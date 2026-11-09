"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EditPlan } from "@/agent/editor";
import { cx } from "@/lib/ui";

type Edit = { id: number; title: string; notes: string; frameCount: number; plan: EditPlan; createdAt: string };

const STATUS = {
  hit: { icon: "✓", label: "Hit", cls: "bg-ok-soft text-ok" },
  miss: { icon: "!", label: "Missing", cls: "bg-warn-soft text-warn" },
  unclear: { icon: "?", label: "Can't tell", cls: "bg-surface-2 text-muted" },
} as const;

export default function EditPlanView({
  id,
  brand,
  headerRight,
}: {
  id: number;
  brand: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  const [edit, setEdit] = useState<Edit | null>(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/edits/${id}`, { cache: "no-store" }).then(async (r) => {
      if (r.status === 404) return setMissing(true);
      if (r.ok) setEdit(await r.json());
    });
  }, [id]);

  async function copySteps() {
    if (!edit) return;
    const text = edit.plan.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the steps are still on screen */
    }
  }

  async function remove() {
    if (!confirm("Delete this edit plan?")) return;
    await fetch(`/api/edits/${id}`, { method: "DELETE" });
    window.location.href = "/editor";
  }

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <header className="flex items-center justify-between gap-2 py-5 sm:gap-3">
        {brand}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">{headerRight}</div>
      </header>
      <Link href="/editor" className="inline-flex h-12 items-center gap-2 rounded-xl px-2 text-muted hover:text-ink">
        ← Editor
      </Link>
      {children}
    </div>
  );

  if (missing) return shell(<p className="py-20 text-center text-muted">This edit plan is gone.</p>);
  if (!edit) return shell(<div className="mt-2 h-40 animate-pulse rounded-3xl bg-surface-2" />);
  const p = edit.plan;

  return shell(
    <>
      <section className="rise mt-2 rounded-[28px] border border-line bg-surface p-6 shadow-float sm:p-8">
        <p className="text-[0.85rem] font-semibold uppercase tracking-wide text-accent">Edit plan · {p.targetLength}</p>
        <h1 className="mt-2 text-[1.9rem] font-bold leading-tight tracking-tight">{edit.title}</h1>
        <p className="mt-4 rounded-2xl bg-surface-2 px-5 py-4 text-[1.05rem] leading-relaxed" data-testid="verdict">
          {p.verdict}
        </p>
      </section>

      <Section title="Cut list">
        <ol className="flex flex-col gap-2.5" data-testid="cuts">
          {p.cuts.map((c) => (
            <li key={c.order} className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-ink">{c.order}</span>
              <div className="min-w-0">
                <p className="font-semibold">
                  Part {c.part} · {c.start} → {c.end}
                </p>
                <p className="mt-0.5 break-words">{c.what}</p>
                <p className="mt-1 text-[0.9rem] text-muted">{c.why}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Sound">
        <Card>
          <Row label="Hook sound">{p.sound.hook}</Row>
          <Row label="Music">{p.sound.music}</Row>
          <Row label="Voiceover">{p.sound.voiceover}</Row>
        </Card>
      </Section>

      {p.textBeats.length > 0 && (
        <Section title="On-screen text">
          <Card>
            {p.textBeats.map((t, i) => (
              <Row key={i} label={t.at}>
                <span className="font-semibold">“{t.text}”</span>
              </Row>
            ))}
          </Card>
        </Section>
      )}

      <Section title="Captions">
        <Card>
          <p className="break-words leading-relaxed">{p.captions}</p>
        </Card>
      </Section>

      <Section title="Look">
        <Card>
          <Row label="Filter">{p.look.filter}</Row>
          {p.look.adjustments.map((a, i) => (
            <Row key={i} label={a.setting}>
              {a.value}
            </Row>
          ))}
          <Row label="Letterbox">{p.look.letterbox}</Row>
          <a
            href="/letterbox-9x16.png"
            download="letterbox-9x16.png"
            data-testid="letterbox-download"
            className="mt-4 inline-flex h-14 items-center gap-2 rounded-2xl bg-ink px-6 text-lg font-semibold text-bg shadow-card transition hover:opacity-90"
          >
            ⬇ Letterbox overlay
          </a>
          <p className="mt-2 text-[0.85rem] text-muted">Values are starting points. Match by eye to your best reel.</p>
        </Card>
      </Section>

      <Section title="Loop ending">
        <Card>
          <p className="break-words leading-relaxed">{p.loopEnding}</p>
        </Card>
      </Section>

      <Section title="Playbook check">
        <ul className="flex flex-col gap-2" data-testid="scorecard">
          {p.scorecard.map((s, i) => {
            const st = STATUS[s.status];
            return (
              <li key={i} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold", st.cls)} aria-label={st.label}>
                  {st.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{s.item}</p>
                  {s.status !== "hit" && s.fix && <p className="mt-0.5 break-words text-[0.95rem] text-muted">{s.fix}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Caption & hashtags">
        <Card>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{p.caption}</p>
          {p.hashtags.length > 0 && <p className="mt-3 break-words text-accent">{p.hashtags.join(" ")}</p>}
          {p.credit && (
            <p className="mt-3 break-words text-[0.95rem]">
              <strong className="font-semibold">Credit:</strong> {p.credit}
            </p>
          )}
        </Card>
      </Section>

      <Section
        title="Steps in Instagram's editor"
        action={
          <button
            onClick={copySteps}
            className="h-12 shrink-0 rounded-xl border border-line px-4 font-semibold transition hover:bg-surface-2"
          >
            {copied ? "✓ Copied" : "Copy steps"}
          </button>
        }
      >
        <ol className="flex flex-col gap-2" data-testid="steps">
          {p.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-card">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.9rem] font-bold text-accent">
                {i + 1}
              </span>
              <span className="min-w-0 break-words pt-0.5 leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      </Section>

      {p.unconfirmed.length > 0 && (
        <Section title="Unconfirmed (from stills only)">
          <Card>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {p.unconfirmed.map((u, i) => (
                <li key={i} className="break-words">
                  {u}
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}

      <div className="mt-12 text-center">
        <button onClick={remove} className="h-12 rounded-xl px-5 text-muted transition hover:bg-surface-2 hover:text-danger">
          Delete edit plan
        </button>
      </div>
    </>,
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">{children}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-0 sm:flex-row sm:gap-4">
      <span className="shrink-0 text-[0.9rem] font-semibold text-muted sm:w-32">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
