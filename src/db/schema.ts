import { pgTable, text, integer, timestamp, jsonb, serial, date } from "drizzle-orm/pg-core";

import type { Area, Pile, TaskStatus, StepStatus, EventType, ActionKind, ActionStatus, DocKind, CheckStatus, DocStage } from "./enums";

export * from "./enums";

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  area: text("area").$type<Area>().notNull().default("other"),
  pile: text("pile").$type<Pile>().notNull().default("mine"),
  sortReason: text("sort_reason").notNull().default(""),
  status: text("status").$type<TaskStatus>().notNull().default("todo"),
  summary: text("summary").notNull().default(""),
  /** Result of the checker agent's independent review. */
  checkStatus: text("check_status").$type<CheckStatus>().notNull().default("none"),
  checkNote: text("check_note").notNull().default(""),
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
  /** "draft" until the checker agent passes the task, then "final" (an output). */
  stage: text("stage").$type<DocStage>().notNull().default("draft"),
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
