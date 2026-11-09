"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Pile, Task } from "@/db/schema";
import { PILES } from "@/db/enums";
import { AREA_INFO, PILE_INFO, STATUS_INFO, cx, formatDue } from "@/lib/ui";
import AgentsPanel from "./AgentsPanel";

export type BoardTask = Task & { awaiting: number; stepsTotal: number; stepsDone: number; lastEvent: string };

const BATCH_KEY = "todo-agent:batch";

function readBatch(): number[] {
  try {
    return JSON.parse(localStorage.getItem(BATCH_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeBatch(ids: number[]) {
  try {
    localStorage.setItem(BATCH_KEY, JSON.stringify(ids));
  } catch {
    /* private mode: the panel just won't survive a reload */
  }
}

export default function Board({ brand, headerRight }: { brand: React.ReactNode; headerRight?: React.ReactNode }) {
  const [tasks, setTasks] = useState<BoardTask[] | null>(null);
  const [tab, setTab] = useState<Pile>("agent");
  const [showDone, setShowDone] = useState(false);
  const [batch, setBatch] = useState<number[]>([]);
  const [runningAll, setRunningAll] = useState(false);
  const [runError, setRunError] = useState("");

  useEffect(() => setBatch(readBatch()), []);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks", { cache: "no-store" });
    if (res.ok) setTasks(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh while anything is being worked on.
  const anyWorking = tasks?.some((t) => t.status === "working");
  useEffect(() => {
    if (!anyWorking) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [anyWorking, load]);

  const needsYou = useMemo(
    () => (tasks ?? []).filter((t) => t.status === "needs_you" || t.awaiting > 0).length,
    [tasks],
  );

  const byPile = useMemo(() => {
    const out: Record<Pile, BoardTask[]> = { mine: [], together: [], agent: [] };
    for (const t of tasks ?? []) if (showDone || t.status !== "done") out[t.pile].push(t);
    return out;
  }, [tasks, showDone]);

  const doneCount = (tasks ?? []).filter((t) => t.status === "done").length;

  // Tasks a sub-agent could start on right now.
  const runnable = (tasks ?? []).filter((t) => t.pile !== "mine" && t.status === "todo" && t.awaiting === 0);

  // The panel shows this batch, plus anything else currently being worked on.
  const panelTasks = useMemo(() => {
    const ids = new Set(batch);
    return (tasks ?? [])
      .filter((t) => ids.has(t.id) || t.status === "working")
      .sort((a, b) => a.id - b.id);
  }, [tasks, batch]);

  async function runAll() {
    setRunningAll(true);
    setRunError("");
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    setRunningAll(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setRunError(json.error ?? "Couldn't start the agents.");
    setBatch(json.ids);
    writeBatch(json.ids);
    await load();
  }

  function clearBatch() {
    setBatch([]);
    writeBatch([]);
  }

  async function toggleDone(t: BoardTask) {
    const status = t.status === "done" ? "todo" : "done";
    setTasks((prev) => prev?.map((x) => (x.id === t.id ? { ...x, status } : x)) ?? null);
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <header className="flex items-center justify-between gap-2 py-5 sm:gap-3">
        {brand}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          {needsYou > 0 && (
            <span
              data-testid="needs-you"
              aria-label={`${needsYou} need${needsYou === 1 ? "s" : ""} you`}
              className="flex h-12 items-center gap-2 whitespace-nowrap rounded-xl bg-warn-soft px-2.5 font-semibold text-warn sm:px-4"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-warn" />
              {needsYou}
              <span className="hidden sm:inline">need{needsYou === 1 ? "s" : ""} you</span>
            </span>
          )}
          {headerRight}
        </div>
      </header>

      <AddTask
        onAdded={(t) => {
          setTasks((prev) => [{ ...t, awaiting: 0, stepsTotal: 0, stepsDone: 0, lastEvent: "" }, ...(prev ?? [])]);
          setTab(t.pile);
        }}
      />

      {runnable.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[24px] bg-accent-soft p-3 pl-5">
          <p className="min-w-0 flex-1 font-medium">
            <span className="font-bold">{runnable.length}</span> task{runnable.length === 1 ? "" : "s"} the agents can start on
          </p>
          <button
            onClick={runAll}
            disabled={runningAll}
            data-testid="run-all"
            className="h-14 rounded-2xl bg-accent px-6 text-lg font-semibold text-accent-ink shadow-card transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {runningAll ? "Starting…" : `✨ Run all ${Math.min(runnable.length, 8)}`}
          </button>
          {runError && <p className="basis-full text-danger">{runError}</p>}
        </div>
      )}

      {panelTasks.length > 0 && <AgentsPanel tasks={panelTasks} onClear={clearBatch} />}

      {/* Phone: tabs */}
      <div className="mt-8 grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-1.5 md:hidden" role="tablist">
        {PILES.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={tab === p}
            onClick={() => setTab(p)}
            className={cx(
              "h-12 rounded-xl text-[0.95rem] font-semibold transition",
              tab === p ? "bg-surface text-ink shadow-card" : "text-muted",
            )}
          >
            {PILE_INFO[p].label}
            <span className="ml-1.5 text-muted font-normal">{byPile[p].length}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:mt-10 md:grid-cols-3">
        {PILES.map((p) => (
          <section key={p} className={cx(tab !== p && "hidden md:block")} data-testid={`pile-${p}`}>
            <div className="mb-4 hidden md:block">
              <h2 className="text-xl font-bold tracking-tight">
                {PILE_INFO[p].icon} {PILE_INFO[p].label}
                <span className="ml-2 text-base font-medium text-muted">{byPile[p].length}</span>
              </h2>
              <p className="text-[0.9rem] text-muted">{PILE_INFO[p].hint}</p>
            </div>
            <p className="mb-3 text-[0.9rem] text-muted md:hidden">{PILE_INFO[p].hint}</p>
            <div className="flex flex-col gap-3">
              {tasks === null ? (
                <>
                  <div className="h-28 animate-pulse rounded-2xl bg-surface-2" />
                  <div className="h-28 animate-pulse rounded-2xl bg-surface-2" />
                </>
              ) : byPile[p].length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-line px-5 py-8 text-center text-muted">
                  Nothing here yet
                </div>
              ) : (
                byPile[p].map((t) => <TaskCard key={t.id} task={t} onToggle={() => toggleDone(t)} />)
              )}
            </div>
          </section>
        ))}
      </div>

      {doneCount > 0 && (
        <div className="mt-10 text-center">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="h-12 rounded-xl px-5 font-medium text-muted hover:bg-surface-2 hover:text-ink transition"
          >
            {showDone ? "Hide finished" : `Show ${doneCount} finished`}
          </button>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onToggle }: { task: BoardTask; onToggle: () => void }) {
  const area = AREA_INFO[task.area];
  const status = STATUS_INFO[task.status];
  const due = formatDue(task.due);
  const done = task.status === "done";
  const showStatus = task.pile !== "mine" || done;

  return (
    <div
      className={cx(
        "rise group relative flex gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-float",
        done && "opacity-60",
      )}
    >
      <button
        onClick={onToggle}
        aria-label={done ? "Mark not done" : "Mark done"}
        className={cx(
          "relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition",
          done ? "border-ok bg-ok text-white" : "border-line hover:border-ok",
        )}
      >
        {done && "✓"}
      </button>
      <div className="min-w-0 flex-1">
        <Link href={`/tasks/${task.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
          <h3 className={cx("text-[1.05rem] font-semibold leading-snug", done && "line-through")}>{task.title}</h3>
        </Link>
        {task.summary && task.status !== "todo" && (
          <p className="mt-1.5 line-clamp-2 text-[0.9rem] text-muted">{task.summary}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.8rem]">
          <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium", area.chip)}>
            <span className={cx("h-2 w-2 rounded-full", area.dot)} />
            {area.label}
          </span>
          {due && <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium text-muted">{due}</span>}
          {showStatus && (
            <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold", status.cls)}>
              {task.status === "working" && <span className="spin inline-block">✳</span>}
              {task.awaiting > 0 ? `${task.awaiting} to approve` : status.label}
            </span>
          )}
          {task.stepsTotal > 0 && !done && (
            <span className="font-medium text-muted">
              {task.stepsDone}/{task.stepsTotal} steps
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

function AddTask({ onAdded }: { onAdded: (t: Task) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [canTalk, setCanTalk] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setCanTalk(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as Record<string, new () => SpeechRec>;
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    const base = title ? `${title} ` : "";
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setTitle(base + text);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), ...(due ? { due } : {}) }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't add that. Try again.");
      return;
    }
    onAdded(await res.json());
    setTitle("");
    setDue("");
  }

  return (
    <form onSubmit={submit} className="rounded-[24px] border border-line bg-surface p-3 shadow-float">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add anything…"
        aria-label="New task"
        className="h-16 w-full rounded-2xl bg-transparent px-4 text-[1.15rem] font-medium placeholder:text-muted/70 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
        <label className="flex items-center gap-2 pl-3 text-[0.85rem] text-muted">
          Due
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-12 rounded-xl bg-surface-2 px-3 text-ink"
          />
        </label>
        {error && <span className="text-[0.85rem] text-danger">{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          {canTalk && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? "Stop listening" : "Talk"}
              className={cx(
                "grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl transition",
                listening ? "bg-danger text-white animate-pulse" : "bg-surface-2 hover:bg-accent-soft",
              )}
            >
              🎙
            </button>
          )}
          <button
            disabled={!title.trim() || busy}
            className="h-14 shrink-0 rounded-2xl bg-accent px-7 text-lg font-semibold text-accent-ink shadow-card transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? "Sorting…" : "Add"}
          </button>
        </div>
      </div>
    </form>
  );
}
