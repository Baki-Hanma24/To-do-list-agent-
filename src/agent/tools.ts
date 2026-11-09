import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db";
import { schema } from "@/db";
import { DOC_KINDS, STEP_STATUSES } from "@/db/schema";
import { emailPayload, calendarPayload } from "@/lib/payloads";

type ToolDef = Anthropic.Beta.BetaTool;

const obj = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});
const str = (description: string) => ({ type: "string", description });
const strArr = (description: string) => ({ type: "array", items: { type: "string" }, description });

const emailProps = {
  to: strArr("Recipient email addresses"),
  cc: strArr("CC addresses (optional)"),
  subject: str("Subject line"),
  body: str("Plain-text body, ready to send"),
};

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "set_plan",
    description: "Write the step-by-step plan for this task. Call once, before working.",
    strict: true,
    input_schema: obj({ steps: strArr("2-7 short steps, each starting with a verb") }, ["steps"]),
  },
  {
    name: "add_step",
    description: "Add one more step to the end of the plan if you discover extra work.",
    strict: true,
    input_schema: obj({ text: str("The new step") }, ["text"]),
  },
  {
    name: "update_step",
    description:
      'Update a step. Use "doing" when starting it or while it waits on the user\'s approval, "done" when finished, "skipped" with a reason if it can\'t be done.',
    strict: true,
    input_schema: obj(
      {
        position: { type: "integer", description: "Step number (1-based)" },
        status: { type: "string", enum: [...STEP_STATUSES] },
        note: str("One short line: what you found or made"),
      },
      ["position", "status", "note"],
    ),
  },
  {
    name: "create_document",
    description:
      'Save a document the user can open and download. kind "doc" = markdown, "checklist" = markdown "- [ ]" list, "sheet" = CSV with a header row.',
    strict: true,
    input_schema: obj(
      { title: str("Short title"), kind: { type: "string", enum: [...DOC_KINDS] }, content: str("Full content") },
      ["title", "kind", "content"],
    ),
  },
  {
    name: "propose_gmail_draft",
    description:
      "Ask the user to approve saving this email as a Gmail draft. Nothing happens until they approve.",
    input_schema: obj(emailProps, ["to", "subject", "body"]),
  },
  {
    name: "propose_email_send",
    description:
      "Ask the user to approve SENDING this email from their Gmail. Use only when the task clearly asks to send. Nothing is sent until they approve.",
    input_schema: obj(emailProps, ["to", "subject", "body"]),
  },
  {
    name: "propose_calendar_event",
    description:
      "Ask the user to approve adding an event to their Google Calendar. Nothing is added until they approve.",
    input_schema: obj(
      {
        summary: str("Event title"),
        start: str("YYYY-MM-DD for all-day, or ISO 8601 date-time like 2026-11-20T18:00:00"),
        end: str("Same format as start"),
        timeZone: str("IANA time zone, e.g. America/Chicago"),
        location: str("Optional location"),
        description: str("Optional details"),
        attendees: strArr("Optional guest emails"),
      },
      ["summary", "start", "end"],
    ),
  },
  {
    name: "finish",
    description:
      'Call last. Check your work: one check per step. outcome "needs_you" if the user must decide, approve, pay, or give missing info.',
    strict: true,
    input_schema: obj(
      {
        outcome: { type: "string", enum: ["done", "needs_you"] },
        summary: str("One or two plain sentences for the user"),
        checks: {
          type: "array",
          items: obj(
            {
              position: { type: "integer" },
              ok: { type: "boolean" },
              note: str("Why it's done, or what's missing"),
            },
            ["position", "ok", "note"],
          ),
        },
      },
      ["outcome", "summary", "checks"],
    ),
  },
];

const inputs = {
  set_plan: z.object({ steps: z.array(z.string().min(1)).min(1).max(12) }),
  add_step: z.object({ text: z.string().min(1) }),
  update_step: z.object({
    position: z.number().int().min(1),
    status: z.enum(STEP_STATUSES),
    note: z.string(),
  }),
  create_document: z.object({ title: z.string().min(1), kind: z.enum(DOC_KINDS), content: z.string().min(1) }),
  propose_gmail_draft: emailPayload,
  propose_email_send: emailPayload,
  propose_calendar_event: calendarPayload,
  finish: z.object({
    outcome: z.enum(["done", "needs_you"]),
    summary: z.string().min(1),
    checks: z.array(z.object({ position: z.number().int(), ok: z.boolean(), note: z.string() })),
  }),
};

export type ToolName = keyof typeof inputs;
export type FinishInput = z.infer<typeof inputs.finish>;

