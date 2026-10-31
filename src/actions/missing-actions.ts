"use server";
import { auditedTransaction, operationFromForm } from "@/lib/audited-transaction";

import { writeAuditEvent, requireAuditActor, updateAuditedAsset } from "@/lib/audit-log-write";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function fileMissingIncidentAction(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  try { return await auditedTransaction(prisma, user.id, operationFromForm(formData, ["ADMIN", "STAFF", "CUSTODIAN"]), async tx => {
    const actor = await requireAuditActor(tx, user.id, ["ADMIN","STAFF","CUSTODIAN"]);


  const assetId = formData.get("assetId")?.toString();
  const locationLastSeen = formData.get("locationLastSeen")?.toString().trim();
  const lastSeenDateStr = formData.get("lastSeenDate")?.toString();
  const lastSeenDate = lastSeenDateStr ? new Date(lastSeenDateStr) : new Date();
  const circumstances = formData.get("circumstances")?.toString().trim();
  const policeBlotterUrl = formData.get("policeBlotterUrl")?.toString().trim() || null;

  if (!assetId || !locationLastSeen || !circumstances) {
    return { error: "Please fill in all required incident fields." };
  }

  const affectedAsset = await tx.asset.findUnique({ where: { id: assetId } });
  if (!affectedAsset || affectedAsset.isDeleted || (actor.role === "CUSTODIAN" && actor.unitId !== affectedAsset.unitId)) return { error: "Asset is unavailable in your office." };
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
      condition: "FAIR",
    },
  });

  // Audit log
  await writeAuditEvent(tx, {
    data: {
      actorId: user.id,
      action: "REPORT_MISSING",
      entityType: "MISSING_REPORT",
      entityId: report.id, relatedAssetIds: [assetId],
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
  if (!user) throw new Error("Unauthorized");
  try { return await prisma.$transaction(async tx => {
    await requireAuditActor(tx, user.id, ["ADMIN","STAFF"]);


  const report = await tx.missingReport.findUnique({
    where: { id: reportId },
    include: { asset: true },
  });

  if (!report) return { error: "Report not found" };
  if (!["REPORTED", "UNDER_INVESTIGATION", "FOUND", "WRITTEN_OFF"].includes(newStatus)) return { error: "Choose a valid report status." };
  if (report.status === newStatus) return { success: true };

  await tx.missingReport.update({
    where: { id: reportId },
    data: {
      status: newStatus,
      resolvedAt: newStatus === "FOUND" || newStatus === "WRITTEN_OFF" ? new Date() : null,
    },
  });

  // If found, restore asset to IN_USE
  if (newStatus === "FOUND") {
    await updateAuditedAsset(tx, user.id, {
      where: { id: report.assetId },
      data: { status: "IN_USE", lastVerifiedAt: new Date() },
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
