import { Router, type IRouter } from "express";
import { db, programsTable, insertProgramSchema, pathwaysTable, learnersTable, fundingSourcesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logAudit } from "./audit-log";
import { requireOrg } from "../lib/tenant";

const router: IRouter = Router();

function computeMetrics(program: any, learners: any[]) {
  const pl = learners.filter(l => l.program === program.name);
  const count = pl.length;
  return {
    ...program,
    activeLearners: count,
    completionRate: count > 0 ? Math.round(pl.filter(l => l.progress >= 100).length / count * 100) : 0,
    readinessScore: count > 0 ? Math.round(pl.reduce((s, l) => s + l.readiness, 0) / count) : 0,
    placementReady: pl.filter(l => l.status === "Placement Ready").length,
  };
}

router.get("/programs", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const programs = await db.select().from(programsTable).where(eq(programsTable.orgId, orgId));
    const learners = await db.select().from(learnersTable).where(eq(learnersTable.orgId, orgId));
    res.json(programs.map(p => computeMetrics(p, learners)));
  } catch (error) {
    console.error("Error fetching programs:", error);
    res.status(500).json({ error: "Failed to fetch programs" });
  }
});

router.get("/programs/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(programsTable.id, id), eq(programsTable.orgId, orgId));
    const program = await db.select().from(programsTable).where(where);
    if (program.length === 0) { res.status(404).json({ error: "Program not found" }); return; }
    const learners = await db.select().from(learnersTable).where(eq(learnersTable.orgId, orgId));
    res.json(computeMetrics(program[0], learners));
  } catch (error) {
    console.error("Error fetching program:", error);
    res.status(500).json({ error: "Failed to fetch program" });
  }
});

router.post("/programs", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const data = insertProgramSchema.parse(req.body);
    const existing = await db.select().from(programsTable).where(eq(programsTable.programTag, data.programTag));
    if (existing.length > 0) {
      return res.status(409).json({ error: "A program with this tag already exists." });
    }
    const [newProgram] = await db.insert(programsTable).values({ ...data, orgId }).returning();
    await logAudit(req, "created", "program", newProgram.id, newProgram.name);
    res.status(201).json(newProgram);
  } catch (error) {
    console.error("Error creating program:", error);
    res.status(400).json({ error: "Invalid data" });
  }
});

router.put("/programs/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const data = insertProgramSchema.partial().parse(req.body);
    const where = and(eq(programsTable.id, id), eq(programsTable.orgId, orgId));
    const existing = await db.select().from(programsTable).where(eq(programsTable.programTag, data.programTag));
    if (existing.length > 0 && existing[0].id !== id) {
      return res.status(409).json({ error: "A program with this tag already exists." });
    }
    const [updatedProgram] = await db.update(programsTable).set(data).where(where).returning();
    if (!updatedProgram) { res.status(404).json({ error: "Program not found" }); return; }
    await logAudit(req, "updated", "program", id, updatedProgram.name);
    res.json(updatedProgram);
  } catch (error) {
    console.error("Error updating program:", error);
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/programs/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(programsTable.id, id), eq(programsTable.orgId, orgId));
    const program = await db.select().from(programsTable).where(where);
    if (program.length === 0) { res.status(404).json({ error: "Program not found" }); return; }
    await db.delete(programsTable).where(where);
    await logAudit(req, "deleted", "program", id, program[0].name);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting program:", error);
    res.status(500).json({ error: "Failed to delete program" });
  }
});

router.post("/programs/bulk-delete", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const ids: number[] = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids array is required" }); return; }
    const deleted: number[] = [];
    const blocked: { id: number; reason: string }[] = [];
    for (const id of ids) {
      const where = and(eq(programsTable.id, id), eq(programsTable.orgId, orgId));
      const [program] = await db.select().from(programsTable).where(where);
      if (!program) continue;
      await db.delete(programsTable).where(where);
      deleted.push(id);
      await logAudit(req, "deleted", "program", id, program.name);
    }
    res.json({ deleted: deleted.length, blocked });
  } catch (error) {
    console.error("Error bulk deleting programs:", error);
    res.status(500).json({ error: "Bulk delete failed" });
  }
});

router.post("/programs/import", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const rows: unknown[] = req.body;
    if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: "Request body must be a non-empty array" }); return; }
    const results = { imported: 0, errors: [] as { row: number; message: string }[] };
    for (let i = 0; i < rows.length; i++) {
      try {
        const row: any = rows[i];
        row.activeLearners = parseInt(row.activeLearners) || 0;
        row.completionRate = parseInt(row.completionRate) || 0;
        row.readinessScore = parseInt(row.readinessScore) || 0;
        row.eventParticipation = parseInt(row.eventParticipation) || 0;
        row.placementReady = parseInt(row.placementReady) || 0;
        if (!row.pathways) row.pathways = null;
        const data = insertProgramSchema.parse(row);
        const existing = await db.select().from(programsTable).where(eq(programsTable.programTag, data.programTag));
        if (existing.length > 0) { results.errors.push({ row: i + 1, message: `programTag "${data.programTag}" already exists` }); continue; }
        await db.insert(programsTable).values({ ...data, orgId });
        results.imported++;
      } catch (e: any) {
        results.errors.push({ row: i + 1, message: e.message || "Invalid data" });
      }
    }
    res.json(results);
  } catch (error) {
    console.error("Error importing programs:", error);
    res.status(500).json({ error: "Import failed" });
  }
});

export default router;
