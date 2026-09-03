import type { Request, Response, NextFunction } from "express";
import { db, usersTable, organizationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Resolve the authenticated principal to a database user with an organization.
 *
 * Fails closed: the request only proceeds when `req.dbUser.orgId` is a number.
 * A token without an email claim is 401; any failure while upserting the user
 * or creating its organization is logged and answered 500. Never falls through
 * to the router with an unresolved user, because every route scopes its
 * queries by `dbUser.orgId` and would otherwise have nothing to scope on.
 *
 * requireAuth runs first and already 401s requests without a verified
 * principal, so `!auth?.providerUserId` here is a defensive duplicate of that
 * check rather than a bypass.
 */
export async function resolveUser(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") return next();

  const auth = (req as any).user;
  if (!auth?.providerUserId) {
    return res.status(401).json({ error: "Missing authorization token" });
  }
  if (typeof auth.email !== "string" || auth.email.length === 0) {
    return res.status(401).json({ error: "Token missing email claim" });
  }

  try {
    // Upsert user, update last_seen
    const [user] = await db
      .insert(usersTable)
      .values({
        cognitoSub: auth.providerUserId,
        email: auth.email,
        provider: auth.provider || "cognito",
      })
      .onConflictDoUpdate({
        target: usersTable.cognitoSub,
        set: { lastSeenAt: sql`now()` },
      })
      .returning();

    // If user has no org, create one
    if (!user.orgId) {
      const [org] = await db
        .insert(organizationsTable)
        .values({ name: auth.email.split("@")[0] })
        .returning();

      await db.update(usersTable).set({ orgId: org.id }).where(eq(usersTable.id, user.id));
      user.orgId = org.id;
    }

    if (typeof user.orgId !== "number") {
      throw new Error(`User ${user.id} resolved without an organization`);
    }

    (req as any).dbUser = user;
  } catch (err) {
    logger.error({ err, providerUserId: auth.providerUserId }, "Failed to resolve user");
    return res.status(500).json({ error: "Failed to resolve user" });
  }

  next();
}
