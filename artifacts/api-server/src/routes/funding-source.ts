import { Router, type IRouter } from "express";
import { db, fundingSourcesTable, insertFundingSourceSchema, fundingSourceGoalsTable, fundingSourceLearnersTable, fundingSourcePathwaysTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { logAudit } from "./audit-log";
import { requireOrg } from "../lib/tenant";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

const router: IRouter = Router();

router.get("/funding-sources", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const sources = await db.select().from(fundingSourcesTable).where(eq(fundingSourcesTable.orgId, orgId));
    res.json(sources);
  } catch (error) {
    console.error("Error fetching funding sources:", error);
    res.status(500).json({ error: "Failed to fetch funding sources" });
  }
});

router.get("/funding-sources/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(fundingSourcesTable.id, id), eq(fundingSourcesTable.orgId, orgId));
    const [source] = await db.select().from(fundingSourcesTable).where(where);
    if (!source) { res.status(404).json({ error: "Funding source not found" }); return; }
    res.json(source);
  } catch (error) {
    console.error("Error fetching funding source:", error);
    res.status(500).json({ error: "Failed to fetch funding source" });
  }
});

router.post("/funding-sources", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    if (req.body.amount != null) req.body.amount = String(req.body.amount);
    const data = insertFundingSourceSchema.parse(req.body);
    const [created] = await db.insert(fundingSourcesTable).values({ ...data, orgId }).returning();
    await logAudit(req, "created", "funding_source", created.id, created.name);
    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating funding source:", error);
    res.status(400).json({ error: "Invalid data" });
  }
});

router.put("/funding-sources/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    if (req.body.amount != null) req.body.amount = String(req.body.amount);
    // Partial update: the client saves the narrative on its own ({ narrative }),
    // so requiring the full body 400s every save. strict() still rejects unknown keys.
    const data = insertFundingSourceSchema.partial().strict().parse(req.body);
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "At least one field must be provided" });
      return;
    }
    const where = and(eq(fundingSourcesTable.id, id), eq(fundingSourcesTable.orgId, orgId));
    const [updated] = await db.update(fundingSourcesTable).set(data).where(where).returning();
    if (!updated) { res.status(404).json({ error: "Funding source not found" }); return; }
    await logAudit(req, "updated", "funding_source", id, updated.name);
    res.json(updated);
  } catch (error) {
    console.error("Error updating funding source:", error);
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/funding-sources/:id", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(fundingSourcesTable.id, id), eq(fundingSourcesTable.orgId, orgId));
    const [deleted] = await db.delete(fundingSourcesTable).where(where).returning();
    if (!deleted) { res.status(404).json({ error: "Funding source not found" }); return; }
    await logAudit(req, "deleted", "funding_source", id, deleted.name);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting funding source:", error);
    res.status(500).json({ error: "Failed to delete funding source" });
  }
});

