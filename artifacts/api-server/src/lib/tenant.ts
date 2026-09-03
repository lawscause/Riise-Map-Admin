import type { Request } from "express";
import { db, learnersTable } from "@workspace/db";
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

/**
 * Assert that a learner belongs to the caller's organization before touching
 * any of its sub-resources. A learner in another org is reported as 404, not
 * 403, so ids never leak existence across tenants.
 */
export async function ownedLearner(req: Request, learnerId: number): Promise<{ id: number }> {
  const orgId = requireOrg(req);
  const [row] = await db
    .select({ id: learnersTable.id })
    .from(learnersTable)
    .where(and(eq(learnersTable.id, learnerId), eq(learnersTable.orgId, orgId)));
  if (!row) throw new HttpError(404, "Learner not found");
  return row;
}
