import type { Area, Pile, TaskStatus } from "@/db/enums";

export const PILE_INFO: Record<Pile, { label: string; hint: string; icon: string }> = {
  mine: { label: "Mine", hint: "Things only you can do", icon: "🙋" },
  together: { label: "Together", hint: "Agent does most, you finish", icon: "🤝" },
  agent: { label: "Agent", hint: "Agent handles it end to end", icon: "✨" },
};

export const AREA_INFO: Record<Area, { label: string; icon: string; dot: string; chip: string }> = {
  work: { label: "Work", icon: "💼", dot: "bg-sky-500", chip: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
  home: { label: "Home", icon: "🏠", dot: "bg-amber-500", chip: "bg-amber-500/14 text-amber-800 dark:text-amber-300" },
  family: { label: "Family", icon: "🎁", dot: "bg-pink-500", chip: "bg-pink-500/12 text-pink-700 dark:text-pink-300" },
  money: { label: "Money", icon: "💵", dot: "bg-emerald-500", chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  health: { label: "Health", icon: "❤️", dot: "bg-rose-500", chip: "bg-rose-500/12 text-rose-700 dark:text-rose-300" },
  other: { label: "Other", icon: "✨", dot: "bg-violet-500", chip: "bg-violet-500/12 text-violet-700 dark:text-violet-300" },
};

export const STATUS_INFO: Record<TaskStatus, { label: string; cls: string }> = {
  todo: { label: "To do", cls: "bg-surface-2 text-muted" },
  working: { label: "Working…", cls: "bg-accent-soft text-accent" },
  needs_you: { label: "Needs you", cls: "bg-warn-soft text-warn" },
  done: { label: "Done", cls: "bg-ok-soft text-ok" },
};

export function formatDue(due: string | null): string | null {
  if (!due) return null;
  const d = new Date(`${due}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${-days} days late`;
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
