import type { Request } from "express";
import { db, learnersTable, pathwaysTable, fundingSourcesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * An error that maps directly to an HTTP response. Thrown from tenancy guards
 * and translated by the error handler in app.ts; anything else becomes a 500.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * The caller's organization id, or a 403. Every route query must be scoped by
 * this value; there is no unscoped fallback. resolveUser guarantees dbUser is
 * set, so a miss here means a middleware-order bug rather than a bad token.
 */
export function requireOrg(req: Request): number {
  const orgId = (req as any).dbUser?.orgId;
  if (typeof orgId !== "number") {
    throw new HttpError(403, "Organization required");
  }
  return orgId;
}

type OrgOwnedTable = typeof learnersTable | typeof pathwaysTable | typeof fundingSourcesTable;

/**
 * Shared shape of the ownership guards below: 404 unless `id` exists in the
 * caller's org. Missing and foreign rows are indistinguishable on purpose, so
 * ids never leak existence across tenants. Returns the org id so callers can
 * keep scoping follow-up queries without a second requireOrg.
 */
async function ownedRow(req: Request, table: OrgOwnedTable, id: number, label: string): Promise<number> {
  const orgId = requireOrg(req);
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.orgId, orgId)));
  if (!row) throw new HttpError(404, `${label} not found`);
  return orgId;
}

/** Guard for every route under /learners/:id/*. */
export function ownedLearner(req: Request, learnerId: number): Promise<number> {
  return ownedRow(req, learnersTable, learnerId, "Learner");
}

/** Guard for /pathways/:id/programs. */
export function ownedPathway(req: Request, pathwayId: number): Promise<number> {
  return ownedRow(req, pathwaysTable, pathwayId, "Pathway");
}

/** Guard for every route under /funding-sources/:fundingSourceId/goals*. */
export function ownedFundingSource(req: Request, fundingSourceId: number): Promise<number> {
  return ownedRow(req, fundingSourcesTable, fundingSourceId, "Funding source");
}
