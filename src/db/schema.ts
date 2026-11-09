import { pgTable, text, integer, timestamp, jsonb, serial, date } from "drizzle-orm/pg-core";

export const PILES = ["mine", "together", "agent"] as const;
export const AREAS = ["work", "home", "family", "money", "health", "other"] as const;
export const TASK_STATUSES = ["todo", "working", "needs_you", "done"] as const;
export const STEP_STATUSES = ["todo", "doing", "done", "skipped"] as const;
export const EVENT_TYPES = ["thought", "tool", "result", "check", "error"] as const;
export const ACTION_KINDS = ["gmail_draft", "gmail_send", "calendar_event"] as const;
export const ACTION_STATUSES = ["awaiting", "approved", "rejected", "done", "failed"] as const;
export const DOC_KINDS = ["doc", "checklist", "sheet"] as const;

export type Pile = (typeof PILES)[number];
export type Area = (typeof AREAS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type StepStatus = (typeof STEP_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type ActionKind = (typeof ACTION_KINDS)[number];
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type DocKind = (typeof DOC_KINDS)[number];

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  area: text("area").$type<Area>().notNull().default("other"),
  pile: text("pile").$type<Pile>().notNull().default("mine"),
  sortReason: text("sort_reason").notNull().default(""),
  status: text("status").$type<TaskStatus>().notNull().default("todo"),
  summary: text("summary").notNull().default(""),
  due: date("due"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const steps = pgTable("steps", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  text: text("text").notNull(),
  status: text("status").$type<StepStatus>().notNull().default("todo"),
  note: text("note").notNull().default(""),
});

export const runEvents = pgTable("run_events", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  type: text("type").$type<EventType>().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pendingActions = pgTable("pending_actions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  kind: text("kind").$type<ActionKind>().notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").$type<ActionStatus>().notNull().default("awaiting"),
  result: text("result").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").$type<DocKind>().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Single-user app: one row (id = 1) holds the encrypted Google refresh token. */
export const googleTokens = pgTable("google_tokens", {
  id: integer("id").primaryKey(),
  email: text("email").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type Step = typeof steps.$inferSelect;
export type RunEvent = typeof runEvents.$inferSelect;
export type PendingAction = typeof pendingActions.$inferSelect;
export type Document = typeof documents.$inferSelect;
