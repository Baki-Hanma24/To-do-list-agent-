// Plain constants (no database code) so client components can import them.
export const PILES = ["mine", "together", "agent"] as const;
export const AREAS = ["work", "home", "family", "money", "health", "other"] as const;
export const TASK_STATUSES = ["todo", "working", "needs_you", "done"] as const;
export const STEP_STATUSES = ["todo", "doing", "done", "skipped"] as const;
export const EVENT_TYPES = ["thought", "tool", "result", "check", "error"] as const;
export const ACTION_KINDS = ["gmail_draft", "gmail_send", "calendar_event"] as const;
export const ACTION_STATUSES = ["awaiting", "approved", "rejected", "done", "failed"] as const;
export const CHECK_STATUSES = ["none", "checking", "passed", "failed"] as const;
export const DOC_KINDS = ["doc", "checklist", "sheet"] as const;

export type Pile = (typeof PILES)[number];
export type Area = (typeof AREAS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type StepStatus = (typeof STEP_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type ActionKind = (typeof ACTION_KINDS)[number];
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type DocKind = (typeof DOC_KINDS)[number];
export type CheckStatus = (typeof CHECK_STATUSES)[number];
