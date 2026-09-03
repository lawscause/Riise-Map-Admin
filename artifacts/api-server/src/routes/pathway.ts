import { Router, type IRouter } from "express";
import { db, pathwaysTable, insertPathwaySchema, learnersTable, programsTable, pathwayProgramsTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { logAudit } from "./audit-log";
import { requireOrg } from "../lib/tenant";

const router: IRouter = Router();

router.get("/pathways", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const pathways = await db.select().from(pathwaysTable).where(eq(pathwaysTable.orgId, orgId));
    res.json(pathways);
  } catch (error) {
    console.error("Error fetching pathways:", error);
    res.status(500).json({ error: "Failed to fetch pathways" });
  }
});

router.get("/pathways/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(pathwaysTable.id, id), eq(pathwaysTable.orgId, orgId));
    const pathway = await db.select().from(pathwaysTable).where(where);
    if (pathway.length === 0) { res.status(404).json({ error: "Pathway not found" }); return; }
    res.json(pathway[0]);
  } catch (error) {
    console.error("Error fetching pathway:", error);
    res.status(500).json({ error: "Failed to fetch pathway" });
  }
});

router.post("/pathways", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const data = insertPathwaySchema.parse(req.body);
    const [newPathway] = await db.insert(pathwaysTable).values({ ...data, orgId }).returning();
    await logAudit(req, "created", "pathway", newPathway.id, newPathway.name);
    res.status(201).json(newPathway);
  } catch (error) {
    console.error("Error creating pathway:", error);
    res.status(400).json({ error: "Invalid data" });
  }
});

router.put("/pathways/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const data = insertPathwaySchema.partial().parse(req.body);
    const where = and(eq(pathwaysTable.id, id), eq(pathwaysTable.orgId, orgId));
    const [updatedPathway] = await db.update(pathwaysTable).set(data).where(where).returning();
    if (!updatedPathway) { res.status(404).json({ error: "Pathway not found" }); return; }
    await logAudit(req, "updated", "pathway", id, updatedPathway.name);
    res.json(updatedPathway);
  } catch (error) {
    console.error("Error updating pathway:", error);
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/pathways/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(pathwaysTable.id, id), eq(pathwaysTable.orgId, orgId));
    const [deleted] = await db.delete(pathwaysTable).where(where).returning();
    if (!deleted) { res.status(404).json({ error: "Pathway not found" }); return; }
    await logAudit(req, "deleted", "pathway", id, deleted.name);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting pathway:", error);
    res.status(500).json({ error: "Failed to delete pathway" });
  }
});

router.post("/pathways/import", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const rows: unknown[] = req.body;
    if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: "Request body must be a non-empty array" }); return; }
    const results = { imported: 0, ids: [] as number[], errors: [] as { row: number; message: string }[] };
    for (let i = 0; i < rows.length; i++) {
      try {
        const row: any = rows[i];
        row.programCategory = null;
        row.activeLearners = parseInt(row.activeLearners) || 0;
        row.estimatedWeeks = parseInt(row.estimatedWeeks) || 16;
        row.skills = row.skills ? row.skills.split("|").map((s: string) => s.trim()).filter(Boolean) : null;
        row.milestones = row.milestones ? row.milestones.split("|").map((s: string) => s.trim()).filter(Boolean) : null;
        row.projects = row.projects ? row.projects.split("|").map((s: string) => s.trim()).filter(Boolean) : null;
        row.readinessCriteria = row.readinessCriteria ? row.readinessCriteria.split("|").map((s: string) => s.trim()).filter(Boolean) : null;
        const data = insertPathwaySchema.parse(row);
        const [created] = await db.insert(pathwaysTable).values({ ...data, orgId }).returning();
        results.imported++;
        results.ids.push(created.id);
      } catch (e: any) {
        results.errors.push({ row: i + 1, message: e.message || "Invalid data" });
      }
    }
    res.json(results);
  } catch (error) {
    console.error("Error importing pathways:", error);
    res.status(500).json({ error: "Import failed" });
  }
});

router.post("/pathways/bulk-delete", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const ids: number[] = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids array is required" }); return; }
    const deleted: number[] = [];
    const blocked: { id: number; reason: string }[] = [];
    for (const id of ids) {
      const where = and(eq(pathwaysTable.id, id), eq(pathwaysTable.orgId, orgId));
      const [pathway] = await db.select().from(pathwaysTable).where(where);
      if (!pathway) continue;
      const learners = await db.select().from(learnersTable).where(eq(learnersTable.pathway, pathway.name));
      if (learners.length > 0) {
        blocked.push({ id, reason: `${learners.length} learner${learners.length > 1 ? "s" : ""} assigned` });
      } else {
        await db.delete(pathwaysTable).where(where);
        deleted.push(id);
        await logAudit(req, "deleted", "pathway", id, pathway.name);
      }
    }
    res.json({ deleted: deleted.length, blocked });
  } catch (error) {
    console.error("Error bulk deleting pathways:", error);
    res.status(500).json({ error: "Bulk delete failed" });
  }
});

router.get("/pathways/:id/programs", async (req, res) => {
  try {
    const pathwayId = parseInt(req.params.id);
    const links = await db.select().from(pathwayProgramsTable).where(eq(pathwayProgramsTable.pathwayId, pathwayId));
    res.json(links.map(l => l.programId));
  } catch (error) { res.status(500).json({ error: "Failed to fetch pathway programs" }); }
});

router.put("/pathways/:id/programs", async (req, res) => {
  try {
    const pathwayId = parseInt(req.params.id);
    const { programIds } = req.body as { programIds: number[] };
    await db.delete(pathwayProgramsTable).where(eq(pathwayProgramsTable.pathwayId, pathwayId));
    if (programIds && programIds.length > 0) {
      await db.insert(pathwayProgramsTable).values(programIds.map(programId => ({ pathwayId, programId })));
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Failed to update pathway programs" }); }
});

router.get("/pathway-programs", async (req, res) => {
  try {
    const all = await db.select().from(pathwayProgramsTable);
    res.json(all);
  } catch (error) { res.status(500).json({ error: "Failed to fetch pathway programs" }); }
});

export default router;
