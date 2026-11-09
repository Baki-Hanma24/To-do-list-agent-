import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import { schema } from "@/db";
import { refreshTaskStatus } from "@/lib/task-status";
import { addRule, ruleText } from "@/agent/rules";

/**
 * Reject a queued email/event. If you say why, that reason becomes a rule
 * every future sub-agent and checker follows.
 */
export async function rejectAction(db: DB, actionId: number, reason?: string) {
  const why = reason?.trim() ?? "";
  if (why && !ruleText.safeParse(why).success) return { ok: false as const, error: "Keep the reason between 3 and 500 characters." };

  const [action] = await db
    .update(schema.pendingActions)
    .set({ status: "rejected", result: why ? `You said no: ${why}` : "You said no." })
    .where(and(eq(schema.pendingActions.id, actionId), eq(schema.pendingActions.status, "awaiting")))
    .returning();
  if (!action) return { ok: false as const, error: "Not found" };

  const rule = why ? await addRule(db, why, action.taskId) : null;
  await refreshTaskStatus(db, action.taskId);
  return { ok: true as const, rule };
}
