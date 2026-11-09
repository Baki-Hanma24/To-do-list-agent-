ALTER TABLE "documents" ADD COLUMN "stage" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
UPDATE "documents" SET "stage" = 'final' WHERE "task_id" IN (SELECT "id" FROM "tasks" WHERE "check_status" = 'passed');
