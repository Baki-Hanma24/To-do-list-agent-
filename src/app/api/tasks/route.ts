import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { badRequest } from "@/lib/http";
import { sortTask } from "@/agent/sort";
import { listTasks } from "@/lib/queries";

export async function GET() {
  const denied = await requireUser();
  if (denied) return denied;
  return Response.json(await listTasks(await getDb()));
}

const createBody = z.object({
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(5000).optional(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const parsed = createBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Give the task a title.");
  const { title, notes = "", due } = parsed.data;

  const sorted = await sortTask(title, notes);
  const db = await getDb();
  const [task] = await db
    .insert(schema.tasks)
    .values({ title, notes, due: due ?? null, pile: sorted.pile, area: sorted.area, sortReason: sorted.reason })
    .returning();
  return Response.json(task, { status: 201 });
}

