import { getDb } from "@/db";
import { requireUser } from "@/lib/session";
import { badRequest, idParam, notFound } from "@/lib/http";
import { rejectAction } from "@/lib/reject-action";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const result = await rejectAction(await getDb(), id, typeof body.reason === "string" ? body.reason : undefined);
  if (!result.ok) return result.error === "Not found" ? notFound() : badRequest(result.error);
  return Response.json({ ok: true, rule: result.rule });
}
