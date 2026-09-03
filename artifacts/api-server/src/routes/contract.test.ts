import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  insertCoachSchema,
  insertFundingSourceSchema,
  insertLearnerProjectSchema,
  insertLearnerSchema,
  insertPathwaySchema,
  insertProgramSchema,
} from "@workspace/db";

/**
 * Contract test: the OpenAPI spec (lib/api-spec/openapi.yaml) must accept every
 * field the Drizzle insert schemas accept. When a column is added to lib/db but
 * not to the spec, the generated api-client-react / api-zod packages silently
 * drop it and the frontend is forced into `as any` casts — this test catches
 * that drift at the source.
 *
 * The counterpart of an insert schema is the entity's response schema: every
 * field the server accepts for create/update is a field it can echo back.
 */

type InsertSchema = { shape: Record<string, unknown> };

// Resolve relative to this test file: repo-root/lib/api-spec/openapi.yaml
const specPath = new URL("../../../../lib/api-spec/openapi.yaml", import.meta.url);
const spec = parse(readFileSync(specPath, "utf8")) as {
  components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
};

const pairs: { entity: string; schema: InsertSchema }[] = [
  { entity: "Learner", schema: insertLearnerSchema },
  { entity: "Program", schema: insertProgramSchema },
  { entity: "Pathway", schema: insertPathwaySchema },
  { entity: "Coach", schema: insertCoachSchema },
  { entity: "FundingSource", schema: insertFundingSourceSchema },
  { entity: "LearnerProject", schema: insertLearnerProjectSchema },
];

describe("openapi spec covers drizzle insert schemas", () => {
  for (const { entity, schema } of pairs) {
    it(`${entity}: insert schema keys are all documented in the spec`, () => {
      const properties = spec.components.schemas[entity]?.properties;
      expect(properties, `${entity} schema must exist in openapi.yaml`).toBeDefined();

      const insertKeys = Object.keys(schema.shape);
      const specKeys = new Set(Object.keys(properties!));
      const missing = insertKeys.filter((key) => !specKeys.has(key));

      expect(
        missing,
        `${entity} fields accepted by the API but missing from openapi.yaml`,
      ).toEqual([]);
    });
  }
});
