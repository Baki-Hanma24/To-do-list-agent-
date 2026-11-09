import { after } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { badRequest, idParam, notFound } from "@/lib/http";
import { runSubAgent } from "@/agent/orchestrate";
import { hasAnthropicKey } from "@/agent/client";

// The sub-agent (and its checker) keep working after this responds; Vercel allows up to 300s.
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  if (!hasAnthropicKey()) return badRequest("Add ANTHROPIC_API_KEY to run the agent.");

  const body = (await req.json().catch(() => ({}))) as { timeZone?: string };
  const db = await getDb();

  // Claim the task so two taps can't start two runs.
  const [task] = await db
    .update(schema.tasks)
    .set({ status: "working", updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, id), ne(schema.tasks.status, "working"), ne(schema.tasks.pile, "mine")))
    .returning();
  if (!task) return Response.json({ error: "Already running, or this task is yours to do." }, { status: 409 });

  after(() => runSubAgent({ db, taskId: id, timeZone: body.timeZone }).catch(console.error));
  return Response.json({ ok: true }, { status: 202 });
}
