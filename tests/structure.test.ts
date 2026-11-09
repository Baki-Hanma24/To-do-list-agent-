import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";

vi.mock("@/google/gmail", () => ({ createGmailDraft: vi.fn(), sendGmail: vi.fn() }));
vi.mock("@/google/calendar", () => ({ createCalendarEvent: vi.fn() }));

import * as schema from "@/db/schema";
import { slugify, documentFilename } from "@/lib/files";
import { agentSystemPrompt, checkerSystemPrompt, sortSystemPrompt, getTemplate, listTemplates } from "@/agent/prompt";
import { runTool } from "@/agent/tools";
import { runSubAgent } from "@/agent/orchestrate";
import { testDb, toolUse, message, scripted } from "./helpers";

describe("file naming rules", () => {
  it("uses lowercase, hyphens, and no special characters", () => {
    expect(slugify("Venue Options!")).toBe("venue-options");
    expect(slugify("  Gift ideas: Mom & Dad (2026) ")).toBe("gift-ideas-mom-and-dad-2026");
    expect(slugify("Café Menu — Final")).toBe("cafe-menu-final");
    expect(slugify("🎉🎉")).toBe("document");
    expect(documentFilename("Gift Tracker", "sheet")).toBe("gift-tracker.csv");
    expect(documentFilename("venue-options", "doc")).toBe("venue-options.md");
  });
});

describe("prompts come from /workflows", () => {
  afterEach(() => {
    delete process.env.AGENT_CONTENT_DIR;
  });

  it("builds the sub-agent prompt from workflows, success criteria, and templates", () => {
    const p = agentSystemPrompt();
    expect(p).toContain(fs.readFileSync("workflows/sub-agent.md", "utf8").trim());
    expect(p).toContain("Immediately useful");
    expect(p).toContain("Never pad");
    expect(p).toContain("- event-plan.md: parties, trips");
    expect(checkerSystemPrompt()).toContain("Immediately useful");
    expect(sortSystemPrompt()).toContain('"together"');
  });

  it("includes files from /resources but not the README", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-content-"));
    for (const d of ["workflows", "templates", "resources"]) fs.cpSync(d, path.join(dir, d), { recursive: true });
    fs.writeFileSync(path.join(dir, "resources", "about-me.md"), "I live in Austin. Budget-minded.");
    process.env.AGENT_CONTENT_DIR = dir;

    const p = agentSystemPrompt();
    expect(p).toContain('<resource name="about-me.md">');
    expect(p).toContain("I live in Austin");
    expect(p).not.toContain("Drop `.md` or `.txt` files here"); // resources/README.md
  });

  it("adds no resources section when the folder is empty", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-content-"));
    for (const d of ["workflows", "templates"]) fs.cpSync(d, path.join(dir, d), { recursive: true });
    fs.mkdirSync(path.join(dir, "resources"));
    fs.copyFileSync("resources/README.md", path.join(dir, "resources", "README.md"));
    process.env.AGENT_CONTENT_DIR = dir;
    expect(agentSystemPrompt()).not.toContain("Reference material from the user");
  });

  it("includes the real about-me file", () => {
    const p = agentSystemPrompt();
    expect(p).toContain('<resource name="about-me.md">');
    expect(p).toContain("personal training coaching business");
  });

  it("includes the content playbook in full (not cut off by the size cap)", () => {
    const p = agentSystemPrompt();
    expect(p).toContain('<resource name="content-playbook.md">');
    expect(p).toContain("**Tight:** 30-45s, no dead stretches.");
    expect(p).not.toContain("…[cut]");
  });
});

describe("business and content templates", () => {
  it("are listed with what they're for", () => {
    const p = agentSystemPrompt();
    for (const name of ["youtube-video-script.md", "social-post-batch.md", "client-check-in.md", "training-program.md", "coaching-reel.md", "reel-breakdown.md"]) {
      expect(p).toMatch(new RegExp(`- ${name.replace(".", "\\.")}: \\S`));
    }
    expect(p).toContain("- content-calendar.csv: spreadsheet with columns Date, Platform, Format, Topic, Hook, Status, Link");
  });
});

describe("templates", () => {
  it("lists templates with what they're for", () => {
    const names = listTemplates().map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["event-plan.md", "research-comparison.md", "shopping-list.csv"]));
    expect(names).not.toContain("README.md");
  });

  it("get_template returns a template, and errors on unknown or unsafe names", async () => {
    const db = await testDb();
    const ctx = { db, taskId: 1, finishRejections: 0 };
    const ok = await runTool("get_template", { name: "event-plan.md" }, ctx);
    expect(ok.isError).toBeFalsy();
    expect(ok.content).toContain("# {Event} plan");

    const missing = await runTool("get_template", { name: "nope.md" }, ctx);
    expect(missing.isError).toBe(true);
    expect(missing.content).toContain("event-plan.md");

    expect(getTemplate("../CLAUDE.md")).toBeNull();
    expect(getTemplate("README.md")).toBeNull();
  });
});

describe("drafts and outputs", () => {
  const run = () =>
    scripted([
      message([toolUse("set_plan", { steps: ["Write it"] })]),
      message([
        toolUse("create_document", { title: "venue-options", kind: "doc", content: "# Venues" }),
        toolUse("update_step", { position: 1, status: "done", note: "ok" }),
        toolUse("finish", { outcome: "done", summary: "Done.", checks: [{ position: 1, ok: true, note: "" }] }),
      ]),
    ]).create;

  it("documents are drafts until the checker passes them, then final", async () => {
    const db = await testDb();
    const [t] = await db.insert(schema.tasks).values({ title: "Venues", pile: "agent" }).returning();
    let stageDuringCheck = "";
    await runSubAgent({
      db,
      taskId: t.id,
      create: run(),
      check: async () => {
        stageDuringCheck = (await db.select().from(schema.documents))[0].stage;
        return { pass: true, problems: [], note: "Good." };
      },
    });
    expect(stageDuringCheck).toBe("draft");
    const docs = await db.select().from(schema.documents).where(eq(schema.documents.taskId, t.id));
    expect(docs.map((d) => d.stage)).toEqual(["final"]);
  });

  it("stay drafts when the checker fails them", async () => {
    const db = await testDb();
    const [t] = await db.insert(schema.tasks).values({ title: "Venues", pile: "agent" }).returning();
    await runSubAgent({
      db,
      taskId: t.id,
      create: run(),
      maxFixes: 0,
      check: async () => ({ pass: false, problems: ["Add prices"], note: "No prices." }),
    });
    expect((await db.select().from(schema.documents)).map((d) => d.stage)).toEqual(["draft"]);
  });
});
