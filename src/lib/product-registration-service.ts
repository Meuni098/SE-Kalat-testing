import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { allocateProductCodes, MAX_DELIVERY_QUANTITY } from "./asset-code";
import { allocateProcurementReferences } from "./procurement-reference";
import { auditedTransaction, operationFromForm } from "./audited-transaction";
import { writeAuditEvent, requireAuditActor } from "./audit-log-write";
import { auditOperationContext } from "./audit-context";
import { safeAuditState } from "./audit-log-validation";
import { readManualPerson, resolveManualPerson } from "./manual-person";
import { ProductRegistrationError, readText, readNumber, readAcquisitionDate, registrationOperation } from "./product-registration-validation";

export async function registerProduct(db: PrismaClient, actorId: string, form: FormData) {
  registrationOperation(form);
  const name = readText(form, "name", "item name");
  const description = readText(form, "description", "description", 4000, false);
  const categoryId = readText(form, "categoryId", "category");
  const unitId = readText(form, "unitId", "college or office");
  const serialNo = readText(form, "serialNo", "serial number", 128, false);
  const acquisitionCost = readNumber(form, "acquisitionCost", "acquisition cost");
  const acquisitionDate = readAcquisitionDate(form);
  const personInput = form.get("includePerson") === "on" ? readManualPerson(form) : null;
  const result = await auditedTransaction(db, actorId, operationFromForm(form), async tx => {
    await requireAuditActor(tx, actorId, ["ADMIN", "STAFF"]);
    const unit = await tx.unit.findUnique({ where: { id: unitId } });
    if (!unit?.isActive) throw new ProductRegistrationError("VALIDATION_ERROR", "Choose an active office or college.");
    if (!await tx.category.findUnique({ where: { id: categoryId } })) throw new ProductRegistrationError("VALIDATION_ERROR", "Choose an available category.");
    const person = personInput ? await resolveManualPerson(tx, unitId, personInput, actorId) : null;
    const [propertyNo] = await allocateProductCodes(tx);
    const asset = await tx.asset.create({ data: {
      propertyNo, qrCodeData: propertyNo, name, description, categoryId, unitId,
      accountablePersonId: person?.id ?? null, serialNo: serialNo || null,
      acquisitionCost, acquisitionDate, classification: acquisitionCost >= 50000 ? "PPE" : "SEMI_EXPENDABLE",
      status: "IN_USE", condition: "EXCELLENT", lastVerifiedAt: new Date(),
    } });
    await writeAuditEvent(tx, { data: { actorId, action: "REGISTER_ASSET", entityType: "ASSET", entityId: asset.id,
      afterState: { propertyNo, name, acquisitionCost, classification: asset.classification, unitId } } });
    return { success: true as const, assetId: asset.id, productCode: propertyNo, qrCodeData: propertyNo, assetName: name, unitCode: unit.code };
  // Creation is append-only: the sequence/unique constraint protect identity and the
  // operation advisory lock protects replay. ReadCommitted avoids unrelated SSI conflicts.
  }, { isolationLevel: "ReadCommitted" });
  // Old durable replay results only contain the asset ID. Read the identity; never allocate again.
  if (!result.productCode) {
    const asset = await db.asset.findUnique({ where: { id: result.assetId }, include: { unit: true } });
    if (!asset || asset.isDeleted) throw new ProductRegistrationError("NOT_FOUND", "Item not found or unavailable.");
    return { ...result, productCode: asset.propertyNo, qrCodeData: asset.propertyNo, assetName: asset.name, unitCode: asset.unit.code };
  }
  return result;
}

