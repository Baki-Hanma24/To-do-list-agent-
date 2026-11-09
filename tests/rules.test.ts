import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";

const gmail = vi.hoisted(() => ({ createGmailDraft: vi.fn(), sendGmail: vi.fn() }));
vi.mock("@/google/gmail", () => gmail);
vi.mock("@/google/calendar", () => ({ createCalendarEvent: vi.fn() }));

import * as schema from "@/db/schema";
import type { DB } from "@/db";
import { addRule } from "@/agent/rules";
import { buildReviewPacket } from "@/agent/checker";
import { runSubAgent } from "@/agent/orchestrate";
import { rejectAction } from "@/lib/reject-action";
import { testDb, toolUse, message, scripted } from "./helpers";

const RULE = "Always include a price and a link for every option";

const oneStep = () => [
  message([toolUse("set_plan", { steps: ["Do it"] })]),
  message([
    toolUse("create_document", { title: "options", kind: "doc", content: "# Options" }),
    toolUse("update_step", { position: 1, status: "done", note: "ok" }),
    toolUse("finish", { outcome: "done", summary: "Done.", checks: [{ position: 1, ok: true, note: "" }] }),
  ]),
];

async function seed(db: DB) {
  const [t] = await db.insert(schema.tasks).values({ title: "Compare robot vacuums", pile: "agent" }).returning();
  return t.id;
}

const systemOf = (p: { system?: unknown }) => (typeof p.system === "string" ? p.system : JSON.stringify(p.system));

describe("teach the agent", () => {
  it("a saved rule goes into the next sub-agent's prompt and the checker's review", async () => {
    const db = await testDb();
    const id = await seed(db);
    await addRule(db, RULE, id);

    const { create, calls } = scripted(oneStep());
    let packet = "";
    await runSubAgent({ db, taskId: id, create, check: async (p) => ((packet = p), { pass: true, problems: [], note: "ok" }) });

    expect(systemOf(calls[0])).toContain("Rules the user taught you");
    expect(systemOf(calls[0])).toContain(`1. ${RULE}`);
    expect(packet).toContain("RULES THE USER TAUGHT");
    expect(packet).toContain(RULE);
  });

  it("no rules means no rules section", async () => {
    const db = await testDb();
    const id = await seed(db);
    const { create, calls } = scripted(oneStep());
    let packet = "";
    await runSubAgent({ db, taskId: id, create, check: async (p) => ((packet = p), { pass: true, problems: [], note: "ok" }) });
    expect(systemOf(calls[0])).not.toContain("Rules the user taught you");
    expect(packet).not.toContain("RULES THE USER TAUGHT");
  });

  it("a deleted rule stops applying", async () => {
    const db = await testDb();
    const id = await seed(db);
    const rule = await addRule(db, RULE, id);
    await db.delete(schema.rules).where(eq(schema.rules.id, rule.id));
    expect(await buildReviewPacket(db, id)).not.toContain(RULE);
  });

  it("rejecting with a reason teaches a rule; without one it doesn't", async () => {
    const db = await testDb();
    const id = await seed(db);
    const [a, b] = await db
      .insert(schema.pendingActions)
      .values([
        { taskId: id, kind: "gmail_draft", payload: { to: ["a@b.co"], subject: "Hi", body: "x" } },
        { taskId: id, kind: "gmail_draft", payload: { to: ["a@b.co"], subject: "Hi", body: "y" } },
      ])
      .returning();

    const withWhy = await rejectAction(db, a.id, "  Keep emails under 5 sentences  ");
    expect(withWhy.ok && withWhy.rule?.text).toBe("Keep emails under 5 sentences");
    const without = await rejectAction(db, b.id);
    expect(without.ok && without.rule).toBeNull();

    const rules = await db.select().from(schema.rules);
    expect(rules.map((r) => [r.text, r.taskId])).toEqual([["Keep emails under 5 sentences", id]]);
    expect(gmail.createGmailDraft).not.toHaveBeenCalled();
  });

  it("redo with a new rule tells the agent to fix the work and resets documents to draft", async () => {
    const db = await testDb();
    const id = await seed(db);
    await db.insert(schema.documents).values({ taskId: id, title: "old", kind: "doc", content: "# Old", stage: "final" });
    let stageAtCheck = "";
    const { create, calls } = scripted(oneStep());
    await runSubAgent({
      db,
      taskId: id,
      create,
      redoRule: RULE,
      check: async () => {
        stageAtCheck = (await db.select().from(schema.documents).where(eq(schema.documents.title, "old")))[0].stage;
        return { pass: true, problems: [], note: "ok" };
      },
    });
    expect(calls[0].messages[0].content as string).toContain(`Redo whatever doesn't follow it: "${RULE}"`);
    expect(stageAtCheck).toBe("draft");
  });

  it("a rule's task link survives deleting the task", async () => {
    const db = await testDb();
    const id = await seed(db);
    await addRule(db, RULE, id);
    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
    const [r] = await db.select().from(schema.rules);
    expect([r.text, r.taskId]).toEqual([RULE, null]);
  });
});
