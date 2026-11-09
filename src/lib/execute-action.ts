/**
 * The ONLY place that talks to Gmail / Calendar.
 * Imported only by the approve API route, which runs after you tap Approve.
 * The agent can never reach this code: its tools just queue pending actions.
 */
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import { schema } from "@/db";
import { emailPayload, calendarPayload } from "@/lib/payloads";
import { createGmailDraft, sendGmail } from "@/google/gmail";
import { createCalendarEvent } from "@/google/calendar";
import { refreshTaskStatus } from "@/lib/task-status";

export async function approveAndExecute(
  db: DB,
  actionId: number,
  edited?: Record<string, unknown>,
): Promise<{ ok: boolean; message: string }> {
  // Claim the action atomically so a double-tap can't run it twice.
  const [action] = await db
    .update(schema.pendingActions)
    .set({ status: "approved", ...(edited ? { payload: edited } : {}) })
    .where(and(eq(schema.pendingActions.id, actionId), eq(schema.pendingActions.status, "awaiting")))
    .returning();
  if (!action) return { ok: false, message: "This action was already handled." };

  let ok = true;
  let message: string;
  try {
    switch (action.kind) {
      case "gmail_draft":
        message = await createGmailDraft(emailPayload.parse(action.payload));
        break;
      case "gmail_send":
        message = await sendGmail(emailPayload.parse(action.payload));
        break;
      case "calendar_event":
        message = await createCalendarEvent(calendarPayload.parse(action.payload));
        break;
      default:
        throw new Error(`Unknown action kind: ${action.kind}`);
    }
  } catch (err) {
    ok = false;
    message = err instanceof Error ? err.message : String(err);
  }

  // On failure, put it back in the queue so you can fix the problem and tap Approve again.
  await db
    .update(schema.pendingActions)
    .set({ status: ok ? "done" : "awaiting", result: message })
    .where(eq(schema.pendingActions.id, actionId));
  await refreshTaskStatus(db, action.taskId);
  return { ok, message };
}
