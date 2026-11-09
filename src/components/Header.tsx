import Link from "next/link";
import { signOut } from "@/auth";
import { devBypass } from "@/lib/session";

export function SignOutButton() {
  if (devBypass()) return null;
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <button className="h-12 rounded-xl px-4 text-muted hover:bg-surface-2 hover:text-ink transition">Sign out</button>
    </form>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-xl">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-xl text-accent-ink shadow-card">✓</span>
      <span className="whitespace-nowrap text-lg font-bold tracking-tight sm:text-xl">To-Do Agent</span>
    </Link>
  );
}
