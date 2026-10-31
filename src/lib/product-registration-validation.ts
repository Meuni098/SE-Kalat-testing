export class ProductRegistrationError extends Error {
  constructor(public code: "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND", message: string) { super(message); }
}

export function readText(form: FormData, key: string, label: string, max = 200, required = true): string {
  const value = form.get(key);
  if (value !== null && typeof value !== "string") invalid(`Enter a valid ${label}.`);
  const text = typeof value === "string" ? value.trim() : "";
  if ((required && !text) || text.length > max) invalid(`Enter ${label}${required ? "" : " if needed"} (maximum ${max} characters).`);
  return text;
}

export function readNumber(form: FormData, key: string, label: string, maximum = Number.MAX_SAFE_INTEGER, integer = false): number {
  const text = readText(form, key, label, 30);
  const value = Number(text);
  if (!Number.isFinite(value) || value < (integer ? 1 : 0) || value > maximum || (integer && (!/^\d+$/.test(text) || !Number.isInteger(value)))) {
    invalid(`Enter a valid ${label}${integer ? ` between 1 and ${maximum}` : " of zero or more"}.`);
  }
  return value;
}

export function registrationOperation(form: FormData): string {
  if (readText(form, "propertyNo", "product code", 128, false) || readText(form, "productCode", "product code", 128, false)) {
    invalid("Product codes are generated automatically. Remove the supplied code and try again.");
  }
  const id = readText(form, "operationId", "operation ID", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) invalid("Reload the form before saving.");
  return id;
}

export function readAcquisitionDate(form: FormData): Date {
  const value = readText(form, "acquisitionDate", "acquisition date", 10, false);
  if (!value) return new Date();
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid("Enter a valid acquisition date.");
  return date;
}

function invalid(message: string): never { throw new ProductRegistrationError("VALIDATION_ERROR", message); }
