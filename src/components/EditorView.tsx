"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { extractFrames, type Frame } from "@/lib/frames";

type PastEdit = { id: number; title: string; frameCount: number; createdAt: string };

export default function EditorView({ brand, headerRight }: { brand: React.ReactNode; headerRight?: React.ReactNode }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [progress, setProgress] = useState<string>("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [past, setPast] = useState<PastEdit[] | null>(null);

  useEffect(() => {
    fetch("/api/edits", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setPast)
      .catch(() => setPast([]));
  }, []);

  async function pull(next: File[]) {
    setError("");
    setFrames([]);
    if (!next.length) return;
    setProgress("Pulling frames…");
    try {
      const f = await extractFrames(next, 36, (done, total) => setProgress(`Pulling frames… ${done} of ${total}`));
      setFrames(f);
      setProgress("");
    } catch (err) {
      setProgress("");
      setError(err instanceof Error ? err.message : "Couldn't read those files.");
    }
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files, ...Array.from(list)];
    setFiles(next);
    void pull(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(i: number) {
    const next = files.filter((_, j) => j !== i);
    setFiles(next);
    void pull(next);
  }

  async function submit() {
    if (!frames.length || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/edits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || undefined, notes, frames }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(json.error ?? "The editor failed. Try again.");
    }
    router.push(`/editor/${json.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <header className="flex items-center justify-between gap-2 py-5 sm:gap-3">
        {brand}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">{headerRight}</div>
      </header>

      <Link href="/" className="inline-flex h-12 items-center gap-2 rounded-xl px-2 text-muted hover:text-ink">
        ← All tasks
      </Link>

      <section className="rise mt-2 rounded-[28px] border border-line bg-surface p-6 shadow-float sm:p-8">
        <h1 className="text-[1.9rem] font-bold leading-tight tracking-tight">🎬 Editor</h1>
        <p className="mt-2 text-[1.05rem] text-muted">
          Add your raw clips. Get a step-by-step edit plan for Instagram&apos;s editor, built on your playbook: hook, sound, captions, look,
          and loop.
        </p>

        {/* 1. Clips */}
        <div className="mt-7">
          <h2 className="text-lg font-bold">1. Your clips</h2>
          <p className="text-[0.9rem] text-muted">In order. Videos or screenshots. Only small stills leave your phone.</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,image/*"
            multiple
            className="sr-only"
            id="clips"
            data-testid="clips-input"
            onChange={(e) => addFiles(e.target.files)}
          />
          <label
            htmlFor="clips"
            className="mt-3 flex h-20 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-surface-2 text-lg font-semibold transition hover:border-accent hover:bg-accent-soft"
          >
            <span className="text-2xl">＋</span> Add clips or screenshots
          </label>

          {files.length > 0 && (
            <ol className="mt-3 flex flex-col gap-2">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <button
                    onClick={() => removeFile(i)}
                    disabled={busy}
                    className="h-11 shrink-0 rounded-lg px-3 font-medium text-muted hover:bg-surface hover:text-danger"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          )}

          {progress && <p className="mt-3 font-medium text-accent">{progress}</p>}
          {frames.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[0.9rem] font-medium text-muted" data-testid="frame-count">
                {frames.length} frames ready
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {frames.map((f, i) => (
                  <figure key={i} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:image/jpeg;base64,${f.data}`} alt={f.label} className="h-28 w-auto rounded-lg object-cover" />
                    <figcaption className="mt-1 text-center text-[0.75rem] text-muted">{f.label}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Notes */}
        <div className="mt-7">
          <label htmlFor="notes" className="text-lg font-bold">
            2. What happens
          </label>
          <p className="text-[0.9rem] text-muted">The editor can&apos;t hear audio. Tell it what you said, the sounds, and anything off camera.</p>
          <textarea
            id="notes"
            rows={5}
            maxLength={4000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={'e.g. Viral clip plays while I say "let\'s try it". I struggle, realize it\'s like a pullover, fix my form. End: "oh sh*t" in pain.'}
            className="mt-3 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[1.05rem] leading-relaxed focus:border-accent focus:outline-none"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Working title (optional)"
            aria-label="Working title"
            className="mt-3 h-14 w-full rounded-2xl border border-line bg-surface-2 px-4 text-[1.05rem] focus:border-accent focus:outline-none"
          />
        </div>

        <button
          onClick={submit}
          disabled={!frames.length || busy || !!progress}
          data-testid="make-plan"
          className="mt-7 h-16 w-full rounded-2xl bg-accent px-6 text-xl font-semibold text-accent-ink shadow-card transition hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? (
            <span className="inline-flex items-center gap-3">
              <span className="spin inline-block">✳</span> Watching your footage…
            </span>
          ) : (
            "Make my edit plan"
          )}
        </button>
        {busy && <p className="mt-2 text-center text-[0.9rem] text-muted">This takes about a minute.</p>}
        {error && <p className="mt-3 text-danger">{error}</p>}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold tracking-tight">Past edit plans</h2>
        {past === null ? (
          <div className="h-20 animate-pulse rounded-2xl bg-surface-2" />
        ) : past.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line px-5 py-8 text-center text-muted">Your edit plans will show up here.</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="past-edits">
            {past.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/editor/${e.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-float"
                >
                  <span className="text-2xl">🎬</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[1.05rem] font-semibold">{e.title}</span>
                    <span className="text-[0.85rem] text-muted">
                      {new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {e.frameCount} frames
                    </span>
                  </span>
                  <span className="text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
