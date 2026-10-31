import type { AssignInput, RemoveInput, DirectoryFilters } from "@/types/receiving-custodian";

export const UNIT_TYPES = ["ACADEMIC", "ADMINISTRATIVE", "AUXILIARY", "SATELLITE_CAMPUS"];
export const CAMPUSES = ["MAIN_CAMPUS", "BUSTOS", "MENESES", "SARMIENTO", "HAGONOY"];
const controlCharacters = /[\u0000-\u001f\u007f]/;
export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function validQuery(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.length <= 100 && !controlCharacters.test(value));
}
export function validateDirectory(input: DirectoryFilters): boolean {
  return !!input && validQuery(input.query) &&
    (input.campus === undefined || CAMPUSES.includes(input.campus)) &&
    (input.unitType === undefined || UNIT_TYPES.includes(input.unitType)) &&
    (input.status === undefined || ["ALL", "ASSIGNED", "UNASSIGNED"].includes(input.status)) &&
    (input.page === undefined || (Number.isSafeInteger(input.page) && input.page >= 1 && input.page <= 1000000)) &&
    (input.includeInactive === undefined || typeof input.includeInactive === "boolean");
}
function text(value: unknown, min: number, max: number, multiline = false): boolean {
  const prohibited = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : controlCharacters;
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max && !prohibited.test(value);
}
export function validateDesignation(input: AssignInput | RemoveInput, remove = false): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input || !validId(input.unitId)) errors.unitId = "Choose a valid office or college.";
  if (!input || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) errors.expectedRevision = "Reload the designation before saving.";
  if (!input || (input.reason !== "" && !text(input.reason, 5, 500, true))) errors.reason = "Enter a reason between 5 and 500 characters.";
  if (remove || !input) return errors;
  if (!("mode" in input)) { errors.mode = "Choose existing or new personnel."; return errors; }
  if (input.mode === "EXISTING") {
    if (!validId(input.personId)) errors.personId = "Select an employee.";
  } else if (input.mode === "NEW") {
    if (input.person?.employeeNo !== undefined && input.person.employeeNo !== "" && !text(input.person.employeeNo, 1, 50)) errors.employeeNo = "Employee number must be 1–50 characters.";
    if (!input.person || !text(input.person.fullName, 2, 150)) errors.fullName = "Full name must be 2–150 characters.";
    if (!input.person || !text(input.person.position, 2, 150)) errors.position = "Position must be 2–150 characters.";
    const email = input.person?.email;
    if (email !== undefined && (typeof email !== "string" || (email.trim() !== "" && (!text(email, 3, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))))) errors.email = "Enter a valid email address or leave it blank.";
  } else errors.mode = "Choose existing or new personnel.";
  return errors;
}
