import type * as Beta from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { asc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import { schema } from "@/db";
import type { EventType, TaskStatus } from "@/db/schema";
import { anthropic, AGENT_MODEL } from "./client";
import { agentSystemPrompt } from "./prompt";
import { TOOL_DEFS, runTool, hasAwaitingActions, type ToolContext } from "./tools";

type CreateFn = (params: Beta.MessageCreateParamsNonStreaming) => Promise<Beta.BetaMessage>;

export interface RunOptions {
  db: DB;
  taskId: number;
  timeZone?: string;
  /** Injected in tests. Defaults to the real Anthropic client. */
  create?: CreateFn;
  maxIterations?: number;
  /** Stop and let the user continue before the hosting time limit hits. */
  timeBudgetMs?: number;
  /** Problems the checker agent found on a previous pass. */
  feedback?: string[];
}

const WEB_SEARCH: Beta.BetaWebSearchTool20260209 = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 8,
};

export async function logEvent(db: DB, taskId: number, type: EventType, content: string) {
  await db.insert(schema.runEvents).values({ taskId, type, content: content.slice(0, 2000) });
}

async function setStatus(db: DB, taskId: number, status: TaskStatus, summary?: string) {
  await db
    .update(schema.tasks)
    .set({ status, updatedAt: new Date(), ...(summary !== undefined ? { summary } : {}) })
    .where(eq(schema.tasks.id, taskId));
}

function describeServerTool(block: Beta.BetaContentBlock): string | null {
  if (block.type === "server_tool_use" && block.name === "web_search") {
    const q = (block.input as { query?: string }).query;
    return q ? `Searching the web: ${q}` : "Searching the web";
  }
  return null;
}

async function buildKickoff(db: DB, taskId: number, timeZone: string, feedback?: string[]): Promise<string> {
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
  const steps = await db
    .select()
    .from(schema.steps)
    .where(eq(schema.steps.taskId, taskId))
    .orderBy(asc(schema.steps.position));
  const today = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date());

  const lines = [
    `Today is ${today} (${timeZone}).`,
    "",
    `Task: ${task.title}`,
    task.notes ? `Notes: ${task.notes}` : "",
    task.due ? `Due: ${task.due}` : "",
    `Area: ${task.area}. Pile: ${task.pile === "together" ? "together (do most of it; the user finishes)" : "agent (finish it yourself)"}.`,
  ];
  if (steps.length) {
    lines.push(
      "",
      "A plan already exists from an earlier run. Continue it; don't redo finished steps:",
      ...steps.map((s) => `${s.position}. [${s.status}] ${s.text}${s.note ? ` (${s.note})` : ""}`),
    );
  }
  if (feedback?.length) {
    lines.push(
      "",
      "A separate checker agent reviewed your work and found these problems. Fix every one (update or add steps and documents as needed), then call finish again:",
      ...feedback.map((f) => `- ${f}`),
    );
  }
  return lines.filter((l) => l !== "").join("\n");
}

/**
 * The agent loop: plan → use tools → self-check → finish.
 * Every step is written to the DB so the UI can show live progress, and so a
 * run that stops early (time limit) can pick up where it left off.
 */
export async function runAgent(opts: RunOptions): Promise<TaskStatus> {
  return (await runAgentDetailed(opts)).status;
}

export interface RunResult {
  status: TaskStatus;
  /** True when the agent called finish (so there is finished work to check). */
  finished: boolean;
}

export async function runAgentDetailed(opts: RunOptions): Promise<RunResult> {
  const { db, taskId } = opts;
  const timeZone = opts.timeZone || "UTC";
  const create: CreateFn = opts.create ?? ((p) => anthropic().beta.messages.create(p));
  const maxIterations = opts.maxIterations ?? 30;
  const deadline = Date.now() + (opts.timeBudgetMs ?? 260_000);
  // Built once per run from /workflows, /templates and /resources.
  const system = agentSystemPrompt();

  const ctx: ToolContext = { db, taskId, finishRejections: 0 };
  await setStatus(db, taskId, "working");
  await logEvent(db, taskId, "thought", opts.feedback?.length ? "Fixing what the checker found" : "Starting work");

  const messages: Beta.BetaMessageParam[] = [
    { role: "user", content: await buildKickoff(db, taskId, timeZone, opts.feedback) },
  ];

  try {
    for (let i = 0; i < maxIterations && !ctx.finished; i++) {
      if (Date.now() > deadline) {
        await logEvent(db, taskId, "thought", "Paused to stay within the time limit. Tap “Keep going” to continue.");
        await setStatus(db, taskId, "todo");
        return { status: "todo", finished: false };
      }

      const response = await create({
        model: AGENT_MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        tools: [WEB_SEARCH, ...TOOL_DEFS],
        messages,
      });

      if (response.stop_reason === "refusal") {
        await logEvent(db, taskId, "error", "Claude declined this task. Try rewording it.");
        await setStatus(db, taskId, "needs_you", "Claude declined this task. Try rewording it.");
        return { status: "needs_you", finished: false };
      }

      // Append the assistant turn unchanged (thinking blocks included).
      messages.push({ role: "assistant", content: response.content as Beta.BetaContentBlockParam[] });

      for (const block of response.content) {
        const serverLog = describeServerTool(block);
        if (serverLog) await logEvent(db, taskId, "tool", serverLog);
        if (block.type === "text" && block.text.trim()) await logEvent(db, taskId, "thought", block.text.trim());
      }

      if (response.stop_reason === "pause_turn") continue;

      const toolUses = response.content.filter((b): b is Beta.BetaToolUseBlock => b.type === "tool_use");

      if (toolUses.length === 0) {
        if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
          messages.push({ role: "user", content: "Keep going. When everything is done and checked, call finish." });
        }
        continue;
      }

      const results: Beta.BetaToolResultBlockParam[] = [];
      for (const use of toolUses) {
        if (response.stop_reason === "max_tokens" && use === toolUses[toolUses.length - 1]) {
          results.push({ type: "tool_result", tool_use_id: use.id, content: "Output was cut off. Try again, shorter.", is_error: true });
          continue;
        }
        const out = await runTool(use.name, use.input, ctx);
        if (out.log) await logEvent(db, taskId, out.isError ? "check" : "tool", out.log);
        results.push({ type: "tool_result", tool_use_id: use.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logEvent(db, taskId, "error", `Stopped: ${msg}`);
    await setStatus(db, taskId, "needs_you", "Something went wrong. Tap “Keep going” to retry.");
    return { status: "needs_you", finished: false };
  }

  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
  const waiting = await hasAwaitingActions(db, taskId);
  const fin = ctx.finished;

  if (!fin) {
    await logEvent(db, taskId, "check", "Ran out of steps before finishing. Tap “Keep going” to continue.");
    await setStatus(db, taskId, "todo");
    return { status: "todo", finished: false };
  }

  for (const c of fin.checks) {
    await logEvent(db, taskId, "check", `${c.ok ? "✓" : "✗"} Step ${c.position}: ${c.note}`);
  }

  const status: TaskStatus =
    waiting || fin.outcome === "needs_you" || task.pile === "together" ? "needs_you" : "done";
  await setStatus(db, taskId, status, fin.summary);
  return { status, finished: true };
}
