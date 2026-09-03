import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import request, { type Agent } from "supertest";
import {
  setDb,
  organizationsTable,
  usersTable,
  type Db,
  type Organization,
  type User,
} from "@workspace/db";
import { generateSchemaSql } from "@workspace/db/src/testing";
import app from "../app";
import type { AuthResult } from "../lib/auth-service";
import { TEST_AUTH_HEADER } from "./setup";

/** A seeded organization together with its single member and that member's Cognito claims. */
export interface TestTenant {
  org: Organization;
  user: User;
  claims: AuthResult;
}

export interface TestDatabase {
  /** Drizzle handle bound to the in-process PGlite instance (also what `db` now resolves to). */
  db: Db;
  /** Two isolated tenants so every test can assert cross-org filtering. */
  orgA: TestTenant;
  orgB: TestTenant;
  /** Shut the PGlite instance down; call from `afterAll`. */
  close(): Promise<void>;
}

/**
 * Boot an empty in-memory Postgres, create the schema from the Drizzle
 * definitions, seed two organizations with one user each, and point the shared
 * `db` export at it. Call once per test file (in `beforeAll`).
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzle(client) as unknown as Db;

  for (const statement of await generateSchemaSql()) {
    await client.exec(statement);
  }

  setDb(db);

  const [orgA, orgB] = await Promise.all([
    seedTenant(db, {
      orgName: "Org A",
      cognitoSub: "test-user-a",
      email: "a@org-a.test",
    }),
    seedTenant(db, {
      orgName: "Org B",
      cognitoSub: "test-user-b",
      email: "b@org-b.test",
    }),
  ]);

  return { db, orgA, orgB, close: () => client.close() };
}

interface SeedTenantInput {
  orgName: string;
  cognitoSub: string;
  email: string;
}

async function seedTenant(db: Db, input: SeedTenantInput): Promise<TestTenant> {
  const [org] = await db
    .insert(organizationsTable)
    .values({ name: input.orgName })
    .returning();
  const [user] = await db
    .insert(usersTable)
    .values({ cognitoSub: input.cognitoSub, email: input.email, orgId: org.id })
    .returning();

  return {
    org,
    user,
    claims: {
      providerUserId: user.cognitoSub,
      email: user.email,
      provider: user.provider,
    },
  };
}

export interface CreateTestAppOptions {
  /** Tenant whose user every request is authenticated as. Omit for unauthenticated requests. */
  asUser?: TestTenant;
}

/**
 * Supertest agent for the real Express `app` with `requireAuth` stubbed
 * (see setup.ts). `resolveUser` and every route run unmodified against the
 * injected database, so tests exercise the same SQL production does.
 */
export function createTestApp({ asUser }: CreateTestAppOptions = {}): Agent {
  const agent = request.agent(app);
  if (asUser) {
    agent.set(TEST_AUTH_HEADER, JSON.stringify(asUser.claims));
  }
  return agent;
}
