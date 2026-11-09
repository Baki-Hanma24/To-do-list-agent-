ALTER TABLE "tasks" ADD COLUMN "check_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "check_note" text DEFAULT '' NOT NULL;