import { Prisma, PrismaClient } from '@prisma/client';
import { requireAuditActor } from './audit-log-write';
import { AuditError, validateAuditQuery, auditDateRange, cursorScope, decodeAuditCursor, encodeAuditCursor, safeAuditState, actionLabel } from './audit-log-validation';
import type { AuditLogQuery, AuditListItem, AuditDetail, TransactionAttribution } from '../types/audit-log';

const actorSelect = { name: true, role: true } as const;
const listSelect = { id: true, actorId: true, actorNameSnapshot: true, actorRoleSnapshot: true, actorKind: true, action: true, entityType: true, entityId: true, entityReference: true, createdAt: true, actor: { select: actorSelect } } satisfies Prisma.AuditLogSelect;
type ListRecord = Prisma.AuditLogGetPayload<{ select: typeof listSelect }>;
function item(row: ListRecord): AuditListItem {
  return {
    id: row.id, actorId: row.actorId, action: row.action, entityType: row.entityType, entityId: row.entityId,
    actorName: row.actorNameSnapshot ?? (row.actorKind === 'SYSTEM' ? 'System' : row.actor?.name ?? 'Actor not recorded'),
    actorRole: row.actorRoleSnapshot ?? (row.actorKind === 'SYSTEM' ? 'SYSTEM' : 'Not recorded'),
    attributionSource: row.actorNameSnapshot ? 'SNAPSHOT' : row.actor ? 'CURRENT_ACCOUNT_FALLBACK' : 'UNAVAILABLE',
    entityReference: row.entityReference ?? row.entityId, createdAt: row.createdAt.toISOString(), summary: actionLabel(row.action),
  };
}
export class AuditLogService {
  constructor(private db: PrismaClient, private actorId: string) {}
  private actor(global = false) { return requireAuditActor(this.db, this.actorId, global ? ['ADMIN', 'AUDITOR'] : undefined); }

  async canViewRecord(entityType: string, id: string): Promise<boolean> {
    const actor = await this.actor();
    if (['ADMIN', 'AUDITOR'].includes(actor.role)) return true;
    const staff = actor.role === 'STAFF';
    if (!staff && !actor.unitId) return false;
    if (entityType === 'ASSET') return !!await this.db.asset.findFirst({ where: { id, ...(!staff ? { unitId: actor.unitId! } : {}), isDeleted: false }, select: { id: true } });
    if (entityType === 'TRANSFER') return !!await this.db.transferRequest.findFirst({ where: { id, ...(!staff ? { OR: [{ fromUnitId: actor.unitId! }, { toUnitId: actor.unitId! }] } : {}) }, select: { id: true } });
    if (entityType === 'RECEIPT') return !!await this.db.itemReceipt.findFirst({ where: { id, ...(!staff ? { unitId: actor.unitId! } : {}) }, select: { id: true } });
    if (entityType === 'RECEIVING_CUSTODIAN' || entityType === 'UNIT') return (staff || id === actor.unitId) && !!await this.db.unit.findUnique({ where: { id }, select: { id: true } });
    if (entityType === 'PERSON') return !!await this.db.person.findFirst({ where: { id, ...(!staff ? { unitId: actor.unitId! } : {}) }, select: { id: true } });
    if (staff && entityType === 'CATEGORY') return !!await this.db.category.findUnique({ where: { id }, select: { id: true } });
    if (staff && entityType === 'PRODUCT_TEMPLATE') return !!await this.db.productTemplate.findUnique({ where: { id }, select: { id: true } });
    if (staff && entityType === 'INTAKE') return !!await this.db.intakeRecord.findUnique({ where: { id }, select: { id: true } });
    if (staff && entityType === 'PHYSICAL_COUNT_SESSION') return !!await this.db.physicalCountSession.findUnique({ where: { id }, select: { id: true } });
    const record = entityType === 'RETURN' ? await this.db.returnRequest.findUnique({ where: { id }, select: { assetId: true } })
      : entityType === 'INSPECTION' ? await this.db.inspection.findUnique({ where: { id }, select: { assetId: true } })
      : entityType === 'MISSING_REPORT' ? await this.db.missingReport.findUnique({ where: { id }, select: { assetId: true } })
      : entityType === 'PHYSICAL_COUNT_ENTRY' ? await this.db.physicalCountEntry.findUnique({ where: { id }, select: { assetId: true } })
      : entityType === 'DISPOSAL' ? await this.db.disposal.findUnique({ where: { id }, select: { assetId: true } }) : null;
    return record?.assetId ? this.canViewRecord('ASSET', record.assetId) : false;
  }

