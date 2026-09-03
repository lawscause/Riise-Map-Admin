import { Router, type IRouter } from "express";
import { db, auditLogTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { Request } from "express";
import { requireOrg } from "../lib/tenant";

const router: IRouter = Router();

export async function logAudit(req: Request, action: string, entityType: string, entityId?: number, entityName?: string, details?: string) {
  const userEmail = (req as any).user?.email || "unknown";
  // Every call site runs behind requireOrg, so dbUser.orgId is present in
  // practice; skipping with an error log (instead of writing an unattributable
  // row) keeps the org_id NOT NULL contract honest if that invariant ever breaks.
  const orgId = (req as any).dbUser?.orgId;
  if (typeof orgId !== "number") {
    console.error("Audit log failed: no dbUser orgId to attribute the entry");
    return;
  }
  console.log("AUDIT:", action, entityType, entityId, entityName, userEmail);
  try {
    await db.insert(auditLogTable).values({ action, entityType, entityId: entityId ?? null, entityName: entityName ?? null, userEmail, orgId, details: details ?? null });
    console.log("AUDIT: logged successfully");
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}

router.get("/audit-log", async (req, res) => {
  const orgId = requireOrg(req);
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await db
      .select()
      .from(auditLogTable)
      .where(eq(auditLogTable.orgId, orgId))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit log:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

export default router;
