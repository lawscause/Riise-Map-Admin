import { Router, type IRouter } from "express";
import { db, learnersTable, fundingSourcesTable, fundingSourceGoalsTable } from "@workspace/db";
import { eq, lt, gt, and, sql } from "drizzle-orm";
import { requireOrg } from "../lib/tenant";

const router: IRouter = Router();

router.get("/dashboard-priorities", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const priorities: { text: string; href: string; urgency: string }[] = [];

    // Learners flagged for support
    const flaggedWhere = and(eq(learnersTable.flaggedForSupport, true), eq(learnersTable.orgId, orgId));
    const flagged = await db.select({ count: sql<number>`count(*)` }).from(learnersTable).where(flaggedWhere);
    const flaggedCount = Number(flagged[0].count);
    if (flaggedCount > 0) {
      priorities.push({ text: `${flaggedCount} learner${flaggedCount > 1 ? "s" : ""} flagged for support`, href: "/learners?sort=status&dir=asc", urgency: "high" });
    }

    // Learners with low readiness (<25)
    const lowWhere = and(lt(learnersTable.readiness, 25), eq(learnersTable.orgId, orgId));
    const lowReadiness = await db.select({ count: sql<number>`count(*)` }).from(learnersTable).where(lowWhere);
    const lowCount = Number(lowReadiness[0].count);
    if (lowCount > 0) {
      priorities.push({ text: `${lowCount} learner${lowCount > 1 ? "s" : ""} with low readiness scores`, href: "/learners?sort=readiness&dir=asc", urgency: "medium" });
    }

    // Funding sources expiring within 30 days
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringWhere = and(gt(fundingSourcesTable.endDate, now.toISOString().split("T")[0]), lt(fundingSourcesTable.endDate, thirtyDays.toISOString().split("T")[0]), eq(fundingSourcesTable.orgId, orgId));
    const expiring = await db.select({ name: fundingSourcesTable.name }).from(fundingSourcesTable).where(expiringWhere);
    for (const fs of expiring) {
      priorities.push({ text: `${fs.name} grant period ending soon`, href: "/impact?status=expiring_soon", urgency: "high" });
    }

    // Funding goals not started (join through funding_sources for org scoping)
    const notStarted = await db.select({ count: sql<number>`count(*)` }).from(fundingSourceGoalsTable)
      .innerJoin(fundingSourcesTable, eq(fundingSourceGoalsTable.fundingSourceId, fundingSourcesTable.id))
      .where(and(eq(fundingSourceGoalsTable.status, "not_started"), eq(fundingSourcesTable.orgId, orgId)));
    const nsCount = Number(notStarted[0].count);
    if (nsCount > 0) {
      priorities.push({ text: `${nsCount} funding goal${nsCount > 1 ? "s" : ""} not yet started`, href: "/impact?status=not_started", urgency: "medium" });
    }

    // Learners with zero progress
    const npWhere = and(eq(learnersTable.progress, 0), eq(learnersTable.orgId, orgId));
    const noProgress = await db.select({ count: sql<number>`count(*)` }).from(learnersTable).where(npWhere);
    const npCount = Number(noProgress[0].count);
    if (npCount > 0) {
      priorities.push({ text: `${npCount} learner${npCount > 1 ? "s" : ""} with no progress recorded`, href: "/learners?sort=progress&dir=asc", urgency: "low" });
    }

    res.json(priorities);
  } catch (error) {
    console.error("Error computing priorities:", error);
    res.status(500).json({ error: "Failed to compute priorities" });
  }
});

export default router;
