import { writeAuditEvent } from "@/lib/audit-log-write";
import { resolveManualPerson, ManualPersonError } from "./manual-person";
import { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import type { ItemReceiptInput, ItemReceiptFilters } from "@/types/item-receipt";
import { canManageReceivingCustodians, canReadReceivingUnit } from "./rbac";
import { validateDesignation, validateDirectory, validId, validQuery } from "./receiving-custodian-validation";
import type { AssignInput, RemoveInput, DirectoryFilters, PersonSummary, ReceivingCustodianRow, ReceivingErrorCode, ReceivingCustodianHistoryEntry } from "@/types/receiving-custodian";

export class ReceivingError extends Error {
  constructor(public code: ReceivingErrorCode, message: string, public fieldErrors?: Record<string, string>) { super(message); }
}
const personSelect = { id: true, employeeNo: true, fullName: true, position: true, email: true } satisfies Prisma.PersonSelect;
const unitSelect = {
  id: true, code: true, name: true, unitType: true, campus: true, isActive: true,
  receivingCustodianRevision: true, receivingCustodianAssignedAt: true,
  receivingCustodian: { select: personSelect },
} satisfies Prisma.UnitSelect;
type UnitRecord = Prisma.UnitGetPayload<{ select: typeof unitSelect }>;
type Actor = { id: string; name: string; role: string; unitId: string | null };
function row(unit: UnitRecord): ReceivingCustodianRow {
  return {
    unit: { id: unit.id, code: unit.code, name: unit.name, unitType: unit.unitType, campus: unit.campus, isActive: unit.isActive },
    person: unit.receivingCustodian, assignedAt: unit.receivingCustodianAssignedAt?.toISOString() ?? null,
    revision: unit.receivingCustodianRevision,
  };
}
function invalid(): never { throw new ReceivingError("VALIDATION_ERROR", "Check the requested fields and try again."); }
function requireScope(actor: Actor, unitId: string) {
  if (!canReadReceivingUnit(actor.role, actor.unitId, unitId)) throw new ReceivingError("FORBIDDEN", "You cannot access this unit's designations.");
}
function manager(actor: Actor) {
  if (!canManageReceivingCustodians(actor.role)) throw new ReceivingError("FORBIDDEN", "Only AMO administrators and staff can manage receiving custodians.");
}
function snapshot(person: PersonSummary | null) { return person ? { ...person, email: null } : null; }
// Prisma's PostgreSQL contains filter uses LIKE; treat search punctuation literally.
function literalSearch(query: string) { return query.replace(/([\\%_])/g, "\\$1"); }

// Kept independent of Next's request context so transactions and authorization can be verified against a disposable database.
export class ReceivingCustodianService {
  constructor(private db: PrismaClient, private actorId: string) {}

  private async actor(client: Prisma.TransactionClient = this.db): Promise<Actor> {
    const actor = await client.user.findUnique({ where: { id: this.actorId }, select: { id: true, name: true, role: true, unitId: true, isActive: true } });
    if (!actor?.isActive) throw new ReceivingError("UNAUTHENTICATED", "Please sign in with an active account.");
    if (!["ADMIN", "STAFF", "AUDITOR", "CUSTODIAN"].includes(actor.role)) throw new ReceivingError("FORBIDDEN", "Your account cannot access receiving custodians.");
    return actor;
  }

  async directory(filters: DirectoryFilters = {}) {
    const actor = await this.actor();
    if (!validateDirectory(filters)) invalid();
    const where: Prisma.UnitWhereInput = {};
    if (actor.role === "CUSTODIAN") where.id = actor.unitId ?? "__unlinked__";
    if (!filters.includeInactive) where.isActive = true;
    if (filters.campus) where.campus = filters.campus;
    if (filters.unitType) where.unitType = filters.unitType;
    if (filters.status === "ASSIGNED") where.receivingCustodianId = { not: null };
    if (filters.status === "UNASSIGNED") where.receivingCustodianId = null;
    const query = literalSearch(filters.query?.trim() ?? "");
    if (query) where.OR = [
      { code: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } },
      { receivingCustodian: { fullName: { contains: query, mode: "insensitive" } } },
      { receivingCustodian: { employeeNo: { contains: query, mode: "insensitive" } } },
    ];
    const page = filters.page ?? 1;
    const [total, units] = await this.db.$transaction([
      this.db.unit.count({ where }), this.db.unit.findMany({ where, select: unitSelect, orderBy: [{ name: "asc" }, { id: "asc" }], take: 25, skip: (page - 1) * 25 }),
    ]);
    return { items: units.map(row), total, page, pageSize: 25 as const, canManage: canManageReceivingCustodians(actor.role), unlinked: actor.role === "CUSTODIAN" && !actor.unitId };
  }

  async unit(unitId: string) {
    const actor = await this.actor();
    if (!validId(unitId)) invalid();
    requireScope(actor, unitId);
    const unit = await this.db.unit.findUnique({ where: { id: unitId }, select: unitSelect });
    if (!unit) throw new ReceivingError("NOT_FOUND", "Office or college not found.");
    return { row: row(unit) };
  }

  async units(query?: string) {
    manager(await this.actor());
    if (!validQuery(query)) invalid();
    const q = literalSearch(query?.trim() ?? "");
    const units = await this.db.unit.findMany({ where: { isActive: true, OR: [{ code: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] }, select: { id: true, code: true, name: true }, take: 21, orderBy: [{ name: "asc" }, { id: "asc" }] });
    return { items: units.slice(0, 20), hasMore: units.length > 20 };
  }

  async candidates(unitId: string, query?: string) {
    manager(await this.actor());
    if (!validId(unitId) || !validQuery(query)) invalid();
    const unit = await this.db.unit.findUnique({ where: { id: unitId }, select: { isActive: true } });
    if (!unit) throw new ReceivingError("NOT_FOUND", "Office or college not found.");
    if (!unit.isActive) throw new ReceivingError("UNIT_INACTIVE", "This unit is inactive.");
    const q = literalSearch(query?.trim() ?? "");
    const people = await this.db.person.findMany({ where: { unitId, OR: [{ fullName: { contains: q, mode: "insensitive" } }, { employeeNo: { contains: q, mode: "insensitive" } }] }, select: personSelect, take: 21, orderBy: [{ fullName: "asc" }, { employeeNo: "asc" }] });
    return { items: people.slice(0, 20), hasMore: people.length > 20 };
  }

  async save(input: AssignInput | RemoveInput, remove = false) {
    const fields = validateDesignation(input, remove);
    if (Object.keys(fields).length) throw new ReceivingError("VALIDATION_ERROR", "Please correct the highlighted fields.", fields);
    return this.db.$transaction(async (tx) => {
      // Row locks serialize assignments with unit deactivation and account revocation.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${this.actorId} FOR SHARE`;
      const actor = await this.actor(tx);
      manager(actor);
      await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${input.unitId} FOR UPDATE`;
      const unit = await tx.unit.findUnique({ where: { id: input.unitId }, select: unitSelect });
      if (!unit) throw new ReceivingError("NOT_FOUND", "Office or college not found.");
      if (unit.receivingCustodianRevision !== input.expectedRevision) throw new ReceivingError("CONFLICT", "This designation changed. Reload it before saving.");
      if (!remove && !unit.isActive) throw new ReceivingError("UNIT_INACTIVE", "This unit is inactive. Choose an active office or college.");
      if (remove && !unit.receivingCustodian) throw new ReceivingError("NOT_ASSIGNED", "This unit no longer has a receiving custodian.");
      let person: PersonSummary | null = null;
      let createdPersonId: string | null = null;
      if (!remove && "mode" in input) {
        if (input.mode === "EXISTING") {
          await tx.$queryRaw`SELECT "id" FROM "Person" WHERE "id" = ${input.personId} FOR SHARE`;
          const candidate = await tx.person.findUnique({ where: { id: input.personId }, select: { ...personSelect, unitId: true } });
          if (!candidate) throw new ReceivingError("NOT_FOUND", "Employee record no longer exists.");
          if (candidate.unitId !== input.unitId) throw new ReceivingError("PERSON_UNIT_MISMATCH", "Choose an employee belonging to this office or college.");
          person = { id: candidate.id, employeeNo: candidate.employeeNo, fullName: candidate.fullName, position: candidate.position, email: candidate.email };
          if (person.id === unit.receivingCustodian?.id) throw new ReceivingError("ALREADY_ASSIGNED", "This person is already the receiving custodian.");
        } else {
          const entered = { employeeNo: input.person.employeeNo?.trim(), fullName: input.person.fullName.trim(), position: input.person.position.trim(), email: input.person.email?.trim() || undefined };
          const existed = entered.employeeNo ? await tx.person.findUnique({ where: { employeeNo: entered.employeeNo }, select: { id: true } }) : null;
          try { person = await resolveManualPerson(tx, input.unitId, entered, actor.id); }
          catch (error) { if (error instanceof ManualPersonError) throw new ReceivingError("EMPLOYEE_NO_EXISTS", error.message, { employeeNo: error.message }); throw error; }
          if (person.id === unit.receivingCustodian?.id) throw new ReceivingError("ALREADY_ASSIGNED", "This person is already the receiving custodian.");
          createdPersonId = existed ? null : person.id;
        }
      }
      const revision = unit.receivingCustodianRevision + 1;
      const updated = await tx.unit.update({ where: { id: unit.id }, data: { receivingCustodianId: person?.id ?? null, receivingCustodianAssignedAt: person ? new Date() : null, receivingCustodianRevision: revision }, select: unitSelect });
      const action = remove ? "REMOVE_RECEIVING_CUSTODIAN" : unit.receivingCustodian ? "REPLACE_RECEIVING_CUSTODIAN" : "ASSIGN_RECEIVING_CUSTODIAN";
      await writeAuditEvent(tx, { data: { actorId: actor.id, action, entityType: "RECEIVING_CUSTODIAN", entityId: unit.id, beforeState: { person: snapshot(unit.receivingCustodian), revision: unit.receivingCustodianRevision }, afterState: { person: snapshot(person), revision, reason: input.reason.trim(), actorName: actor.name } } });
      return { row: row(updated), createdPersonId };
    }, { maxWait: 5000, timeout: 10000 });
  }

  async receiptAssets(unitId: string, query?: string) {
    manager(await this.actor());
    if (!validId(unitId) || !validQuery(query)) invalid();
    const unit = await this.db.unit.findUnique({ where: { id: unitId }, select: { isActive: true } });
    if (!unit) throw new ReceivingError("NOT_FOUND", "Office or college not found.");
    if (!unit.isActive) throw new ReceivingError("UNIT_INACTIVE", "This unit is inactive.");
    const q = literalSearch(query?.trim() ?? "");
    const assets = await this.db.asset.findMany({
      where: { unitId, isDeleted: false, status: { notIn: ["DISPOSED", "MISSING"] }, OR: [{ propertyNo: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
      select: { id: true, propertyNo: true, name: true, updatedAt: true }, take: 21, orderBy: [{ propertyNo: "asc" }, { id: "asc" }],
    });
    return { items: assets.slice(0, 20).map(a => ({ ...a, updatedAt: a.updatedAt.toISOString() })), hasMore: assets.length > 20 };
  }

  async receipts(filters: ItemReceiptFilters = {}) {
    const actor = await this.actor();
    if (!filters || !validQuery(filters.query) || (filters.unitId !== undefined && !validId(filters.unitId)) || (filters.assetId !== undefined && !validId(filters.assetId)) || (filters.page !== undefined && (!Number.isSafeInteger(filters.page) || filters.page < 1 || filters.page > 1000000))) invalid();
    if (filters.unitId) requireScope(actor, filters.unitId);
    const where: Prisma.ItemReceiptWhereInput = {};
    if (actor.role === "CUSTODIAN") where.unitId = actor.unitId ?? "__unlinked__";
    else if (filters.unitId) where.unitId = filters.unitId;
    if (filters.assetId) where.assetId = filters.assetId;
    const query = literalSearch(filters.query?.trim() ?? "");
    if (query) where.OR = [{ propertyNo: { contains: query, mode: "insensitive" } }, { assetName: { contains: query, mode: "insensitive" } }, { receiverName: { contains: query, mode: "insensitive" } }, { receiverEmployeeNo: { contains: query, mode: "insensitive" } }];
    const page = filters.page ?? 1;
    const [total, records] = await this.db.$transaction([
      this.db.itemReceipt.count({ where }),
      this.db.itemReceipt.findMany({ where, orderBy: [{ receivedAt: "desc" }, { id: "desc" }], take: 25, skip: (page - 1) * 25, select: receiptSelect }),
    ]);
    return { items: records.map(receiptDto), total, page, canManage: canManageReceivingCustodians(actor.role), unlinked: actor.role === "CUSTODIAN" && !actor.unitId };
  }

  async recordReceipt(input: ItemReceiptInput) {
    if (!input || !validId(input.operationId) || !validId(input.assetId) || typeof input.expectedAssetUpdatedAt !== "string" || !Number.isFinite(Date.parse(input.expectedAssetUpdatedAt))) invalid();
    const receiver = input.receiver;
    if (!receiver || (receiver.mode !== "EXISTING" && receiver.mode !== "NEW")) invalid();
    const assignment = { ...receiver, unitId: input.unitId, expectedRevision: 0, reason: input.remarks };
    const errors = validateDesignation(assignment);
    if (errors.reason) { errors.remarks = errors.reason; delete errors.reason; }
    if (Object.keys(errors).length) throw new ReceivingError("VALIDATION_ERROR", "Check the receipt fields.", errors);
    const normalized = {
      assetId: input.assetId, unitId: input.unitId, expectedAssetUpdatedAt: input.expectedAssetUpdatedAt,
      remarks: input.remarks.trim(), receiver: receiver.mode === "EXISTING" ? { mode: receiver.mode, personId: receiver.personId } : { mode: receiver.mode, person: { employeeNo: receiver.person.employeeNo?.trim(), fullName: receiver.person.fullName.trim(), position: receiver.person.position.trim(), email: receiver.person.email?.trim() || null } },
    };
    const hash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${this.actorId} FOR SHARE`;
      const actor = await this.actor(tx);
      manager(actor);
      // Serialize retries of one operation even when a tampered retry changes the asset.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${input.operationId}, 0))`;
      const previous = await tx.itemReceipt.findUnique({ where: { operationId: input.operationId } });
      if (previous) {
        if (previous.recordedById !== actor.id || previous.requestHash !== hash) throw new ReceivingError("CONFLICT", "This receipt request was already used. Start a new receipt.");
        return { receipt: receiptDto(previous), replayed: true };
      }
      await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${input.unitId} FOR SHARE`;
      const unit = await tx.unit.findUnique({ where: { id: input.unitId }, select: { code: true, isActive: true } });
      if (!unit) throw new ReceivingError("NOT_FOUND", "Office or college not found.");
      if (!unit.isActive) throw new ReceivingError("UNIT_INACTIVE", "This unit is inactive.");
      await tx.$queryRaw`SELECT "id" FROM "Asset" WHERE "id" = ${input.assetId} FOR UPDATE`;
      const asset = await tx.asset.findUnique({ where: { id: input.assetId } });
      if (!asset || asset.isDeleted || ["DISPOSED", "MISSING"].includes(asset.status)) throw new ReceivingError("NOT_FOUND", "This item is not available for receiving.");
      if (asset.unitId !== input.unitId || asset.updatedAt.toISOString() !== input.expectedAssetUpdatedAt) throw new ReceivingError("CONFLICT", "The item changed or moved to another unit. Reload the item before recording receipt.");
      let person: PersonSummary;
      if (receiver.mode === "EXISTING") {
        await tx.$queryRaw`SELECT "id" FROM "Person" WHERE "id" = ${receiver.personId} FOR SHARE`;
        const existing = await tx.person.findUnique({ where: { id: receiver.personId }, select: { ...personSelect, unitId: true } });
        if (!existing) throw new ReceivingError("NOT_FOUND", "Receiver no longer exists.");
        if (existing.unitId !== input.unitId) throw new ReceivingError("PERSON_UNIT_MISMATCH", "Select a receiver belonging to this office or college.");
        person = existing;
      } else {
        const entered = { employeeNo: receiver.person.employeeNo?.trim(), fullName: receiver.person.fullName.trim(), position: receiver.person.position.trim(), email: receiver.person.email?.trim() || undefined };
        try { person = await resolveManualPerson(tx, input.unitId, entered, actor.id); }
        catch (error) { if (error instanceof ManualPersonError) throw new ReceivingError("EMPLOYEE_NO_EXISTS", error.message, { employeeNo: error.message }); throw error; }
      }
      const receipt = await tx.itemReceipt.create({ data: {
        operationId: input.operationId, requestHash: hash, assetId: asset.id, unitId: input.unitId,
        receivedByPersonId: person.id, recordedById: actor.id, receiverName: person.fullName,
        receiverEmployeeNo: person.employeeNo, receiverPosition: person.position, unitCode: unit.code,
        propertyNo: asset.propertyNo, assetName: asset.name, recordedByName: actor.name, remarks: input.remarks.trim(),
      } });
      await tx.asset.update({ where: { id: asset.id }, data: { accountablePersonId: person.id } });
      await writeAuditEvent(tx, { data: { actorId: actor.id, action: "RECORD_ITEM_RECEIPT", entityType: "RECEIPT", entityId: receipt.id, operationId: input.operationId,
        afterState: { receiptId: receipt.id, person: snapshot(person), unitId: input.unitId, remarks: input.remarks.trim(), accountablePersonId: person.id } } });
      if (asset.accountablePersonId !== person.id) await writeAuditEvent(tx, { data: { actorId: actor.id, action: "UPDATE_ASSET_RECEIVER", entityType: "ASSET", entityId: asset.id, eventKind: "UPDATE", beforeState: { accountablePersonId: asset.accountablePersonId }, afterState: { accountablePersonId: person.id } } });
      return { receipt: receiptDto(receipt), replayed: false };
    }, { maxWait: 5000, timeout: 10000 });
  }

  async history(unitId: string, cursor?: string) {
    const actor = await this.actor();
    if (!validId(unitId) || (cursor !== undefined && !validId(cursor))) invalid();
    requireScope(actor, unitId);
    if (!await this.db.unit.findUnique({ where: { id: unitId }, select: { id: true } })) throw new ReceivingError("NOT_FOUND", "Office or college not found.");
    const where: Prisma.AuditLogWhereInput = { entityType: "RECEIVING_CUSTODIAN", entityId: unitId };
    if (cursor) {
      const anchor = await this.db.auditLog.findFirst({ where: { ...where, id: cursor }, select: { id: true, createdAt: true } });
      if (!anchor) invalid();
      where.OR = [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }];
    }
    const logs = await this.db.auditLog.findMany({ where, take: 21, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { actor: { select: { name: true } } } });
    const items: ReceivingCustodianHistoryEntry[] = logs.slice(0, 20).map(log => {
      const before = jsonObject(log.beforeState), after = jsonObject(log.afterState);
      return { id: log.id, unitId, action: log.action, actorName: log.actorNameSnapshot ?? (typeof after.actorName === "string" ? after.actorName : log.actor?.name ?? "Unknown actor"), beforePerson: historyPerson(before.person), afterPerson: historyPerson(after.person), reason: typeof after.reason === "string" ? after.reason : "", revision: typeof after.revision === "number" ? after.revision : 0, createdAt: log.createdAt.toISOString() };
    });
    return { items, nextCursor: logs.length > 20 ? items[items.length - 1].id : null };
  }
}
const receiptSelect = { id: true, assetId: true, unitId: true, propertyNo: true, assetName: true, unitCode: true, receiverName: true, receiverEmployeeNo: true, receiverPosition: true, recordedByName: true, remarks: true, receivedAt: true } satisfies Prisma.ItemReceiptSelect;
function receiptDto(receipt: Prisma.ItemReceiptGetPayload<{ select: typeof receiptSelect }>) { return { id: receipt.id, assetId: receipt.assetId, unitId: receipt.unitId, propertyNo: receipt.propertyNo, assetName: receipt.assetName, unitCode: receipt.unitCode, receiverName: receipt.receiverName, receiverEmployeeNo: receipt.receiverEmployeeNo, receiverPosition: receipt.receiverPosition, recordedByName: receipt.recordedByName, remarks: receipt.remarks, receivedAt: receipt.receivedAt.toISOString() }; }
function jsonObject(value: Prisma.JsonValue | undefined): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function historyPerson(value: Prisma.JsonValue | undefined): PersonSummary | null {
  const p = jsonObject(value);
  return typeof p.id === "string" && typeof p.employeeNo === "string" && typeof p.fullName === "string" && typeof p.position === "string" ? { id: p.id, employeeNo: p.employeeNo, fullName: p.fullName, position: p.position, email: null } : null;
}
