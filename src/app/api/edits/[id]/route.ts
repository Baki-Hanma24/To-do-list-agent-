import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { idParam, notFound } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  const db = await getDb();
  const [edit] = await db.select().from(schema.edits).where(eq(schema.edits.id, id));
  return edit ? Response.json(edit) : notFound();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  const db = await getDb();
  await db.delete(schema.edits).where(eq(schema.edits.id, id));
  return new Response(null, { status: 204 });
}
