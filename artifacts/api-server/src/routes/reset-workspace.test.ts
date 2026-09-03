/**
 * F2 — org-scoped, transactional workspace reset.
 *
 * Two organizations are seeded with a full resource set (learner + note +
 * roadmap, program, pathway + program link, funding source + goal, success
 * story). A reset by Org A must remove only A's rows, leave B untouched,
 * preserve id sequences, roll back completely on a mid-transaction failure,
 * and write exactly one action="reset" audit row per successful call.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PgDatabase } from "drizzle-orm/pg-core";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import {
  auditLogTable,
  fundingSourceGoalsTable,
  fundingSourcesTable,
  learnerNotesTable,
  learnerRoadmapsTable,
  learnersTable,
  pathwayProgramsTable,
  pathwaysTable,
  programsTable,
  successStoriesTable,
  type FundingSource,
  type FundingSourceGoal,
  type Learner,
  type LearnerNote,
  type LearnerRoadmap,
  type Pathway,
  type Program,
  type SuccessStory,
} from "@workspace/db";
import { createTestApp, createTestDatabase, type TestDatabase } from "../test/harness";

let tdb: TestDatabase;

interface OrgFixtures {
  learner: Learner;
  note: LearnerNote;
  roadmap: LearnerRoadmap;
  program: Program;
  pathway: Pathway;
  fundingSource: FundingSource;
  goal: FundingSourceGoal;
  story: SuccessStory;
}

let b: OrgFixtures;

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

async function seedOrgData(orgId: number, tag: string): Promise<OrgFixtures> {
  const [learner] = await tdb.db
    .insert(learnersTable)
    .values({ ...learnerBody(`Learner ${tag}`, `learner-${tag}@test`), orgId })
    .returning();
  const [note] = await tdb.db
    .insert(learnerNotesTable)
    .values({ learnerId: learner.id, author: "coach", date: "2026-01-01", content: `note ${tag}` })
    .returning();
  const [roadmap] = await tdb.db
    .insert(learnerRoadmapsTable)
    .values({ learnerId: learner.id, title: `Roadmap ${tag}`, state: "in_progress", dueDate: "2026-06-01" })
    .returning();
  const [program] = await tdb.db.insert(programsTable).values({ ...programBody(tag), orgId }).returning();
  const [pathway] = await tdb.db.insert(pathwaysTable).values({ ...pathwayBody(`Pathway ${tag}`), orgId }).returning();
  await tdb.db.insert(pathwayProgramsTable).values({ pathwayId: pathway.id, programId: program.id });
  const [fundingSource] = await tdb.db.insert(fundingSourcesTable).values({ name: `Grant ${tag}`, orgId }).returning();
  const [goal] = await tdb.db
    .insert(fundingSourceGoalsTable)
    .values({ fundingSourceId: fundingSource.id, title: `Goal ${tag}` })
    .returning();
  const [story] = await tdb.db
    .insert(successStoriesTable)
    .values({ orgId, learnerId: learner.id, learnerName: learner.name, headline: `Story ${tag}`, story: `Body ${tag}` })
    .returning();
  return { learner, note, roadmap, program, pathway, fundingSource, goal, story };
}

async function tenantCounts(orgId: number) {
  const orgLearners = tdb.db.select({ id: learnersTable.id }).from(learnersTable).where(eq(learnersTable.orgId, orgId));
  const orgPathways = tdb.db.select({ id: pathwaysTable.id }).from(pathwaysTable).where(eq(pathwaysTable.orgId, orgId));
  const orgFundingSources = tdb.db
    .select({ id: fundingSourcesTable.id })
    .from(fundingSourcesTable)
    .where(eq(fundingSourcesTable.orgId, orgId));
  const [
    [learners],
    [notes],
    [roadmaps],
    [programs],
    [pathwayPrograms],
    [pathways],
    [fundingSources],
    [goals],
    [stories],
  ] = await Promise.all([
    tdb.db.select({ n: count() }).from(learnersTable).where(eq(learnersTable.orgId, orgId)),
    tdb.db.select({ n: count() }).from(learnerNotesTable).where(inArray(learnerNotesTable.learnerId, orgLearners)),
    tdb.db.select({ n: count() }).from(learnerRoadmapsTable).where(inArray(learnerRoadmapsTable.learnerId, orgLearners)),
    tdb.db.select({ n: count() }).from(programsTable).where(eq(programsTable.orgId, orgId)),
    tdb.db.select({ n: count() }).from(pathwayProgramsTable).where(inArray(pathwayProgramsTable.pathwayId, orgPathways)),
    tdb.db.select({ n: count() }).from(pathwaysTable).where(eq(pathwaysTable.orgId, orgId)),
    tdb.db.select({ n: count() }).from(fundingSourcesTable).where(eq(fundingSourcesTable.orgId, orgId)),
    tdb.db
      .select({ n: count() })
      .from(fundingSourceGoalsTable)
      .where(inArray(fundingSourceGoalsTable.fundingSourceId, orgFundingSources)),
    tdb.db.select({ n: count() }).from(successStoriesTable).where(eq(successStoriesTable.orgId, orgId)),
  ]);
  return {
    learners: learners.n,
    notes: notes.n,
    roadmaps: roadmaps.n,
    programs: programs.n,
    pathwayPrograms: pathwayPrograms.n,
    pathways: pathways.n,
    fundingSources: fundingSources.n,
    goals: goals.n,
    successStories: stories.n,
  };
}

async function resetAuditRowCount(orgId: number): Promise<number> {
  const [row] = await tdb.db
    .select({ n: count() })
    .from(auditLogTable)
    .where(and(eq(auditLogTable.orgId, orgId), eq(auditLogTable.action, "reset")));
  return row.n;
}

beforeAll(async () => {
  tdb = await createTestDatabase();
  b = await seedOrgData(tdb.orgB.org.id, "B");
});

afterAll(async () => {
  await tdb.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const asA = () => createTestApp({ asUser: tdb.orgA });

describe("POST /api/reset-workspace", () => {
  it("removes only the caller org's rows, leaves other orgs untouched, and preserves id sequences", async () => {
    await seedOrgData(tdb.orgA.org.id, "A");
    const countsB = await tenantCounts(tdb.orgB.org.id);

    const res = await asA().post("/api/reset-workspace");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deleted).toEqual({
      success_stories: 1,
      funding_sources: 1,
      pathways: 1,
      programs: 1,
      learners: 1,
    });

    expect(await tenantCounts(tdb.orgA.org.id)).toEqual({
      learners: 0,
      notes: 0,
      roadmaps: 0,
      programs: 0,
      pathwayPrograms: 0,
      pathways: 0,
      fundingSources: 0,
      goals: 0,
      successStories: 0,
    });
    expect(await tenantCounts(tdb.orgB.org.id)).toEqual(countsB);

    // Sequences are preserved: B's next learner keeps consuming the shared sequence.
    const [newBLearner] = await tdb.db
      .insert(learnersTable)
      .values({ ...learnerBody("Learner B2", "learner-B2@test"), orgId: tdb.orgB.org.id })
      .returning();
    expect(newBLearner.id).toBeGreaterThan(b.learner.id);
  });

  it("rolls back every delete and answers 500 when a delete fails mid-transaction", async () => {
    await seedOrgData(tdb.orgA.org.id, "A2");
    const countsBefore = await tenantCounts(tdb.orgA.org.id);
    const auditRowsBefore = await resetAuditRowCount(tdb.orgA.org.id);

    // Fail the third delete (pathways): a mid-transaction failure must abort
    // every delete on the same connection, leaving all counts untouched.
    const realDelete = PgDatabase.prototype.delete;
    let deleteCalls = 0;
    vi.spyOn(PgDatabase.prototype, "delete").mockImplementation(function (this: InstanceType<typeof PgDatabase>, ...args) {
      deleteCalls += 1;
      if (deleteCalls === 3) throw new Error("injected delete failure");
      return realDelete.apply(this, args);
    });

    const res = await asA().post("/api/reset-workspace");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(deleteCalls).toBeGreaterThanOrEqual(3);

    expect(await tenantCounts(tdb.orgA.org.id)).toEqual(countsBefore);
    expect(await resetAuditRowCount(tdb.orgA.org.id)).toBe(auditRowsBefore);
  });

  it("writes exactly one action=reset audit row for the caller org after success", async () => {
    await seedOrgData(tdb.orgA.org.id, "A3");
    const auditRowsBefore = await resetAuditRowCount(tdb.orgA.org.id);

    const res = await asA().post("/api/reset-workspace");
    expect(res.status).toBe(200);

    expect(await resetAuditRowCount(tdb.orgA.org.id)).toBe(auditRowsBefore + 1);
    const [entry] = await tdb.db
      .select()
      .from(auditLogTable)
      .where(and(eq(auditLogTable.orgId, tdb.orgA.org.id), eq(auditLogTable.action, "reset")))
      .orderBy(desc(auditLogTable.id))
      .limit(1);
    expect(entry.entityType).toBe("workspace");
    expect(JSON.parse(entry.details ?? "{}")).toEqual(res.body.deleted);
  });

  it("answers 200 with all-zero counts for an org with no data", async () => {
    const res = await asA().post("/api/reset-workspace");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      deleted: { success_stories: 0, funding_sources: 0, pathways: 0, programs: 0, learners: 0 },
    });
  });
});
