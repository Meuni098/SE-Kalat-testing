import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { readManualPerson, resolveManualPerson } from "../src/lib/manual-person";

const person = { fullName: "María O'Connor", position: "Office Assistant", employeeNo: "EMP-01" };
function form(values = person) {
  const data = new FormData();
  data.set("personName", values.fullName);
  data.set("personPosition", values.position);
  data.set("personEmployeeNo", values.employeeNo);
  return data;
}
test("manual transaction input trims identity fields and preserves Unicode", () => {
  assert.deepEqual(readManualPerson(form({ ...person, fullName: ` ${person.fullName} ` })), person);
});
test("manual transaction input requires name and position", () => {
  for (const field of ["fullName", "position"] as const) assert.throws(() => readManualPerson(form({ ...person, [field]: " " })));
  assert.throws(() => readManualPerson(form({ ...person, fullName: "a\u0000b" })));
});
function database(existing: object | null, active = true) {
  const writes: string[] = [];
  const tx = {
    $queryRaw: async () => [],
    user: { findUnique: async () => ({ id: "actor", name: "Test Actor", role: "STAFF", isActive: true }) },
    unit: { findUnique: async () => ({ isActive: active }) },
    person: { findUnique: async () => existing, create: async ({ data }: { data: object }) => { writes.push("person"); return { id: "new", ...data }; } },
    auditLog: { create: async () => { writes.push("audit"); } },
  } as unknown as Prisma.TransactionClient;
  return { tx, writes };
}
test("matching typed employee identity reuses the record without writes", async () => {
  const existing = { ...person, id: "known", unitId: "unit" };
  const { tx, writes } = database(existing);
  assert.equal((await resolveManualPerson(tx, "unit", person, "actor")).id, "known");
  assert.deepEqual(writes, []);
});
test("conflicting identity or another office is rejected without writes", async () => {
  for (const change of [{ unitId: "other" }, { fullName: "Other Name" }, { position: "Other Position" }]) {
    const { tx, writes } = database({ ...person, id: "known", unitId: "unit", ...change });
    await assert.rejects(resolveManualPerson(tx, "unit", person, "actor"));
    assert.deepEqual(writes, []);
  }
});
test("new transaction person creates a personnel and audit record", async () => {
  const { tx, writes } = database(null);
  assert.equal((await resolveManualPerson(tx, "unit", person, "actor")).id, "new");
  assert.deepEqual(writes, ["person", "audit"]);
});
test("inactive offices reject typed personnel without writes", async () => {
  const { tx, writes } = database(null, false);
  await assert.rejects(resolveManualPerson(tx, "unit", person, "actor"));
  assert.deepEqual(writes, []);
});

test("manual entry accepts name and position without an employee number", async () => {
  const input = form();
  input.delete("personEmployeeNo");
  const entered = readManualPerson(input);
  assert.equal(entered.employeeNo, "");
  const { tx, writes } = database(null);
  const created = await resolveManualPerson(tx, "unit", entered, "actor");
  assert.match(created.employeeNo, /^MANUAL-/);
  assert.deepEqual(writes, ["person", "audit"]);
});
