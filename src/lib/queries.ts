import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { schema } from "@/db";

// Fully qualified so it refers to the OUTER tasks row inside correlated subqueries.
// A bare ${schema.tasks.id} renders as "id", which a subquery resolves to its own id column.
const taskId = sql.raw(`"tasks"."id"`);

const awaitingCount = sql<number>`(select count(*)::int from ${schema.pendingActions} pa where pa.task_id = ${taskId} and pa.status = 'awaiting')`;

/** Every task plus the counts the board needs. */
export async function listTasks(db: DB) {
  const rows = await db
    .select({
      task: schema.tasks,
      awaiting: awaitingCount,
      stepsTotal: sql<number>`(select count(*)::int from ${schema.steps} s where s.task_id = ${taskId})`,
      stepsDone: sql<number>`(select count(*)::int from ${schema.steps} s where s.task_id = ${taskId} and s.status in ('done','skipped'))`,
      lastEvent: sql<string | null>`(select e.content from ${schema.runEvents} e where e.task_id = ${taskId} order by e.id desc limit 1)`,
    })
    .from(schema.tasks)
    .orderBy(desc(schema.tasks.createdAt), desc(schema.tasks.id));
  return rows.map((r) => ({
    ...r.task,
    awaiting: Number(r.awaiting),
    stepsTotal: Number(r.stepsTotal),
    stepsDone: Number(r.stepsDone),
    lastEvent: r.lastEvent ?? "",
  }));
}

/** Open Agent/Together tasks a sub-agent can start on (not waiting on your approval). */
export async function runnableTaskIds(db: DB, limit: number): Promise<number[]> {
  const rows = await db
    .select({ id: schema.tasks.id })
    .from(schema.tasks)
    .where(and(ne(schema.tasks.pile, "mine"), eq(schema.tasks.status, "todo"), sql`${awaitingCount} = 0`))
    .orderBy(schema.tasks.createdAt, schema.tasks.id)
    .limit(limit);
  return rows.map((r) => r.id);
}
