import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { decrypt } from "@/lib/crypto";

/** Exchange the stored refresh token for a short-lived access token. */
export async function googleAccessToken(): Promise<string> {
  const db = await getDb();
  const [row] = await db.select().from(schema.googleTokens).where(eq(schema.googleTokens.id, 1));
  if (!row) throw new Error("Google isn't connected. Sign out and sign in again.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      refresh_token: decrypt(row.refreshTokenEnc),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}). Sign in again.`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function googleFetch(url: string, body: unknown): Promise<Record<string, unknown>> {
  const token = await googleAccessToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as { message?: string } | undefined)?.message ?? res.statusText;
    throw new Error(`Google API error (${res.status}): ${msg}`);
  }
  return json;
}
