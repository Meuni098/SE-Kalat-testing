import assert from "node:assert/strict";
import test from "node:test";
import { formatProductCode } from "../src/lib/asset-code";
import { readNumber, readAcquisitionDate, registrationOperation } from "../src/lib/product-registration-validation";

test("codes start at BULSU-AMO-000001 and expand without wrapping", () => {
  assert.equal(formatProductCode(BigInt(1)), "BULSU-AMO-000001");
  assert.equal(formatProductCode(BigInt(1000000)), "BULSU-AMO-1000000");
  assert.equal(formatProductCode(BigInt("9007199254740993")), "BULSU-AMO-9007199254740993");
  assert.throws(() => formatProductCode(BigInt(0)));
});

test("quantity validation rejects partial, fractional, empty and excessive inputs", () => {
  for (const value of ["2abc", "1.2", "", "0", "10001", "Infinity", "-1"]) {
    const form = new FormData(); form.set("quantity", value);
    assert.throws(() => readNumber(form, "quantity", "quantity", 10000, true));
  }
  const form = new FormData(); form.set("quantity", "10000");
  assert.equal(readNumber(form, "quantity", "quantity", 10000, true), 10000);
});

test("dates and manual identifier overrides are rejected", () => {
  const form = new FormData(); form.set("acquisitionDate", "2026-02-30");
  assert.throws(() => readAcquisitionDate(form));
  form.set("operationId", "11111111-1111-4111-8111-111111111111");
  assert.equal(registrationOperation(form), form.get("operationId"));
  form.set("propertyNo", "MANUAL-01"); assert.throws(() => registrationOperation(form));
  form.delete("propertyNo"); form.set("productCode", "MANUAL-01"); assert.throws(() => registrationOperation(form));
});
