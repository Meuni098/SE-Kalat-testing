"use server";
import { auditedTransaction, operationFromForm } from "@/lib/audited-transaction";

import { writeAuditEvent, requireAuditActor, updateAuditedAsset } from "@/lib/audit-log-write";

import { Prisma } from "@prisma/client";
import { readManualPerson, manualEntryError, ManualPersonError } from "@/lib/manual-person";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getReturnRequestsAction(statusFilter?: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const whereClause: Prisma.ReturnRequestWhereInput = {};
  if (statusFilter && statusFilter !== "ALL") {
    whereClause.status = statusFilter;
  }

  const returns = await prisma.returnRequest.findMany({
    where: whereClause,
    include: {
      asset: {
        include: {
          category: true,
          unit: true,
          accountablePerson: true,
        },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  return { success: true, returns };
}

export async function createReturnRequestAction(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const assetId = formData.get("assetId")?.toString();
  const reason = formData.get("reason")?.toString().trim() || "";
  if (!assetId || reason.length > 500) return { error: "Choose an asset." };
  let returnReq;
  try {
    const person = readManualPerson(formData);
    returnReq = await auditedTransaction(prisma, user.id, operationFromForm(formData, ["ADMIN", "STAFF", "CUSTODIAN"]), async tx => {
      const actor = await tx.user.findUnique({ where: { id: user.id } });
      if (!actor?.isActive || !["ADMIN", "STAFF", "CUSTODIAN"].includes(actor.role)) throw new ManualPersonError("You cannot request returns.");
      await tx.$queryRaw`SELECT "id" FROM "Asset" WHERE "id" = ${assetId} FOR UPDATE`;
      const asset = await tx.asset.findUnique({ where: { id: assetId } });
      if (!asset || asset.isDeleted || asset.status !== "IN_USE") throw new ManualPersonError("Asset is not available for return.");
      if (actor.role === "CUSTODIAN" && actor.unitId !== asset.unitId) throw new ManualPersonError("You cannot return another office's asset.");
      if (await tx.returnRequest.findFirst({ where: { assetId, status: "PENDING" } })) throw new ManualPersonError("This asset already has a pending return request.");
      const unit = await tx.unit.findUnique({ where: { id: asset.unitId } });
      const request = await tx.returnRequest.create({ data: { assetId, returnedBy: person.fullName, reason, status: "PENDING" } });
      await writeAuditEvent(tx, { data: { actorId: actor.id, action: "REQUEST_RETURN", entityType: "RETURN", entityId: request.id, beforeState: { status: asset.status, unitId: asset.unitId }, afterState: { returnedBy: person.fullName, person: { ...person }, unitId: asset.unitId, unitCode: unit?.code, reason } } });
      return request;
    });
  } catch (error) { return manualEntryError(error); }

  revalidatePath("/inventory/returns");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return { success: true, returnId: returnReq.id };
}

export async function decideReturnAction(
  returnId: string,
  decision: "APPROVED" | "REJECTED",
  conditionOnReturn?: string
) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  try { return await prisma.$transaction(async tx => {
    await requireAuditActor(tx, user.id, ["ADMIN","STAFF"]);


  if (!["APPROVED", "REJECTED"].includes(decision)) return { error: "Choose a valid decision." };
  const returnReq = await tx.returnRequest.findUnique({
    where: { id: returnId },
    include: { asset: true },
  });

  if (!returnReq) {
    return { error: "Return request not found." };
  }

  if (returnReq.status === decision) return { success: true };
  if (returnReq.status !== "PENDING") {
    return { error: `Return request is already ${returnReq.status.toLowerCase()}.` };
  }

  // Find Central Storage or AMO unit
  const storageUnit =
    (await tx.unit.findFirst({
      where: {
        OR: [{ code: "STORAGE" }, { code: "AMO" }, { unitType: "AUXILIARY" }],
      },
    })) || (await tx.unit.findFirst());

  if (decision === "APPROVED") {
    await (async () => { await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: "APPROVED",
          decidedAt: new Date(),
        },
      });
await updateAuditedAsset(tx, user.id, {
        where: { id: returnReq.assetId },
        data: {
          status: "IN_STORAGE",
          condition: conditionOnReturn || returnReq.asset.condition,
          accountablePersonId: null,
          unitId: storageUnit ? storageUnit.id : returnReq.asset.unitId,
          lastVerifiedAt: new Date(),
        },
      });
await writeAuditEvent(tx, {
        data: {
          actorId: user.id,
          action: "APPROVE_RETURN",
          entityType: "RETURN",
          entityId: returnReq.id,
          beforeState: {
            status: returnReq.asset.status,
            custodianId: returnReq.asset.accountablePersonId,
          },
          afterState: {
            status: "IN_STORAGE",
            condition: conditionOnReturn || returnReq.asset.condition,
            custodianId: null,
          },
        },
      }); })();
  } else {
    await (async () => { await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: "REJECTED",
          decidedAt: new Date(),
        },
      });
await writeAuditEvent(tx, {
        data: {
          actorId: user.id,
          action: "REJECT_RETURN",
          entityType: "RETURN",
          entityId: returnReq.id,
          afterState: { status: "REJECTED" },
        },
      }); })();
  }

  revalidatePath("/inventory/returns");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return { success: true };

  }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}
