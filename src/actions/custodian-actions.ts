"use server";
import { auditedTransaction } from "@/lib/audited-transaction";
import { randomUUID } from "node:crypto";

import { writeAuditEvent, requireAuditActor, updateAuditedAsset } from "@/lib/audit-log-write";

import { lookupProduct } from "@/lib/product-lookup";
import { productRegistrationFailure } from "@/lib/product-registration-error";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function lookupAssetByPropertyNo(propertyNo: string) {
  const user = await getSession();
  if (!user) return { error: "Please sign in with an active account.", code: "UNAUTHORIZED" };
  try { return await lookupProduct(prisma, user.id, propertyNo); }
  catch (error) { return productRegistrationFailure(error); }
}

export async function confirmPhysicalCountPresence(propertyNo: string, location?: string, operationId?: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  try {
    if (operationId && !/^[0-9a-f-]{36}$/i.test(operationId)) return { error: "Reload the scanner before verifying." };
    return await auditedTransaction(prisma, user.id, { id: operationId ?? randomUUID(), values: { action: "VERIFY", propertyNo, location }, roles: ["ADMIN", "STAFF", "CUSTODIAN", "AUDITOR"] }, async tx => {
    const actor = await requireAuditActor(tx, user.id, ["ADMIN","STAFF","CUSTODIAN","AUDITOR"]);


  const asset = await tx.asset.findUnique({
    where: { propertyNo: propertyNo.trim() },
    include: { unit: true },
  });

  if (!asset) {
    return { error: "Asset not found." };
  }

  if (actor.role === "CUSTODIAN" && actor.unitId !== asset.unitId) return { error: "You cannot verify another office's asset." };
  // Find active physical count session or create current one
  let session = await tx.physicalCountSession.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  });

  if (!session) {
    session = await tx.physicalCountSession.create({
      data: {
        title: `Annual Physical Inventory ${new Date().getFullYear()}`,
        fiscalYear: new Date().getFullYear(),
        status: "ACTIVE",
      },
    });
    await writeAuditEvent(tx, { data: { actorId: user.id, action: "CREATE_COUNT_SESSION", eventKind: "CREATE", entityType: "PHYSICAL_COUNT_SESSION", entityId: session.id, afterState: session } });
  }

  // Create count entry
  const entry = await tx.physicalCountEntry.create({
    data: {
      sessionId: session.id,
      assetId: asset.id,
      countedById: user.id,
      foundStatus: "VERIFIED_IN_PLACE",
      scannedLocation: location || `${asset.unit.code} Main Premises`,
      remarks: "Field QR presence verified.",
    },
  });

  // Update asset lastVerifiedAt
  await updateAuditedAsset(tx, user.id, {
    where: { id: asset.id },
    data: {
      lastVerifiedAt: new Date(),
      status: asset.status === "MISSING" ? "IN_USE" : asset.status,
    },
  });

  // Log to AuditLog
  await writeAuditEvent(tx, {
    data: {
      actorId: user.id,
      action: "QR_VERIFY_PRESENCE",
      entityType: "PHYSICAL_COUNT_ENTRY",
      entityId: entry.id,
      eventKind: "CREATE", relatedAssetIds: [asset.id],
      afterState: {
        propertyNo: asset.propertyNo,
        foundStatus: "VERIFIED_IN_PLACE",
        location: location || asset.unit.code,
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/physical-inventory/sessions/current");

  return { success: true, entryId: entry.id };

  }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}
