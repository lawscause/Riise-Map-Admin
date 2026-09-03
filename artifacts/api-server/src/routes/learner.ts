import { Router, type IRouter } from "express";
import {
  db, learnersTable, insertLearnerSchema,
  learnerRoadmapsTable, learnerProjectsTable, learnerEventsTable,
  learnerNotesTable, learnerReadinessScoresTable, learnerActivitiesTable,
  insertLearnerNoteSchema
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logAudit } from "./audit-log";
import { requireOrg, ownedLearner } from "../lib/tenant";

const router: IRouter = Router();

// Get all learners
router.get("/learners", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const learners = await db.select().from(learnersTable).where(eq(learnersTable.orgId, orgId));
    res.json(learners);
  } catch (error) {
    console.error("Error fetching learners:", error);
    res.status(500).json({ error: "Failed to fetch learners" });
  }
});

// Get single learner
router.get("/learners/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(learnersTable.id, id), eq(learnersTable.orgId, orgId));
    const learner = await db.select().from(learnersTable).where(where);
    if (learner.length === 0) { res.status(404).json({ error: "Learner not found" }); return; }
    res.json(learner[0]);
  } catch (error) {
    console.error("Error fetching learner:", error);
    res.status(500).json({ error: "Failed to fetch learner" });
  }
});

// Create learner
router.post("/learners", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const data = insertLearnerSchema.parse(req.body);
    const existing = await db.select().from(learnersTable).where(eq(learnersTable.email, data.email));
    if (existing.length > 0) {
      res.status(409).json({ error: "A learner with this email already exists." });
      return;
    }
    const [newLearner] = await db.insert(learnersTable).values({ ...data, orgId }).returning();
    await logAudit(req, "created", "learner", newLearner.id, newLearner.name);
    res.status(201).json(newLearner);
  } catch (error) {
    console.error("Error creating learner:", error);
    res.status(400).json({ error: "Invalid data" });
  }
});

// Update learner
router.put("/learners/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const data = insertLearnerSchema.parse(req.body);
    const where = and(eq(learnersTable.id, id), eq(learnersTable.orgId, orgId));
    const [updatedLearner] = await db.update(learnersTable).set(data).where(where).returning();
    if (!updatedLearner) { res.status(404).json({ error: "Learner not found" }); return; }
    await logAudit(req, "updated", "learner", id, updatedLearner.name);
    res.json(updatedLearner);
  } catch (error) {
    console.error("Error updating learner:", error);
    res.status(400).json({ error: "Invalid data" });
  }
});

// Get learner summary
router.get("/learners/:id/summary", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(learnersTable.id, id), eq(learnersTable.orgId, orgId));
    const [learner] = await db.select().from(learnersTable).where(where);
    if (!learner) { res.status(404).json({ error: "Learner not found" }); return; }

    const projects = await db.select().from(learnerProjectsTable).where(eq(learnerProjectsTable.learnerId, id));
    const events = await db.select().from(learnerEventsTable).where(eq(learnerEventsTable.learnerId, id));
    const readiness = await db.select().from(learnerReadinessScoresTable).where(eq(learnerReadinessScoresTable.learnerId, id));

    const completedProjects = projects.filter((p: any) => p.status === "Complete" || p.completion >= 100).length;
    const attendedEvents = events.length;
    const avgReadiness = readiness.length > 0 ? Math.round(readiness.reduce((s: number, r: any) => s + r.score, 0) / readiness.length) : 0;

    res.json({
      learnerName: learner.name, pathway: learner.pathway,
      dataPoints: [
        `${learner.progress}% roadmap completion`,
        `${completedProjects} project${completedProjects !== 1 ? "s" : ""} completed`,
        `${attendedEvents} event${attendedEvents !== 1 ? "s" : ""} attended`,
        `Readiness score: ${avgReadiness}`,
        `Status: ${learner.status}`,
        `Pathway: ${learner.pathway}`,
      ],
    });
  } catch (error) {
    console.error("Error fetching learner summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// Bulk import learners
router.post("/learners/import", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const rows: unknown[] = req.body;
    if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: "Request body must be a non-empty array" }); return; }
    const results = { imported: 0, errors: [] as { row: number; message: string }[] };
    for (let i = 0; i < rows.length; i++) {
      try {
        const row: any = rows[i];
        row.progress = parseInt(row.progress) || 0;
        row.readiness = parseInt(row.readiness) || 0;
        row.profileStrength = parseInt(row.profileStrength) || 0;
        if (!row.status) row.status = "New Learner";
        if (!row.lastActive) row.lastActive = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        if (!row.nextAction) row.nextAction = "Complete onboarding";
        if (!row.joinDate) row.joinDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        if (!row.photo) row.photo = null;
        if (!row.background) row.background = null;
        row.strengths = row.strengths ? row.strengths.split("|").map((s: string) => s.trim()).filter(Boolean) : null;
        row.risks = row.risks ? row.risks.split("|").map((s: string) => s.trim()).filter(Boolean) : null;
        const existing = await db.select().from(learnersTable).where(eq(learnersTable.email, row.email));
        if (existing.length > 0) { results.errors.push({ row: i + 1, message: `Email "${row.email}" already exists` }); continue; }
        const data = insertLearnerSchema.parse(row);
        await db.insert(learnersTable).values({ ...data, orgId });
        results.imported++;
      } catch (e: any) {
        results.errors.push({ row: i + 1, message: e.message || "Invalid data" });
      }
    }
    res.json(results);
  } catch (error) {
    console.error("Error importing learners:", error);
    res.status(500).json({ error: "Import failed" });
  }
});

