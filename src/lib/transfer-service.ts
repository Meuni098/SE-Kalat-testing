import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { auditedTransaction, operationFromForm } from "./audited-transaction";
import { requireAuditActor, updateAuditedAsset, writeAuditEvent } from "./audit-log-write";
import { AuditError } from "./audit-log-validation";

const requestRoles = ["ADMIN", "STAFF", "CUSTODIAN"];
const transferableStatuses = ["IN_USE", "IN_STORAGE", "UNDER_REPAIR"];
type TransferResult = { success: true; transferId: string } | { error: string; fieldErrors?: Record<string, string> };

class TransferError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) { super(message); }
}

function transferError(error: unknown): { error: string; fieldErrors?: Record<string, string> } {
  if (error instanceof TransferError) return { error: error.message, fieldErrors: error.fieldErrors };
  if (error instanceof AuditError) return { error: error.message };
  return { error: "The transfer could not be saved. Refresh the list and try again." };
}

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Kept independent of Next's request context, matching the receiving-custodian service.
export class TransferService {
  constructor(private db: PrismaClient, private actorId: string) {}

  async create(formData: FormData): Promise<TransferResult> {
    const assetId = readText(formData, "assetId");
    const toUnitId = readText(formData, "toUnitId");
    const remarks = readText(formData, "remarks");
    const fieldErrors: Record<string, string> = {};
    if (!assetId || assetId.length > 100) fieldErrors.assetId = "Choose an asset.";
    if (!toUnitId || toUnitId.length > 100) fieldErrors.toUnitId = "Choose a receiving college or unit.";
    if (remarks.length > 500 || (formData.has("remarks") && typeof formData.get("remarks") !== "string")) fieldErrors.remarks = "Remarks must contain at most 500 characters.";
    if (Object.keys(fieldErrors).length) return { error: Object.values(fieldErrors).join(" "), fieldErrors };

    try {
      const transfer = await auditedTransaction(this.db, this.actorId, operationFromForm(formData, requestRoles), async tx => {
        const actor = await requireAuditActor(tx, this.actorId, requestRoles);
        await tx.$queryRaw`SELECT "id" FROM "Asset" WHERE "id" = ${assetId} FOR UPDATE`;
        const asset = await tx.asset.findUnique({ where: { id: assetId } });
        if (!asset || asset.isDeleted || !transferableStatuses.includes(asset.status)) throw new TransferError("This asset is not available for transfer.");
        if (actor.role === "CUSTODIAN" && actor.unitId !== asset.unitId) throw new TransferError("You can only transfer assets from your own college or unit.");
        if (asset.unitId === toUnitId) throw new TransferError("Choose a different receiving college or unit.", { toUnitId: "The receiving college must differ from the origin." });
        if (await tx.transferRequest.findFirst({ where: { assetId, status: "PENDING" } })) throw new TransferError("This asset already has a pending transfer request.");
        if (await tx.returnRequest.findFirst({ where: { assetId, status: "PENDING" } })) throw new TransferError("Resolve the asset's pending return request before transferring it.");
        const destination = await tx.unit.findUnique({ where: { id: toUnitId } });
        if (!destination?.isActive) throw new TransferError("Choose an active receiving college or unit.", { toUnitId: "This college or unit is no longer available." });
        const request = await tx.transferRequest.create({ data: {
          assetId, fromUnitId: asset.unitId, toUnitId, fromPersonId: asset.accountablePersonId,
          toPersonId: null, requestedById: actor.id, status: "PENDING", remarks,
        } });
        await writeAuditEvent(tx, { data: {
          actorId: actor.id, action: "REQUEST_TRANSFER", entityType: "TRANSFER", entityId: request.id,
          beforeState: { unitId: asset.unitId, accountablePersonId: asset.accountablePersonId },
          afterState: { toUnitId, toPersonId: null, remarks },
        } });
        return { id: request.id };
      });
      return { success: true, transferId: transfer.id };
    } catch (error) { return transferError(error); }
  }

