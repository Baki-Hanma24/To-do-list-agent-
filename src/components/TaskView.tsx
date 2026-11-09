"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Document, PendingAction, Pile, RunEvent, Step, Task } from "@/db/schema";
import { PILES } from "@/db/enums";
import { AREA_INFO, PILE_INFO, STATUS_INFO, cx, formatDue } from "@/lib/ui";
import ApprovalCard from "./ApprovalCard";

type Detail = { task: Task; steps: Step[]; events: RunEvent[]; actions: PendingAction[]; documents: Document[] };

export default function TaskView({
  id,
  brand,
  headerRight,
}: {
  id: number;
  brand: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/${id}`, { cache: "no-store" });
    if (res.status === 404) return setMissing(true);
    if (res.ok) setData(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const working = data?.task.status === "working";
  useEffect(() => {
    if (!working) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [working, load]);

  async function run() {
    setStarting(true);
    setError("");
    const res = await fetch(`/api/tasks/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    setStarting(false);
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Couldn't start.");
    await load();
  }

  async function patch(body: Partial<Pick<Task, "pile" | "status">>) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  async function remove() {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    window.location.href = "/";
  }

  if (missing) {
    return (
      <Shell brand={brand} headerRight={headerRight}>
        <p className="py-20 text-center text-muted">This task is gone.</p>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell brand={brand} headerRight={headerRight}>
        <div className="h-40 animate-pulse rounded-3xl bg-surface-2" />
      </Shell>
    );
  }

  const { task, steps, events, actions, documents } = data;
  const awaiting = actions.filter((a) => a.status === "awaiting");
  const handled = actions.filter((a) => a.status !== "awaiting");
  const area = AREA_INFO[task.area];
  const status = STATUS_INFO[task.status];
  const due = formatDue(task.due);
  const canRun = task.pile !== "mine" && !working && task.status !== "done" && awaiting.length === 0;
  const doneSteps = steps.filter((s) => s.status === "done" || s.status === "skipped").length;

  return (
    <Shell brand={brand} headerRight={headerRight}>
      <Link href="/" className="inline-flex h-12 items-center gap-2 rounded-xl px-2 text-muted hover:text-ink">
        ← All tasks
      </Link>

      <section className="rise mt-2 rounded-[28px] border border-line bg-surface p-6 shadow-float sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-[0.85rem]">
          <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium", area.chip)}>
            <span className={cx("h-2 w-2 rounded-full", area.dot)} />
            {area.label}
          </span>
          {due && <span className="rounded-full bg-surface-2 px-3 py-1 font-medium text-muted">{due}</span>}
          <span
            data-testid="task-status"
            className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold", status.cls)}
          >
            {working && <span className="spin inline-block">✳</span>}
            {status.label}
          </span>
        </div>
        <h1 className="mt-4 text-[1.9rem] font-bold leading-tight tracking-tight sm:text-[2.2rem]">{task.title}</h1>
        {task.notes && <p className="mt-2 text-muted">{task.notes}</p>}
        {task.summary && (
          <p className="mt-5 rounded-2xl bg-surface-2 px-5 py-4 text-[1.05rem] leading-relaxed">{task.summary}</p>
        )}

        {/* Pile switcher */}
        <div className="mt-6">
          <p className="mb-2 text-[0.85rem] font-medium text-muted">
            Pile{task.sortReason ? ` · ${task.sortReason}` : ""}
          </p>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-1.5">
            {PILES.map((p: Pile) => (
              <button
                key={p}
                onClick={() => p !== task.pile && patch({ pile: p })}
                disabled={working}
                className={cx(
                  "h-12 rounded-xl text-[0.95rem] font-semibold transition",
                  task.pile === p ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                )}
              >
                <span className="hidden sm:inline">{PILE_INFO[p].icon} </span>
                {PILE_INFO[p].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {canRun && (
            <button
              onClick={run}
              disabled={starting}
              data-testid="run"
              className="h-14 flex-1 rounded-2xl bg-accent px-6 text-lg font-semibold text-accent-ink shadow-card transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50 sm:flex-none sm:min-w-56"
            >
              {starting ? "Starting…" : steps.length ? "Keep going" : task.pile === "together" ? "Get it started" : "Do it for me"}
            </button>
          )}
          {working && (
            <div className="flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-accent-soft px-6 text-lg font-semibold text-accent sm:flex-none sm:min-w-56">
              <span className="spin inline-block">✳</span> Working on it
            </div>
          )}
          {task.status !== "done" ? (
            <button
              onClick={() => patch({ status: "done" })}
              disabled={working}
              className="h-14 rounded-2xl border border-line px-6 text-lg font-semibold transition hover:bg-surface-2 disabled:opacity-40"
            >
              Mark done
            </button>
          ) : (
            <button
              onClick={() => patch({ status: "todo" })}
              className="h-14 rounded-2xl border border-line px-6 text-lg font-semibold transition hover:bg-surface-2"
            >
              Reopen
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-danger">{error}</p>}
      </section>

      {awaiting.length > 0 && (
        <section className="mt-8">
          <SectionTitle title="Waiting for your OK" subtitle="Nothing goes out until you approve it." />
          <div className="flex flex-col gap-4">
            {awaiting.map((a) => (
              <ApprovalCard key={a.id} action={a} onDone={load} />
            ))}
          </div>
        </section>
      )}

      {steps.length > 0 && (
        <section className="mt-8">
          <SectionTitle title="Plan" subtitle={`${doneSteps} of ${steps.length} done`} />
          <ol className="flex flex-col gap-2.5" data-testid="steps">
            {steps.map((s) => (
              <li
                key={s.id}
                className={cx(
                  "rise flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card",
                  s.status === "skipped" && "opacity-60",
                )}
              >
                <span
                  className={cx(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.85rem] font-bold",
                    s.status === "done" && "bg-ok text-white",
                    s.status === "doing" && "bg-accent-soft text-accent",
                    s.status === "todo" && "border-2 border-line text-muted",
                    s.status === "skipped" && "bg-surface-2 text-muted",
                  )}
                >
                  {s.status === "done" ? "✓" : s.status === "doing" ? <span className="spin inline-block">✳</span> : s.status === "skipped" ? "–" : s.position}
                </span>
                <div className="min-w-0">
                  <p className={cx("text-[1.05rem] font-semibold", s.status === "done" && "text-muted line-through decoration-1")}>
                    {s.text}
                  </p>
                  {s.note && <p className="mt-1 text-[0.9rem] text-muted">{s.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {documents.length > 0 && (
        <section className="mt-8">
          <SectionTitle title="What it made" />
          <div className="flex flex-col gap-4">
            {documents.map((d) => (
              <DocCard key={d.id} doc={d} />
            ))}
          </div>
        </section>
      )}

      {handled.length > 0 && (
        <section className="mt-8">
          <SectionTitle title="Approvals" />
          <ul className="flex flex-col gap-2">
            {handled.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-[0.95rem]">
                <span>{a.status === "done" ? "✅" : a.status === "rejected" ? "🚫" : a.status === "failed" ? "⚠️" : "⏳"}</span>
                <span className="min-w-0 break-words">
                  <strong className="font-semibold">{actionTitle(a)}</strong>
                  <span className="text-muted"> · {a.result || a.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-8">
          <SectionTitle title="Activity" />
          <ul className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
            {events.slice(-40).map((e) => (
              <li key={e.id} className="flex gap-3 py-1 text-[0.9rem]">
                <span className="w-5 shrink-0 text-center">
                  {e.type === "tool" ? "→" : e.type === "check" ? "✓" : e.type === "error" ? "!" : "·"}
                </span>
                <span className={cx("min-w-0 whitespace-pre-wrap break-words", e.type === "error" ? "text-danger" : e.type === "thought" ? "text-muted" : "")}>
                  {e.content}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12 text-center">
        <button onClick={remove} className="h-12 rounded-xl px-5 text-muted hover:bg-surface-2 hover:text-danger transition">
          Delete task
        </button>
      </div>
    </Shell>
  );
}

function Shell({ brand, headerRight, children }: { brand: React.ReactNode; headerRight?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-5">
        {brand}
        {headerRight}
      </header>
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {subtitle && <span className="text-[0.9rem] text-muted">{subtitle}</span>}
    </div>
  );
}

export function actionTitle(a: PendingAction): string {
  const p = a.payload as Record<string, unknown>;
  if (a.kind === "calendar_event") return `Event: ${p.summary}`;
  return `${a.kind === "gmail_send" ? "Send" : "Draft"}: ${p.subject}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function DocCard({ doc }: { doc: Document }) {
  const [open, setOpen] = useState(true);
  const icon = doc.kind === "sheet" ? "📊" : doc.kind === "checklist" ? "☑️" : "📄";
  const rows = doc.kind === "sheet" ? parseCsv(doc.content) : [];

  return (
    <article className="rise overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 p-4 pl-5">
        <button onClick={() => setOpen((v) => !v)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left">
          <span className="text-2xl">{icon}</span>
          <span className="truncate text-[1.05rem] font-semibold">{doc.title}</span>
          <span className="ml-auto text-muted">{open ? "▴" : "▾"}</span>
        </button>
        <a
          href={`/api/documents/${doc.id}`}
          aria-label={`Download ${doc.title}`}
          className="grid h-12 min-w-12 shrink-0 place-items-center rounded-xl bg-surface-2 px-3 font-medium transition hover:bg-accent-soft sm:px-4"
        >
          <span className="sm:hidden">⬇</span>
          <span className="hidden sm:inline">Download</span>
        </a>
      </div>
      {open && (
        <div className="border-t border-line px-5 py-4 sm:px-6">
          {doc.kind === "sheet" ? (
            <div className="prose-doc overflow-x-auto">
              <table>
                <thead>
                  <tr>{rows[0]?.map((h, i) => <th key={i}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(1).map((r, i) => (
                    <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="prose-doc">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
              >
                {doc.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
