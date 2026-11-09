"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** "Correct the agent": what you type becomes a rule every future sub-agent and checker follows. */
export default function TeachCard({
  taskId,
  canRedo,
  onChanged,
}: {
  taskId: number;
  canRedo: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "redo">("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 3 || busy) return;
    setBusy("save");
    setError("");
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), taskId }),
    });
    setBusy("");
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't save that.");
    setSaved(text.trim());
    setText("");
    router.refresh(); // updates the Rules count in the header
  }

  async function redo() {
    if (!saved) return;
    setBusy("redo");
    setError("");
    const res = await fetch(`/api/tasks/${taskId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, redoRule: saved }),
    });
    setBusy("");
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't start the redo.");
    setSaved(null);
    onChanged();
  }

  return (
    <section data-testid="teach" className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-xl font-bold tracking-tight">Correct the agent</h2>
      <p className="mt-1 text-[0.95rem] text-muted">
        Tell it what was wrong. It becomes a rule every agent follows from now on, and the checker enforces it.
      </p>

      {saved ? (
        <div className="rise mt-4 rounded-2xl bg-ok-soft p-4" role="status">
          <p className="font-semibold text-ok">✓ The agent will remember this.</p>
          <p className="mt-1 break-words">“{saved}”</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {canRedo && (
              <button
                onClick={redo}
                disabled={!!busy}
                data-testid="redo"
                className="h-14 flex-1 rounded-2xl bg-accent px-6 text-lg font-semibold text-accent-ink shadow-card transition hover:opacity-90 disabled:opacity-50 sm:flex-none"
              >
                {busy === "redo" ? "Starting…" : "Redo with this rule"}
              </button>
            )}
            <button
              onClick={() => setSaved(null)}
              className="h-14 rounded-2xl border border-line px-6 text-lg font-semibold transition hover:bg-surface"
            >
              Add another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="mt-4">
          <label htmlFor="teach-text" className="sr-only">
            What should the agent do differently?
          </label>
          <textarea
            id="teach-text"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="e.g. Always include prices and a link for every option"
            className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[1.05rem] leading-relaxed focus:border-accent focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              disabled={text.trim().length < 3 || !!busy}
              className="h-14 rounded-2xl bg-ink px-6 text-lg font-semibold text-bg shadow-card transition hover:opacity-90 disabled:opacity-40"
            >
              {busy === "save" ? "Saving…" : "Save rule"}
            </button>
            <Link href="/rules" className="flex h-14 items-center rounded-2xl px-4 font-medium text-muted hover:bg-surface-2 hover:text-ink">
              See all rules
            </Link>
          </div>
        </form>
      )}
      {error && <p className="mt-3 text-danger">{error}</p>}
    </section>
  );
}
