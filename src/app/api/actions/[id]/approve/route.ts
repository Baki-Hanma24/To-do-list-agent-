import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { badRequest, idParam, notFound } from "@/lib/http";
import { emailPayload, calendarPayload } from "@/lib/payloads";
import { approveAndExecute } from "@/lib/execute-action";

type Ctx = { params: Promise<{ id: string }> };

/** The one route that can send email or add calendar events, and only on your tap. */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();

  const db = await getDb();
  const [action] = await db.select().from(schema.pendingActions).where(eq(schema.pendingActions.id, id));
  if (!action) return notFound();

  // Optional edits from the approval card.
  const body = (await req.json().catch(() => ({}))) as { payload?: unknown };
  let edited: Record<string, unknown> | undefined;
  if (body.payload !== undefined) {
    const schemaFor = action.kind === "calendar_event" ? calendarPayload : emailPayload;
    const parsed = schemaFor.safeParse(body.payload);
    if (!parsed.success) return badRequest("Check the email addresses and fields.");
    edited = parsed.data;
  }

  const result = await approveAndExecute(db, id, edited);
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