  async decide(transferId: string, decision: "APPROVED" | "REJECTED", remarks?: string): Promise<TransferResult> {
    if (typeof transferId !== "string" || !transferId || transferId.length > 100 || !["APPROVED", "REJECTED"].includes(decision)) return { error: "Choose a valid transfer and decision." };
    if (remarks !== undefined && (typeof remarks !== "string" || remarks.trim().length > 500)) return { error: "Remarks must contain at most 500 characters." };
    try {
      return await auditedTransaction(this.db, this.actorId, {
        id: randomUUID(), values: { transferId, decision, remarks: remarks ?? null }, roles: ["ADMIN", "STAFF"],
      }, async tx => {
        await tx.$queryRaw`SELECT "id" FROM "TransferRequest" WHERE "id" = ${transferId} FOR UPDATE`;
        const transfer = await tx.transferRequest.findUnique({ where: { id: transferId } });
        if (!transfer) throw new TransferError("Transfer request not found.");
        if (transfer.status === decision) return { success: true as const, transferId };
        if (transfer.status !== "PENDING") throw new TransferError(`This transfer request is already ${transfer.status.toLowerCase()}.`);
        const decisionRemarks = remarks?.trim() || transfer.remarks;

        if (decision === "APPROVED") {
          await tx.$queryRaw`SELECT "id" FROM "Asset" WHERE "id" = ${transfer.assetId} FOR UPDATE`;
          const asset = await tx.asset.findUnique({ where: { id: transfer.assetId } });
          const destination = await tx.unit.findUnique({ where: { id: transfer.toUnitId } });
          if (!destination?.isActive) throw new TransferError("The receiving college or unit is inactive. Reject this request and create a new one.");
          if (!asset || asset.isDeleted || !transferableStatuses.includes(asset.status)) throw new TransferError("This asset is no longer available for transfer.");
          if (asset.unitId !== transfer.fromUnitId || asset.accountablePersonId !== transfer.fromPersonId) throw new TransferError("The asset's custody has changed. Reject this request and create a new one.");
          if (transfer.fromUnitId === transfer.toUnitId) throw new TransferError("The receiving college must differ from the origin. Reject this request and create a new one.");
          if (await tx.returnRequest.findFirst({ where: { assetId: asset.id, status: "PENDING" } })) throw new TransferError("Resolve the asset's pending return request before approving this transfer.");
          // Preserve named recipients on legacy requests; new requests always track college custody.
          if (transfer.toPersonId) {
            const recipient = await tx.person.findUnique({ where: { id: transfer.toPersonId } });
            if (recipient?.unitId !== transfer.toUnitId) throw new TransferError("The recorded recipient no longer belongs to the receiving college. Reject this request and create a new one.");
          }
          const storageDestination = ["AMO", "STORAGE"].includes(destination.code);
          const status = asset.status === "UNDER_REPAIR" ? asset.status : storageDestination ? "IN_STORAGE" : "IN_USE";
          await updateAuditedAsset(tx, this.actorId, { where: { id: asset.id }, data: {
            unitId: transfer.toUnitId, accountablePersonId: transfer.toPersonId, status,
          } });
        }

        await tx.transferRequest.update({ where: { id: transferId }, data: {
          status: decision, decidedById: this.actorId, decidedAt: new Date(), remarks: decisionRemarks,
        } });
        await writeAuditEvent(tx, { data: {
          actorId: this.actorId, action: decision === "APPROVED" ? "APPROVE_TRANSFER" : "REJECT_TRANSFER",
          entityType: "TRANSFER", entityId: transferId,
          beforeState: { status: "PENDING", unitId: transfer.fromUnitId, personId: transfer.fromPersonId },
          afterState: { status: decision, ...(decision === "APPROVED" ? { unitId: transfer.toUnitId, personId: transfer.toPersonId } : {}), remarks: decisionRemarks },
        } });
        return { success: true as const, transferId };
      });
    } catch (error) { return transferError(error); }
  }
}
