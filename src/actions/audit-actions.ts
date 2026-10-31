"use server";

import { writeAuditEvent, requireAuditActor } from "@/lib/audit-log-write";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function resolveDiscrepancyTransferAction(assetId: string, toUnitId: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  try { return await prisma.$transaction(async tx => {
    await requireAuditActor(tx, user.id, ["ADMIN","STAFF","AUDITOR"]);


  const asset = await tx.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) return { error: "Asset not found" };

  if (asset.unitId === toUnitId && asset.status === "IN_USE" && !await tx.physicalCountEntry.findFirst({ where: { assetId, foundStatus: { not: "VERIFIED_IN_PLACE" } }, select: { id: true } })) return { success: true };
  // Update asset unit to the verified unit
  await tx.asset.update({
    where: { id: assetId },
    data: {
      unitId: toUnitId,
      status: "IN_USE",
      lastVerifiedAt: new Date(),
    },
  });

  // Update physical count entries to VERIFIED_IN_PLACE
  await tx.physicalCountEntry.updateMany({
    where: { assetId },
    data: { foundStatus: "VERIFIED_IN_PLACE" },
  });

  await writeAuditEvent(tx, {
    data: {
      actorId: user.id,
      action: "RECONCILE_DISCREPANCY_TRANSFER",
      entityType: "ASSET",
      entityId: assetId,
      beforeState: { unitId: asset.unitId },
      afterState: { unitId: toUnitId, remarks: "Reconciled from annual physical count audit" },
    },
  });

  revalidatePath("/physical-inventory/sessions/current");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");

  return { success: true };

  }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}
