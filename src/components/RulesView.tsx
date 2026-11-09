"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Rule } from "@/db/schema";

export default function RulesView({ brand, footer }: { brand: React.ReactNode; footer?: React.ReactNode }) {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/rules", { cache: "no-store" });
    if (res.ok) setRules(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't save that.");
    setText("");
    await load();
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-5">{brand}</header>

      <Link href="/" className="inline-flex h-12 items-center gap-2 rounded-xl px-2 text-muted hover:text-ink">
        ← All tasks
      </Link>

      <section className="rise mt-2 rounded-[28px] border border-line bg-surface p-6 shadow-float sm:p-8">
        <h1 className="text-[1.9rem] font-bold leading-tight tracking-tight">Rules the agents follow</h1>
        <p className="mt-2 text-[1.05rem] text-muted">
          Every correction you give becomes a rule. Each sub-agent follows all of them, and the checker fails any work that
          breaks one. So the same mistake doesn&apos;t happen twice.
        </p>

        <form onSubmit={add} className="mt-6">
          <label htmlFor="new-rule" className="mb-2 block font-semibold">
            Add a rule
          </label>
          <textarea
            id="new-rule"
            rows={2}
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Use Austin, TX for anything local"
            className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[1.05rem] focus:border-accent focus:outline-none"
          />
          <button
            disabled={text.trim().length < 3 || busy}
            className="mt-3 h-14 rounded-2xl bg-accent px-6 text-lg font-semibold text-accent-ink shadow-card transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Add rule"}
          </button>
          {error && <p className="mt-3 text-danger">{error}</p>}
        </form>
      </section>

      <ol className="mt-8 flex flex-col gap-3" data-testid="rules">
        {rules === null ? (
          <li className="h-24 animate-pulse rounded-2xl bg-surface-2" />
        ) : rules.length === 0 ? (
          <li className="rounded-2xl border-2 border-dashed border-line px-5 py-10 text-center text-muted">
            No rules yet. Correct the agent on any task and it shows up here.
          </li>
        ) : (
          rules.map((r, i) => (
            <RuleRow
              key={r.id}
              rule={r}
              n={i + 1}
              onChanged={async () => {
                await load();
                router.refresh();
              }}
            />
          ))
        )}
      </ol>

      {footer && <div className="mt-12 flex justify-center">{footer}</div>}
    </div>
  );
}

function RuleRow({ rule, n, onChanged }: { rule: Rule; n: number; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(rule.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't save that.");
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!confirm("Delete this rule? The agents will stop following it.")) return;
    setBusy(true);
    await fetch(`/api/rules/${rule.id}`, { method: "DELETE" });
    onChanged();
  }

  const btn = "h-12 rounded-xl px-4 font-semibold transition disabled:opacity-40";

  return (
    <li data-testid="rule" className="rise rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent">{n}</span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <textarea
              rows={2}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Edit rule"
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-[1.05rem] focus:border-accent focus:outline-none"
            />
          ) : (
            <p className="break-words pt-1 text-[1.05rem] font-medium leading-snug">{rule.text}</p>
          )}
          <p className="mt-1.5 text-[0.85rem] text-muted">
            Added {new Date(rule.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            {rule.taskId && (
              <>
                {" · "}
                <Link href={`/tasks/${rule.taskId}`} className="underline underline-offset-2 hover:text-ink">
                  from a task
                </Link>
              </>
            )}
          </p>
          {error && <p className="mt-2 text-danger">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {editing ? (
              <>
                <button onClick={save} disabled={busy || text.trim().length < 3} className={`${btn} bg-accent text-accent-ink`}>
                  Save
                </button>
                <button
                  onClick={() => {
                    setText(rule.text);
                    setEditing(false);
                  }}
                  className={`${btn} border border-line hover:bg-surface-2`}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className={`${btn} border border-line hover:bg-surface-2`}>
                  Edit
                </button>
                <button onClick={remove} disabled={busy} className={`${btn} text-muted hover:bg-surface-2 hover:text-danger`}>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
