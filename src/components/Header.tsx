import Link from "next/link";
import { count } from "drizzle-orm";
import { signOut } from "@/auth";
import { getDb, schema } from "@/db";
import { devBypass } from "@/lib/session";

export function SignOutButton({ alwaysShow = false }: { alwaysShow?: boolean }) {
  if (devBypass()) return null;
  return (
    <form
      className={alwaysShow ? "" : "hidden sm:block"}
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <button className="h-12 rounded-xl px-4 text-muted hover:bg-surface-2 hover:text-ink transition">Sign out</button>
    </form>
  );
}

/** "Rules (N)": what the agents have been taught. Icon-only on phones to keep the header on one line. */
export async function RulesLink() {
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.rules);
  return (
    <Link
      href="/rules"
      data-testid="rules-link"
      aria-label={`Rules the agents follow: ${n}`}
      className="flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2 font-semibold sm:gap-2 sm:px-3 text-muted transition hover:bg-surface-2 hover:text-ink"
    >
      <span className="text-lg">📘</span>
      <span className="hidden sm:inline">Rules</span>
      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.85rem]">{n}</span>
    </Link>
  );
}

export function HeaderActions() {
  return (
    <>
      <RulesLink />
      <SignOutButton />
    </>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-xl text-accent-ink shadow-card">✓</span>
      <span className="truncate whitespace-nowrap text-lg font-bold max-[359px]:hidden tracking-tight sm:text-xl">To-Do Agent</span>
    </Link>
  );
}
