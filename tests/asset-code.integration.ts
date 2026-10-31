import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { registerProduct, registerDelivery } from "../src/lib/product-registration-service";
import { allocateProductCodes } from "../src/lib/asset-code";
import { lookupProduct } from "../src/lib/product-lookup";

loadEnvConfig(process.cwd());

async function verify() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Integration checks require a disposable local database.");
  const schema = `product_test_${Date.now()}`;
  const base = new PrismaClient();
  url.searchParams.set("schema", schema);
  url.searchParams.set("connection_limit", "10");
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  let created = false;
  try {
    await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" });
    const amo = await db.unit.create({ data: { code: "AMO", name: "Asset Office" } });
    const college = await db.unit.create({ data: { code: "SCI", name: "Science" } });
    const category = await db.category.create({ data: { code: "EQ", name: "Equipment" } });
    const admin = await db.user.create({ data: { name: "Test Admin", email: "admin@test.invalid", passwordHash: "unused", role: "ADMIN", unitId: amo.id } });
    const custodian = await db.user.create({ data: { name: "Custodian", email: "custodian@test.invalid", passwordHash: "unused", role: "CUSTODIAN", unitId: college.id } });
    function form(values: Record<string, string> = {}) {
      const result = new FormData();
      for (const [key, value] of Object.entries({ operationId: randomUUID(), name: "Projector", categoryId: category.id, unitId: college.id, acquisitionCost: "55000", acquisitionDate: "2026-10-31", ...values })) result.set(key, value);
      return result;
    }
    const firstForm = form();
    const first = await registerProduct(db, admin.id, firstForm);
    assert.equal(first.productCode, "BULSU-AMO-000001");
    assert.equal(first.qrCodeData, first.productCode);
    assert.deepEqual(await registerProduct(db, admin.id, firstForm), first);
    assert.equal(await db.asset.count(), 1);
    assert.equal(await db.auditLog.count({ where: { entityId: first.assetId } }), 1);
    firstForm.set("name", "Changed request");
    await assert.rejects(registerProduct(db, admin.id, firstForm));
    console.log("PASS automatic code, durable replay and changed-payload rejection");

    const peers = [db, new PrismaClient({ datasourceUrl: url.toString() })];
    let concurrent;
    try { concurrent = await Promise.all(Array.from({ length: 50 }, (_, index) => registerProduct(peers[index % 2], admin.id, form()))); }
    finally { await peers[1].$disconnect(); }
    assert.equal(new Set(concurrent.map(item => item.productCode)).size, 50);
    console.log("PASS 50 concurrent registrations through independent database clients");

    let rolledBackCode = "";
    await assert.rejects(db.$transaction(async tx => {
      [rolledBackCode] = await allocateProductCodes(tx);
      await tx.asset.create({ data: { propertyNo: rolledBackCode, name: "Rollback", categoryId: category.id, unitId: amo.id, acquisitionDate: new Date(), acquisitionCost: 1 } });
      throw new Error("Injected rollback");
    }));
    assert.equal(await db.asset.count({ where: { propertyNo: rolledBackCode } }), 0);
    assert.notEqual((await registerProduct(db, admin.id, form())).productCode, rolledBackCode);
    console.log("PASS rollback leaves no asset and does not reuse allocated codes");

    const beforeFailure = { assets: await db.asset.count(), inspections: await db.inspection.count(), receipts: await db.intakeRecord.count(), audits: await db.auditLog.count() };
    await db.$executeRawUnsafe(`CREATE FUNCTION reject_test_intake() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."action" = 'PROCUREMENT_INTAKE' AND NEW."afterState"->>'supplierName' = 'FAIL-SUPPLIER' THEN RAISE EXCEPTION 'Injected intake failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER reject_test_intake BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION reject_test_intake()`);
    await assert.rejects(registerDelivery(db, admin.id, form({ supplierName: "FAIL-SUPPLIER", itemDescription: "Failed batch", quantity: "300", unitCost: "100" })));
    assert.deepEqual({ assets: await db.asset.count(), inspections: await db.inspection.count(), receipts: await db.intakeRecord.count(), audits: await db.auditLog.count() }, beforeFailure);
    await db.$executeRawUnsafe('DROP TRIGGER reject_test_intake ON "AuditLog"');
    await db.$executeRawUnsafe('DROP FUNCTION reject_test_intake()');
    console.log("PASS failure after all delivery writes rolls back assets, inspections, receipt and audit together");

    for (const quantity of [1, 6, 12, 100, 1000, 10000]) {
      const delivery = form({ supplierName: "Supplier", itemDescription: "Chair", quantity: String(quantity), unitCost: "100" });
      const started = performance.now();
      const result = await registerDelivery(db, admin.id, delivery);
      assert.equal(result.count, quantity);
      assert.match(result.poNumber, /^BULSU-AMO-PO-[0-9]{6,}$/);
      assert.match(result.deliveryReceiptNo, /^BULSU-AMO-DR-[0-9]{6,}$/);
      const inspections = await db.inspection.findMany({ where: { intakeItem: { intakeRecordId: result.recordId } }, select: { assetId: true } });
      assert.equal(inspections.length, quantity);
      const ids = inspections.flatMap(item => item.assetId ? [item.assetId] : []);
      assert.equal(await db.asset.count({ where: { id: { in: ids } } }), quantity);
      assert.equal(await db.auditLog.count({ where: { action: "REGISTER_ASSET", entityId: { in: ids } } }), quantity);
      assert.deepEqual(await registerDelivery(db, admin.id, delivery), result);
      console.log(`PASS ${quantity}-item atomic delivery, inspections, audit and replay (${Math.round(performance.now() - started)}ms)`);
    }

    const concurrentDeliveries = await Promise.all(Array.from({ length: 12 }, () => registerDelivery(db, admin.id, form({ supplierName: "Parallel", itemDescription: "Desk", quantity: "1", unitCost: "100" }))));
    assert.equal(new Set(concurrentDeliveries.map(row => row.poNumber)).size, 12);
    assert.equal(new Set(concurrentDeliveries.map(row => row.deliveryReceiptNo)).size, 12);
    await assert.rejects(registerDelivery(db, admin.id, form({ poNumber: "MANUAL-PO" })));
    await assert.rejects(registerDelivery(db, admin.id, form({ deliveryReceiptNo: "MANUAL-DR" })));
    console.log("PASS automatic PO/DR references are unique under concurrency and reject manual overrides");

    const before = await db.asset.count();
    await assert.rejects(registerProduct(db, custodian.id, form()));
    await assert.rejects(registerDelivery(db, admin.id, form({ quantity: "2abc" })));
    await assert.rejects(registerProduct(db, admin.id, form({ propertyNo: "MANUAL" })));
    assert.equal(await db.asset.count(), before);
    assert.ok("asset" in await lookupProduct(db, custodian.id, first.productCode));
    await db.asset.update({ where: { id: first.assetId }, data: { unitId: amo.id } });
    assert.equal((await lookupProduct(db, custodian.id, first.productCode)).error, "Item not found or unavailable.");
    await db.asset.update({ where: { id: first.assetId }, data: { isDeleted: true } });
    assert.equal((await lookupProduct(db, admin.id, first.productCode)).error, "Item not found or unavailable.");
    await db.user.update({ where: { id: custodian.id }, data: { isActive: false } });
    await assert.rejects(lookupProduct(db, custodian.id, first.productCode));
    console.log("PASS invalid/unauthorized writes and scoped/deleted lookup");

    // Exercise migration initialization with existing, deleted and nonstandard identifiers.
    await db.$executeRawUnsafe('DROP SEQUENCE "ProductCodeSequence"');
    for (const code of ["BULSU-AMO-900000", "BULSU-2024-PPE-0104", "LEGACY-XYZ"]) {
      await db.asset.create({ data: { propertyNo: code, name: "Legacy", categoryId: category.id, unitId: amo.id, acquisitionCost: 1, acquisitionDate: new Date(), isDeleted: code === "BULSU-AMO-900000" } });
    }
    const migration = readFileSync("prisma/migrations/20261031000000_automatic_product_codes/migration.sql", "utf8");
    for (const statement of migration.split(";").filter(value => value.trim())) await db.$executeRawUnsafe(statement);
    assert.equal((await registerProduct(db, admin.id, form())).productCode, "BULSU-AMO-900001");
    assert.ok("asset" in await lookupProduct(db, admin.id, " BULSU-2024-PPE-0104 "));
    assert.ok("asset" in await lookupProduct(db, admin.id, "LEGACY-XYZ"));
    console.log("PASS migration reserves deleted codes and preserves legacy lookup");
  } finally {
    await db.$disconnect();
    if (created) await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await base.$disconnect();
  }
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
