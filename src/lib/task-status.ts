import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import { schema } from "@/db";

/**
 * After an approval or rejection: if nothing is waiting on you anymore and the
 * agent finished its run, mark the task done.
 */
export async function refreshTaskStatus(db: DB, taskId: number): Promise<void> {
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
  if (!task || task.status !== "needs_you" || task.pile !== "agent") return;
  const waiting = await db
    .select({ id: schema.pendingActions.id })
    .from(schema.pendingActions)
    .where(and(eq(schema.pendingActions.taskId, taskId), eq(schema.pendingActions.status, "awaiting")));
  if (waiting.length === 0) {
    await db
      .update(schema.steps)
      .set({ status: "done" })
      .where(and(eq(schema.steps.taskId, taskId), eq(schema.steps.status, "doing")));
    await db
      .update(schema.tasks)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(schema.tasks.id, taskId));
  }
}
