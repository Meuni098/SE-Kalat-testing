import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { TransferService } from "../src/lib/transfer-service";

loadEnvConfig(process.cwd());
async function verify() {
  assert.ok(process.env.DATABASE_URL, "A local DATABASE_URL is required.");
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Integration checks must use a local database.");
  const schema = `transfer_test_${Date.now()}`;
  const base = new PrismaClient();
  url.searchParams.set("schema", schema);
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  let created = false;
  let checks = 0;
  const passed = (name: string) => { checks++; console.log(`PASS ${name}`); };
  try {
    await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" });
    const origin = await db.unit.create({ data: { code: "AMO", name: "AMO Storage", unitType: "ADMINISTRATIVE" } });
    const college = await db.unit.create({ data: { code: "SCI", name: "College of Science" } });
    const other = await db.unit.create({ data: { code: "COE", name: "College of Engineering" } });
    const category = await db.category.create({ data: { code: "EQ", name: "Equipment" } });
    const account = (name: string, role: string, unitId: string | null = null) => db.user.create({ data: { name, email: `${name}@test.invalid`, role, unitId, passwordHash: "not-a-login" } });
    const staff = await account("Staff", "STAFF");
    const custodian = await account("Custodian", "CUSTODIAN", college.id);
    const auditor = await account("Auditor", "AUDITOR");
    const service = new TransferService(db, staff.id);
    const createAsset = (status = "IN_STORAGE") => db.asset.create({ data: { propertyNo: `TEST-${randomUUID()}`, name: "Test equipment", categoryId: category.id, unitId: origin.id, acquisitionDate: new Date(), acquisitionCost: 100, status } });
    const form = (assetId: string, toUnitId = college.id) => { const data = new FormData(); for (const [key, value] of Object.entries({ assetId, toUnitId, operationId: randomUUID() })) data.set(key, value); return data; };
    const first = await createAsset(); const input = form(first.id);
    const [a, b] = await Promise.all([service.create(input), service.create(input)]);
    assert.ok("success" in a && "success" in b); assert.equal(a.transferId, b.transferId);
    assert.equal(await db.transferRequest.count(), 1); assert.equal(await db.person.count(), 0);
    assert.equal((await db.asset.findUniqueOrThrow({ where: { id: first.id } })).unitId, origin.id);
    passed("college-only creation and concurrent exact retry create one pending request with no personnel writes");
    const raceAsset = await createAsset();
    const competing = await Promise.all([service.create(form(raceAsset.id)), service.create(form(raceAsset.id, other.id))]);
    assert.equal(competing.filter(result => "success" in result).length, 1);
    assert.equal(await db.transferRequest.count({ where: { assetId: raceAsset.id, status: "PENDING" } }), 1);
    passed("competing destinations create exactly one pending request");
    const decisions = await Promise.all([service.decide(a.transferId, "APPROVED"), service.decide(a.transferId, "APPROVED")]);
    assert.ok(decisions.every(result => "success" in result));
    const deployed = await db.asset.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(deployed.unitId, college.id); assert.equal(deployed.status, "IN_USE"); assert.equal(deployed.accountablePersonId, null); assert.equal(deployed.lastVerifiedAt, null);
    assert.equal(await db.auditLog.count({ where: { action: "APPROVE_TRANSFER", entityId: a.transferId } }), 1);
    passed("simultaneous approvals move inventory once and write one approval event");
    const invalidDecision = await service.decide(a.transferId, "REJECTED"); assert.ok("error" in invalidDecision);
    const reverse = await service.create(form(first.id, origin.id)); assert.ok("success" in reverse);
    await service.decide(reverse.transferId, "APPROVED");
    assert.equal((await db.asset.findUniqueOrThrow({ where: { id: first.id } })).status, "IN_STORAGE");
    passed("opposite decisions are blocked and AMO return restores storage status");
    const staleAsset = await createAsset(); const stale = await service.create(form(staleAsset.id)); assert.ok("success" in stale);
    await db.asset.update({ where: { id: staleAsset.id }, data: { unitId: other.id } });
    assert.ok("error" in await service.decide(stale.transferId, "APPROVED"));
    assert.equal((await db.transferRequest.findUniqueOrThrow({ where: { id: stale.transferId } })).status, "PENDING");
    assert.ok("success" in await service.decide(stale.transferId, "REJECTED"));
    passed("stale custody cannot be approved but can be rejected safely");
    const retAsset = await createAsset("IN_USE");
    await db.returnRequest.create({ data: { assetId: retAsset.id, returnedBy: "Test", reason: "Testing" } });
    assert.ok("error" in await service.create(form(retAsset.id)));
    for (const status of ["FOR_DISPOSAL", "DISPOSED", "MISSING"]) {
      const asset = await createAsset(status); assert.ok("error" in await service.create(form(asset.id)));
    }
    passed("pending returns and unavailable asset states are blocked");
    assert.ok("error" in await new TransferService(db, auditor.id).create(form(first.id)));
    assert.ok("error" in await new TransferService(db, custodian.id).create(form(first.id)));
    await db.user.update({ where: { id: staff.id }, data: { isActive: false } });
    assert.ok("error" in await service.create(form(first.id)));
    await db.user.update({ where: { id: staff.id }, data: { isActive: true } });
    passed("persisted role, own-college and active-account authorization are enforced");
    const rollbackAsset = await createAsset(); const rollbackRequest = await service.create(form(rollbackAsset.id)); assert.ok("success" in rollbackRequest);
    await db.$executeRawUnsafe(`CREATE FUNCTION "${schema}".reject_transfer_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'APPROVE_TRANSFER' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER reject_transfer_audit BEFORE INSERT ON "${schema}"."AuditLog" FOR EACH ROW EXECUTE FUNCTION "${schema}".reject_transfer_audit()`);
    assert.ok("error" in await service.decide(rollbackRequest.transferId, "APPROVED"));
    assert.equal((await db.asset.findUniqueOrThrow({ where: { id: rollbackAsset.id } })).unitId, origin.id);
    assert.equal((await db.transferRequest.findUniqueOrThrow({ where: { id: rollbackRequest.transferId } })).status, "PENDING");
    assert.equal(await db.auditLog.count({ where: { action: "APPROVE_TRANSFER", entityId: rollbackRequest.transferId } }), 0);
    passed("audit failure rolls back asset, request and event atomically");
    console.log(`${checks} integration checks passed in an isolated schema.`);
  } finally {
    await db.$disconnect();
    // Only this run's generated test schema may be removed.
    if (created) await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await base.$disconnect();
  }
}
verify().catch(error => { console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Transfer integration check failed"); process.exitCode = 1; });
