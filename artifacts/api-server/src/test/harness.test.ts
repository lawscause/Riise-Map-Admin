import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { learnersTable } from "@workspace/db";
import {
  createTestApp,
  createTestDatabase,
  type TestDatabase,
} from "./harness";

let tdb: TestDatabase;

beforeAll(async () => {
  tdb = await createTestDatabase();
});

afterAll(async () => {
  await tdb.close();
});

function learnerFor(orgId: number, name: string, email: string) {
  return {
    orgId,
    name,
    email,
    pathway: "Software Engineering",
    program: "Cohort 1",
    coach: "Coach",
    progress: 10,
    readiness: 20,
    status: "On Track",
    lastActive: "today",
    nextAction: "none",
    joinDate: "2026-01-01",
  };
}

describe("test harness", () => {
  it("returns only the caller's organization's learners", async () => {
    await tdb.db
      .insert(learnersTable)
      .values([
        learnerFor(tdb.orgA.org.id, "Alice A", "alice@org-a.test"),
        learnerFor(tdb.orgB.org.id, "Bob B", "bob@org-b.test"),
      ]);

    const response = await createTestApp({ asUser: tdb.orgA }).get(
      "/api/learners",
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      name: "Alice A",
      orgId: tdb.orgA.org.id,
    });
  });

  it("rejects requests without credentials", async () => {
    const response = await createTestApp().get("/api/learners");

    expect(response.status).toBe(401);
  });
});
