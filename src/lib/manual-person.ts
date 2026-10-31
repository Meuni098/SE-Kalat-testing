import { writeAuditEvent } from "@/lib/audit-log-write";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { validateDesignation } from "./receiving-custodian-validation";

export class ManualPersonError extends Error {}
export interface ManualPerson { fullName: string; position: string; employeeNo?: string; email?: string }

export function readManualPerson(form: FormData): ManualPerson {
  const person = {
    fullName: String(form.get("personName") ?? "").trim(),
    position: String(form.get("personPosition") ?? "").trim(),
    employeeNo: String(form.get("personEmployeeNo") ?? "").trim(),
  };
  const errors = validateDesignation({ unitId: "11111111-1111-4111-8111-111111111111", expectedRevision: 0, reason: "Manual transaction", mode: "NEW", person });
  if (Object.keys(errors).length) throw new ManualPersonError(Object.values(errors).join(" "));
  return person;
}

export async function resolveManualPerson(tx: Prisma.TransactionClient, unitId: string, person: ManualPerson, actorId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${unitId} FOR SHARE`;
  const unit = await tx.unit.findUnique({ where: { id: unitId } });
  if (!unit?.isActive) throw new ManualPersonError("Choose an active office or college.");
  // This is an internal reference for the legacy required column, not an employee number supplied by the user.
  const employeeNo = person.employeeNo || `MANUAL-${createHash("sha256").update(JSON.stringify([unitId, person.fullName, person.position])).digest("hex").slice(0, 40)}`;
  const existing = await tx.person.findUnique({ where: { employeeNo } });
  if (existing) {
    if (existing.unitId !== unitId) throw new ManualPersonError("This employee number belongs to another office or college.");
    if (existing.fullName !== person.fullName || existing.position !== person.position) {
      throw new ManualPersonError("This employee number is registered with a different name or position. Enter the registered details or correct the personnel record first.");
    }
    return existing;
  }
  const created = await tx.person.create({ data: { ...person, employeeNo, unitId } });
  await writeAuditEvent(tx, { data: { actorId, action: "CREATE_PERSON", entityType: "PERSON", entityId: created.id,
    afterState: { person: { id: created.id, employeeNo: created.employeeNo, fullName: created.fullName, position: created.position }, unitId } } });
  return created;
}

export function manualEntryError(error: unknown): { error: string } {
  if (error instanceof ManualPersonError) return { error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "A matching record was saved concurrently. Review the details and retry." };
  return { error: "Unable to save this transaction. Please review and retry." };
}
