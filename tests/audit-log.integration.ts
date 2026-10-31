import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { auditedTransaction } from "../src/lib/audited-transaction";
import { randomUUID } from "node:crypto";
import { AuditLogService } from "../src/lib/audit-log-service";
import { writeAuditEvent } from "../src/lib/audit-log-write";
import { AuditError } from "../src/lib/audit-log-validation";
loadEnvConfig(process.cwd());

async function verify() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Use a disposable local database");
  const schema = `audit_test_${Date.now()}`;
  const base = new PrismaClient(); url.searchParams.set("schema", schema);
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  let created = false;
  try {
    await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" });
    const unit = await db.unit.create({ data: { code: "TEST", name: "Test College" } });
    const category = await db.category.create({ data: { code: "TEST", name: "Equipment" } });
    const account = (name: string, role: string) => db.user.create({ data: { name, role, email: `${name}@test.invalid`, passwordHash: "not-a-login", unitId: unit.id } });
    const admin = await account("Admin", "ADMIN"), staff = await account("Staff", "STAFF"), other = await account("Other", "STAFF"), custodian = await account("Custodian", "CUSTODIAN"), auditor = await account("Auditor", "AUDITOR");
    const svc = (id: string) => new AuditLogService(db, id);
    const asset = await db.$transaction(async tx => {
      const asset = await tx.asset.create({ data: { propertyNo: "AUDIT-001", name: "Laptop", categoryId: category.id, unitId: unit.id, acquisitionDate: new Date(), acquisitionCost: 100 } });
      await writeAuditEvent(tx, { data: { actorId: staff.id, action: "REGISTER_ASSET", entityType: "ASSET", entityId: asset.id, afterState: { name: asset.name, passwordHash: "secret" } } });
      return asset;
    });
    const createdEvent = await db.auditLog.findFirstOrThrow({ where: { entityId: asset.id } });
    assert.equal(createdEvent.actorNameSnapshot, "Staff");
    assert.deepEqual(createdEvent.afterState, { name: "Laptop" });
    await db.user.update({ where: { id: staff.id }, data: { name: "Renamed Staff", role: "CUSTODIAN" } });
    assert.equal((await svc(staff.id).list({}, true)).items[0].actorName, "Staff");
    assert.equal((await svc(other.id).list({}, true)).items.length, 0);
    await assert.rejects(svc(other.id).detail(createdEvent.id, true), e => e instanceof AuditError && e.code === "NOT_FOUND");
    await assert.rejects(svc(other.id).list(), e => e instanceof AuditError && e.code === "FORBIDDEN");
    await assert.rejects(svc(staff.id).list({ actorId: other.id }, true));
    assert.equal((await svc(auditor.id).list()).items.length, 1);
    console.log("PASS account snapshots, role access, self-only list and detail isolation");
    await db.$transaction(async tx => {
      await tx.asset.update({ where: { id: asset.id }, data: { condition: "FAIR" } });
      await writeAuditEvent(tx, { data: { actorId: other.id, action: "UPDATE_STATUS", eventKind: "UPDATE", entityType: "ASSET", entityId: asset.id, beforeState: { condition: "GOOD" }, afterState: { condition: "FAIR" } } });
    });
    const attribution = await svc(admin.id).attribution("ASSET", asset.id);
    assert.equal(attribution.originallyLoggedBy?.name, "Staff"); assert.equal(attribution.lastUpdatedBy?.name, "Other");
    console.log("PASS original creator stays fixed and latest editor is separate");
    await assert.rejects(db.$transaction(async tx => {
      await tx.asset.update({ where: { id: asset.id }, data: { name: "Must roll back" } });
      await writeAuditEvent(tx, { data: { actorId: "missing-account", action: "UPDATE_STATUS", entityType: "ASSET", entityId: asset.id } });
    }));
    assert.equal((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).name, "Laptop");
    await assert.rejects(db.auditLog.delete({ where: { id: createdEvent.id } }));
    await assert.rejects(db.auditLog.update({ where: { id: createdEvent.id }, data: { action: "TAMPER" } }));
    console.log("PASS business rollback on capture failure and database append-only enforcement");
    await db.user.update({ where: { id: staff.id }, data: { unitId: null } });
    const restricted = await svc(staff.id).detail(createdEvent.id, true);
    assert.equal(restricted.payloadVisible, false); assert.equal(restricted.afterState, null); assert.ok(!("ipAddress" in restricted));
    assert.equal((await svc(staff.id).list({}, true)).items.length, 1);
    console.log("PASS permission loss retains own safe summary while withholding payload and IP");
    const stamp = new Date("2026-10-31T01:00:00Z");
    for (let i = 0; i < 28; i++) await writeAuditEvent(db, { data: { actorId: other.id, action: "TEST_EVENT", entityType: "ASSET", entityId: asset.id, createdAt: stamp, eventKind: "EVENT" } });
    const first = await svc(other.id).list({ action: "TEST_EVENT" }, true);
    assert.equal(first.items.length, 25); assert.ok(first.nextCursor);
    const second = await svc(other.id).list({ action: "TEST_EVENT", cursor: first.nextCursor! }, true);
    assert.equal(second.items.length, 3); assert.equal(new Set([...first.items, ...second.items].map(i => i.id)).size, 28);
    await assert.rejects(svc(staff.id).list({ action: "TEST_EVENT", cursor: first.nextCursor! }, true));
    console.log("PASS stable timestamp-tie pagination and account-bound cursors");
    const transfer = await db.transferRequest.create({ data: { assetId: asset.id, fromUnitId: unit.id, toUnitId: unit.id, requestedById: other.id } });
    await db.auditLog.create({ data: { actorId: other.id, action: "REQUEST_TRANSFER", entityType: "TRANSFER", entityId: transfer.id } });
    assert.ok((await svc(admin.id).list({ assetId: asset.id, action: "REQUEST_TRANSFER" })).items.length);
    const legacy = await db.auditLog.create({ data: { action: "LEGACY", entityType: "ASSET", entityId: asset.id, afterState: { passwordHash: "secret", status: "IN_USE" } } });
    const legacyDetail = await svc(admin.id).detail(legacy.id);
    assert.equal(legacyDetail.actorName, "Actor not recorded"); assert.deepEqual(legacyDetail.afterState, { status: "IN_USE" });
    console.log("PASS related legacy transaction lookup and truthful, redacted legacy display");
    await db.user.update({ where: { id: auditor.id }, data: { role: "CUSTODIAN" } });
    await assert.rejects(svc(auditor.id).list());
    await db.user.update({ where: { id: custodian.id }, data: { isActive: false } });
    await assert.rejects(svc(custodian.id).list({}, true));
    console.log("PASS current role revocation and deactivation apply immediately");
    assert.equal(await svc(other.id).canViewRecord("USER", admin.id), false);
    const retryOperation = { roles: ["STAFF"], id: randomUUID(), values: { action: "register", name: "Retry-safe" } };
    let calls = 0;
    const save = () => auditedTransaction(db, other.id, retryOperation, async tx => {
      calls++;
      const asset = await tx.asset.create({ data: { propertyNo: "RETRY-001", name: "Retry-safe", categoryId: category.id, unitId: unit.id, acquisitionDate: new Date(), acquisitionCost: 1 } });
      await writeAuditEvent(tx, { data: { actorId: other.id, action: "REGISTER_ASSET", entityType: "ASSET", entityId: asset.id, afterState: { name: asset.name } } });
      return { success: true, assetId: asset.id };
    });
    const saved = await save(); const replayed = await save();
    assert.deepEqual(replayed, saved); assert.equal(calls, 1);
    assert.equal(await db.auditLog.count({ where: { operationId: retryOperation.id } }), 1);
    await assert.rejects(auditedTransaction(db, other.id, { ...retryOperation, values: { name: "Different" } }, async () => ({ success: true })));
    await db.user.update({ where: { id: other.id }, data: { role: "CUSTODIAN" } });
    await assert.rejects(save(), e => e instanceof AuditError && e.code === "FORBIDDEN");
    await db.user.update({ where: { id: other.id }, data: { role: "STAFF" } });
    console.log("PASS lost-response replay returns the original result without duplicates and rechecks current roles");
    if (process.env.AUDIT_PERF === "1") {
      for (let batch = 0; batch < 10; batch++) {
        await db.auditLog.createMany({ data: Array.from({ length: 10000 }, (_, i) => ({ actorId: other.id, actorNameSnapshot: "Other", actorRoleSnapshot: "STAFF", action: "PERF_EVENT", entityType: "ASSET", entityId: asset.id, createdAt: new Date(Date.UTC(2026, 0, 1) + batch * 10000 + i) })) });
      }
      const samples: number[] = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        const page = await svc(other.id).list({ action: "PERF_EVENT", limit: 25 }, true);
        samples.push(performance.now() - start); assert.equal(page.items.length, 25);
      }
      samples.sort((a, b) => a - b);
      const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
      assert.ok(p95 < 1000, `p95 ${p95}ms exceeds 1s target`);
      console.log(`PASS 100,000-event personal-history p95: ${p95.toFixed(1)}ms (20 local samples)`);
    }
    console.log("Audit database verification passed.");
  } finally {
    await db.$disconnect();
    if (created) await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await base.$disconnect();
  }
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
