import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

// Any call into Google from the agent would hit these mocks.
const gmail = vi.hoisted(() => ({ createGmailDraft: vi.fn(async () => "Draft saved"), sendGmail: vi.fn(async () => "Email sent") }));
const calendar = vi.hoisted(() => ({ createCalendarEvent: vi.fn(async () => "Event added") }));
vi.mock("@/google/gmail", () => gmail);
vi.mock("@/google/calendar", () => calendar);
const fetchSpy = vi.fn(async () => new Response("{}"));
vi.stubGlobal("fetch", fetchSpy);

import * as schema from "@/db/schema";
import { runAgent } from "@/agent/run";
import { approveAndExecute } from "@/lib/execute-action";
import { testDb, toolUse, message, scripted } from "./helpers";

const invite = { to: ["sam@example.com"], subject: "You're invited!", body: "Party on Saturday at 7." };

async function seedTask(db: Awaited<ReturnType<typeof testDb>>, pile: schema.Pile = "agent") {
  const [t] = await db.insert(schema.tasks).values({ title: "Plan my 40th birthday: venue, cake, invites", pile }).returning();
  return t.id;
}

function birthdayScript() {
  return scripted([
    message([toolUse("set_plan", { steps: ["Search venues", "Pick a cake", "Draft the invites"] })]),
    message([toolUse("update_step", { position: 1, status: "done", note: "Found 3 venues" }),
      toolUse("create_document", { title: "Venue options", kind: "doc", content: "# Venues\n- The Loft" })]),
    message([toolUse("update_step", { position: 2, status: "done", note: "Chocolate, local bakery" })]),
    message([toolUse("propose_email_send", invite), toolUse("propose_calendar_event", { summary: "40th party", start: "2026-12-05T19:00:00", end: "2026-12-05T23:00:00" }),
      toolUse("update_step", { position: 3, status: "doing", note: "Invite waiting for your OK" })]),
    message([toolUse("finish", { outcome: "done", summary: "Venues and cake picked. Invite is ready for your OK.",
      checks: [{ position: 1, ok: true, note: "3 venues" }, { position: 2, ok: true, note: "cake" }, { position: 3, ok: true, note: "queued" }] })]),
  ]);
}

describe("agent run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plans, works, checks, and only QUEUES email/calendar actions", async () => {
    const db = await testDb();
    const id = await seedTask(db);
    const { create, calls } = birthdayScript();

    const status = await runAgent({ db, taskId: id, create });

    expect(status).toBe("needs_you"); // waiting on approvals
    const steps = await db.select().from(schema.steps).where(eq(schema.steps.taskId, id));
    expect(steps.map((s) => s.status)).toEqual(["done", "done", "doing"]);
    const docs = await db.select().from(schema.documents);
    expect(docs).toHaveLength(1);

    const actions = await db.select().from(schema.pendingActions);
    expect(actions.map((a) => [a.kind, a.status])).toEqual([["gmail_send", "awaiting"], ["calendar_event", "awaiting"]]);

    // The approval gate: nothing reached Google.
    expect(gmail.sendGmail).not.toHaveBeenCalled();
    expect(gmail.createGmailDraft).not.toHaveBeenCalled();
    expect(calendar.createCalendarEvent).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Request shape sanity.
    expect(calls[0].model).toBe("claude-opus-5-5");
    expect(calls[0].thinking).toEqual({ type: "adaptive" });
    expect(calls[0].tools?.some((t) => "type" in t && t.type === "web_search_20260209")).toBe(true);
    // History is append-only: each request extends the previous one.
    expect(calls[1].messages.slice(0, calls[0].messages.length)).toEqual(calls[0].messages);
  });

  it("calls Google only after approval, and never for rejected actions", async () => {
    const db = await testDb();
    const id = await seedTask(db);
    await runAgent({ db, taskId: id, create: birthdayScript().create });
    const [send, event] = await db.select().from(schema.pendingActions).orderBy(schema.pendingActions.id);

    // Reject the calendar event.
    await db.update(schema.pendingActions).set({ status: "rejected" }).where(eq(schema.pendingActions.id, event.id));
    const rejectedTry = await approveAndExecute(db, event.id);
    expect(rejectedTry.ok).toBe(false);
    expect(calendar.createCalendarEvent).not.toHaveBeenCalled();

    // Approve the email.
    const res = await approveAndExecute(db, send.id);
    expect(res).toEqual({ ok: true, message: "Email sent" });
    expect(gmail.sendGmail).toHaveBeenCalledTimes(1);
    expect(gmail.sendGmail).toHaveBeenCalledWith(invite);

    // Double-tap does not send twice.
    await approveAndExecute(db, send.id);
    expect(gmail.sendGmail).toHaveBeenCalledTimes(1);

    // Nothing left waiting, so the agent task is done.
    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id));
    expect(task.status).toBe("done");
  });

  it("pushes back when it tries to finish with steps untouched", async () => {
    const db = await testDb();
    const id = await seedTask(db);
    const finish = { outcome: "done", summary: "Done.", checks: [] };
    const { create, calls } = scripted([
      message([toolUse("set_plan", { steps: ["One", "Two"] })]),
      message([toolUse("update_step", { position: 1, status: "done", note: "ok" }), toolUse("finish", finish)]),
      message([toolUse("update_step", { position: 2, status: "done", note: "ok" }), toolUse("finish", finish)]),
    ]);
    const status = await runAgent({ db, taskId: id, create });
    expect(status).toBe("done");
    // The first finish came back as an error telling it to keep going.
    const third = calls[2].messages.at(-1)!;
    expect(JSON.stringify(third.content)).toContain("Not finished");
  });

  it("leaves Together tasks for you to finish", async () => {
    const db = await testDb();
    const id = await seedTask(db, "together");
    const { create } = scripted([
      message([toolUse("set_plan", { steps: ["Compare flights"] })]),
      message([toolUse("update_step", { position: 1, status: "done", note: "3 options" }),
        toolUse("finish", { outcome: "done", summary: "Pick one and book it.", checks: [{ position: 1, ok: true, note: "" }] })]),
    ]);
    expect(await runAgent({ db, taskId: id, create })).toBe("needs_you");
  });

  it("rejects invalid email addresses from the model", async () => {
    const db = await testDb();
    const id = await seedTask(db);
    const { create, calls } = scripted([
      message([toolUse("propose_gmail_draft", { to: ["not-an-email"], subject: "Hi", body: "x" })]),
      message([toolUse("finish", { outcome: "needs_you", summary: "Need Sam's email.", checks: [] })]),
    ]);
    await runAgent({ db, taskId: id, create });
    expect(await db.select().from(schema.pendingActions)).toHaveLength(0);
    expect(JSON.stringify(calls[1].messages.at(-1)!.content)).toContain("Invalid input");
  });

  it("stops cleanly on a refusal", async () => {
    const db = await testDb();
    const id = await seedTask(db);
    const { create } = scripted([message([], "refusal")]);
    expect(await runAgent({ db, taskId: id, create })).toBe("needs_you");
  });
});
