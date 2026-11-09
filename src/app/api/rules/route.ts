import { z } from "zod";
import { getDb } from "@/db";
import { requireUser } from "@/lib/session";
import { badRequest } from "@/lib/http";
import { addRule, listRules, ruleText } from "@/agent/rules";

export async function GET() {
  const denied = await requireUser();
  if (denied) return denied;
  return Response.json(await listRules(await getDb()));
}

const body = z.object({ text: ruleText, taskId: z.number().int().positive().nullable().optional() });

export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Write the rule in 3 to 500 characters.");
  const rule = await addRule(await getDb(), parsed.data.text, parsed.data.taskId ?? null);
  return Response.json(rule, { status: 201 });
}
