import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { registerDelivery } from "../src/lib/product-registration-service";
import { actualProductDescription, productDescriptionInclude } from "../src/lib/product-description";
import { createReportWorkbook } from "../src/lib/report-workbook";
import { renderDocumentPreview } from "../src/lib/document-preview";
import { lookupProduct } from "../src/lib/product-lookup";

loadEnvConfig(process.cwd());

async function verify() {
  assert.ok(process.env.DATABASE_URL, "A local test database is required.");
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Use a disposable local database only.");
  const schema = `description_test_${randomUUID().replaceAll("-", "")}`;
  const base = new PrismaClient({ datasourceUrl: url.toString() });
  url.searchParams.set("schema", schema);
  const originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url.toString();
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  let created = false;
  let sourceDb: PrismaClient | undefined;
  try {
    await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    created = true;
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe",
    });
    const { getAutofillRecords } = await import("../src/lib/form-autofill-source");
    sourceDb = (await import("../src/lib/db")).prisma;
    const currentSchema = await sourceDb.$queryRaw<{ name: string }[]>`SELECT current_schema() AS name`;
    assert.equal(currentSchema[0]?.name, schema, "Report reads must use the disposable schema.");
    const unit = await db.unit.create({ data: { code: "AMO", name: "Test receiving office" } });
    const destination = await db.unit.create({ data: { code: "SCI", name: "Test science college" } });
    const category = await db.category.create({ data: { code: "TEST", name: "Test equipment" } });
    const admin = await db.user.create({ data: { name: "Test officer", email: "officer@test.invalid", passwordHash: "unused", role: "ADMIN", unitId: unit.id } });
    const session = await db.physicalCountSession.create({ data: { title: "Test count", fiscalYear: 2026 } });

    for (const unitCost of [65000, 1000]) {
      const details = `Receiver circuit with status LED\nTechnical specifications ${unitCost}`;
      const form = new FormData();
      for (const [key, value] of Object.entries({ operationId: randomUUID(), supplierName: "Test vendor", categoryId: category.id, itemDescription: details, quantity: "2", unitCost: String(unitCost) })) form.set(key, value);
      const result = await registerDelivery(db, admin.id, form);
      const assets = await db.asset.findMany({ where: { inspections: { some: { intakeItem: { intakeRecordId: result.recordId } } } }, include: productDescriptionInclude, orderBy: { propertyNo: "asc" } });
      assert.equal(assets.length, 2);
      assert.ok(assets.every(asset => asset.description === details), "New delivery assets must store technical details, never generated delivery prose.");
      // Simulate an existing legacy record inside this disposable schema only.
      const oldDescription = `Delivered under PO #${result.poNumber}, DR #${result.deliveryReceiptNo} by Test vendor`;
      await db.asset.update({ where: { id: assets[0].id }, data: { description: oldDescription } });
      const legacy = await db.asset.findUniqueOrThrow({ where: { id: assets[0].id }, include: productDescriptionInclude });
      assert.equal(actualProductDescription(legacy), details);
      const lookup = await lookupProduct(db, admin.id, legacy.propertyNo);
      assert.ok(lookup.asset);
      assert.equal(lookup.asset.description, details);
      assert.ok(!("inspections" in lookup.asset), "Lookup must not expose delivery provenance metadata.");
      for (const asset of assets) {
        await db.transferRequest.create({ data: { assetId: asset.id, fromUnitId: unit.id, toUnitId: destination.id, requestedById: admin.id, status: "APPROVED" } });
        await db.returnRequest.create({ data: { assetId: asset.id, returnedBy: "Test receiver", reason: "Recorded return reason" } });
        await db.physicalCountEntry.create({ data: { assetId: asset.id, sessionId: session.id, countedById: admin.id } });
      }
      const templates = unitCost >= 50000 ? ["par", "ptr", "rpcppe", "return"] : ["ics", "itr", "rpcsp", "return"];
      const classification = unitCost >= 50000 ? "PPE" : "SEMI_EXPENDABLE";
      for (const templateId of templates) {
        const records = await getAutofillRecords(templateId, { categoryId: category.id, classification }, true);
        assert.equal(records.flatMap(record => record.rows).length, 2);
        assert.ok(records.every(record => record.rows.every(row => row.description === details)));
        const output = await createReportWorkbook([{ templateId, records }]);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(new Uint8Array(output.data).buffer);
        let descriptions = 0;
        for (const sheet of workbook.worksheets) sheet.eachRow(row => row.eachCell(cell => {
          if (cell.type === ExcelJS.ValueType.Merge) return;
          assert.ok(!cell.text.includes(oldDescription), "Generated delivery prose must not enter the workbook.");
          if (cell.text === details) descriptions++;
        }));
        assert.ok(descriptions >= 2, `${templateId} must contain both technical descriptions.`);
        const preview = await renderDocumentPreview(output.data, output.filename);
        assert.ok(preview.html.includes(`Technical specifications ${unitCost}`));
        assert.ok(!preview.html.includes(oldDescription));
      }
      assert.equal((await db.asset.findUniqueOrThrow({ where: { id: legacy.id } })).description, oldDescription, "Reading reports must leave original records untouched.");
      assert.equal((await db.intakeRecord.findUniqueOrThrow({ where: { id: result.recordId } })).supplierName, "Test vendor");
    }
    console.log("PASS new and legacy delivery descriptions across both classifications, 8 form exports/previews, scoped lookup, and unchanged source records.");
  } finally {
    await sourceDb?.$disconnect();
    await db.$disconnect();
    process.env.DATABASE_URL = originalUrl;
    if (created) await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await base.$disconnect();
  }
}

verify().catch(error => { console.error(error); process.exitCode = 1; });
