import { createHash } from 'node:crypto';
import type { AuditLogQuery } from '../types/audit-log';

export class AuditError extends Error {
  constructor(public code: import('../types/audit-log').AuditErrorCode, message: string) { super(message); }
}
const filterKeys = ['fromDate', 'toDate', 'actorId', 'action', 'entityType', 'entityId', 'assetId', 'reference', 'cursor', 'limit'];
export function validateAuditQuery(input: AuditLogQuery, personal = false): AuditLogQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !filterKeys.includes(k)) || (personal && 'actorId' in input)) invalid();
  for (const [key, value] of Object.entries(input)) {
    if (key === 'limit') { if (![25, 50, 100].includes(value as number)) invalid(); }
    else if (typeof value !== 'string' || value.length > (key === 'cursor' ? 2048 : 120) || /[\u0000-\u001f]/.test(value)) invalid();
  }
  for (const date of [input.fromDate, input.toDate]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) invalid();
  }
  if (input.fromDate && input.toDate && input.fromDate > input.toDate) invalid();
  return { ...input, limit: input.limit ?? 25 };
}
export function invalid(): never { throw new AuditError('VALIDATION_ERROR', 'Check the filters and date range, then try again.'); }
export function auditDateRange(query: AuditLogQuery) {
  return {
    ...(query.fromDate ? { gte: new Date(`${query.fromDate}T00:00:00+08:00`) } : {}),
    ...(query.toDate ? { lt: new Date(Date.parse(`${query.toDate}T00:00:00+08:00`) + 86400000) } : {}),
  };
}
export function cursorScope(query: AuditLogQuery, actorId: string, personal: boolean) {
  const { cursor: ignored, ...filters } = query;
  void ignored;
  return createHash('sha256').update(JSON.stringify([actorId, personal, Object.entries(filters).sort(([a], [b]) => a.localeCompare(b))])).digest('hex');
}
export function encodeAuditCursor(id: string, scope: string) { return Buffer.from(JSON.stringify({ id, scope })).toString('base64url'); }
export function decodeAuditCursor(cursor: string, scope: string): string {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof value?.id !== 'string' || value.id.length > 120 || value.scope !== scope) invalid();
    return value.id;
  } catch { return invalid(); }
}

// The same allowlist is used for new writes and legacy read projections.
const allowed = new Set(`id propertyNo name description classification categoryId categoryCode categoryName serialNo acquisitionDate acquisitionCost unitId unitCode unitName accountablePersonId status condition isDeleted lastVerifiedAt code unitType campus parentUnitId isActive usefulLifeYears benchmarkCost specifications assetId assetName assetPropertyNo fromUnitId toUnitId fromPersonId toPersonId personId person fullName employeeNo position receiverName receiverEmployeeNo receiverPosition recordedByName remarks reason revision receivedAt receiptId reportId reportStatus locationLastSeen circumstances lastSeenDate location foundStatus result poNumber supplierName deliveryReceiptNo deliveryDate quantity unitCost totalAmount docketNo appraisedScrapValue method assetSoftDeleted duplicatePropertyNo masterPropertyNo retainedMaster archivedDuplicate mergedAt approvedBy templateVersion sourceVersion rowCount sheetCount reportSection overrideCount recordCount selection pageCount groupCount fieldIds templateIds fromUnit toUnit returnedBy requestedById decidedById requestedAt decidedAt inspectorId inspectedAt countedById countedAt sessionId title fiscalYear startedAt endedAt scannedLocation intakeRecordId intakeItemId approvedAt proposedAt coaApprovalRef resolvedAt reportedAt recordedById receivedByPersonId receivingCustodianId receivingCustodianRevision receivingCustodianAssignedAt receiver operationId`.split(' '));
export function safeAuditState(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 5) return null;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!allowed.has(key)) continue;
    if (entry === null || typeof entry === 'string' || typeof entry === 'boolean' || typeof entry === 'number') result[key] = entry;
    else if (entry instanceof Date) result[key] = entry.toISOString();
    else if (Array.isArray(entry)) result[key] = entry.filter(e => e === null || ['string', 'number', 'boolean'].includes(typeof e));
    else result[key] = safeAuditState(entry, depth + 1);
  }
  return result;
}
export function actionLabel(action: string) { return action.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()); }
export function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value));
}
