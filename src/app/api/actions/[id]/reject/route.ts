import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { idParam, notFound } from "@/lib/http";
import { refreshTaskStatus } from "@/lib/task-status";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  const db = await getDb();
  const [action] = await db
    .update(schema.pendingActions)
    .set({ status: "rejected", result: "You said no." })
    .where(and(eq(schema.pendingActions.id, id), eq(schema.pendingActions.status, "awaiting")))
    .returning();
  if (!action) return notFound();
  await refreshTaskStatus(db, action.taskId);
  return Response.json({ ok: true });
}
