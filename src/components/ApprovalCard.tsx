"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PendingAction } from "@/db/schema";
import { cx } from "@/lib/ui";

type Email = { to: string[]; cc?: string[]; subject: string; body: string };
type Event = {
  summary: string;
  start: string;
  end: string;
  timeZone?: string;
  location?: string;
  description?: string;
  attendees?: string[];
};

const list = (v?: string[]) => (v ?? []).join(", ");
const split = (v: string) =>
  v
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

function fmtWhen(start: string, end: string) {
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(start);
  const opts: Intl.DateTimeFormatOptions = allDay
    ? { weekday: "short", month: "short", day: "numeric" }
    : { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  const s = new Date(allDay ? `${start}T12:00:00` : start);
  const e = new Date(allDay ? `${end}T12:00:00` : end);
  if (isNaN(s.getTime())) return `${start} → ${end}`;
  const sameDay = s.toDateString() === e.toDateString();
  if (allDay) return sameDay ? `${s.toLocaleDateString(undefined, opts)} (all day)` : `${s.toLocaleDateString(undefined, opts)} → ${e.toLocaleDateString(undefined, opts)}`;
  return `${s.toLocaleString(undefined, opts)} → ${sameDay ? e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : e.toLocaleString(undefined, opts)}`;
}

export default function ApprovalCard({ action, onDone }: { action: PendingAction; onDone: () => void }) {
  const isEvent = action.kind === "calendar_event";
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"" | "approve" | "reject">("");
  const [error, setError] = useState("");
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState<Email>(action.payload as Email);
  const [event, setEvent] = useState<Event>(action.payload as Event);

  const verb = action.kind === "gmail_send" ? "Send email" : action.kind === "gmail_draft" ? "Save Gmail draft" : "Add to calendar";
  const icon = isEvent ? "📅" : action.kind === "gmail_send" ? "📨" : "✉️";

  async function decide(kind: "approve" | "reject") {
    setBusy(kind);
    setError("");
    const res = await fetch(`/api/actions/${action.id}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:
        kind === "approve" && editing
          ? JSON.stringify({ payload: isEvent ? event : email })
          : kind === "reject" && reason.trim()
            ? JSON.stringify({ reason: reason.trim() })
            : "{}",
    });
    setBusy("");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.message ?? json.error ?? "That didn't work.");
      return;
    }
    if (json.rule) router.refresh(); // a new rule was taught: update the Rules count
    onDone();
  }

  const input = "w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-[1rem] focus:border-accent focus:outline-none";

  return (
    <article data-testid="approval" className="rise overflow-hidden rounded-3xl border-2 border-warn/40 bg-surface shadow-float">
      <div className="flex items-center gap-3 bg-warn-soft px-5 py-3 font-semibold text-warn">
        <span className="text-xl">{icon}</span> {verb}?
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {isEvent ? (
          editing ? (
            <>
              <Field label="Title"><input className={input} value={event.summary} onChange={(e) => setEvent({ ...event, summary: e.target.value })} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Starts"><input className={input} value={event.start} onChange={(e) => setEvent({ ...event, start: e.target.value })} /></Field>
                <Field label="Ends"><input className={input} value={event.end} onChange={(e) => setEvent({ ...event, end: e.target.value })} /></Field>
              </div>
              <Field label="Where"><input className={input} value={event.location ?? ""} onChange={(e) => setEvent({ ...event, location: e.target.value || undefined })} /></Field>
              <Field label="Guests"><input className={input} value={list(event.attendees)} onChange={(e) => setEvent({ ...event, attendees: split(e.target.value) })} /></Field>
              <Field label="Details"><textarea rows={4} className={input} value={event.description ?? ""} onChange={(e) => setEvent({ ...event, description: e.target.value || undefined })} /></Field>
            </>
          ) : (
            <>
              <p className="text-[1.25rem] font-bold">{event.summary}</p>
              <p className="text-[1.05rem]">{fmtWhen(event.start, event.end)}</p>
              {event.location && <p className="text-muted">📍 {event.location}</p>}
              {event.attendees?.length ? <p className="text-muted">Guests: {list(event.attendees)}</p> : null}
              {event.description && <p className="whitespace-pre-wrap text-muted">{event.description}</p>}
            </>
          )
        ) : editing ? (
          <>
            <Field label="To"><input className={input} value={list(email.to)} onChange={(e) => setEmail({ ...email, to: split(e.target.value) })} /></Field>
            <Field label="Subject"><input className={input} value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} /></Field>
            <Field label="Message"><textarea rows={9} className={input} value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} /></Field>
          </>
        ) : (
          <>
            <p className="text-[0.95rem] text-muted">
              To <span className="font-medium text-ink">{list(email.to)}</span>
              {email.cc?.length ? <> · Cc {list(email.cc)}</> : null}
            </p>
            <p className="text-[1.2rem] font-bold">{email.subject}</p>
            <p className="whitespace-pre-wrap rounded-2xl bg-surface-2 px-4 py-3 leading-relaxed">{email.body}</p>
          </>
        )}
        {error && <p className="text-danger">{error}</p>}
      </div>

      {rejecting ? (
        <div className="space-y-3 border-t border-line bg-surface-2/50 p-4 sm:px-6" data-testid="reject-panel">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Tell the agent why (optional, it&apos;ll remember)</span>
            <textarea
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Keep invites under 5 sentences"
              className={input}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => decide("reject")}
              disabled={!!busy}
              className="h-14 flex-1 rounded-2xl bg-danger px-6 text-lg font-semibold text-white shadow-card transition hover:opacity-90 disabled:opacity-50 sm:flex-none"
            >
              {busy === "reject" ? "Rejecting…" : reason.trim() ? "Reject & teach" : "Reject"}
            </button>
            <button
              onClick={() => setRejecting(false)}
              disabled={!!busy}
              className="h-14 rounded-2xl border border-line px-6 text-lg font-semibold transition hover:bg-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
      <div className="flex flex-wrap gap-3 border-t border-line p-4 sm:px-6">
        <button
          onClick={() => decide("approve")}
          disabled={!!busy}
          className="h-14 flex-1 rounded-2xl bg-ok px-6 text-lg font-semibold text-white shadow-card transition hover:opacity-90 disabled:opacity-50 sm:flex-none sm:min-w-40"
        >
          {busy === "approve" ? "Working…" : editing ? "Save & approve" : "Approve"}
        </button>
        <button
          onClick={() => setEditing((v) => !v)}
          disabled={!!busy}
          className={cx("h-14 rounded-2xl border border-line px-6 text-lg font-semibold transition hover:bg-surface-2", editing && "bg-surface-2")}
        >
          {editing ? "Cancel edit" : "Edit"}
        </button>
        <button
          onClick={() => setRejecting(true)}
          disabled={!!busy}
          className="h-14 rounded-2xl px-6 text-lg font-semibold text-muted transition hover:bg-surface-2 hover:text-danger"
        >
          Reject
        </button>
      </div>
      )}
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.85rem] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
