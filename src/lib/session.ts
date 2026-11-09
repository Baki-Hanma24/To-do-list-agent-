import { auth } from "@/auth";

/** Local development can skip Google sign-in. Never in production. */
export function devBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "1";
}

export async function isSignedIn(): Promise<boolean> {
  if (devBypass()) return true;
  const session = await auth();
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  return !!allowed && session?.user?.email?.toLowerCase() === allowed;
}

/** Use at the top of API routes. Returns a 401 Response when not signed in. */
export async function requireUser(): Promise<Response | null> {
  if (await isSignedIn()) return null;
  return Response.json({ error: "Not signed in" }, { status: 401 });
}
