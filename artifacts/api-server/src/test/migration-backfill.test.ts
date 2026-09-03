/**
 * Migration backfill test for 0001_success_stories_audit_log_org_id.
 *
 * Pre-migration state = the schema lib/db generates today (what push-managed
 * databases already have) minus the two new org_id columns. The migration SQL
 * is then applied statement by statement and the backfill result is asserted
 * for: a story with a learner, an orphaned story, an audit row with a known
 * user, an audit row with an unknown email — plus the single-org guard, which
 * must abort the migration instead of guessing when two organizations exist.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { generateSchemaSql } from "@workspace/db/src/testing";

const migrationPath = join(import.meta.dirname, "../../../../lib/db/drizzle/0001_success_stories_audit_log_org_id.sql");
const migrationStatements = readFileSync(migrationPath, "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

/** Boot a pre-migration database: current schema, then the two org_id columns removed again. */
async function bootPreMigrationDb(): Promise<PGlite> {
  const client = new PGlite();
  for (const statement of await generateSchemaSql()) {
    await client.exec(statement);
  }
  await client.exec(`ALTER TABLE "success_stories" DROP COLUMN "org_id"`);
  await client.exec(`ALTER TABLE "audit_log" DROP COLUMN "org_id"`);
  return client;
}

async function seedBase(client: PGlite, orgs: number[]): Promise<void> {
  for (const id of orgs) {
    await client.exec(
      `INSERT INTO "organizations" ("id", "name") VALUES (${id}, 'Org ${id}')`,
    );
  }
  // A user for org 1 so the audit email join has something to find.
  await client.exec(
    `INSERT INTO "users" ("id", "cognito_sub", "email", "org_id") VALUES (1, 'sub-1', 'known-user@test', 1)`,
  );
  await client.exec(
    `INSERT INTO "learners" ("id", "org_id", "name", "pathway", "program", "coach", "progress", "readiness", "status", "lastActive", "nextAction", "joinDate", "email")
     VALUES (1, 1, 'Learner One', 'pw', 'prog', 'coach', 0, 0, 'New', 'today', 'none', '2026-01-01', 'learner@test')`,
  );
}

/**
 * Seed the four rows the acceptance criteria name. Only runs after the
 * org_id columns are dropped, so no org_id is written here — the migration
 * must attribute every row on its own.
 */
async function seedBackfillRows(client: PGlite): Promise<void> {
  await client.exec(
    `INSERT INTO "success_stories" ("id", "learner_id", "learner_name", "headline", "story")
     VALUES (1, 1, 'Learner One', 'via learner', 'story'),
            (2, NULL, 'Ghost', 'orphaned', 'story')`,
  );
  await client.exec(
    `INSERT INTO "audit_log" ("id", "action", "entity_type", "user_email")
     VALUES (1, 'created', 'learner', 'known-user@test'),
            (2, 'created', 'learner', 'unknown-user@test')`,
  );
}

interface OrgIdRow {
  id: number;
  org_id: number | null;
}

async function orgIds(client: PGlite, table: string): Promise<Map<number, number | null>> {
  const result = await client.query<OrgIdRow>(`SELECT "id", "org_id" FROM "${table}" ORDER BY "id"`);
  return new Map(result.rows.map((r) => [r.id, r.org_id]));
}

async function isNullable(client: PGlite, table: string): Promise<string | undefined> {
  const result = await client.query<{ is_nullable: string }>(
    `SELECT "is_nullable" FROM "information_schema"."columns"
     WHERE "table_name" = '${table}' AND "column_name" = 'org_id'`,
  );
  return result.rows[0]?.is_nullable;
}

let client: PGlite;

beforeEach(async () => {
  client = await bootPreMigrationDb();
});

describe("0001 migration backfill (success_stories + audit_log org_id)", () => {
  it("attributes every row and enforces NOT NULL when exactly one organization exists", async () => {
    await seedBase(client, [1]);
    await seedBackfillRows(client);

    for (const statement of migrationStatements) {
      await client.exec(statement);
    }

    const stories = await orgIds(client, "success_stories");
    expect(stories.get(1)).toBe(1); // story with a learner: attributed through learners.org_id
    expect(stories.get(2)).toBe(1); // orphaned story: attributed through the single-org rule

    const audit = await orgIds(client, "audit_log");
    expect(audit.get(1)).toBe(1); // audit row with a known user: attributed through users.org_id
    expect(audit.get(2)).toBe(1); // unknown email: attributed through the single-org rule

    expect(await isNullable(client, "success_stories")).toBe("NO");
    expect(await isNullable(client, "audit_log")).toBe("NO");
  });

  it("aborts instead of guessing when two organizations exist", async () => {
    await seedBase(client, [1, 2]);
    await seedBackfillRows(client);

    let ran = 0;
    await expect(async () => {
      for (const statement of migrationStatements) {
        ran++;
        await client.exec(statement);
      }
    }).rejects.toThrow(/org_id backfill expects exactly one organization, found 2/);

    // Statements before the guard committed: the attributable join backfills ran,
    // but the fallback and NOT NULL enforcement never did.
    const stories = await orgIds(client, "success_stories");
    expect(stories.get(1)).toBe(1); // learner join still attributes its own row
    expect(stories.get(2)).toBeNull(); // orphaned story NOT guessed
    expect(await isNullable(client, "success_stories")).toBe("YES");

    const audit = await orgIds(client, "audit_log");
    expect(audit.get(1)).toBe(1); // user email join still attributes its own row
    expect(audit.get(2)).toBeNull(); // unknown email NOT attributed to a random org
    expect(await isNullable(client, "audit_log")).toBe("YES");
    expect(ran).toBeLessThan(migrationStatements.length);
  });
});
