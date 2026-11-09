"use client";

import Link from "next/link";
import type { BoardTask } from "./Board";
import { AREA_INFO, cx } from "@/lib/ui";

/** What a sub-agent is doing right now, in one word. */
export function activityLabel(t: BoardTask): { text: string; tone: "work" | "ok" | "warn" | "muted" } {
  if (t.checkStatus === "checking") return { text: "Checking…", tone: "work" };
  if (t.status === "done") return { text: "Done", tone: "ok" };
  if (t.status === "needs_you") return { text: t.awaiting > 0 ? "Needs your OK" : "Needs you", tone: "warn" };
  if (t.status === "todo") return { text: t.stepsTotal ? "Paused" : "Queued", tone: "muted" };
  const e = t.lastEvent;
  if (e.startsWith("Searching")) return { text: "Searching…", tone: "work" };
  if (e.startsWith("Created")) return { text: "Writing…", tone: "work" };
  if (e.startsWith("Email ready") || e.startsWith("Calendar event ready")) return { text: "Drafting…", tone: "work" };
  if (e.startsWith("Fixing") || e.startsWith("Checker found")) return { text: "Fixing…", tone: "work" };
  if (e.startsWith("Made a") || e.startsWith("Starting")) return { text: "Planning…", tone: "work" };
  return { text: "Working…", tone: "work" };
}

export function progress(t: BoardTask): number {
  if (t.status === "done") return 100;
  if (t.checkStatus === "checking") return 96;
  if (!t.stepsTotal) return t.status === "working" ? 6 : 0;
  return Math.max(6, Math.round((t.stepsDone / t.stepsTotal) * 92));
}

export default function AgentsPanel({ tasks, onClear }: { tasks: BoardTask[]; onClear: () => void }) {
  const working = tasks.some((t) => t.status === "working");
  const checked = tasks.filter((t) => t.checkStatus === "passed" || t.checkStatus === "failed").length;

  return (
    <section
      data-testid="agents-panel"
      className="rise mt-8 rounded-[28px] border border-line bg-surface p-5 shadow-float sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[1.4rem] font-bold tracking-tight">One task, one sub-agent</h2>
          <p className="text-[0.9rem] text-muted">Each task gets its own agent. A checker reviews every one.</p>
        </div>
        {working ? (
          <span className="flex h-12 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-5 font-semibold shadow-card">
            <span className="spin inline-block text-[#e8673c]">✳</span> Working…
          </span>
        ) : (
          <button
            onClick={onClear}
            className="h-12 shrink-0 rounded-full border border-line px-5 font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <ul className="flex min-w-0 flex-col gap-2.5">
          {tasks.map((t) => {
            const area = AREA_INFO[t.area];
            const label = activityLabel(t);
            const pct = progress(t);
            return (
              <li key={t.id} data-testid="subagent">
                <Link
                  href={`/tasks/${t.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3 pr-3 transition sm:gap-4 sm:pr-4 hover:bg-surface-2"
                >
                  <span className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl sm:h-14 sm:w-14 sm:text-2xl", area.dot)}>
                    <span className="drop-shadow-sm">{area.icon}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[1rem] font-semibold leading-snug sm:truncate sm:text-[1.05rem]">{t.title}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-line/70">
                        <div
                          className={cx("h-full rounded-full transition-[width] duration-700 ease-out", t.status === "done" ? "bg-ok" : area.dot)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={cx(
                          "shrink-0 text-[0.9rem] font-semibold sm:w-[7.5rem] sm:text-[0.95rem]",
                          label.tone === "ok" && "text-ok",
                          label.tone === "warn" && "text-warn",
                          label.tone === "muted" && "text-muted",
                        )}
                      >
                        {label.text}
                      </span>
                    </div>
                  </div>
                  <CheckMark status={t.checkStatus} />
                </Link>
              </li>
            );
          })}
        </ul>

        <CheckerRing tasks={tasks} checked={checked} />
      </div>
    </section>
  );
}

function CheckMark({ status }: { status: BoardTask["checkStatus"] }) {
  if (status === "passed")
    return (
      <span aria-label="Checker passed" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ok text-white">
        ✓
      </span>
    );
  if (status === "failed")
    return (
      <span aria-label="Checker found problems" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warn font-bold text-white">
        !
      </span>
    );
  return (
    <span
      aria-label={status === "checking" ? "Checking" : "Not checked yet"}
      className={cx("h-9 w-9 shrink-0 rounded-full border-2 border-dashed", status === "checking" ? "spin border-accent" : "border-line")}
    />
  );
}

function CheckerRing({ tasks, checked }: { tasks: BoardTask[]; checked: number }) {
  const n = tasks.length;
  const r = 92;
  return (
    <div data-testid="checker" className="flex flex-col items-center justify-center rounded-3xl border border-line bg-surface p-5 shadow-card">
      <h3 className="text-[1.2rem] font-bold tracking-tight">Checker agent</h3>
      <div className="relative mt-3 h-[220px] w-[220px]">
        <svg viewBox="0 0 220 220" className="absolute inset-0" aria-hidden>
          <circle cx="110" cy="110" r={r} fill="none" className="stroke-line" strokeWidth="1" />
          {tasks.map((t, i) => {
            const a = (i / n) * 2 * Math.PI - Math.PI / 2;
            const fill =
              t.checkStatus === "passed" ? "var(--ok)" : t.checkStatus === "failed" ? "var(--warn)" : t.checkStatus === "checking" ? "var(--accent)" : "var(--border)";
            return <circle key={t.id} cx={110 + r * Math.cos(a)} cy={110 + r * Math.sin(a)} r="7" fill={fill} />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[4rem] font-extrabold leading-none tracking-tight">{checked}</span>
          <span className="mt-2 h-px w-10 bg-line" />
          <span className="mt-2 font-semibold">of {n} checked</span>
        </div>
      </div>
    </div>
  );
}
