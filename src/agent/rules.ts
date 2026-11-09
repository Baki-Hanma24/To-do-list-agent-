import { asc } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db";
import { schema } from "@/db";

export const ruleText = z.string().trim().min(3).max(500);

export async function listRules(db: DB) {
  return db.select().from(schema.rules).orderBy(asc(schema.rules.id));
}

export async function addRule(db: DB, text: string, taskId: number | null = null) {
  const [row] = await db.insert(schema.rules).values({ text: ruleText.parse(text), taskId }).returning();
  return row;
}

function numbered(rules: { text: string }[]): string {
  return rules.map((r, i) => `${i + 1}. ${r.text}`).join("\n");
}

/** Appended to the sub-agent's system prompt on every run. */
export async function agentRulesBlock(db: DB): Promise<string> {
  const rules = await listRules(db);
  if (!rules.length) return "";
  return `# Rules the user taught you\n\nThe user corrected earlier work. Follow every one of these rules. The checker will fail work that breaks any of them.\n\n${numbered(rules)}`;
}

/** Added to the checker's review packet. */
export async function checkerRulesBlock(db: DB): Promise<string> {
  const rules = await listRules(db);
  if (!rules.length) return "";
  return `RULES THE USER TAUGHT (fail the work if it breaks any of these):\n${numbered(rules)}`;
}