export interface ToolContext {
  db: DB;
  taskId: number;
  /** Set when finish is accepted. */
  finished?: FinishInput;
  finishRejections: number;
}

export interface ToolOutcome {
  content: string;
  isError?: boolean;
  /** Short line for the activity feed. */
  log?: string;
}

async function stepCount(ctx: ToolContext) {
  return (await ctx.db.select({ id: schema.steps.id }).from(schema.steps).where(eq(schema.steps.taskId, ctx.taskId)))
    .length;
}

/**
 * Runs one client tool. Note what is NOT here: no Gmail or Calendar calls.
 * The propose_* tools only insert a pending_actions row for the user to approve.
 */
export async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  if (!(name in inputs)) return { content: `Unknown tool: ${name}`, isError: true };
  const parsed = inputs[name as ToolName].safeParse(rawInput);
  if (!parsed.success) {
    return { content: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, isError: true };
  }
  const { db, taskId } = ctx;

  switch (name as ToolName) {
    case "set_plan": {
      const { steps } = parsed.data as z.infer<typeof inputs.set_plan>;
      if ((await stepCount(ctx)) > 0) {
        return { content: "A plan already exists. Use update_step or add_step.", isError: true };
      }
      await db.insert(schema.steps).values(steps.map((text, i) => ({ taskId, position: i + 1, text })));
      return { content: `Plan saved with ${steps.length} steps.`, log: `Made a ${steps.length}-step plan` };
    }
    case "add_step": {
      const { text } = parsed.data as z.infer<typeof inputs.add_step>;
      const position = (await stepCount(ctx)) + 1;
      await db.insert(schema.steps).values({ taskId, position, text });
      return { content: `Added step ${position}.`, log: `Added step: ${text}` };
    }
    case "update_step": {
      const { position, status, note } = parsed.data as z.infer<typeof inputs.update_step>;
      const updated = await db
        .update(schema.steps)
        .set({ status, note })
        .where(and(eq(schema.steps.taskId, taskId), eq(schema.steps.position, position)))
        .returning();
      if (updated.length === 0) return { content: `No step ${position}.`, isError: true };
      return {
        content: "OK",
        log: status === "done" ? `✓ ${updated[0].text}` : status === "doing" ? `Working on: ${updated[0].text}` : undefined,
      };
    }
    case "create_document": {
      const doc = parsed.data as z.infer<typeof inputs.create_document>;
      const [row] = await db.insert(schema.documents).values({ taskId, ...doc }).returning();
      return { content: `Saved document #${row.id}.`, log: `Created ${doc.kind}: ${doc.title}` };
    }
    case "propose_gmail_draft":
    case "propose_email_send":
    case "propose_calendar_event": {
      const kind =
        name === "propose_gmail_draft" ? "gmail_draft" : name === "propose_email_send" ? "gmail_send" : "calendar_event";
      await db.insert(schema.pendingActions).values({
        taskId,
        kind,
        payload: parsed.data as Record<string, unknown>,
      });
      return {
        content:
          "Queued for the user's approval. It has NOT been done yet. Mark the related step \"doing\" and tell the user it is waiting for approval.",
        log: kind === "calendar_event" ? "Calendar event ready for your OK" : "Email ready for your OK",
      };
    }
    case "finish": {
      const fin = parsed.data as FinishInput;
      const open = await db
        .select()
        .from(schema.steps)
        .where(and(eq(schema.steps.taskId, taskId), eq(schema.steps.status, "todo")))
        .orderBy(asc(schema.steps.position));
      // Keep going until done: push back (twice at most) if steps are still untouched.
      if (fin.outcome === "done" && open.length > 0 && ctx.finishRejections < 2) {
        ctx.finishRejections++;
        return {
          content: `Not finished: step(s) ${open.map((s) => s.position).join(", ")} are still "todo". Do them, or mark them "skipped" with a reason, then call finish again.`,
          isError: true,
          log: "Self-check found unfinished steps; continuing",
        };
      }
      ctx.finished = fin;
      const failed = fin.checks.filter((c) => !c.ok).length;
      return {
        content: "Finished.",
        log: failed ? `Checked: ${failed} step(s) need you` : `Checked: all ${fin.checks.length} steps are done`,
      };
    }
  }
}

export async function hasAwaitingActions(db: DB, taskId: number): Promise<boolean> {
  const rows = await db
    .select({ id: schema.pendingActions.id })
    .from(schema.pendingActions)
    .where(and(eq(schema.pendingActions.taskId, taskId), eq(schema.pendingActions.status, "awaiting")));
  return rows.length > 0;
}

