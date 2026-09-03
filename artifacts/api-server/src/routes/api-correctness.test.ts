/**
 * Route tests for F4–F6 (API correctness).
 *
 * F4 — PUT /pathways/:id/programs replaces links inside one transaction, so a
 *       failed insert leaves the prior link set intact.
 * F5 — PUT /funding-sources/:id is a true partial update: narrative-only saves
 *       succeed, an empty body is rejected, unknown keys are rejected, and the
 *       full-body edit form still works.
 * F6 — program tag uniqueness is checked per organization and only when the
 *       tag itself is being changed.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  fundingSourcesTable,
  pathwayProgramsTable,
  pathwaysTable,
  programsTable,
  type FundingSource,
  type Program,
  type Pathway,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createTestApp, createTestDatabase, type TestDatabase } from "../test/harness";

let tdb: TestDatabase;

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

interface OrgAFixtures {
  /** Three own-org programs; the pathway starts linked to the first two. */
  programs: [Program, Program, Program];
  pathway: Pathway;
  fundingSource: FundingSource;
}

let a: OrgAFixtures;
/** Org B's own program tag, used to prove tag uniqueness is per org. */
let bProgram: Program;

beforeAll(async () => {
  tdb = await createTestDatabase();
  const orgA = tdb.orgA.org.id;
  const programs = await Promise.all(
    ["a-web", "a-mobile", "a-data"].map(
      async (tag) =>
        (
          await tdb.db
            .insert(programsTable)
            .values({ ...programBody(tag), orgId: orgA })
            .returning()
        )[0],
    ),
  );
  const [pathway] = await tdb.db
    .insert(pathwaysTable)
    .values({ ...pathwayBody("Pathway A"), orgId: orgA })
    .returning();
  await tdb.db.insert(pathwayProgramsTable).values([
    { pathwayId: pathway.id, programId: programs[0].id },
    { pathwayId: pathway.id, programId: programs[1].id },
  ]);
  const [fundingSource] = await tdb.db
    .insert(fundingSourcesTable)
    .values({ name: "Grant A", narrative: "old narrative", amount: "100.00", learnerCount: 5, orgId: orgA })
    .returning();
  a = { programs: programs as [Program, Program, Program], pathway, fundingSource };

  const [programB] = await tdb.db
    .insert(programsTable)
    .values({ ...programBody("b-web"), orgId: tdb.orgB.org.id })
    .returning();
  bProgram = programB;
});

