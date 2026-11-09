import Anthropic from "@anthropic-ai/sdk";

export const AGENT_MODEL = "claude-opus-5-5";
export const SORT_MODEL = "claude-haiku-5-5";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function hasAnthropicKey(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
