import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { badRequest } from "@/lib/http";
import { runSubAgents } from "@/agent/orchestrate";
import { hasAnthropicKey } from "@/agent/client";
import { runnableTaskIds } from "@/lib/queries";

export const maxDuration = 300;

/** Most sub-agents to run at once. */
const MAX_PARALLEL = 8;

/**
 * Run all: one sub-agent per open Agent/Together task, all at the same time.
 * Skips tasks that are waiting on your approval.
 */
export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  if (!hasAnthropicKey()) return badRequest("Add ANTHROPIC_API_KEY to run the agents.");
  const body = (await req.json().catch(() => ({}))) as { timeZone?: string };
  const db = await getDb();

  const candidates = await runnableTaskIds(db, MAX_PARALLEL);
  if (candidates.length === 0) return Response.json({ ids: [] });

  // Claim them so a second tap can't double-start.
  const claimed = await db
    .update(schema.tasks)
    .set({ status: "working", updatedAt: new Date() })
    .where(and(inArray(schema.tasks.id, candidates), eq(schema.tasks.status, "todo")))
    .returning({ id: schema.tasks.id });
  const ids = claimed.map((c) => c.id);

  after(() => runSubAgents(db, ids, { timeZone: body.timeZone }).catch(console.error));
  return Response.json({ ids }, { status: 202 });
}
