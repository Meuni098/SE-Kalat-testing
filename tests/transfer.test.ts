import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { TransferService } from "../src/lib/transfer-service";

function fixture() {
  const actor = { id: "staff", name: "AMO Staff", role: "STAFF", isActive: true, unitId: "origin" as string | null };
  const asset = { id: "asset", propertyNo: "TEST-001", unitId: "origin", accountablePersonId: "old-person" as string | null, status: "IN_STORAGE", isDeleted: false, lastVerifiedAt: null as Date | null };
  const destination = { id: "college", code: "CICT", unitType: "ACADEMIC", isActive: true };
  type Request = { id: string; assetId: string; fromUnitId: string; toUnitId: string; fromPersonId: string | null; toPersonId: string | null; status: string; remarks: string; requestedById: string; decidedById?: string; decidedAt?: Date };
  const requests: Request[] = [];
  const events: { action: string; afterState?: unknown }[] = [];
  const operations = new Map<string, { requestHash: string; result: unknown }>();
  const controls = { pendingReturn: false, failAudit: false, conflicts: 0, rawConflicts: 0 };
  const tx = {
    $queryRaw: async () => { if (controls.rawConflicts-- > 0) throw new Prisma.PrismaClientKnownRequestError("Raw query conflict", { code: "P2010", clientVersion: "test", meta: { code: "40001" } }); return []; },
    user: { findUnique: async () => actor },
    asset: {
      findUnique: async () => asset,
      findUniqueOrThrow: async () => ({ ...asset }),
      update: async ({ data }: { data: Partial<typeof asset> }) => Object.assign(asset, data),
    },
    unit: { findUnique: async () => destination },
    person: { findUnique: async () => ({ id: "legacy-person", unitId: destination.id }) },
    returnRequest: { findFirst: async () => controls.pendingReturn ? { id: "pending-return" } : null },
    transferRequest: {
      findFirst: async () => requests.find(r => r.status === "PENDING") ?? null,
      create: async ({ data }: { data: Omit<Request, "id"> }) => { const request = { id: randomUUID(), ...data }; requests.push(request); return request; },
      findUnique: async ({ where }: { where: { id: string } }) => { const request = requests.find(r => r.id === where.id); return request ? { ...request, asset: { ...asset } } : null; },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Request> }) => Object.assign(requests.find(r => r.id === where.id)!, data),
    },
    auditLog: { create: async ({ data }: { data: { action: string } }) => { if (controls.failAudit) throw new Error("Audit unavailable"); events.push(data); return data; } },
    auditOperation: {
      findUnique: async ({ where }: { where: { actorId_operationId: { operationId: string } } }) => operations.get(where.actorId_operationId.operationId) ?? null,
      create: async ({ data }: { data: { operationId: string; requestHash: string; result: unknown } }) => { operations.set(data.operationId, data); return data; },
    },
  };
  // This fixture implements only the Prisma operations used by the transfer flow;
  // database locking/concurrency is verified separately by the isolated integration suite.
  const db = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
    if (controls.conflicts-- > 0) throw new Prisma.PrismaClientKnownRequestError("Conflict", { code: "P2034", clientVersion: "test" });
    const before = structuredClone({ asset, requests, events, operations });
    try { return await callback(tx); }
    catch (error) {
      Object.assign(asset, before.asset); requests.splice(0, requests.length, ...before.requests); events.splice(0, events.length, ...before.events);
      operations.clear(); for (const [key, value] of before.operations) operations.set(key, value);
      throw error;
    }
  } } as unknown as PrismaClient;
  const service = new TransferService(db, actor.id);
  const form = () => { const form = new FormData(); form.set("assetId", asset.id); form.set("toUnitId", destination.id); form.set("operationId", randomUUID()); return form; };
  async function pending() { const result = await service.create(form()); assert.ok("success" in result); return requests[0]; }
  return { service, actor, asset, destination, requests, events, controls, form, pending };
}

