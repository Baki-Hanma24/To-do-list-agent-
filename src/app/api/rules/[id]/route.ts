import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { badRequest, idParam, notFound } from "@/lib/http";
import { ruleText } from "@/agent/rules";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  const parsed = z.object({ text: ruleText }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Write the rule in 3 to 500 characters.");
  const db = await getDb();
  const [rule] = await db.update(schema.rules).set({ text: parsed.data.text }).where(eq(schema.rules.id, id)).returning();
  return rule ? Response.json(rule) : notFound();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  const db = await getDb();
  await db.delete(schema.rules).where(eq(schema.rules.id, id));
  return new Response(null, { status: 204 });
}
