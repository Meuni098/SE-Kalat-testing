"use server";
import { auditedTransaction, operationFromForm } from "@/lib/audited-transaction";

import { writeAuditEvent, requireAuditActor, updateAuditedAsset } from "@/lib/audit-log-write";

import { Prisma } from "@prisma/client";
import { readManualPerson, resolveManualPerson, manualEntryError, ManualPersonError } from "@/lib/manual-person";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getTransferRequestsAction(statusFilter?: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const whereClause: Prisma.TransferRequestWhereInput = {};
  if (statusFilter && statusFilter !== "ALL") {
    whereClause.status = statusFilter;
  }

  const transfers = await prisma.transferRequest.findMany({
    where: whereClause,
    include: {
      asset: {
        include: {
          category: true,
        },
      },
      fromUnit: true,
      toUnit: true,
      fromPerson: true,
      toPerson: true,
      requestedBy: {
        select: { id: true, name: true, email: true, role: true },
      },
      decidedBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  return { success: true, transfers };
}

export async function createTransferRequestAction(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const assetId = formData.get("assetId")?.toString();
  const toUnitId = formData.get("toUnitId")?.toString();
  const remarks = formData.get("remarks")?.toString().trim() || "";
  if (!assetId || !toUnitId || remarks.length > 500) return { error: "Choose an asset and college." };
  let transfer;
  try {
    const person = formData.get("includePerson") === "on" ? readManualPerson(formData) : null;
    transfer = await auditedTransaction(prisma, user.id, operationFromForm(formData, ["ADMIN", "STAFF", "CUSTODIAN"]), async tx => {
      const actor = await tx.user.findUnique({ where: { id: user.id } });
      if (!actor?.isActive || !["ADMIN", "STAFF", "CUSTODIAN"].includes(actor.role)) throw new ManualPersonError("You cannot request transfers.");
      await tx.$queryRaw`SELECT "id" FROM "Asset" WHERE "id" = ${assetId} FOR UPDATE`;
      const asset = await tx.asset.findUnique({ where: { id: assetId } });
      if (!asset || asset.isDeleted || ["MISSING", "DISPOSED"].includes(asset.status)) throw new ManualPersonError("Asset is not available for transfer.");
      if (actor.role === "CUSTODIAN" && actor.unitId !== asset.unitId) throw new ManualPersonError("You cannot transfer another office's asset.");
      if (await tx.transferRequest.findFirst({ where: { assetId, status: "PENDING" } })) throw new ManualPersonError("This asset already has a pending transfer request.");
      const destination = await tx.unit.findUnique({ where: { id: toUnitId } });
      if (!destination?.isActive) throw new ManualPersonError("Choose an active office or college.");
      const receiver = person ? await resolveManualPerson(tx, toUnitId, person, actor.id) : null;
      const request = await tx.transferRequest.create({ data: { assetId, fromUnitId: asset.unitId, toUnitId, fromPersonId: asset.accountablePersonId, toPersonId: receiver?.id ?? null, requestedById: actor.id, status: "PENDING", remarks } });
      await writeAuditEvent(tx, { data: { actorId: actor.id, action: "REQUEST_TRANSFER", entityType: "TRANSFER", entityId: request.id, beforeState: { unitId: asset.unitId, accountablePersonId: asset.accountablePersonId }, afterState: { toUnitId, toPersonId: receiver?.id ?? null, person: { ...person }, remarks } } });
      return request;
    });
  } catch (error) { return manualEntryError(error); }

  revalidatePath("/people/faculty-staff");
  revalidatePath("/people/accountable-persons");
  revalidatePath("/inventory/transfers");
  revalidatePath("/inventory");
  revalidatePath("/inventory/central");
  revalidatePath("/inventory/transferred");
  revalidatePath("/dashboard");

  return { success: true, transferId: transfer.id };
}

export async function decideTransferAction(
  transferId: string,
  decision: "APPROVED" | "REJECTED",
  remarks?: string
) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  try { return await prisma.$transaction(async tx => {
    await requireAuditActor(tx, user.id, ["ADMIN","STAFF"]);


  if (!["APPROVED", "REJECTED"].includes(decision)) return { error: "Choose a valid decision." };
  const transfer = await tx.transferRequest.findUnique({
    where: { id: transferId },
    include: { asset: true },
  });

  if (!transfer) {
    return { error: "Transfer request not found." };
  }

  if (transfer.status === decision) return { success: true };
  if (transfer.status !== "PENDING") {
    return { error: `Transfer request is already ${transfer.status.toLowerCase()}.` };
  }

  if (decision === "APPROVED") {
    await (async () => { await tx.transferRequest.update({
        where: { id: transferId },
        data: {
          status: "APPROVED",
          decidedById: user.id,
          decidedAt: new Date(),
          remarks: remarks || transfer.remarks,
        },
      });
await updateAuditedAsset(tx, user.id, {
        where: { id: transfer.assetId },
        data: {
          unitId: transfer.toUnitId,
          accountablePersonId: transfer.toPersonId || null,
          lastVerifiedAt: new Date(),
        },
      });
await writeAuditEvent(tx, {
        data: {
          actorId: user.id,
          action: "APPROVE_TRANSFER",
          entityType: "TRANSFER",
          entityId: transfer.id,
          beforeState: {
            unitId: transfer.fromUnitId,
            personId: transfer.fromPersonId,
          },
          afterState: {
            unitId: transfer.toUnitId,
            personId: transfer.toPersonId,
            status: "APPROVED",
          },
        },
      }); })();
  } else {
    await (async () => { await tx.transferRequest.update({
        where: { id: transferId },
        data: {
          status: "REJECTED",
          decidedById: user.id,
          decidedAt: new Date(),
          remarks: remarks || transfer.remarks,
        },
      });
await writeAuditEvent(tx, {
        data: {
          actorId: user.id,
          action: "REJECT_TRANSFER",
          entityType: "TRANSFER",
          entityId: transfer.id,
          afterState: { status: "REJECTED", remarks },
        },
      }); })();
  }

  revalidatePath("/inventory/transfers");
  revalidatePath("/inventory");
  revalidatePath("/inventory/central");
  revalidatePath("/inventory/transferred");
  revalidatePath("/dashboard");

  return { success: true };

  }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}