  async list(input: AuditLogQuery = {}, personal = false) {
    await this.actor(!personal);
    const query = validateAuditQuery(input, personal);
    const conditions: Prisma.AuditLogWhereInput[] = [];
    if (personal) conditions.push({ actorId: this.actorId });
    else if (query.actorId) conditions.push({ actorId: query.actorId });
    if (query.fromDate || query.toDate) conditions.push({ createdAt: auditDateRange(query) });
    for (const key of ['action', 'entityType', 'entityId'] as const) if (query[key]) conditions.push({ [key]: query[key] });
    if (query.reference) conditions.push({ OR: [{ entityReference: query.reference.trim() }, { entityId: query.reference.trim() }] });
    if (query.assetId) {
      // Include legacy transfer events as well as new related-asset snapshots.
      const [transfers, returns, receipts, inspections, disposals] = await Promise.all([
        this.db.transferRequest.findMany({ where: { assetId: query.assetId }, select: { id: true } }),
        this.db.returnRequest.findMany({ where: { assetId: query.assetId }, select: { id: true } }),
        this.db.itemReceipt.findMany({ where: { assetId: query.assetId }, select: { id: true } }),
        this.db.inspection.findMany({ where: { assetId: query.assetId }, select: { id: true } }),
        this.db.disposal.findMany({ where: { assetId: query.assetId }, select: { id: true } }),
      ]);
      conditions.push({ OR: [{ relatedAssetIds: { has: query.assetId } }, { entityType: 'ASSET', entityId: query.assetId }, ...[['TRANSFER', transfers], ['RETURN', returns], ['RECEIPT', receipts], ['INSPECTION', inspections], ['DISPOSAL', disposals]].map(([type, rows]) => ({ entityType: String(type), entityId: { in: (rows as { id: string }[]).map(r => r.id) } }))] });
    }
    const scope = cursorScope(query, this.actorId, personal);
    if (query.cursor) {
      const id = decodeAuditCursor(query.cursor, scope);
      const anchor = await this.db.auditLog.findFirst({ where: { AND: [...conditions, { id }] }, select: { id: true, createdAt: true } });
      if (!anchor) throw new AuditError('VALIDATION_ERROR', 'Refresh the history before continuing.');
      conditions.push({ OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] });
    }
    const rows = await this.db.auditLog.findMany({ where: { AND: conditions }, select: listSelect, take: query.limit! + 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    await this.actor(!personal);
    const items = rows.slice(0, query.limit).map(item);
    return { items, hasMore: rows.length > query.limit!, nextCursor: rows.length > query.limit! && items.length ? encodeAuditCursor(items[items.length - 1].id, scope) : null };
  }

  async detail(id: string, personal = false): Promise<AuditDetail> {
    await this.actor(!personal);
    if (typeof id !== 'string' || !id || id.length > 120) throw new AuditError('VALIDATION_ERROR', 'Choose a valid history entry.');
    const row = await this.db.auditLog.findFirst({ where: { id, ...(personal ? { actorId: this.actorId } : {}) }, include: { actor: { select: actorSelect } } });
    if (!row) throw new AuditError('NOT_FOUND', 'Activity entry not found.');
    const payloadVisible = !personal || await this.canViewRecord(row.entityType, row.entityId);
    await this.actor(!personal);
    return { ...item(row), beforeState: payloadVisible ? safeAuditState(row.beforeState) : null, afterState: payloadVisible ? safeAuditState(row.afterState) : null, ...(!personal ? { ipAddress: row.ipAddress } : {}), payloadVisible };
  }

  async actors(query = '', cursor?: string) {
    await this.actor(true);
    if (typeof query !== 'string' || query.length > 120 || (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 120))) throw new AuditError('VALIDATION_ERROR', 'Choose valid account filters.');
    const rows = await this.db.user.findMany({ where: { ...(query ? { name: { contains: query.replace(/([\\%_])/g, '\\$1'), mode: 'insensitive' } } : {}), ...(cursor ? { id: { gt: cursor } } : {}) }, select: { id: true, name: true, isActive: true }, orderBy: { id: 'asc' }, take: 26 });
    return { items: rows.slice(0, 25), nextCursor: rows.length > 25 ? rows[24].id : null };
  }

  async attribution(entityType: string, entityId: string): Promise<TransactionAttribution> {
    if (!await this.canViewRecord(entityType, entityId)) throw new AuditError('FORBIDDEN', 'You cannot view this transaction.');
    const where = { entityType, entityId };
    const [original, latest] = await Promise.all([
      this.db.auditLog.findFirst({ where: { ...where, eventKind: 'CREATE' }, select: listSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      this.db.auditLog.findFirst({ where: { ...where, eventKind: { in: ['UPDATE', 'DELETE'] } }, select: listSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    ]);
    const value = (row: ListRecord | null) => row ? { name: item(row).actorName, at: row.createdAt.toISOString(), source: item(row).attributionSource } : null;
    // Reliable pre-feature receipt snapshots can identify the receipt creator.
    if (!original && entityType === 'RECEIPT') {
      const receipt = await this.db.itemReceipt.findUnique({ where: { id: entityId }, select: { recordedByName: true, receivedAt: true } });
      if (receipt) return { originallyLoggedBy: { name: receipt.recordedByName, at: receipt.receivedAt.toISOString(), source: 'SNAPSHOT' }, lastUpdatedBy: value(latest) };
    }
    return { originallyLoggedBy: value(original), lastUpdatedBy: value(latest) };
  }
}
