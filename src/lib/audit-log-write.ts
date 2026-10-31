import { auditOperationContext } from "./audit-context";
import { Prisma } from '@prisma/client';
import { safeAuditState, AuditError } from './audit-log-validation';

export async function requireAuditActor(db: Prisma.TransactionClient, actorId: string, roles = ['ADMIN', 'STAFF', 'CUSTODIAN', 'AUDITOR']) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { id: true, name: true, role: true, isActive: true, unitId: true } });
  if (!actor?.isActive) throw new AuditError('UNAUTHENTICATED', 'Please sign in with an active account.');
  if (!roles.includes(actor.role)) throw new AuditError('FORBIDDEN', 'Your account cannot perform this action.');
  return actor;
}

const creations = new Set(['REGISTER_ASSET', 'CREATE_PERSON', 'CREATE_UNIT', 'CREATE_CATEGORY', 'CREATE_PRODUCT_TEMPLATE', 'REQUEST_TRANSFER', 'REQUEST_RETURN', 'PROCUREMENT_INTAKE', 'LOG_INSPECTION', 'PROPOSE_DISPOSAL_DOCKET', 'REPORT_MISSING', 'RECORD_ITEM_RECEIPT']);
export async function updateAuditedAsset(db: Prisma.TransactionClient, actorId: string, input: Prisma.AssetUpdateArgs) {
  const before = await db.asset.findUniqueOrThrow({ where: input.where });
  const after = await db.asset.update(input);
  const safeBefore = safeAuditState(before) ?? {};
  const safeAfter = safeAuditState(after) ?? {};
  const changed = Object.keys(safeAfter).filter(key => JSON.stringify(safeBefore[key]) !== JSON.stringify(safeAfter[key]));
  if (changed.length) await writeAuditEvent(db, { data: { actorId, action: 'UPDATE_ASSET', eventKind: 'UPDATE', entityType: 'ASSET', entityId: before.id, beforeState: JSON.parse(JSON.stringify(Object.fromEntries(changed.map(key => [key, safeBefore[key]])))), afterState: JSON.parse(JSON.stringify(Object.fromEntries(changed.map(key => [key, safeAfter[key]])))) } });
  return after;
}
export async function writeAuditEvent(db: Prisma.TransactionClient, input: { data: Prisma.AuditLogUncheckedCreateInput }) {
  const data = input.data;
  const actor = data.actorId ? await requireAuditActor(db, data.actorId) : null;
  const related = new Set<string>(Array.isArray(data.relatedAssetIds) ? data.relatedAssetIds : []);
  let reference = data.entityReference ?? null;
  if (data.entityType === 'ASSET') related.add(data.entityId);
  const lookup = data.entityType === 'TRANSFER' ? await db.transferRequest.findUnique({ where: { id: data.entityId }, select: { assetId: true } })
    : data.entityType === 'RETURN' ? await db.returnRequest.findUnique({ where: { id: data.entityId }, select: { assetId: true } })
    : data.entityType === 'DISPOSAL' ? await db.disposal.findUnique({ where: { id: data.entityId }, select: { assetId: true } })
    : data.entityType === 'INSPECTION' ? await db.inspection.findUnique({ where: { id: data.entityId }, select: { assetId: true } })
    : data.entityType === 'MISSING_REPORT' ? await db.missingReport.findUnique({ where: { id: data.entityId }, select: { assetId: true } })
    : data.entityType === 'PHYSICAL_COUNT_ENTRY' ? await db.physicalCountEntry.findUnique({ where: { id: data.entityId }, select: { assetId: true } })
    : data.entityType === 'RECEIPT' ? await db.itemReceipt.findUnique({ where: { id: data.entityId }, select: { assetId: true } }) : null;
  if (lookup?.assetId) related.add(lookup.assetId);
  if (related.size && !reference) {
    const asset = await db.asset.findUnique({ where: { id: [...related][0] }, select: { propertyNo: true } });
    reference = asset?.propertyNo ?? null;
  }
  const before = safeAuditState(data.beforeState);
  const after = safeAuditState(data.afterState);
  const eventKind = data.eventKind ?? (creations.has(data.action) ? 'CREATE' : data.action.startsWith('EXPORT') ? 'EVENT' : data.action.startsWith('DELETE') ? 'DELETE' : 'UPDATE');
  if (eventKind === 'UPDATE' && JSON.stringify(before) === JSON.stringify(after)) return null;
  if (Buffer.byteLength(JSON.stringify([before, after])) > 65536) throw new AuditError('VALIDATION_ERROR', 'The change is too large to record safely.');
  return db.auditLog.create({ data: {
    ...data,
    operationId: data.operationId ?? auditOperationContext.getStore() ?? null,
    actorNameSnapshot: actor?.name ?? null,
    actorRoleSnapshot: actor?.role ?? null,
    actorKind: actor ? 'USER' : (data.actorKind ?? 'UNKNOWN'),
    eventKind,
    beforeState: before ? JSON.parse(JSON.stringify(before)) : Prisma.JsonNull,
    afterState: after ? JSON.parse(JSON.stringify(after)) : Prisma.JsonNull,
    relatedAssetIds: [...related], entityReference: reference,
  } });
}
