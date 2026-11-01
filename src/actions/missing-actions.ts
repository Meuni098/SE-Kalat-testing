"use server";
import { auditedTransaction, operationFromForm } from "@/lib/audited-transaction";

import { writeAuditEvent, requireAuditActor, updateAuditedAsset } from "@/lib/audit-log-write";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function fileMissingIncidentAction(formData: FormData) {
  const user = await getSession();
  if (!user) return { error: "Please sign in before filing an incident." };
  try { return await auditedTransaction(prisma, user.id, operationFromForm(formData, ["ADMIN", "STAFF", "CUSTODIAN"]), async tx => {
    const actor = await requireAuditActor(tx, user.id, ["ADMIN","STAFF","CUSTODIAN"]);


  const assetId = formData.get("assetId")?.toString();
  const locationLastSeen = formData.get("locationLastSeen")?.toString().trim();
  const lastSeenDateStr = formData.get("lastSeenDate")?.toString();
  const lastSeenDate = new Date(`${lastSeenDateStr}T00:00:00+08:00`);
  const circumstances = formData.get("circumstances")?.toString().trim();
  const policeBlotterUrl = formData.get("policeBlotterUrl")?.toString().trim() || null;

  if (!assetId || !locationLastSeen || !circumstances) {
    return { error: "Please fill in all required incident fields." };
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  if (!lastSeenDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(lastSeenDateStr) || !Number.isFinite(lastSeenDate.getTime()) || new Date(`${lastSeenDateStr}T00:00:00Z`).toISOString().slice(0, 10) !== lastSeenDateStr || lastSeenDateStr > today) {
    return { error: "Choose a valid last-seen date that is not in the future." };
  }
  if (policeBlotterUrl) {
    try { if (!["https:", "http:"].includes(new URL(policeBlotterUrl).protocol)) throw new Error(); }
    catch { return { error: "Enter an HTTP or HTTPS blotter link." }; }
  }

  await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${assetId} FOR UPDATE`;
  const affectedAsset = await tx.asset.findUnique({ where: { id: assetId } });
  if (!affectedAsset || affectedAsset.isDeleted || (actor.role === "CUSTODIAN" && actor.unitId !== affectedAsset.unitId)) return { error: "Asset is unavailable in your office." };
  if (await tx.missingReport.findFirst({ where: { assetId, status: { in: ["REPORTED", "UNDER_INVESTIGATION"] } } })) return { error: "This asset already has an active missing incident." };
  if (!["IN_USE", "IN_STORAGE", "UNDER_REPAIR", "MISSING"].includes(affectedAsset.status)) return { error: "Only active or already-missing assets can have an incident filed." };
  // Create MissingReport
  const report = await tx.missingReport.create({
    data: {
      assetId,
      reportedById: user.id,
      lastSeenDate,
      locationLastSeen,
      circumstances,
      policeBlotterUrl,
      status: "REPORTED",
    },
  });

  // Mark asset status as MISSING
  await updateAuditedAsset(tx, user.id, {
    where: { id: assetId },
    data: {
      status: "MISSING",
    },
  });

  // Audit log
  await writeAuditEvent(tx, {
    data: {
      actorId: user.id,
      action: "REPORT_MISSING",
      entityType: "MISSING_REPORT",
      entityId: report.id, relatedAssetIds: [assetId],
      beforeState: { status: affectedAsset.status },
      afterState: { reportId: report.id, locationLastSeen, circumstances },
    },
  });

  revalidatePath("/missing");
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${assetId}`);
  revalidatePath("/dashboard");

  return { success: true, reportId: report.id };

  }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}

export async function updateMissingReportStatusAction(
  reportId: string,
  newStatus: "REPORTED" | "UNDER_INVESTIGATION" | "FOUND" | "WRITTEN_OFF"
) {
  const user = await getSession();
  if (!user) return { error: "Please sign in before updating an incident." };
  try { return await prisma.$transaction(async tx => {
    await requireAuditActor(tx, user.id, ["ADMIN","STAFF"]);


  const report = await tx.missingReport.findUnique({
    where: { id: reportId },
    include: { asset: { include: { unit: true } } },
  });

  if (!report) return { error: "Report not found" };
  if (!["REPORTED", "UNDER_INVESTIGATION", "FOUND", "WRITTEN_OFF"].includes(newStatus)) return { error: "Choose a valid report status." };
  if (report.status === newStatus) return { success: true };
  const allowed = report.status === "REPORTED" ? ["UNDER_INVESTIGATION"] : report.status === "UNDER_INVESTIGATION" ? ["FOUND", "WRITTEN_OFF"] : [];
  if (!allowed.includes(newStatus)) return { error: "This incident cannot move to that stage. Refresh the desk and try again." };
  if (report.asset.isDeleted || report.asset.status !== "MISSING") return { error: "The asset is no longer marked missing. Review its dossier before resolving this incident." };

  await tx.missingReport.update({
    where: { id: reportId },
    data: {
      status: newStatus,
      resolvedAt: newStatus === "FOUND" || newStatus === "WRITTEN_OFF" ? new Date() : null,
    },
  });

  // If found, restore asset to IN_USE
  if (newStatus === "FOUND") {
    const original = await tx.auditLog.findFirst({ where: { entityType: "MISSING_REPORT", entityId: report.id, action: "REPORT_MISSING" }, orderBy: { createdAt: "asc" }, select: { beforeState: true } });
    const before = original?.beforeState;
    const previous = before && typeof before === "object" && !Array.isArray(before) ? before.status : null;
    const restoredStatus = typeof previous === "string" && ["IN_USE", "IN_STORAGE", "UNDER_REPAIR"].includes(previous)
      ? previous : report.asset.condition === "UNSERVICEABLE" ? "UNDER_REPAIR" : report.asset.unit.code === "AMO" ? "IN_STORAGE" : "IN_USE";
    await updateAuditedAsset(tx, user.id, {
      where: { id: report.assetId },
      data: { status: restoredStatus, lastVerifiedAt: new Date() },
    });
  }

  // If written off, mark asset FOR_DISPOSAL
  if (newStatus === "WRITTEN_OFF") {
    await updateAuditedAsset(tx, user.id, {
      where: { id: report.assetId },
      data: { status: "FOR_DISPOSAL" },
    });
  }

  await writeAuditEvent(tx, {
    data: {
      actorId: user.id,
      action: "UPDATE_MISSING_STAGE",
      entityType: "MISSING_REPORT",
      entityId: report.id, relatedAssetIds: [report.assetId],
      beforeState: { reportStatus: report.status },
      afterState: { reportStatus: newStatus },
    },
  });

  revalidatePath("/missing");
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${report.assetId}`);
  revalidatePath("/dashboard");

  return { success: true };

  }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}
