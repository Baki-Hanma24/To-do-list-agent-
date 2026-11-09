import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as Beta from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { DB } from "@/db";
import { schema } from "@/db";
import { anthropic, AGENT_MODEL } from "./client";
import { editorSystemPrompt } from "./prompt";
import { agentRulesBlock } from "./rules";

export const MAX_FRAMES = 36;
export const MAX_FRAME_BYTES = 300_000; // per decoded JPEG
/** Keeps the request under Vercel's ~4.5MB body limit after base64 (+33%). */
export const MAX_TOTAL_BYTES = 3_000_000;
export const MAX_NOTES = 4000;

export const frameInput = z.object({
  /** e.g. "Part 1 0:03" */
  label: z.string().trim().min(1).max(40),
  /** base64 JPEG, no data: prefix */
  data: z.string().min(100),
});

export const editInput = z.object({
  title: z.string().trim().max(120).optional(),
  notes: z.string().max(MAX_NOTES).default(""),
  frames: z.array(frameInput).min(1).max(MAX_FRAMES),
});
export type EditInput = z.infer<typeof editInput>;

/** Returns an error message if any frame is too big or not a JPEG, else null. */
export function checkFrames(frames: { data: string }[]): string | null {
  let total = 0;
  for (const [i, f] of frames.entries()) {
    const bytes = Buffer.from(f.data, "base64");
    if (bytes.length > MAX_FRAME_BYTES) return `Frame ${i + 1} is too big. Try fewer or smaller frames.`;
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return `Frame ${i + 1} isn't a JPEG image.`;
    total += bytes.length;
  }
  if (total > MAX_TOTAL_BYTES) return "The frames are too big in total. Try fewer frames.";
  return null;
}

export const editPlan = z.object({
  title: z.string(),
  verdict: z.string(),
  targetLength: z.string(),
  cuts: z.array(
    z.object({
      order: z.number(),
      part: z.number(),
      start: z.string(),
      end: z.string(),
      what: z.string(),
      why: z.string(),
    }),
  ),
  sound: z.object({ hook: z.string(), music: z.string(), voiceover: z.string() }),
  textBeats: z.array(z.object({ at: z.string(), text: z.string() })),
  captions: z.string(),
  look: z.object({
    filter: z.string(),
    adjustments: z.array(z.object({ setting: z.string(), value: z.string() })),
    letterbox: z.string(),
  }),
  loopEnding: z.string(),
  scorecard: z.array(z.object({ item: z.string(), status: z.enum(["hit", "miss", "unclear"]), fix: z.string() })),
  caption: z.string(),
  hashtags: z.array(z.string()),
  credit: z.string(),
  steps: z.array(z.string()),
  unconfirmed: z.array(z.string()),
});
export type EditPlan = z.infer<typeof editPlan>;

type CreateFn = (params: Beta.MessageCreateParamsNonStreaming) => Promise<Beta.BetaMessage>;

export function buildEditorMessage(input: EditInput): Beta.BetaContentBlockParam[] {
  const blocks: Beta.BetaContentBlockParam[] = [
    { type: "text", text: `Here are ${input.frames.length} stills from my raw footage, in order.` },
  ];
  for (const f of input.frames) {
    blocks.push({ type: "text", text: f.label });
    blocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } });
  }
  blocks.push({
    type: "text",
    text: [
      input.title ? `Working title: ${input.title}` : "",
      `What happens and what I say (you can't hear the audio):\n${input.notes.trim() || "(no notes; say what you can't tell from the stills)"}`,
      "Make my edit plan for Instagram's editor.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  return blocks;
}

/** Strictly an editor: one call, no tools. It can't post or queue anything. */
export async function makeEditPlan(db: DB, input: EditInput, create?: CreateFn) {
  const call: CreateFn = create ?? ((p) => anthropic().beta.messages.create(p));
  const taught = await agentRulesBlock(db);
  const res = await call({
    model: AGENT_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(editPlan) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: taught ? `${editorSystemPrompt()}\n\n${taught}` : editorSystemPrompt(),
    messages: [{ role: "user", content: buildEditorMessage(input) }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined to review this footage.");
  const text = res.content.find((b): b is Beta.BetaTextBlock => b.type === "text")?.text;
  if (!text) throw new Error("The editor didn't return a plan. Try again.");
  const plan = editPlan.parse(JSON.parse(text));

  const [row] = await db
    .insert(schema.edits)
    .values({
      title: input.title?.trim() || plan.title,
      notes: input.notes,
      frameCount: input.frames.length,
      plan,
    })
    .returning();
  return row;
}
