import test from "node:test";
import assert from "node:assert/strict";
import { validateAuditQuery, auditDateRange, safeAuditState, cursorScope, encodeAuditCursor, decodeAuditCursor } from "../src/lib/audit-log-validation";

test("personal history rejects another actor and unknown filters", () => {
  assert.throws(() => validateAuditQuery({ actorId: "other" }, true));
  assert.throws(() => validateAuditQuery({ fromDate: "2026-02-30" }));
  assert.throws(() => validateAuditQuery({ fromDate: "2026-10-31", toDate: "2026-10-01" }));
});
test("Manila dates include the full final day", () => {
  const range = auditDateRange({ fromDate: "2026-10-31", toDate: "2026-10-31" });
  assert.equal(range.gte?.toISOString(), "2026-10-30T16:00:00.000Z");
  assert.equal(range.lt?.toISOString(), "2026-10-31T16:00:00.000Z");
});
test("cursors cannot be replayed for another account, scope or filters", () => {
  const q = validateAuditQuery({ action: "REQUEST_TRANSFER" });
  const scope = cursorScope(q, "account-a", true);
  const cursor = encodeAuditCursor("event", scope);
  assert.equal(decodeAuditCursor(cursor, scope), "event");
  for (const other of [cursorScope(q, "account-b", true), cursorScope(q, "account-a", false), cursorScope({ ...q, action: "OTHER" }, "account-a", true)]) assert.throws(() => decodeAuditCursor(cursor, other));
});
test("new and historical payloads remove secrets recursively", () => {
  assert.deepEqual(safeAuditState({ status: "IN_USE", passwordHash: "secret", person: { fullName: "Receiver", email: "private", token: "secret" }, cookies: "secret" }), { status: "IN_USE", person: { fullName: "Receiver" } });
});