// Delete single learner
router.delete("/learners/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(learnersTable.id, id), eq(learnersTable.orgId, orgId));
    const [deleted] = await db.delete(learnersTable).where(where).returning();
    if (!deleted) { res.status(404).json({ error: "Learner not found" }); return; }
    await logAudit(req, "deleted", "learner", id, deleted.name);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting learner:", error);
    res.status(500).json({ error: "Failed to delete learner" });
  }
});

// Bulk delete learners
router.post("/learners/bulk-delete", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const ids: number[] = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids array is required" }); return; }
    let deleted = 0;
    for (const id of ids) {
      const where = and(eq(learnersTable.id, id), eq(learnersTable.orgId, orgId));
      const result = await db.delete(learnersTable).where(where).returning();
      if (result.length > 0) {
        deleted++;
        await logAudit(req, "deleted", "learner", id, result[0].name);
      }
    }
    res.json({ deleted });
  } catch (error) {
    console.error("Error bulk deleting learners:", error);
    res.status(500).json({ error: "Bulk delete failed" });
  }
});

// --- Learner sub-resources ---
// Each handler awaits ownedLearner() before its try block: a learner outside the
// caller's org throws HttpError(404), which Express 5 forwards to the error handler.

router.get("/learners/:id/roadmaps", async (req, res) => {
  const id = parseInt(req.params.id);
  await ownedLearner(req, id);
  try {
    const rows = await db.select().from(learnerRoadmapsTable).where(eq(learnerRoadmapsTable.learnerId, id));
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "Failed to fetch roadmaps" }); }
});

router.get("/learners/:id/projects", async (req, res) => {
  const id = parseInt(req.params.id);
  await ownedLearner(req, id);
  try {
    const rows = await db.select().from(learnerProjectsTable).where(eq(learnerProjectsTable.learnerId, id));
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "Failed to fetch projects" }); }
});

router.get("/learners/:id/events", async (req, res) => {
  const id = parseInt(req.params.id);
  await ownedLearner(req, id);
  try {
    const rows = await db.select().from(learnerEventsTable).where(eq(learnerEventsTable.learnerId, id));
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "Failed to fetch events" }); }
});

router.get("/learners/:id/notes", async (req, res) => {
  const id = parseInt(req.params.id);
  await ownedLearner(req, id);
  try {
    const rows = await db.select().from(learnerNotesTable).where(eq(learnerNotesTable.learnerId, id)).orderBy(desc(learnerNotesTable.id));
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "Failed to fetch notes" }); }
});

router.post("/learners/:id/notes", async (req, res) => {
  const id = parseInt(req.params.id);
  await ownedLearner(req, id);
  try {
    const data = insertLearnerNoteSchema.parse({ ...req.body, learnerId: id });
    const [note] = await db.insert(learnerNotesTable).values(data).returning();
    res.status(201).json(note);
  } catch (error) { res.status(400).json({ error: "Invalid data" }); }
});

router.put("/learners/:id/notes/:noteId", async (req, res) => {
  const id = parseInt(req.params.id);
  await ownedLearner(req, id);
  try {
    const noteId = parseInt(req.params.noteId);
    // Match on learnerId too so a note id from another learner cannot be reached through this URL.
    const [updated] = await db.update(learnerNotesTable).set({ content: req.body.content }).where(and(eq(learnerNotesTable.id, noteId), eq(learnerNotesTable.learnerId, id))).returning();
    if (!updated) { res.status(404).json({ error: "Note not found" }); return; }
    res.json(updated);
  } catch (error) { res.status(400).json({ error: "Failed to update note" }); }
});

router.delete("/learners/:id/notes/:noteId", async (req, res) => {
  const id = parseInt(req.params.id);
  await ownedLearner(req, id);
  try {
    const noteId = parseInt(req.params.noteId);
    const [deleted] = await db.delete(learnerNotesTable).where(and(eq(learnerNotesTable.id, noteId), eq(learnerNotesTable.learnerId, id))).returning();
    if (!deleted) { res.status(404).json({ error: "Note not found" }); return; }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Failed to delete note" }); }
});

router.get("/learners/:id/readiness", async (req, res) => {
  const id = parseInt(req.params.id);
  await ownedLearner(req, id);
  try {
    const rows = await db.select().from(learnerReadinessScoresTable).where(eq(learnerReadinessScoresTable.learnerId, id));
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "Failed to fetch readiness" }); }
});

router.get("/learners/:id/activities", async (req, res) => {
  const id = parseInt(req.params.id);
  await ownedLearner(req, id);
  try {
    const rows = await db.select().from(learnerActivitiesTable).where(eq(learnerActivitiesTable.learnerId, id));
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "Failed to fetch activities" }); }
});

export default router;
