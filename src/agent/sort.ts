import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PILES, AREAS, type Pile, type Area } from "@/db/schema";
import { anthropic, hasAnthropicKey, SORT_MODEL } from "./client";
import { sortSystemPrompt } from "./prompt";

export const sortResult = z.object({
  pile: z.enum(PILES),
  area: z.enum(AREAS),
  reason: z.string(),
});
export type SortResult = z.infer<typeof sortResult>;

/** Keyword fallback, used when there's no API key or the call fails. */
export function heuristicSort(text: string): SortResult {
  const t = text.toLowerCase();
  const area: Area =
    /\b(boss|meeting|client|report|deadline|work|email .*team|presentation)\b/.test(t) ? "work"
    : /\b(bill|tax|budget|bank|pay|money|invest|insurance|rent)\b/.test(t) ? "money"
    : /\b(doctor|dentist|gym|workout|health|meds|therapy|run)\b/.test(t) ? "health"
    : /\b(mom|dad|kids?|wife|husband|family|birthday|anniversary|party)\b/.test(t) ? "family"
    : /\b(clean|fix|laundry|groceries|house|home|yard|repair)\b/.test(t) ? "home"
    : "other";
  const pile: Pile =
    /\b(research|find|compare|look up|plan|draft|write|schedule|summari[sz]e|list)\b/.test(t) ? "agent"
    : /\b(book|buy|order|choose|decide|invite|organi[sz]e|apply)\b/.test(t) ? "together"
    : "mine";
  return { pile, area, reason: "Sorted by keywords (no AI key set)." };
}

export async function sortTask(title: string, notes = ""): Promise<SortResult> {
  const text = notes ? `${title}\n\n${notes}` : title;
  if (!hasAnthropicKey()) return heuristicSort(text);
  try {
    const res = await anthropic().messages.parse({
      model: SORT_MODEL,
      max_tokens: 1024,
      output_config: { effort: "low", format: zodOutputFormat(sortResult) },
      system: sortSystemPrompt(),
      messages: [{ role: "user", content: text }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return heuristicSort(text);
    return res.parsed_output;
  } catch (err) {
    console.error("sortTask failed, using keywords", err);
    return heuristicSort(text);
  }
}
