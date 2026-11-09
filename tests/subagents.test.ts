import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";

const gmail = vi.hoisted(() => ({ createGmailDraft: vi.fn(), sendGmail: vi.fn() }));
vi.mock("@/google/gmail", () => gmail);
vi.mock("@/google/calendar", () => ({ createCalendarEvent: vi.fn() }));

import * as schema from "@/db/schema";
import type { DB } from "@/db";
import { runSubAgent, runSubAgents } from "@/agent/orchestrate";
import { buildReviewPacket, type Verdict } from "@/agent/checker";
import { testDb, toolUse, message, scripted } from "./helpers";

async function seed(db: DB, title: string) {
  const [t] = await db.insert(schema.tasks).values({ title, pile: "agent" }).returning();
  return t.id;
}

const simpleRun = (stepText: string) => [
  message([toolUse("set_plan", { steps: [stepText] })]),
  message([
    toolUse("update_step", { position: 1, status: "done", note: "done" }),
    toolUse("create_document", { title: stepText, kind: "doc", content: `# ${stepText}` }),
    toolUse("finish", { outcome: "done", summary: "All set.", checks: [{ position: 1, ok: true, note: "" }] }),
  ]),
];

const task = async (db: DB, id: number) => (await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)))[0];

describe("one task, one sub-agent + checker", () => {
  it("marks the task done only after the checker passes it", async () => {
    const db = await testDb();
    const id = await seed(db, "Fall wardrobe look with prices");
    const statusDuringCheck: string[] = [];
    const check = vi.fn(async (): Promise<Verdict> => {
      const t = await task(db, id);
      statusDuringCheck.push(`${t.status}/${t.checkStatus}`);
      return { pass: true, problems: [], note: "Looks complete." };
    });

    const status = await runSubAgent({ db, taskId: id, create: scripted(simpleRun("Pick 5 pieces")).create, check });

    expect(status).toBe("done");
    expect(statusDuringCheck).toEqual(["working/checking"]); // not "done" while being checked
    const t = await task(db, id);
    expect([t.status, t.checkStatus, t.checkNote]).toEqual(["done", "passed", "Looks complete."]);
  });

  it("sends checker problems back to the sub-agent to fix, then re-checks", async () => {
    const db = await testDb();
    const id = await seed(db, "Design premium 3D printer buying guide");
    const { create, calls } = scripted([
      ...simpleRun("Compare printers"),
      // Fix pass: the plan already exists, so it adds a step and redoes the doc.
      message([
        toolUse("add_step", { text: "Add prices" }),
        toolUse("update_step", { position: 2, status: "done", note: "Prices added" }),
        toolUse("create_document", { title: "Guide v2", kind: "doc", content: "# Guide\n- Bambu A1: $399" }),
        toolUse("finish", { outcome: "done", summary: "Guide has prices now.", checks: [] }),
      ]),
    ]);
    const check = vi
      .fn<(packet: string) => Promise<Verdict>>()
      .mockResolvedValueOnce({ pass: false, problems: ["Add a price for each printer"], note: "Missing prices." })
      .mockResolvedValueOnce({ pass: true, problems: [], note: "Prices are in." });

    const status = await runSubAgent({ db, taskId: id, create, check });

    expect(status).toBe("done");
    expect(check).toHaveBeenCalledTimes(2);
    // The fix run was told exactly what the checker found.
    const fixKickoff = calls[2].messages[0].content as string;
    expect(fixKickoff).toContain("checker agent");
    expect(fixKickoff).toContain("Add a price for each printer");
    // The second review saw the fixed work.
    expect(check.mock.calls[1][0]).toContain("Bambu A1: $399");
  });

  it("hands it to you when the checker still isn't happy after a fix", async () => {
    const db = await testDb();
    const id = await seed(db, "Design a flyer for my book");
    const { create } = scripted([...simpleRun("Draft flyer"), ...simpleRun("unused").slice(1)]);
    const check = vi.fn(async (): Promise<Verdict> => ({ pass: false, problems: ["Add the book's release date"], note: "Needs the release date." }));

    const status = await runSubAgent({ db, taskId: id, create, check, maxFixes: 1 });

    expect(status).toBe("needs_you");
    const t = await task(db, id);
    expect([t.checkStatus, t.checkNote]).toEqual(["failed", "Needs the release date."]);
  });

  it("does not run the checker when the sub-agent didn't finish", async () => {
    const db = await testDb();
    const id = await seed(db, "2 haircuts, Nov 28 or 29");
    const check = vi.fn();
    await runSubAgent({ db, taskId: id, create: scripted([message([], "refusal")]).create, check });
    expect(check).not.toHaveBeenCalled();
  });

  it("runs many sub-agents at the same time, one per task", async () => {
    const db = await testDb();
    const titles = ["2 haircuts", "Fall wardrobe", "Gift ideas", "Book flyer", "Study guide", "Mini-games", "3D printer guide"];
    const ids = await Promise.all(titles.map((t) => seed(db, t)));
    let inFlight = 0;
    let maxInFlight = 0;
    // Each sub-agent gets its own fake Claude; the delay lets them overlap.
    const scripts = new Map<number, ReturnType<typeof scripted>>();
    const createFor = (taskId: number) => async (p: Parameters<ReturnType<typeof scripted>["create"]>[0]) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return scripts.get(taskId)!.create(p);
    };
    for (const id of ids) scripts.set(id, scripted(simpleRun(`Step for ${id}`)));

    const results = await Promise.all(
      ids.map((taskId) => runSubAgent({ db, taskId, create: createFor(taskId), check: async () => ({ pass: true, problems: [], note: "ok" }) })),
    );
    expect(results.every((r) => r === "done")).toBe(true);
    expect(maxInFlight).toBeGreaterThan(1);
    // Every sub-agent only touched its own task.
    for (const id of ids) {
      const docs = await db.select().from(schema.documents).where(eq(schema.documents.taskId, id));
      expect(docs.map((d) => d.title)).toEqual([`Step for ${id}`]);
    }
    expect(typeof runSubAgents).toBe("function");
  });

  it("gives the checker everything the sub-agent made", async () => {
    const db = await testDb();
    const id = await seed(db, "Family Christmas gift ideas email and tracker");
    await db.insert(schema.documents).values({ taskId: id, title: "Gift tracker", kind: "sheet", content: "Person,Gift\nMom,Scarf" });
    await db.insert(schema.pendingActions).values({ taskId: id, kind: "gmail_draft", payload: { to: ["fam@example.com"], subject: "Gift ideas", body: "Hi" } });
    const packet = await buildReviewPacket(db, id);
    expect(packet).toContain("Mom,Scarf");
    expect(packet).toContain("QUEUED FOR THE USER'S APPROVAL");
    expect(packet).toContain("Gift ideas");
  });
});