test("a college-only request succeeds without a name or position and does not move the asset", async () => {
  const f = fixture(); const request = await f.pending();
  assert.equal(request.toPersonId, null); assert.equal(request.fromPersonId, "old-person");
  assert.equal(f.asset.unitId, "origin"); assert.equal(f.asset.status, "IN_STORAGE");
  assert.deepEqual(f.events.map(e => e.action), ["REQUEST_TRANSFER"]);
});

test("approval deploys a stored asset to college and clears prior individual custody", async () => {
  const f = fixture(); const request = await f.pending();
  assert.ok("success" in await f.service.decide(request.id, "APPROVED"));
  assert.equal(f.asset.unitId, "college"); assert.equal(f.asset.status, "IN_USE"); assert.equal(f.asset.accountablePersonId, null);
});

test("approval of a transfer back to AMO places the asset in storage", async () => {
  const f = fixture(); f.asset.status = "IN_USE"; f.destination.code = "AMO"; f.destination.unitType = "ADMINISTRATIVE";
  const request = await f.pending(); await f.service.decide(request.id, "APPROVED"); assert.equal(f.asset.status, "IN_STORAGE");
});

test("a rejection leaves inventory custody and status unchanged", async () => {
  const f = fixture(); const request = await f.pending(); await f.service.decide(request.id, "REJECTED");
  assert.equal(f.requests[0].status, "REJECTED"); assert.equal(f.asset.unitId, "origin"); assert.equal(f.asset.accountablePersonId, "old-person");
});

test("an exact submission retry replays the saved request without duplicate history", async () => {
  const f = fixture(); const form = f.form(); const first = await f.service.create(form); const retry = await f.service.create(form);
  assert.deepEqual(retry, first); assert.equal(f.requests.length, 1); assert.equal(f.events.length, 1);
});

test("a new operation cannot create a second pending request", async () => {
  const f = fixture(); await f.pending(); assert.ok("error" in await f.service.create(f.form())); assert.equal(f.requests.length, 1);
});

test("request validation rejects same-college moves, inactive destinations, and disposal assets", async () => {
  for (const change of ["same", "inactive", "disposal", "deleted", "missing"]) {
    const f = fixture();
    if (change === "same") f.asset.unitId = "college";
    if (change === "inactive") f.destination.isActive = false;
    if (change === "disposal") f.asset.status = "FOR_DISPOSAL";
    if (change === "deleted") f.asset.isDeleted = true;
    if (change === "missing") f.asset.status = "MISSING";
    assert.ok("error" in await f.service.create(f.form()), change); assert.equal(f.requests.length, 0, change);
  }
});

test("pending returns prevent competing transfer requests", async () => {
  const f = fixture(); f.controls.pendingReturn = true; assert.ok("error" in await f.service.create(f.form())); assert.equal(f.requests.length, 0);
});

test("only authorized active staff or the asset's own college custodian can request transfers", async () => {
  for (const role of ["AUDITOR", "CUSTODIAN", "inactive"]) {
    const f = fixture(); f.actor.role = role === "inactive" ? "STAFF" : role; f.actor.unitId = "other"; f.actor.isActive = role !== "inactive";
    assert.ok("error" in await f.service.create(f.form())); assert.equal(f.requests.length, 0);
  }
  const f = fixture(); f.actor.role = "CUSTODIAN"; await f.pending();
});

test("custodians cannot approve their own transfer requests", async () => {
  const f = fixture(); const request = await f.pending(); f.actor.role = "CUSTODIAN";
  assert.ok("error" in await f.service.decide(request.id, "APPROVED")); assert.equal(f.requests[0].status, "PENDING");
});

test("changed custody and unavailable assets cannot be approved", async () => {
  for (const change of ["unit", "person", "missing", "disposal", "inactive", "return"]) {
    const f = fixture(); const request = await f.pending();
    if (change === "unit") f.asset.unitId = "other";
    if (change === "person") f.asset.accountablePersonId = "other-person";
    if (change === "missing") f.asset.status = "MISSING";
    if (change === "disposal") f.asset.status = "FOR_DISPOSAL";
    if (change === "inactive") f.destination.isActive = false;
    if (change === "return") f.controls.pendingReturn = true;
    assert.ok("error" in await f.service.decide(request.id, "APPROVED"), change); assert.equal(f.requests[0].status, "PENDING", change);
  }
});