afterAll(async () => {
  await tdb.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const asA = () => createTestApp({ asUser: tdb.orgA });
const asB = () => createTestApp({ asUser: tdb.orgB });

async function linksFor(pathwayId: number): Promise<number[]> {
  const links = await tdb.db.select().from(pathwayProgramsTable).where(eq(pathwayProgramsTable.pathwayId, pathwayId));
  return links.map((l: { programId: number }) => l.programId).sort((x, y) => x - y);
}

describe("F4 · pathway program links are replaced atomically", () => {
  it("rolls the delete back when the insert fails: prior links intact, 500", async () => {
    const realTransaction = tdb.db.transaction.bind(tdb.db);
    const spy = vi.spyOn(tdb.db, "transaction").mockImplementation(async (callback) =>
      realTransaction(async (tx) =>
        callback(
          new Proxy(tx, {
            get(target, prop, receiver) {
              // The delete runs for real; only the insert is forced to fail,
              // so the assertion below proves the delete was rolled back.
              if (prop === "insert") {
                return () => {
                  throw new Error("forced insert failure");
                };
              }
              return Reflect.get(target, prop, receiver);
            },
          }) as typeof tx,
        ),
      ),
    );

    try {
      const res = await asA()
        .put(`/api/pathways/${a.pathway.id}/programs`)
        .send({ programIds: [a.programs[2].id] });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Failed to update pathway programs" });
      expect(await linksFor(a.pathway.id)).toEqual([a.programs[0].id, a.programs[1].id]);
    } finally {
      spy.mockRestore();
    }
  });

  it("happy path replaces the set exactly: [p1,p2] then [p2,p3] leaves exactly [p2,p3]", async () => {
    const put = await asA()
      .put(`/api/pathways/${a.pathway.id}/programs`)
      .send({ programIds: [a.programs[1].id, a.programs[2].id] });
    expect(put.status).toBe(200);
    expect(await linksFor(a.pathway.id)).toEqual([a.programs[1].id, a.programs[2].id]);

    // An empty set clears every link and inserts nothing.
    const clear = await asA().put(`/api/pathways/${a.pathway.id}/programs`).send({ programIds: [] });
    expect(clear.status).toBe(200);
    expect(await linksFor(a.pathway.id)).toEqual([]);

    // Restore the seeded link set for later tests.
    await asA().put(`/api/pathways/${a.pathway.id}/programs`).send({ programIds: [a.programs[0].id, a.programs[1].id] });
  });
});

describe("F5 · funding source PUT is a partial update", () => {
  it("PUT {narrative} returns 200 and changes only the narrative", async () => {
    const res = await asA().put(`/api/funding-sources/${a.fundingSource.id}`).send({ narrative: "new narrative" });
    expect(res.status).toBe(200);
    const [row] = await tdb.db.select().from(fundingSourcesTable).where(eq(fundingSourcesTable.id, a.fundingSource.id));
    expect(row.narrative).toBe("new narrative");
    expect(row.name).toBe("Grant A");
    expect(row.learnerCount).toBe(5);
  });

  it("PUT {} is rejected with 400", async () => {
    const res = await asA().put(`/api/funding-sources/${a.fundingSource.id}`).send({});
    expect(res.status).toBe(400);
  });

  it("PUT with an unknown key is rejected with 400 (strict)", async () => {
    const res = await asA()
      .put(`/api/funding-sources/${a.fundingSource.id}`)
      .send({ narrative: "x", notAField: 1 });
    expect(res.status).toBe(400);
  });

  it("the edit form's full body still works, with a numeric amount stringified", async () => {
    const res = await asA()
      .put(`/api/funding-sources/${a.fundingSource.id}`)
      .send({
        name: "Grant A renamed",
        objectives: "objectives",
        narrative: "narrative",
        startDate: "2026-01-01",
        endDate: "2026-06-01",
        amount: 250,
        learnerCount: 7,
      });
    expect(res.status).toBe(200);
    const [row] = await tdb.db.select().from(fundingSourcesTable).where(eq(fundingSourcesTable.id, a.fundingSource.id));
    expect(row.name).toBe("Grant A renamed");
    expect(row.objectives).toBe("objectives");
    expect(Number(row.amount)).toBe(250);
    expect(row.learnerCount).toBe(7);
  });

  it("a numeric amount is accepted only after stringification", async () => {
    // The client sends amount as a JSON number; without the route's stringify
    // the string-typed zod schema would 400 this request.
    const res = await asA().put(`/api/funding-sources/${a.fundingSource.id}`).send({ amount: 99 });
    expect(res.status).toBe(200);
    expect(Number(res.body.amount)).toBe(99);
  });
});

describe("F6 · program tag uniqueness is per organization", () => {
  it("two orgs can each create the same tag; a same-org duplicate is 409", async () => {
    const resA = await asA().post("/api/programs").send(programBody("web-dev"));
    expect(resA.status).toBe(201);
    const resB = await asB().post("/api/programs").send(programBody("web-dev"));
    expect(resB.status).toBe(201);

    const duplicate = await asA().post("/api/programs").send(programBody("web-dev"));
    expect(duplicate.status).toBe(409);
  });

  it("PUT without programTag never collides and updates the row", async () => {
    const res = await asA().put(`/api/programs/${a.programs[1].id}`).send({ name: "Renamed without tag" });
    expect(res.status).toBe(200);
    expect(res.body.programTag).toBe("a-mobile");
    const [row] = await tdb.db.select().from(programsTable).where(eq(programsTable.id, a.programs[1].id));
    expect(row.name).toBe("Renamed without tag");
    expect(row.programTag).toBe("a-mobile");
  });

  it("PUT that sets another program's in-org tag is 409 and the row is untouched", async () => {
    const res = await asA()
      .put(`/api/programs/${a.programs[1].id}`)
      .send({ programTag: a.programs[0].programTag });
    expect(res.status).toBe(409);
    const [row] = await tdb.db.select().from(programsTable).where(eq(programsTable.id, a.programs[1].id));
    expect(row.programTag).toBe("a-mobile");
  });

  it("PUT that re-sets a program's own tag is 200 (self is excluded)", async () => {
    const res = await asA().put(`/api/programs/${a.programs[0].id}`).send({ programTag: "a-web" });
    expect(res.status).toBe(200);
  });

  it("an org can adopt a tag that already exists in another org", async () => {
    const res = await asA().put(`/api/programs/${a.programs[2].id}`).send({ programTag: bProgram.programTag });
    expect(res.status).toBe(200);
    expect(res.body.programTag).toBe("b-web");
  });
});
