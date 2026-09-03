-- T12: give success_stories and audit_log an org_id.
-- Applied on databases whose schema already matches lib/db (push-managed);
-- only the two new columns are missing there, so this migration adds them,
-- backfills them, and then enforces NOT NULL.
ALTER TABLE "success_stories" ADD COLUMN "org_id" integer;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "org_id" integer;--> statement-breakpoint
-- Backfill success stories from their learner's organization; orphaned stories stay NULL until the fallback below.
UPDATE "success_stories" SET "org_id" = (SELECT l."org_id" FROM "learners" l WHERE l."id" = "success_stories"."learner_id" AND l."org_id" IS NOT NULL) WHERE "org_id" IS NULL AND "learner_id" IS NOT NULL;--> statement-breakpoint
-- Backfill audit rows from the acting user's organization; unmatched emails stay NULL until the fallback below.
UPDATE "audit_log" SET "org_id" = (SELECT u."org_id" FROM "users" u WHERE u."email" = "audit_log"."user_email" AND u."org_id" IS NOT NULL ORDER BY u."id" LIMIT 1) WHERE "org_id" IS NULL AND "user_email" IS NOT NULL;--> statement-breakpoint
-- Single-org rule (Mark, 2026-09-03): rows that a learner/user join could not
-- attribute get the one organization that exists. Refuse to guess when the
-- database holds any other number of organizations — abort rather than misattribute.
DO $$ BEGIN IF (SELECT count(*) FROM "organizations") <> 1 THEN RAISE EXCEPTION 'org_id backfill expects exactly one organization, found %', (SELECT count(*) FROM "organizations"); END IF; END $$;--> statement-breakpoint
UPDATE "success_stories" SET "org_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "org_id" IS NULL;--> statement-breakpoint
UPDATE "audit_log" SET "org_id" = (SELECT "id" FROM "organizations" LIMIT 1) WHERE "org_id" IS NULL;--> statement-breakpoint
ALTER TABLE "success_stories" ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "success_stories" ADD CONSTRAINT "success_stories_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "success_stories_org_id_idx" ON "success_stories" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audit_log_org_id_idx" ON "audit_log" USING btree ("org_id");
