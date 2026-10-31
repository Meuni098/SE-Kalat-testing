import type { PrismaClient } from "@prisma/client";
import { requireAuditActor } from "./audit-log-write";
import { rateLimit } from "./rate-limit";

export async function lookupProduct(db: PrismaClient, actorId: string, input: string) {
  const actor = await requireAuditActor(db, actorId);
  if (typeof input !== "string" || !input.trim() || input.trim().length > 128) {
    return { error: "Enter a product code of up to 128 characters.", code: "VALIDATION_ERROR" };
  }
  if (!rateLimit(`product-lookup:${actor.id}`, 60, 60000).allowed) return { error: "Too many lookups. Try again in one minute.", code: "RATE_LIMITED" };
  const asset = await db.asset.findFirst({
    where: { propertyNo: input.trim(), isDeleted: false,
      ...(actor.role === "CUSTODIAN" ? { unitId: actor.unitId ?? "" } : {}) },
    include: { category: true, unit: true, accountablePerson: true },
  });
  if (!asset) return { error: "Item not found or unavailable.", code: "NOT_FOUND" };
  return { success: true as const, asset: {
    id: asset.id, propertyNo: asset.propertyNo, name: asset.name, description: asset.description,
    classification: asset.classification, categoryName: asset.category.name,
    unitCode: asset.unit.code, unitName: asset.unit.name,
    accountablePerson: asset.accountablePerson?.fullName || "Unassigned",
    acquisitionCost: asset.acquisitionCost, status: asset.status, condition: asset.condition,
  } };
}
