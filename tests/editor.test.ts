import { describe, it, expect, vi } from "vitest";
import fs from "fs";

const gmail = vi.hoisted(() => ({ createGmailDraft: vi.fn(), sendGmail: vi.fn() }));
vi.mock("@/google/gmail", () => gmail);
vi.mock("@/google/calendar", () => ({ createCalendarEvent: vi.fn() }));

import * as schema from "@/db/schema";
import type * as Beta from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { checkFrames, editInput, makeEditPlan, type EditPlan, MAX_FRAMES } from "@/agent/editor";
import { editorSystemPrompt } from "@/agent/prompt";
import { addRule } from "@/agent/rules";
import { testDb, message } from "./helpers";

// A tiny valid JPEG header followed by filler, base64.
const jpeg = (bytes = 1000) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(bytes)]).toString("base64");

const PLAN: EditPlan = {
  title: "Trying the high-level dead bug",
  verdict: "The 'oh sh*t' at the end is the moment. Build the loop around it.",
  targetLength: "38s",
  cuts: [
    { order: 1, part: 1, start: "0:00", end: "0:03", what: "Viral clip + 'let's try it'", why: "Challenge hook" },
    { order: 2, part: 2, start: "0:04", end: "0:20", what: "Barbell set", why: "Payoff" },
  ],
  sound: { hook: "Trending yell at Part 1 0:02", music: "Low, cinematic", voiceover: "Keep at full volume" },
  textBeats: [{ at: "Part 2 0:10", text: "It's basically a pullover" }],
  captions: "Turn on auto-captions; fix 'dead bug' spelling.",
  look: { filter: "None", adjustments: [{ setting: "Warmth", value: "+15" }], letterbox: "Add the overlay image full screen" },
  loopEnding: "Cut right after 'oh sh*t' so it snaps to the hook.",
  scorecard: [
    { item: "Hook in 3s", status: "hit", fix: "" },
    { item: "Follow trigger", status: "miss", fix: "Add 'Part 2 on my page' as text in the last 2s" },
  ],
  caption: "hard can it be…",
  hashtags: ["#deadbug", "#coretraining"],
  credit: "@squat_university",
  steps: ["Open a new reel and add Part 1 and Part 2 in order.", "Trim Part 1 to 0:00-0:03."],
  unconfirmed: ["Exact timing of the yell is a guess from stills."],
};

function scriptedEditor(plan: unknown = PLAN) {
  const calls: Beta.MessageCreateParamsNonStreaming[] = [];
  const create = async (p: Beta.MessageCreateParamsNonStreaming) => {
    calls.push(p);
    return message([{ type: "text", text: JSON.stringify(plan) } as Beta.BetaTextBlock], "end_turn");
  };
  return { create, calls };
}

const input = (n = 3) =>
  editInput.parse({
    notes: "I say 'let's try it', then the yell sound, then 'oh sh*t' at the end.",
    frames: Array.from({ length: n }, (_, i) => ({ label: `Part 1 0:0${i}`, data: jpeg() })),
  });

describe("editor agent", () => {
  it("is built from the editor workflow, playbook, and about-me", () => {
    const p = editorSystemPrompt();
    expect(p).toContain(fs.readFileSync("workflows/editor-agent.md", "utf8").trim());
    expect(p).toContain('<resource name="content-playbook.md">');
    expect(p).toContain('<resource name="about-me.md">');
    expect(p).toContain("Immediately useful");
  });

  it("sends every frame as an image with its label, plus the notes and taught rules", async () => {
    const db = await testDb();
    await addRule(db, "Never use more than 3 text overlays");
    const { create, calls } = scriptedEditor();
    await makeEditPlan(db, input(3), create);

    const content = calls[0].messages[0].content as Beta.BetaContentBlockParam[];
    expect(content.filter((b) => b.type === "image")).toHaveLength(3);
    expect(content.some((b) => b.type === "text" && b.text === "Part 1 0:01")).toBe(true);
    expect(JSON.stringify(content.at(-1))).toContain("oh sh*t");
    expect(calls[0].system as string).toContain("Never use more than 3 text overlays");
    expect(calls[0].tools).toBeUndefined(); // strictly an editor: no tools
  });

  it("saves the parsed plan and never queues anything to send", async () => {
    const db = await testDb();
    const row = await makeEditPlan(db, input(), scriptedEditor().create);
    expect(row.title).toBe(PLAN.title);
    expect(row.frameCount).toBe(3);
    const [saved] = await db.select().from(schema.edits);
    expect((saved.plan as EditPlan).steps).toEqual(PLAN.steps);
    expect(await db.select().from(schema.pendingActions)).toHaveLength(0);
    expect(gmail.sendGmail).not.toHaveBeenCalled();
  });

  it("rejects a malformed plan instead of saving it", async () => {
    const db = await testDb();
    await expect(makeEditPlan(db, input(), scriptedEditor({ title: "x" }).create)).rejects.toThrow();
    expect(await db.select().from(schema.edits)).toHaveLength(0);
  });

  it("limits frame count and size", () => {
    expect(editInput.safeParse({ notes: "", frames: [] }).success).toBe(false);
    const tooMany = Array.from({ length: MAX_FRAMES + 1 }, () => ({ label: "x", data: jpeg() }));
    expect(editInput.safeParse({ notes: "", frames: tooMany }).success).toBe(false);

    expect(checkFrames([{ data: jpeg() }])).toBeNull();
    expect(checkFrames([{ data: jpeg(400_000) }])).toMatch(/too big/);
    expect(checkFrames([{ data: Buffer.alloc(500, 1).toString("base64") }])).toMatch(/isn't a JPEG/);
    const heavy = Array.from({ length: 12 }, () => ({ data: jpeg(290_000) }));
    expect(checkFrames(heavy)).toMatch(/too big in total/);
  });
});
