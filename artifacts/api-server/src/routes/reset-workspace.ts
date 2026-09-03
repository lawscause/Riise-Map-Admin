import { Router, type IRouter } from "express";
import {
  db,
  fundingSourcesTable,
  learnersTable,
  pathwaysTable,
  programsTable,
  successStoriesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireOrg } from "../lib/tenant";
import { logAudit } from "./audit-log";

const router: IRouter = Router();

router.post("/reset-workspace", async (req, res) => {
  const orgId = requireOrg(req);

  // Every org-owned child table (learner notes/roadmaps/events/projects/
  // readiness scores/activities, the funding-source learner/program/pathway
  // links and goals, pathway_programs) carries ON DELETE CASCADE from its
  // parent in lib/db/src/schema, so deleting the five roots below removes
  // them all. audit_log and learner_statuses are intentionally preserved.
  // One transaction means a failure anywhere rolls back every delete on the
  // same connection — the old string-wrapped transaction statements could
  // straddle pooled connections.
  const deleted = await db.transaction(async (tx) => {
    const successStories = await tx
      .delete(successStoriesTable)
      .where(eq(successStoriesTable.orgId, orgId))
      .returning({ id: successStoriesTable.id });
    const fundingSources = await tx
      .delete(fundingSourcesTable)
      .where(eq(fundingSourcesTable.orgId, orgId))
      .returning({ id: fundingSourcesTable.id });
    const pathways = await tx
      .delete(pathwaysTable)
      .where(eq(pathwaysTable.orgId, orgId))
      .returning({ id: pathwaysTable.id });
    const programs = await tx
      .delete(programsTable)
      .where(eq(programsTable.orgId, orgId))
      .returning({ id: programsTable.id });
    const learners = await tx
      .delete(learnersTable)
      .where(eq(learnersTable.orgId, orgId))
      .returning({ id: learnersTable.id });

    return {
      success_stories: successStories.length,
      funding_sources: fundingSources.length,
      pathways: pathways.length,
      programs: programs.length,
      learners: learners.length,
    };
  });

  // The reset is already committed, so a failed audit write must not fail
  // (or roll back) the destructive operation it records: log it and still
  // answer 200.
  try {
    await logAudit(req, "reset", "workspace", undefined, undefined, JSON.stringify(deleted));
  } catch (error) {
    logger.error({ err: error, orgId }, "Failed to write audit row for workspace reset");
  }

  res.json({ success: true, deleted });
});

export default router;
