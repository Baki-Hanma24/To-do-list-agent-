import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { idParam, notFound } from "@/lib/http";
import { documentFilename } from "@/lib/files";

type Ctx = { params: Promise<{ id: string }> };

/** Download a document the agent made (.md, or .csv for sheets). */
export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireUser();
  if (denied) return denied;
  const id = idParam((await params).id);
  if (!id) return notFound();
  const db = await getDb();
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
  if (!doc) return notFound();
  const type = doc.kind === "sheet" ? "text/csv" : "text/markdown";
  const filename = documentFilename(doc.title, doc.kind);
  return new Response(doc.content, {
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
