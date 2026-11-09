import { googleFetch } from "./token";
import type { EmailPayload } from "@/lib/payloads";

function encodeHeader(value: string): string {
  // RFC 2047 so non-ASCII subjects survive.
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function buildRawEmail(p: EmailPayload): string {
  const lines = [
    `To: ${p.to.join(", ")}`,
    ...(p.cc?.length ? [`Cc: ${p.cc.join(", ")}`] : []),
    `Subject: ${encodeHeader(p.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(p.body, "utf8").toString("base64"),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

export async function createGmailDraft(p: EmailPayload): Promise<string> {
  const json = await googleFetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    message: { raw: buildRawEmail(p) },
  });
  return `Draft saved in Gmail (id ${json.id}).`;
}

export async function sendGmail(p: EmailPayload): Promise<string> {
  const json = await googleFetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    raw: buildRawEmail(p),
  });
  return `Email sent (id ${json.id}).`;
}
