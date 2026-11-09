import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { DB } from "@/db";
import { schema } from "@/db";
import { anthropic, AGENT_MODEL } from "./client";
import { checkerSystemPrompt } from "./prompt";

export const verdictSchema = z.object({
  pass: z.boolean(),
  /** Specific, fixable problems. Empty when pass is true. */
  problems: z.array(z.string()),
  /** One short sentence for the user. */
  note: z.string(),
});
export type Verdict = z.infer<typeof verdictSchema>;
export type CheckFn = (packet: string) => Promise<Verdict>;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n…[cut]` : s);

/** Everything the sub-agent produced, as one plain-text packet for review. */
export async function buildReviewPacket(db: DB, taskId: number): Promise<string> {
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
  const [steps, docs, actions] = await Promise.all([
    db.select().from(schema.steps).where(eq(schema.steps.taskId, taskId)).orderBy(asc(schema.steps.position)),
    db.select().from(schema.documents).where(eq(schema.documents.taskId, taskId)).orderBy(asc(schema.documents.id)),
    db.select().from(schema.pendingActions).where(eq(schema.pendingActions.taskId, taskId)).orderBy(asc(schema.pendingActions.id)),
  ]);
  const parts = [
    `TASK: ${task.title}`,
    task.notes && `NOTES: ${task.notes}`,
    task.due && `DUE: ${task.due}`,
    `PILE: ${task.pile} (${task.pile === "together" ? "agent does most, user finishes" : "agent finishes alone"})`,
    `AGENT'S SUMMARY: ${task.summary || "(none)"}`,
    "",
    "STEPS:",
    ...(steps.length ? steps.map((s) => `${s.position}. [${s.status}] ${s.text}${s.note ? ` | ${s.note}` : ""}`) : ["(no plan)"]),
    "",
    "DOCUMENTS:",
    ...(docs.length ? docs.map((d) => `--- ${d.kind}: ${d.title} ---\n${clip(d.content, 8000)}`) : ["(none)"]),
    "",
    "EMAILS / EVENTS QUEUED FOR THE USER'S APPROVAL:",
    ...(actions.length
      ? actions.map((a) => `--- ${a.kind} [${a.status}] ---\n${clip(JSON.stringify(a.payload, null, 2), 4000)}`)
      : ["(none)"]),
  ];
  return parts.filter((p) => p !== "" && p !== null && p !== undefined).join("\n");
}

export const claudeChecker: CheckFn = async (packet) => {
  const res = await anthropic().beta.messages.parse({
    model: AGENT_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(verdictSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: checkerSystemPrompt(),
    messages: [{ role: "user", content: packet }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    return { pass: false, problems: [], note: "The checker couldn't review this one. Take a quick look yourself." };
  }
  return res.parsed_output;
};
