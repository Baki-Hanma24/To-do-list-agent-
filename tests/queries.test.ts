import { describe, it, expect } from "vitest";
import * as schema from "@/db/schema";
import { listTasks, runnableTaskIds } from "@/lib/queries";
import { testDb } from "./helpers";

describe("board queries", () => {
  it("counts steps, approvals and latest activity per task (not across tasks)", async () => {
    const db = await testDb();
    const [a, b, mine, waiting] = await db
      .insert(schema.tasks)
      .values([
        { title: "A", pile: "agent" },
        { title: "B", pile: "together" },
        { title: "Mine", pile: "mine" },
        { title: "Waiting", pile: "agent" },
      ])
      .returning();
    await db.insert(schema.steps).values([
      { taskId: a.id, position: 1, text: "1", status: "done" },
      { taskId: a.id, position: 2, text: "2", status: "done" },
      { taskId: a.id, position: 3, text: "3" },
      { taskId: b.id, position: 1, text: "1", status: "skipped" },
    ]);
    await db.insert(schema.runEvents).values([
      { taskId: a.id, type: "tool", content: "old" },
      { taskId: b.id, type: "tool", content: "B's latest" },
      { taskId: a.id, type: "tool", content: "Searching the web: x" },
    ]);
    await db.insert(schema.pendingActions).values({ taskId: waiting.id, kind: "gmail_draft", payload: {} });

    const byTitle = Object.fromEntries((await listTasks(db)).map((t) => [t.title, t]));
    expect([byTitle.A.stepsDone, byTitle.A.stepsTotal, byTitle.A.lastEvent]).toEqual([2, 3, "Searching the web: x"]);
    expect([byTitle.B.stepsDone, byTitle.B.stepsTotal, byTitle.B.lastEvent]).toEqual([1, 1, "B's latest"]);
    expect([byTitle.Waiting.awaiting, byTitle.A.awaiting]).toEqual([1, 0]);

    // Run all skips Mine tasks and tasks waiting on your approval.
    expect((await runnableTaskIds(db, 8)).sort()).toEqual([a.id, b.id].sort());
    expect(await runnableTaskIds(db, 1)).toHaveLength(1);
    expect(mine.id).toBeGreaterThan(0);
  });
});
