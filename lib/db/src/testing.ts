import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "./schema";

/**
 * Test-only helper: the DDL statements that create this package's schema from
 * an empty database, generated straight from the Drizzle table definitions.
 *
 * Lives here rather than in the test harness because drizzle-kit is a dev
 * dependency of this package only. Import via `@workspace/db/src/testing`
 * so nothing from drizzle-kit reaches the production entry point.
 */
export async function generateSchemaSql(): Promise<string[]> {
  const empty = generateDrizzleJson({});
  const current = generateDrizzleJson(schema);
  return generateMigration(empty, current);
}
