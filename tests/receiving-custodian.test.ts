import test from "node:test";
import assert from "node:assert/strict";
import { validateDesignation, validateDirectory } from "../src/lib/receiving-custodian-validation";
import { canManageReceivingCustodians, canReadReceivingUnit } from "../src/lib/rbac";

const valid = { unitId: "11111111-1111-4111-8111-111111111111", expectedRevision: 0, reason: "Initial appointment", mode: "NEW" as const, person: { employeeNo: "EMP-01", fullName: "María O'Connor", position: "Office Assistant", email: "" } };
test("valid registration accepts accented names and an optional blank email", () => assert.deepEqual(validateDesignation(valid), {}));
test("rejects malformed payloads, negative revisions, control characters, and bad email", () => {
  assert.ok(validateDesignation({ ...valid, expectedRevision: -1 }).expectedRevision);
  assert.ok(validateDesignation({ ...valid, person: { ...valid.person, email: "broken" } }).email);
  assert.ok(validateDesignation({ ...valid, person: { ...valid.person, employeeNo: "a\u0000b" } }).employeeNo);
  assert.ok(validateDesignation({ ...valid, reason: "x" }).reason);
  assert.ok(validateDesignation({ ...valid, unitId: "bad" }).unitId);
});
test("removal requires a reason/revision but no person", () => assert.deepEqual(validateDesignation({ unitId: valid.unitId, expectedRevision: 2, reason: "Staff rotation" }, true), {}));
test("reasons accept ordinary multiline notes", () => assert.deepEqual(validateDesignation({ ...valid, reason: "Initial designation\nRequested by the office" }), {}));
test("filters reject excessive queries, malformed pages and unknown enums", () => {
  assert.equal(validateDirectory({ query: "a".repeat(101) }), false);
  assert.equal(validateDirectory({ page: 0 }), false);
  assert.equal(validateDirectory({ page: NaN }), false);
  assert.equal(validateDirectory({ unitType: "UNKNOWN" }), false);
  assert.equal(validateDirectory({ campus: "UNKNOWN" }), false);
  assert.equal(validateDirectory({ page: 1, includeInactive: true }), true);
});
test("only AMO ADMIN/STAFF manage; scoped custodians cannot read other units", () => {
  for (const role of ["ADMIN", "STAFF"]) assert.equal(canManageReceivingCustodians(role), true);
  for (const role of ["CUSTODIAN", "AUDITOR", "UNKNOWN"]) assert.equal(canManageReceivingCustodians(role), false);
  assert.equal(canReadReceivingUnit("CUSTODIAN", "own", "own"), true);
  assert.equal(canReadReceivingUnit("CUSTODIAN", "own", "other"), false);
  assert.equal(canReadReceivingUnit("CUSTODIAN", null, "other"), false);
  assert.equal(canReadReceivingUnit("AUDITOR", null, "other"), true);
  assert.equal(canReadReceivingUnit("UNKNOWN", "own", "own"), false);
});

test("direct entry needs no employee number, email or reason", () => {
  assert.deepEqual(validateDesignation({ unitId: valid.unitId, expectedRevision: 0, reason: "", mode: "NEW", person: { fullName: "Maria Santos", position: "Professor" } }), {});
});
