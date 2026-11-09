import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "path";
import * as schema from "@/db/schema";
import type { DB } from "@/db";
import type * as Beta from "@anthropic-ai/sdk/resources/beta/messages/messages";

export async function testDb(): Promise<DB> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  return db as unknown as DB;
}

let n = 0;
export function toolUse(name: string, input: unknown): Beta.BetaToolUseBlock {
  return { type: "tool_use", id: `toolu_${++n}`, name, input } as Beta.BetaToolUseBlock;
}

export function message(content: Beta.BetaContentBlock[], stop: Beta.BetaStopReason = "tool_use"): Beta.BetaMessage {
  return {
    id: `msg_${++n}`,
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Beta.BetaMessage;
}

/** A fake Claude that replays a fixed script of turns. */
export function scripted(turns: Beta.BetaMessage[]) {
  const calls: Beta.MessageCreateParamsNonStreaming[] = [];
  const create = async (params: Beta.MessageCreateParamsNonStreaming) => {
    calls.push(structuredClone(params));
    const next = turns.shift();
    if (!next) throw new Error("Script ran out of turns");
    return next;
  };
  return { create, calls };
}
