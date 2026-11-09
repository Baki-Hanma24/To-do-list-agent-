import { describe, it, expect } from "vitest";
import { heuristicSort, sortResult, sortTask } from "@/agent/sort";
import { buildRawEmail } from "@/google/gmail";

describe("sorting", () => {
  it("falls back to keywords without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await sortTask("Research the best health insurance plans");
    expect(sortResult.parse(r)).toEqual(r);
    expect(r.pile).toBe("agent");
  });

  it("puts personal errands in Mine", () => {
    expect(heuristicSort("Go to the gym").pile).toBe("mine");
    expect(heuristicSort("Pay the electric bill").area).toBe("money");
  });

  it("validates model output", () => {
    expect(sortResult.safeParse({ pile: "agent", area: "family", reason: "x" }).success).toBe(true);
    expect(sortResult.safeParse({ pile: "someone", area: "family", reason: "x" }).success).toBe(false);
  });
});

describe("gmail encoding", () => {
  it("builds a valid base64url RFC 822 message", () => {
    const raw = buildRawEmail({ to: ["a@b.co"], subject: "Café 🎉", body: "Hi there" });
    const text = Buffer.from(raw, "base64url").toString("utf8");
    expect(text).toContain("To: a@b.co");
    expect(text).toContain("Subject: =?UTF-8?B?");
    expect(raw).not.toMatch(/[+/=]/);
  });
});