test("repeated decisions are idempotent; an opposite decision is rejected", async () => {
  const f = fixture(); const request = await f.pending();
  await f.service.decide(request.id, "APPROVED"); const count = f.events.length;
  assert.ok("success" in await f.service.decide(request.id, "APPROVED")); assert.equal(f.events.length, count);
  assert.ok("error" in await f.service.decide(request.id, "REJECTED"));
});

test("approval retries serializable conflicts instead of reporting a false failure", async () => {
  const f = fixture(); const request = await f.pending(); f.controls.conflicts = 1;
  assert.ok("success" in await f.service.decide(request.id, "APPROVED")); assert.equal(f.requests[0].status, "APPROVED");
});

test("an audit failure rolls back request and inventory changes together", async () => {
  const f = fixture(); const request = await f.pending(); f.controls.failAudit = true;
  assert.ok("error" in await f.service.decide(request.id, "APPROVED"));
  assert.equal(f.requests[0].status, "PENDING"); assert.equal(f.asset.unitId, "origin");
});

test("oversized remarks produce a specific validation error without writing", async () => {
  const f = fixture(); const form = f.form(); form.set("remarks", "x".repeat(501));
  const result = await f.service.create(form); assert.ok("error" in result); assert.match(result.error, /remarks.*500/i); assert.equal(f.requests.length, 0);
});

test("approval retries PostgreSQL serialization conflicts raised by raw row locks", async () => {
  const f = fixture(); const request = await f.pending(); f.controls.rawConflicts = 1;
  assert.ok("success" in await f.service.decide(request.id, "APPROVED"));
  assert.equal(f.requests[0].status, "APPROVED");
  assert.equal(f.events.filter(event => event.action === "APPROVE_TRANSFER").length, 1);
});

test("legacy recipient requests preserve valid named recipients on approval", async () => {
  const f = fixture(); const request = await f.pending(); request.toPersonId = "legacy-person";
  assert.ok("success" in await f.service.decide(request.id, "APPROVED")); assert.equal(f.asset.accountablePersonId, "legacy-person");
});

test("transferring repair equipment preserves repair status and does not count as physical verification", async () => {
  const f = fixture(); f.asset.status = "UNDER_REPAIR"; const request = await f.pending();
  assert.ok("success" in await f.service.decide(request.id, "APPROVED")); assert.equal(f.asset.status, "UNDER_REPAIR"); assert.equal(f.asset.lastVerifiedAt, null);
});

test("obsolete person fields do not change a new college-only request", async () => {
  const f = fixture(); const form = f.form(); form.set("includePerson", "on"); form.set("personName", "Old form name"); form.set("personPosition", "Staff");
  assert.ok("success" in await f.service.create(form)); assert.equal(f.requests[0].toPersonId, null);
});

test("invalid form fields and decisions do not create records or change custody", async () => {
  const f = fixture(); const form = f.form(); form.delete("assetId"); form.delete("toUnitId");
  const result = await f.service.create(form); assert.ok("error" in result); assert.ok(result.fieldErrors?.assetId); assert.ok(result.fieldErrors?.toUnitId);
  assert.ok("error" in await f.service.decide("missing", "APPROVED"));
  assert.equal(f.requests.length, 0); assert.equal(f.events.length, 0);
});

test("serialization retries are bounded and leave the request pending if conflicts persist", async () => {
  const f = fixture(); const request = await f.pending(); f.controls.conflicts = 4;
  assert.ok("error" in await f.service.decide(request.id, "APPROVED")); assert.equal(f.requests[0].status, "PENDING"); assert.equal(f.controls.conflicts, 1);
});
