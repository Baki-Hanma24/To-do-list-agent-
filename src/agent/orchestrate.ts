import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { schema } from "@/db";
import type { TaskStatus } from "@/db/schema";
import { runAgentDetailed, logEvent, type RunOptions } from "./run";
import { buildReviewPacket, claudeChecker, type CheckFn } from "./checker";

export interface SubAgentOptions extends Omit<RunOptions, "feedback" | "timeBudgetMs"> {
  /** Injected in tests. */
  check?: CheckFn;
  /** Total wall-clock budget for work + checks + fixes. */
  totalBudgetMs?: number;
  /** How many times the sub-agent may fix what the checker found. */
  maxFixes?: number;
}

const CHECK_RESERVE_MS = 45_000;

async function setCheck(db: DB, taskId: number, set: Partial<typeof schema.tasks.$inferInsert>) {
  await db.update(schema.tasks).set({ ...set, updatedAt: new Date() }).where(eq(schema.tasks.id, taskId));
}

/**
 * One task, one sub-agent: the sub-agent does the work, then a separate
 * checker agent reviews it. If the checker finds problems, the sub-agent
 * gets them as feedback and fixes them, then the checker looks again.
 */
export async function runSubAgent(opts: SubAgentOptions): Promise<TaskStatus> {
  const { db, taskId } = opts;
  const check = opts.check ?? claudeChecker;
  const maxFixes = opts.maxFixes ?? 1;
  const deadline = Date.now() + (opts.totalBudgetMs ?? 285_000);
  const budget = () => Math.max(deadline - Date.now() - CHECK_RESERVE_MS, 0);

  await setCheck(db, taskId, { checkStatus: "none", checkNote: "" });
  let feedback: string[] | undefined;

  for (let attempt = 0; ; attempt++) {
    const { status, finished } = await runAgentDetailed({ ...opts, feedback, timeBudgetMs: budget() });
    // Paused, refused, or errored: nothing finished to check yet.
    if (!finished) return status;

    // Not done until the checker agrees: keep it "working" while it reviews.
    await setCheck(db, taskId, { checkStatus: "checking", status: "working" });
    await logEvent(db, taskId, "check", "Checker agent is reviewing the work");
    let verdict;
    try {
      verdict = await check(await buildReviewPacket(db, taskId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logEvent(db, taskId, "error", `Checker failed: ${msg}`);
      await setCheck(db, taskId, { checkStatus: "failed", checkNote: "The checker couldn't run. Take a quick look yourself.", status: "needs_you" });
      return "needs_you";
    }

    if (verdict.pass) {
      await logEvent(db, taskId, "check", `Checker agent: passed. ${verdict.note}`);
      await setCheck(db, taskId, { checkStatus: "passed", checkNote: verdict.note, status });
      return status;
    }

    for (const p of verdict.problems) await logEvent(db, taskId, "check", `Checker found: ${p}`);
    const canFix = attempt < maxFixes && verdict.problems.length > 0 && budget() > 30_000;
    if (!canFix) {
      await setCheck(db, taskId, { checkStatus: "failed", checkNote: verdict.note, status: "needs_you" });
      return "needs_you";
    }
    feedback = verdict.problems;
  }
}

/** Run several sub-agents at the same time, each on its own task. */
export async function runSubAgents(
  db: DB,
  taskIds: number[],
  opts: Omit<SubAgentOptions, "db" | "taskId"> = {},
): Promise<TaskStatus[]> {
  const results = await Promise.allSettled(taskIds.map((taskId) => runSubAgent({ ...opts, db, taskId })));
  return results.map((r) => (r.status === "fulfilled" ? r.value : "needs_you"));
}
