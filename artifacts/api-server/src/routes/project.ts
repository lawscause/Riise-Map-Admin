import { Router } from "express";
import { db } from "../../../../lib/db/src/index";
import { learnerProjectsTable } from "../../../../lib/db/src/schema/index";
import { eq } from "drizzle-orm";
import { ownedLearner } from "../lib/tenant";

export const projectRouter = Router();

// Get projects for a specific learner
projectRouter.get("/learners/:learnerId/projects", async (req, res) => {
  const learnerId = parseInt(req.params.learnerId, 10);
  if (isNaN(learnerId)) {
    return res.status(400).json({ error: "Invalid learner ID" });
  }
  await ownedLearner(req, learnerId);
  try {
    const projects = await db
      .select()
      .from(learnerProjectsTable)
      .where(eq(learnerProjectsTable.learnerId, learnerId));

    res.json(projects);
  } catch (error) {
    console.error("Error fetching learner projects:", error);
    res.status(500).json({ error: "Failed to fetch learner projects" });
  }
});