import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { isSignedIn } from "@/lib/session";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isSignedIn()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <div className="rise w-full max-w-md rounded-[28px] bg-surface p-8 sm:p-10 shadow-float border border-line text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-accent text-3xl text-accent-ink shadow-card">
          ✓
        </div>
        <h1 className="text-3xl font-bold tracking-tight">To-Do Agent</h1>
        <p className="mt-3 text-muted leading-relaxed">
          Put everything in. It sorts your list and gets the work done. It never sends anything without asking you.
        </p>
        {error && (
          <p className="mt-5 rounded-xl bg-warn-soft px-4 py-3 text-warn text-[0.9rem]">
            That account isn&apos;t allowed. Sign in with the account set in ALLOWED_EMAIL.
          </p>
        )}
        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button className="h-14 w-full rounded-2xl bg-ink text-bg text-lg font-semibold shadow-card transition hover:opacity-90 active:scale-[0.99]">
            Continue with Google
          </button>
        </form>
        <p className="mt-5 text-[0.8rem] text-muted">
          Google access lets it draft emails and add calendar events, only after you tap Approve.
        </p>
      </div>
    </main>
  );
}
