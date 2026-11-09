import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { PILES, AREAS, TASK_STATUSES } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { badRequest, idParam, notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  const db = await getDb();
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
  if (!task) return notFound();
  const [steps, events, actions, documents] = await Promise.all([
    db.select().from(schema.steps).where(eq(schema.steps.taskId, id)).orderBy(asc(schema.steps.position)),
    db.select().from(schema.runEvents).where(eq(schema.runEvents.taskId, id)).orderBy(asc(schema.runEvents.id)),
    db.select().from(schema.pendingActions).where(eq(schema.pendingActions.taskId, id)).orderBy(asc(schema.pendingActions.id)),
    db.select().from(schema.documents).where(eq(schema.documents.taskId, id)).orderBy(asc(schema.documents.id)),
  ]);
  return Response.json({ task, steps, events, actions, documents });
}

const patchBody = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  notes: z.string().max(5000).optional(),
  pile: z.enum(PILES).optional(),
  area: z.enum(AREAS).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  const parsed = patchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid update.");
  const db = await getDb();
  const [task] = await db
    .update(schema.tasks)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schema.tasks.id, id))
    .returning();
  return task ? Response.json(task) : notFound();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  const db = await getDb();
  await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  return new Response(null, { status: 204 });
}
