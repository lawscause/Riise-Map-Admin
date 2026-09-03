/**
 * Cross-tenant matrix for F1 (fail-closed tenancy).
 *
 * Two organizations are seeded with one of each org-owned resource. Every
 * assertion is made as Org A's user against Org B's ids (expect 404 / empty)
 * and against A's own ids (expect success). resolveUser failure modes are
 * exercised against the real middleware chain.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  learnersTable,
  learnerNotesTable,
  programsTable,
  pathwaysTable,
  pathwayProgramsTable,
  fundingSourcesTable,
  fundingSourceGoalsTable,
  type Learner,
  type LearnerNote,
  type Program,
  type Pathway,
  type FundingSource,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createTestApp, createTestDatabase, type TestDatabase, type TestTenant } from "../test/harness";
import { TEST_AUTH_HEADER } from "../test/setup";

let tdb: TestDatabase;

interface TenantFixtures {
  learner: Learner;
  note: LearnerNote;
  program: Program;
  pathway: Pathway;
  fundingSource: FundingSource;
}

let a: TenantFixtures;
let b: TenantFixtures;

function learnerBody(name: string, email: string) {
  return {
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

function programBody(tag: string) {
  return {
    name: `Program ${tag}`,
    programTag: tag,
    description: "d",
    pathwayCategory: "Software",
    activeLearners: 0,
    completionRate: 0,
    readinessScore: 0,
    eventParticipation: 0,
    placementReady: 0,
    funderTag: "f",
    cohort: "c",
    startDate: "2026-01-01",
    endDate: "2026-06-01",
  };
}

function pathwayBody(name: string) {
  return { name, description: "d", targetProfile: "t", estimatedWeeks: 12, activeLearners: 0 };
}

async function seedTenant(tenant: TestTenant, tag: string): Promise<TenantFixtures> {
  const orgId = tenant.org.id;
  const [learner] = await tdb.db
    .insert(learnersTable)
    .values({ ...learnerBody(`Learner ${tag}`, `learner-${tag}@test`), orgId })
    .returning();
  const [note] = await tdb.db
    .insert(learnerNotesTable)
    .values({ learnerId: learner.id, author: "coach", date: "2026-01-01", content: `note ${tag}` })
    .returning();
  const [program] = await tdb.db
    .insert(programsTable)
    .values({ ...programBody(tag), orgId })
    .returning();
  const [pathway] = await tdb.db
    .insert(pathwaysTable)
    .values({ ...pathwayBody(`Pathway ${tag}`), orgId })
    .returning();
  await tdb.db.insert(pathwayProgramsTable).values({ pathwayId: pathway.id, programId: program.id });
  const [fundingSource] = await tdb.db
    .insert(fundingSourcesTable)
    .values({ name: `Grant ${tag}`, orgId })
    .returning();
  await tdb.db
    .insert(fundingSourceGoalsTable)
    .values({ fundingSourceId: fundingSource.id, title: `Goal ${tag}` });
  return { learner, note, program, pathway, fundingSource };
}

beforeAll(async () => {
  tdb = await createTestDatabase();
  a = await seedTenant(tdb.orgA, "A");
  b = await seedTenant(tdb.orgB, "B");
});

afterAll(async () => {
  await tdb.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const asA = () => createTestApp({ asUser: tdb.orgA });

describe("resource routes: Org A against Org B's ids", () => {
  it("GET on another org's id is 404 for every resource; own id is 200", async () => {
    const cases = [
      ["/api/learners", () => a.learner.id, () => b.learner.id],
      ["/api/programs", () => a.program.id, () => b.program.id],
      ["/api/pathways", () => a.pathway.id, () => b.pathway.id],
      ["/api/funding-sources", () => a.fundingSource.id, () => b.fundingSource.id],
    ] as const;

    for (const [base, own, foreign] of cases) {
      const foreignRes = await asA().get(`${base}/${foreign()}`);
      expect(foreignRes.status, `GET ${base}/:id foreign`).toBe(404);
      const ownRes = await asA().get(`${base}/${own()}`);
      expect(ownRes.status, `GET ${base}/:id own`).toBe(200);
      expect(ownRes.body.orgId).toBe(tdb.orgA.org.id);
    }
  });

  it("PUT on another org's id is 404 and leaves the row untouched; own id is 200", async () => {
    const learnerRes = await asA()
      .put(`/api/learners/${b.learner.id}`)
      .send(learnerBody("Hijacked", "hijacked@test"));
    expect(learnerRes.status).toBe(404);
    const [bLearner] = await tdb.db.select().from(learnersTable).where(eq(learnersTable.id, b.learner.id));
    expect(bLearner.name).toBe("Learner B");

    expect((await asA().put(`/api/programs/${b.program.id}`).send({ name: "Hijacked" })).status).toBe(404);
    expect((await asA().put(`/api/pathways/${b.pathway.id}`).send({ name: "Hijacked" })).status).toBe(404);
    expect((await asA().put(`/api/funding-sources/${b.fundingSource.id}`).send({ name: "Hijacked" })).status).toBe(404);

    expect(
      (await asA().put(`/api/learners/${a.learner.id}`).send(learnerBody("Learner A", `learner-A@test`))).status,
    ).toBe(200);
    expect((await asA().put(`/api/programs/${a.program.id}`).send({ name: "Program A" })).status).toBe(200);
    expect((await asA().put(`/api/pathways/${a.pathway.id}`).send({ name: "Pathway A" })).status).toBe(200);
    expect((await asA().put(`/api/funding-sources/${a.fundingSource.id}`).send({ name: "Grant A" })).status).toBe(200);
  });

  it("list endpoints return only Org A's rows", async () => {
    const orgId = tdb.orgA.org.id;
    for (const path of ["/api/learners", "/api/programs", "/api/pathways", "/api/funding-sources"]) {
      const res = await asA().get(path);
      expect(res.status, path).toBe(200);
      expect(res.body.length, path).toBeGreaterThan(0);
      for (const row of res.body) expect(row.orgId, path).toBe(orgId);
    }

    const goals = await asA().get("/api/funding-source-goals");
    expect(goals.status).toBe(200);
    expect(goals.body.map((g: { title: string }) => g.title)).toEqual(["Goal A"]);
  });

  it("DELETE on another org's id is 404 and the row survives; own id is 200", async () => {
    expect((await asA().delete(`/api/learners/${b.learner.id}`)).status).toBe(404);
    expect((await asA().delete(`/api/programs/${b.program.id}`)).status).toBe(404);
    expect((await asA().delete(`/api/pathways/${b.pathway.id}`)).status).toBe(404);
    expect((await asA().delete(`/api/funding-sources/${b.fundingSource.id}`)).status).toBe(404);
    expect(await tdb.db.select().from(learnersTable).where(eq(learnersTable.id, b.learner.id))).toHaveLength(1);
    expect(await tdb.db.select().from(programsTable).where(eq(programsTable.id, b.program.id))).toHaveLength(1);
    expect(await tdb.db.select().from(pathwaysTable).where(eq(pathwaysTable.id, b.pathway.id))).toHaveLength(1);
    expect(
      await tdb.db.select().from(fundingSourcesTable).where(eq(fundingSourcesTable.id, b.fundingSource.id)),
    ).toHaveLength(1);

    // Own rows created just for deletion so the shared fixtures survive for later tests.
    const [prog] = await tdb.db
      .insert(programsTable)
      .values({ ...programBody("A-del"), orgId: tdb.orgA.org.id })
      .returning();
    const [pw] = await tdb.db
      .insert(pathwaysTable)
      .values({ ...pathwayBody("Pathway A-del"), orgId: tdb.orgA.org.id })
      .returning();
    const [fs] = await tdb.db
      .insert(fundingSourcesTable)
      .values({ name: "Grant A-del", orgId: tdb.orgA.org.id })
      .returning();
    const [lr] = await tdb.db
      .insert(learnersTable)
      .values({ ...learnerBody("Learner A-del", "learner-a-del@test"), orgId: tdb.orgA.org.id })
      .returning();
    expect((await asA().delete(`/api/learners/${lr.id}`)).status).toBe(200);
    expect((await asA().delete(`/api/programs/${prog.id}`)).status).toBe(200);
    expect((await asA().delete(`/api/pathways/${pw.id}`)).status).toBe(200);
    expect((await asA().delete(`/api/funding-sources/${fs.id}`)).status).toBe(200);
  });
});

describe("learner sub-resources", () => {
  const subResources = ["roadmaps", "projects", "events", "notes", "readiness", "activities"];

  it("every GET sub-resource on Org B's learner is 404; own learner is 200", async () => {
    for (const sub of subResources) {
      const foreign = await asA().get(`/api/learners/${b.learner.id}/${sub}`);
      expect(foreign.status, `GET ${sub} foreign`).toBe(404);
      expect(foreign.body).toEqual({ error: "Learner not found" });
      const own = await asA().get(`/api/learners/${a.learner.id}/${sub}`);
      expect(own.status, `GET ${sub} own`).toBe(200);
      expect(Array.isArray(own.body)).toBe(true);
    }
  });

  it("POST note on Org B's learner is 404 and writes nothing; own learner is 201", async () => {
    const before = await tdb.db.select().from(learnerNotesTable).where(eq(learnerNotesTable.learnerId, b.learner.id));
    const foreign = await asA()
      .post(`/api/learners/${b.learner.id}/notes`)
      .send({ author: "a", date: "2026-01-02", content: "intrusion" });
    expect(foreign.status).toBe(404);
    const after = await tdb.db.select().from(learnerNotesTable).where(eq(learnerNotesTable.learnerId, b.learner.id));
    expect(after).toHaveLength(before.length);

    const own = await asA()
      .post(`/api/learners/${a.learner.id}/notes`)
      .send({ author: "a", date: "2026-01-02", content: "fine" });
    expect(own.status).toBe(201);
    expect(own.body.learnerId).toBe(a.learner.id);
  });

  it("PUT/DELETE note on Org B's learner is 404 and the note is unchanged", async () => {
    const put = await asA()
      .put(`/api/learners/${b.learner.id}/notes/${b.note.id}`)
      .send({ content: "tampered" });
    expect(put.status).toBe(404);
    const del = await asA().delete(`/api/learners/${b.learner.id}/notes/${b.note.id}`);
    expect(del.status).toBe(404);
    const [bNote] = await tdb.db.select().from(learnerNotesTable).where(eq(learnerNotesTable.id, b.note.id));
    expect(bNote.content).toBe("note B");
  });

  it("a note id from another learner cannot be reached through an own learner's URL", async () => {
    const put = await asA()
      .put(`/api/learners/${a.learner.id}/notes/${b.note.id}`)
      .send({ content: "tampered" });
    expect(put.status).toBe(404);
    const del = await asA().delete(`/api/learners/${a.learner.id}/notes/${b.note.id}`);
    expect(del.status).toBe(404);
    const [bNote] = await tdb.db.select().from(learnerNotesTable).where(eq(learnerNotesTable.id, b.note.id));
    expect(bNote.content).toBe("note B");
  });

  it("PUT/DELETE own note succeeds", async () => {
    const put = await asA()
      .put(`/api/learners/${a.learner.id}/notes/${a.note.id}`)
      .send({ content: "edited" });
    expect(put.status).toBe(200);
    expect(put.body.content).toBe("edited");
    const del = await asA().delete(`/api/learners/${a.learner.id}/notes/${a.note.id}`);
    expect(del.status).toBe(200);
  });
});

describe("pathway ↔ program links", () => {
  it("GET/PUT /pathways/:id/programs on Org B's pathway is 404", async () => {
    expect((await asA().get(`/api/pathways/${b.pathway.id}/programs`)).status).toBe(404);
    const put = await asA()
      .put(`/api/pathways/${b.pathway.id}/programs`)
      .send({ programIds: [a.program.id] });
    expect(put.status).toBe(404);
    const links = await tdb.db
      .select()
      .from(pathwayProgramsTable)
      .where(eq(pathwayProgramsTable.pathwayId, b.pathway.id));
    expect(links.map((l: { programId: number }) => l.programId)).toEqual([b.program.id]);
  });

  it("PUT with a programId from Org B is 400 and the link set is unchanged", async () => {
    const res = await asA()
      .put(`/api/pathways/${a.pathway.id}/programs`)
      .send({ programIds: [a.program.id, b.program.id] });
    expect(res.status).toBe(400);
    const links = await tdb.db
      .select()
      .from(pathwayProgramsTable)
      .where(eq(pathwayProgramsTable.pathwayId, a.pathway.id));
    expect(links.map((l: { programId: number }) => l.programId)).toEqual([a.program.id]);
  });

  it("PUT with own programIds succeeds and GET reflects it", async () => {
    const put = await asA().put(`/api/pathways/${a.pathway.id}/programs`).send({ programIds: [a.program.id] });
    expect(put.status).toBe(200);
    const get = await asA().get(`/api/pathways/${a.pathway.id}/programs`);
    expect(get.status).toBe(200);
    expect(get.body).toEqual([a.program.id]);
  });

  it("GET /pathway-programs returns only Org A's links", async () => {
    const res = await asA().get("/api/pathway-programs");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ pathwayId: a.pathway.id, programId: a.program.id });
  });
});

describe("funding-source goals", () => {
  it("goal routes under Org B's funding source are 404", async () => {
    expect((await asA().get(`/api/funding-sources/${b.fundingSource.id}/goals`)).status).toBe(404);
    const post = await asA()
      .post(`/api/funding-sources/${b.fundingSource.id}/goals`)
      .send({ title: "intrusion" });
    expect(post.status).toBe(404);
    const goals = await tdb.db
      .select()
      .from(fundingSourceGoalsTable)
      .where(eq(fundingSourceGoalsTable.fundingSourceId, b.fundingSource.id));
    expect(goals).toHaveLength(1);
    expect((await asA().get(`/api/funding-sources/${a.fundingSource.id}/goals`)).status).toBe(200);
  });
});

describe("resolveUser fails closed", () => {
  it("answers 500 and never reaches the route when the user upsert rejects", async () => {
    const insertSpy = vi.spyOn(tdb.db, "insert").mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const selectSpy = vi.spyOn(tdb.db, "select");

    const res = await asA().get("/api/learners");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Failed to resolve user" });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    // The learners handler starts with db.select(); it must never have run.
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("answers 401 when the verified token carries no email claim", async () => {
    const res = await createTestApp()
      .get("/api/learners")
      .set(TEST_AUTH_HEADER, JSON.stringify({ providerUserId: "no-email-user", provider: "cognito" }));

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token missing email claim" });
  });

  it("still 401s from requireAuth when no bearer is presented", async () => {
    const res = await createTestApp().get("/api/learners");
    expect(res.status).toBe(401);
  });
});