export async function registerDelivery(db: PrismaClient, actorId: string, form: FormData) {
  registrationOperation(form);
  if (readText(form, "poNumber", "PO reference", 200, false) || readText(form, "deliveryReceiptNo", "DR reference", 200, false)) {
    throw new ProductRegistrationError("VALIDATION_ERROR", "PO and DR references are generated automatically. Reload the delivery form.");
  }
  const supplierName = readText(form, "supplierName", "supplier name");
  const categoryId = readText(form, "categoryId", "category");
  const itemDescription = readText(form, "itemDescription", "item description", 1000);
  const quantity = readNumber(form, "quantity", "quantity", MAX_DELIVERY_QUANTITY, true);
  const unitCost = readNumber(form, "unitCost", "unit cost");
  const remarks = readText(form, "remarks", "remarks", 4000, false);
  const totalAmount = unitCost * quantity;
  if (!Number.isFinite(totalAmount) || totalAmount > Number.MAX_SAFE_INTEGER) throw new ProductRegistrationError("VALIDATION_ERROR", "The delivery total is too large.");

  const result = await auditedTransaction(db, actorId, operationFromForm(form), async tx => {
    const actor = await requireAuditActor(tx, actorId, ["ADMIN", "STAFF"]);
    const receivingUnit = await tx.unit.findUnique({ where: { code: "AMO" } });
    if (!receivingUnit?.isActive || actor.unitId !== receivingUnit.id) throw new ProductRegistrationError("VALIDATION_ERROR", "Only active AMO officers can log delivery receipts.");
    if (!await tx.category.findUnique({ where: { id: categoryId } })) throw new ProductRegistrationError("VALIDATION_ERROR", "Choose an available category.");
    const unitId = receivingUnit.id;
    const classification = unitCost >= 50000 ? "PPE" : "SEMI_EXPENDABLE";
    const now = new Date();
    const { poNumber, deliveryReceiptNo } = await allocateProcurementReferences(tx);
    const record = await tx.intakeRecord.create({ data: { poNumber, supplierName, deliveryReceiptNo, deliveryDate: now, totalAmount, remarks } });
    const intakeItem = await tx.intakeItem.create({ data: { intakeRecordId: record.id, description: itemDescription, quantity, unitCost, classification } });
    const codes = await allocateProductCodes(tx, quantity);
    const createdAssetIds: string[] = [];
    // Bounded batches avoid N+1 writes and PostgreSQL's parameter limit on large deliveries.
    for (let offset = 0; offset < quantity; offset += 250) {
      const assets = codes.slice(offset, offset + 250).map(propertyNo => ({
        id: randomUUID(), propertyNo, qrCodeData: propertyNo, name: itemDescription,
        description: itemDescription,
        classification, categoryId, unitId, acquisitionCost: unitCost, acquisitionDate: now,
        status: "IN_STORAGE", condition: "EXCELLENT", lastVerifiedAt: now,
      }));
      await tx.asset.createMany({ data: assets });
      await tx.inspection.createMany({ data: assets.map(asset => ({
        assetId: asset.id, intakeItemId: intakeItem.id, inspectorId: actorId, result: "ACCEPTED",
        remarks: "Delivered item conforming to PO technical specifications with zero defects.",
      })) });
      // Same audit envelope as writeAuditEvent, with one already-validated actor for the batch.
      await tx.auditLog.createMany({ data: assets.map(asset => ({
        actorId, actorNameSnapshot: actor.name, actorRoleSnapshot: actor.role, actorKind: "USER",
        action: "REGISTER_ASSET", eventKind: "CREATE", entityType: "ASSET", entityId: asset.id,
        entityReference: asset.propertyNo, relatedAssetIds: [asset.id], operationId: auditOperationContext.getStore(),
        beforeState: Prisma.JsonNull, afterState: JSON.parse(JSON.stringify(safeAuditState(asset))),
      })) });
      createdAssetIds.push(...assets.map(asset => asset.id));
    }
    await writeAuditEvent(tx, { data: {
      actorId, action: "PROCUREMENT_INTAKE", entityType: "INTAKE", entityId: record.id,
      relatedAssetIds: createdAssetIds, entityReference: poNumber,
      afterState: { poNumber, deliveryReceiptNo, supplierName, quantity, unitCost, totalAmount },
    } });
    return { success: true as const, recordId: record.id, count: createdAssetIds.length, poNumber, deliveryReceiptNo };
  }, { isolationLevel: "ReadCommitted", timeout: 60000, maxWait: 15000 });
  if (!result.poNumber || !result.deliveryReceiptNo) {
    const record = await db.intakeRecord.findUniqueOrThrow({ where: { id: result.recordId } });
    return { ...result, poNumber: record.poNumber, deliveryReceiptNo: record.deliveryReceiptNo };
  }
  return result;
}
