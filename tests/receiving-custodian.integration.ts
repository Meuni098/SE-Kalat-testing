import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ReceivingCustodianService, ReceivingError } from "../src/lib/receiving-custodian-service";

// A unique schema prevents these verification writes from touching application records.
async function verify() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const schema = `receiving_test_${Date.now()}`;
  const base = new PrismaClient();
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("schema", schema);
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  let created = false;
  let checks = 0;
  const passed = (description: string) => { checks++; console.log(`PASS ${description}`); };
  try {
    await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    created = true;
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" });
    const unit = await db.unit.create({ data: { code: "TEST", name: "Test College" } });
    const other = await db.unit.create({ data: { code: "OTHER", name: "Other Office" } });
    const original = await db.person.create({ data: { employeeNo: "TEST-01", fullName: "Original Receiver", position: "Assistant", unitId: unit.id } });
    const next = await db.person.create({ data: { employeeNo: "TEST-02", fullName: "Next Receiver", position: "Assistant", unitId: unit.id } });
    const outside = await db.person.create({ data: { employeeNo: "OUTSIDE", fullName: "Other Employee", position: "Assistant", unitId: other.id } });
    const category = await db.category.create({ data: { code: "TEST-CAT", name: "Test equipment" } });
    const asset = await db.asset.create({ data: { propertyNo: "TEST-ASSET", name: "Existing equipment", categoryId: category.id, acquisitionDate: new Date(), acquisitionCost: 100, unitId: unit.id, accountablePersonId: original.id } });
    async function account(role: string, unitId: string | null = null) {
      return db.user.create({ data: { name: `${role} tester`, role, email: `${role}-${unitId ?? "none"}@test.invalid`, passwordHash: "not-a-real-login", unitId } });
    }
    const admin = await account("ADMIN"), staff = await account("STAFF"), auditor = await account("AUDITOR"), custodian = await account("CUSTODIAN", unit.id), unlinked = await account("CUSTODIAN");
    const service = (id: string) => new ReceivingCustodianService(db, id);
    const amo = service(admin.id);
    async function denied(operation: Promise<unknown>, code: string) {
      await assert.rejects(operation, e => e instanceof ReceivingError && e.code === code);
    }
    const initial = await amo.directory();
    assert.equal(initial.total, 2); assert.ok(initial.items.every(r => r.person === null && r.revision === 0));
    assert.equal((await amo.directory({ query: "%" })).total, 0);
    assert.equal((await amo.candidates(unit.id, "_")).items.length, 0);
    passed("existing units start unassigned");
    const first = await amo.save({ unitId: unit.id, expectedRevision: 0, reason: "Initial designation", mode: "EXISTING", personId: original.id });
    assert.equal(first.row.person?.id, original.id); assert.equal(first.row.revision, 1);
    await denied(amo.save({ unitId: unit.id, expectedRevision: 1, reason: "Duplicate designation", mode: "EXISTING", personId: original.id }), "ALREADY_ASSIGNED");
    passed("assignment and duplicate prevention");
    assert.equal((await service(custodian.id).directory()).total, 1);
    assert.equal((await service(unlinked.id).directory()).total, 0);
    await denied(service(custodian.id).unit(other.id), "FORBIDDEN");
    await denied(service(custodian.id).history(other.id), "FORBIDDEN");
    await denied(service(auditor.id).candidates(unit.id), "FORBIDDEN");
    for (const actor of [auditor, custodian, unlinked]) await denied(service(actor.id).save({ unitId: unit.id, expectedRevision: 1, reason: "Unauthorized attempt", mode: "EXISTING", personId: next.id }), "FORBIDDEN");
    passed("server role checks and exact-unit read scope");
    await denied(amo.save({ unitId: unit.id, expectedRevision: 1, reason: "Invalid unit membership", mode: "EXISTING", personId: outside.id }), "PERSON_UNIT_MISMATCH");
    const replacement = await service(staff.id).save({ unitId: unit.id, expectedRevision: 1, reason: "Staff rotation", mode: "EXISTING", personId: next.id });
    assert.equal(replacement.row.revision, 2);
    await db.person.update({ where: { id: next.id }, data: { fullName: "Updated name" } });
    assert.equal((await amo.history(unit.id)).items[0].afterPerson?.fullName, "Next Receiver");
    await amo.save({ unitId: unit.id, expectedRevision: 2, reason: "Remove designation" }, true);
    assert.equal((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).accountablePersonId, original.id);
    await denied(amo.save({ unitId: unit.id, expectedRevision: 0, reason: "Old empty form", mode: "EXISTING", personId: original.id }), "CONFLICT");
    passed("replacement/removal preserve assets and historical identity; stale empty form rejected");
    const fresh = await amo.save({ unitId: unit.id, expectedRevision: 3, reason: "Register new receiver", mode: "NEW", person: { employeeNo: "NEW-01", fullName: "New Receiver", position: "Coordinator", email: "" } });
    assert.ok(fresh.createdPersonId); assert.equal(await db.user.count(), 5);
    const history = await amo.history(unit.id);
    assert.equal(history.items.length, 4);
    assert.ok(await db.auditLog.findFirst({ where: { action: "CREATE_PERSON", entityId: fresh.createdPersonId! } }));
    passed("new-person registration, designation and audit history without login creation");
    const outcomes = await Promise.allSettled([
      amo.save({ unitId: unit.id, expectedRevision: 4, reason: "Concurrent change A", mode: "EXISTING", personId: original.id }),
      amo.save({ unitId: unit.id, expectedRevision: 4, reason: "Concurrent change B", mode: "NEW", person: { employeeNo: "RACE", fullName: "Race Receiver", position: "Assistant" } }),
    ]);
    assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
    const loser = outcomes.find(r => r.status === "rejected");
    assert.ok(loser?.status === "rejected" && loser.reason instanceof ReceivingError && loser.reason.code === "CONFLICT");
    passed("concurrent managers produce exactly one successful update");
    await db.unit.update({ where: { id: unit.id }, data: { isActive: false } });
    await denied(amo.save({ unitId: unit.id, expectedRevision: 5, reason: "Inactive designation", mode: "EXISTING", personId: original.id }), "UNIT_INACTIVE");
    await amo.save({ unitId: unit.id, expectedRevision: 5, reason: "Inactive cleanup" }, true);
    await db.unit.update({ where: { id: unit.id }, data: { isActive: true } });
    passed("inactive units reject assignment but allow removal");
    await db.user.update({ where: { id: admin.id }, data: { role: "AUDITOR" } });
    await denied(amo.save({ unitId: unit.id, expectedRevision: 6, reason: "Stale role claims", mode: "EXISTING", personId: original.id }), "FORBIDDEN");
    await db.user.update({ where: { id: admin.id }, data: { isActive: false } });
    await denied(amo.directory(), "UNAUTHENTICATED");
    await db.user.update({ where: { id: admin.id }, data: { role: "ADMIN", isActive: true } });
    passed("account role changes and deactivation take effect without new login");
    const assetTwo = await db.asset.create({ data: { propertyNo: "TEST-ASSET-2", name: "Second equipment", categoryId: category.id, acquisitionDate: new Date(), acquisitionCost: 200, unitId: unit.id, accountablePersonId: original.id } });
    const receiptInput = { operationId: randomUUID(), unitId: unit.id, assetId: asset.id, expectedAssetUpdatedAt: asset.updatedAt.toISOString(), remarks: "Item received", receiver: { mode: "EXISTING" as const, personId: next.id } };
    const receiptOne = await amo.recordReceipt(receiptInput);
    const receiptTwo = await amo.recordReceipt({ ...receiptInput, operationId: randomUUID(), assetId: assetTwo.id, expectedAssetUpdatedAt: assetTwo.updatedAt.toISOString(), receiver: { mode: "EXISTING", personId: original.id } });
    assert.notEqual(receiptOne.receipt.receiverEmployeeNo, receiptTwo.receipt.receiverEmployeeNo);
    assert.equal((await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).accountablePersonId, next.id);
    assert.equal((await amo.unit(unit.id)).row.person, null);
    passed("different receivers per item update received-by details and preserve office contact");
    const retries = await Promise.all([amo.recordReceipt(receiptInput), amo.recordReceipt(receiptInput)]);
    assert.ok(retries.every(r => r.replayed && r.receipt.id === receiptOne.receipt.id));
    assert.equal(await db.itemReceipt.count(), 2);
    await denied(amo.recordReceipt({ ...receiptInput, remarks: "Tampered retry" }), "CONFLICT");
    passed("concurrent receipt retries are idempotent and altered retries are rejected");
    receiptInput.expectedAssetUpdatedAt = (await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).updatedAt.toISOString();
    const laterReceipt = await amo.recordReceipt({ ...receiptInput, operationId: randomUUID(), receiver: { mode: "NEW", person: { employeeNo: "RECEIPT-ONLY", fullName: "New Item Receiver", position: "Receiving Assistant" } } });
    assert.equal(laterReceipt.receipt.receiverName, "New Item Receiver");
    assert.equal((await amo.unit(unit.id)).row.person, null);
    await db.person.update({ where: { id: next.id }, data: { fullName: "Changed after receipt" } });
    assert.equal((await amo.receipts({ assetId: asset.id })).items.find(r => r.id === receiptOne.receipt.id)?.receiverName, "Updated name");
    passed("receipt-specific registration and historical identity snapshots");
    await denied(service(auditor.id).recordReceipt({ ...receiptInput, operationId: randomUUID() }), "FORBIDDEN");
    await denied(service(custodian.id).recordReceipt({ ...receiptInput, operationId: randomUUID() }), "FORBIDDEN");
    await denied(service(custodian.id).receipts({ unitId: other.id }), "FORBIDDEN");
    assert.equal((await service(unlinked.id).receipts()).total, 0);
    // Isolate membership validation from the separate stale-version conflict assertion below.
    const currentAssetVersion = (await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).updatedAt.toISOString();
    await denied(amo.recordReceipt({ ...receiptInput, expectedAssetUpdatedAt: currentAssetVersion, operationId: randomUUID(), receiver: { mode: "EXISTING", personId: outside.id } }), "PERSON_UNIT_MISMATCH");
    await db.asset.update({ where: { id: assetTwo.id }, data: { unitId: other.id } });
    await denied(amo.recordReceipt({ ...receiptInput, operationId: randomUUID(), assetId: assetTwo.id, expectedAssetUpdatedAt: assetTwo.updatedAt.toISOString() }), "CONFLICT");
    assert.equal((await service(custodian.id).receipts()).total, 3);
    passed("receipt permissions, exact-unit membership and moved-item conflict checks");
    await db.$executeRawUnsafe(`CREATE FUNCTION "${schema}".reject_designation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."afterState" ->> 'reason' = 'Force audit failure' OR NEW."afterState" ->> 'remarks' = 'Force receipt audit failure' THEN RAISE EXCEPTION 'verification rollback'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER reject_designation_audit BEFORE INSERT ON "${schema}"."AuditLog" FOR EACH ROW EXECUTE FUNCTION "${schema}".reject_designation_audit()`);
    const logsBefore = await db.auditLog.count();
    await assert.rejects(amo.save({ unitId: unit.id, expectedRevision: 6, reason: "Force audit failure", mode: "NEW", person: { employeeNo: "ROLLBACK", fullName: "Rollback Receiver", position: "Assistant" } }));
    assert.equal(await db.person.count({ where: { employeeNo: "ROLLBACK" } }), 0);
    assert.equal((await amo.unit(unit.id)).row.revision, 6);
    assert.equal(await db.auditLog.count(), logsBefore);
    passed("audit failure rolls back new employee, designation, revision and all events");
    receiptInput.expectedAssetUpdatedAt = (await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).updatedAt.toISOString();
    const receiptsBefore = await db.itemReceipt.count();
    await assert.rejects(amo.recordReceipt({ ...receiptInput, operationId: randomUUID(), remarks: "Force receipt audit failure", receiver: { mode: "NEW", person: { employeeNo: "RECEIPT-ROLLBACK", fullName: "Receipt Rollback", position: "Assistant" } } }));
    assert.equal(await db.person.count({ where: { employeeNo: "RECEIPT-ROLLBACK" } }), 0);
    assert.equal(await db.itemReceipt.count(), receiptsBefore);
    assert.equal(await db.auditLog.count(), logsBefore);
    passed("receipt audit failure rolls back receipt and optional new person atomically");
    console.log(`${checks} integration checks passed in an isolated schema.`);
  } finally {
    await db.$disconnect();
    if (created) await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await base.$disconnect();
  }
}
verify().catch(error => { console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Integration verification failed"); process.exitCode = 1; });
