import assert from "node:assert/strict";
import test from "node:test";
import { actualProductDescription } from "../src/lib/product-description";

const intakeRecord = { poNumber: "PO-001", deliveryReceiptNo: "DR-001", supplierName: "Test Supplier" };
const generated = "Delivered under PO #PO-001, DR #DR-001 by Test Supplier";
const technicalDetails = "Laboratory microscope\nLED illumination, 40×–1000× magnification";
const inspection = (description = technicalDetails, record = intakeRecord) => ({ intakeItem: { description, intakeRecord: record } });

test("recovers technical product details only from exactly matching linked delivery provenance", () => {
  assert.equal(actualProductDescription({ description: generated, inspections: [inspection()] }), technicalDetails);
});

test("preserves genuine text including delivery words, dates, Unicode and line breaks", () => {
  for (const description of ["Receiver unit, 2026 model – 32 GB", `${generated}\nUser-entered qualification`, ` ${generated}`, `${generated}.`, "Delivered under PO #OTHER, DR #DR-001 by Test Supplier"]) {
    assert.equal(actualProductDescription({ description, inspections: [inspection()] }), description);
  }
});

test("preserves absent and blank recorded descriptions without substituting a product name", () => {
  for (const description of [null, undefined, "", "  "]) {
    assert.equal(actualProductDescription({ description, inspections: [inspection()] }), description);
  }
});

test("leaves unproven generated-looking descriptions untouched", () => {
  assert.equal(actualProductDescription({ description: generated }), generated);
  assert.equal(actualProductDescription({ description: generated, inspections: [{ intakeItem: null }] }), generated);
  assert.equal(actualProductDescription({ description: generated, inspections: [inspection(technicalDetails, { ...intakeRecord, supplierName: "Other Supplier" })] }), generated);
});

test("accepts repeated consistent sources and ignores nonmatching delivery records", () => {
  assert.equal(actualProductDescription({ description: generated, inspections: [inspection(), inspection(), inspection("Different details", { ...intakeRecord, poNumber: "PO-OTHER" })] }), technicalDetails);
});

test("does not guess between conflicting matching product descriptions", () => {
  assert.equal(actualProductDescription({ description: generated, inspections: [inspection(), inspection("Conflicting technical details")] }), generated);
});

test("does not replace a description with unavailable linked technical details", () => {
  for (const description of ["", "  ", "\n"]) {
    assert.equal(actualProductDescription({ description: generated, inspections: [inspection(description)] }), generated);
    assert.equal(actualProductDescription({ description: generated, inspections: [inspection(), inspection(description)] }), generated);
  }
});
