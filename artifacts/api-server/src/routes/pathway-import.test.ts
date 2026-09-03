/**
 * Route tests for F8 — POST /pathways/import returns `ids` positionally
 * aligned with the request rows: exactly one entry per row, null for a row
 * that failed, so clients linking sub-resources by index hit the right
 * pathway. `imported` and `errors` keep their pre-F8 shape.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, createTestDatabase, type TestDatabase } from "../test/harness";

let tdb: TestDatabase;

beforeAll(async () => {
  tdb = await createTestDatabase();
});

afterAll(async () => {
  await tdb.close();
});

/**
 * The import route pre-fills estimatedWeeks/activeLearners and tolerates absent
 * list columns, but name and targetProfile stay required. A row without a name
 * is the server-side failure the client's own pre-filter cannot predict.
 */
function validRow(name: string) {
  return { name, description: `${name} description`, targetProfile: "Career changers" };
}

describe("F8 · pathway import ids stay positionally aligned", () => {
  it("returns one id per request row, null for the failed row", async () => {
    const res = await createTestApp({ asUser: tdb.orgA })
      .post("/api/pathways/import")
      .send([
        validRow("Aligned First"),
        { description: "no name", targetProfile: "Career changers" },
        validRow("Aligned Third"),
      ]);

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(2);
    expect(res.body.errors).toEqual([{ row: 2, message: expect.any(String) }]);

    expect(res.body.ids).toHaveLength(3);
    expect(res.body.ids[1]).toBeNull();
    expect(res.body.ids[0]).toEqual(expect.any(Number));
    expect(res.body.ids[2]).toEqual(expect.any(Number));

    // The two non-null ids are exactly the pathways created for rows 1 and 3.
    const list = await createTestApp({ asUser: tdb.orgA }).get("/api/pathways");
    expect(list.status).toBe(200);
    const createdIds = (list.body as { id: number; name: string }[])
      .filter((p) => p.name === "Aligned First" || p.name === "Aligned Third")
      .map((p) => p.id)
      .sort((a, b) => a - b);
    expect(createdIds).toEqual([res.body.ids[0], res.body.ids[2]].sort((a: number, b: number) => a - b));
  });

  it("returns only nulls when every row fails", async () => {
    const res = await createTestApp({ asUser: tdb.orgA })
      .post("/api/pathways/import")
      .send([
        { description: "no name", targetProfile: "Career changers" },
        { description: "also no name", targetProfile: "Career changers" },
      ]);

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(0);
    expect(res.body.ids).toEqual([null, null]);
    expect(res.body.errors).toHaveLength(2);
  });
});
