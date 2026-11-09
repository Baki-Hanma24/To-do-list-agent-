import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { badRequest } from "@/lib/http";
import { hasAnthropicKey } from "@/agent/client";
import { checkFrames, editInput, makeEditPlan, MAX_FRAMES } from "@/agent/editor";

// One vision call over up to 36 frames; give it room.
export const maxDuration = 300;

export async function GET() {
  const denied = await requireUser();
  if (denied) return denied;
  const db = await getDb();
  const rows = await db
    .select({ id: schema.edits.id, title: schema.edits.title, frameCount: schema.edits.frameCount, createdAt: schema.edits.createdAt })
    .from(schema.edits)
    .orderBy(desc(schema.edits.id));
  return Response.json(rows);
}

export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  if (!hasAnthropicKey()) return badRequest("Add ANTHROPIC_API_KEY to use the editor.");
  const parsed = editInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(`Add 1 to ${MAX_FRAMES} frames, and keep notes under 4,000 characters.`);
  const frameError = checkFrames(parsed.data.frames);
  if (frameError) return badRequest(frameError);
  try {
    const edit = await makeEditPlan(await getDb(), parsed.data);
    return Response.json(edit, { status: 201 });
  } catch (err) {
    console.error("edit plan failed", err);
    return Response.json({ error: err instanceof Error ? err.message : "The editor failed. Try again." }, { status: 502 });
  }
}
