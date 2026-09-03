import { Router, type IRouter } from "express";
import { db, successStoriesTable, insertSuccessStorySchema, type InsertSuccessStory } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireOrg, ownedLearner } from "../lib/tenant";

const router: IRouter = Router();

router.get("/success-stories", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const stories = await db
      .select()
      .from(successStoriesTable)
      .where(eq(successStoriesTable.orgId, orgId))
      .orderBy(successStoriesTable.createdAt);
    res.json(stories);
  } catch (error) {
    console.error("Error fetching success stories:", error);
    res.status(500).json({ error: "Failed to fetch success stories" });
  }
});

router.post("/success-stories", async (req, res) => {
  const orgId = requireOrg(req);
  let data: InsertSuccessStory;
  try {
    data = insertSuccessStorySchema.parse(req.body);
  } catch (error) {
    console.error("Error creating success story:", error);
    res.status(400).json({ error: "Invalid data" });
    return;
  }
  // A story may be orphaned (no learner); when a learner is named it must belong
  // to the caller's org. Awaited outside the try block so HttpError(404) reaches
  // the error handler with its own status instead of becoming a 400.
  if (data.learnerId != null) await ownedLearner(req, data.learnerId);
  try {
    const [created] = await db.insert(successStoriesTable).values({ ...data, orgId }).returning();
    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating success story:", error);
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/success-stories/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    // Missing and foreign rows are indistinguishable on purpose (no id leaks).
    const where = and(eq(successStoriesTable.id, id), eq(successStoriesTable.orgId, orgId));
    const [deleted] = await db.delete(successStoriesTable).where(where).returning();
    if (!deleted) { res.status(404).json({ error: "Story not found" }); return; }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting success story:", error);
    res.status(500).json({ error: "Failed to delete story" });
  }
});

export default router;