router.put("/funding-sources/:id/narrative-file", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) { res.status(400).json({ error: "fileName and fileData are required" }); return; }
    const ext = "." + fileName.toLowerCase().split(".").pop();
    if (!ALLOWED_EXTENSIONS.includes(ext)) { res.status(400).json({ error: "Only .pdf, .doc, .docx files are allowed" }); return; }
    const buffer = Buffer.from(fileData, "base64");
    if (buffer.length > MAX_FILE_SIZE) { res.status(400).json({ error: "File must be under 5MB" }); return; }
    const where = and(eq(fundingSourcesTable.id, id), eq(fundingSourcesTable.orgId, orgId));
    await db.update(fundingSourcesTable).set({ narrativeFile: buffer, narrativeFileName: fileName, updatedAt: new Date() }).where(where);
    res.json({ success: true, fileName });
  } catch (error) {
    console.error("Error uploading narrative file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.get("/funding-sources/:id/narrative-file", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(fundingSourcesTable.id, id), eq(fundingSourcesTable.orgId, orgId));
    const [source] = await db.select({ narrativeFile: fundingSourcesTable.narrativeFile, narrativeFileName: fundingSourcesTable.narrativeFileName }).from(fundingSourcesTable).where(where);
    if (!source?.narrativeFile || !source.narrativeFileName) { res.status(404).json({ error: "No narrative file" }); return; }
    res.set("Content-Type", getMimeType(source.narrativeFileName));
    res.set("Content-Disposition", `attachment; filename="${source.narrativeFileName}"`);
    res.send(source.narrativeFile);
  } catch (error) {
    console.error("Error downloading narrative file:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
});

router.delete("/funding-sources/:id/narrative-file", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const id = parseInt(req.params.id);
    const where = and(eq(fundingSourcesTable.id, id), eq(fundingSourcesTable.orgId, orgId));
    await db.update(fundingSourcesTable).set({ narrativeFile: null, narrativeFileName: null, updatedAt: new Date() }).where(where);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting narrative file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

router.post("/funding-sources/import", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const rows: unknown[] = req.body;
    if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: "Request body must be a non-empty array" }); return; }
    const results = { imported: 0, errors: [] as { row: number; message: string }[] };
    for (let i = 0; i < rows.length; i++) {
      try {
        const row: any = rows[i];
        if (row.amount != null && row.amount !== "") row.amount = String(row.amount);
        else row.amount = null;
        if (row.learnerCount != null && row.learnerCount !== "") row.learnerCount = parseInt(row.learnerCount);
        else row.learnerCount = null;
        if (!row.startDate) row.startDate = null;
        if (!row.endDate) row.endDate = null;
        if (!row.objectives) row.objectives = null;
        if (!row.narrative) row.narrative = null;
        const goals: string[] = Array.isArray(row.goals) ? row.goals : [];
        delete row.goals;
        const data = insertFundingSourceSchema.parse(row);
        const [created] = await db.insert(fundingSourcesTable).values({ ...data, orgId }).returning();
        if (goals.length > 0) {
          await db.insert(fundingSourceGoalsTable).values(goals.map(title => ({ fundingSourceId: created.id, title, status: "not_started" })));
        }
        results.imported++;
      } catch (e: any) {
        results.errors.push({ row: i + 1, message: e.message || "Invalid data" });
      }
    }
    res.json(results);
  } catch (error) {
    console.error("Error importing funding sources:", error);
    res.status(500).json({ error: "Import failed" });
  }
});

router.post("/funding-sources/bulk-delete", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const ids: number[] = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids array is required" }); return; }
    const blocked: { id: number; reason: string }[] = [];
    const deleted: number[] = [];
    for (const id of ids) {
      const where = and(eq(fundingSourcesTable.id, id), eq(fundingSourcesTable.orgId, orgId));
      const [source] = await db.select().from(fundingSourcesTable).where(where);
      if (!source) continue;
      const learners = await db.select().from(fundingSourceLearnersTable).where(eq(fundingSourceLearnersTable.fundingSourceId, id));
      const pathways = await db.select().from(fundingSourcePathwaysTable).where(eq(fundingSourcePathwaysTable.fundingSourceId, id));
      if (learners.length > 0 || pathways.length > 0) {
        const reasons: string[] = [];
        if (learners.length > 0) reasons.push(`${learners.length} learner${learners.length > 1 ? "s" : ""}`);
        if (pathways.length > 0) reasons.push(`${pathways.length} pathway${pathways.length > 1 ? "s" : ""}`);
        blocked.push({ id, reason: `Attached to ${reasons.join(" and ")}` });
      } else {
        await db.delete(fundingSourcesTable).where(where);
        deleted.push(id);
        await logAudit(req, "deleted", "funding_source", id);
      }
    }
    res.json({ deleted: deleted.length, blocked });
  } catch (error) {
    console.error("Error bulk deleting funding sources:", error);
    res.status(500).json({ error: "Bulk delete failed" });
  }
});

export default router;
