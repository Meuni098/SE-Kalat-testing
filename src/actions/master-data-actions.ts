"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { writeAuditEvent, requireAuditActor } from "@/lib/audit-log-write";
import { revalidatePath } from "next/cache";
import { auditedTransaction, operationFromForm } from "@/lib/audited-transaction";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

async function change<T>(operation: (tx: Prisma.TransactionClient, actorId: string) => Promise<T>, form?: FormData) {
  try {
    const user = await getSession();
    if (!user) return { error: "Please sign in before saving changes." };
    return await auditedTransaction(prisma, user.id, form ? operationFromForm(form) : { id: randomUUID(), values: [] }, async tx => {
      await requireAuditActor(tx, user.id, ["ADMIN", "STAFF"]);
      return operation(tx, user.id);
    }, { isolationLevel: "Serializable" });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}

function refresh() {
  for (const path of ["/master-data", "/master-data/colleges", "/master-data/categories", "/master-data/products", "/inventory", "/intake", "/reports"]) revalidatePath(path);
}
export async function createUnitAction(formData: FormData) {
  const result = await change(async (tx, actorId) => {
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    const name = String(formData.get("name") ?? "").trim();
    const unitType = String(formData.get("unitType") ?? "ACADEMIC");
    const campus = String(formData.get("campus") ?? "MAIN_CAMPUS");
    const raw = String(formData.get("parentUnitId") ?? "");
    const parentUnitId = raw && raw !== "NONE" ? raw : null;
    if (!code || !name) return { error: "Unit Code and Full Name are required." };
    if (await tx.unit.findUnique({ where: { code } })) return { error: `Unit code '${code}' already exists.` };
    const unit = await tx.unit.create({ data: { code, name, unitType, campus, parentUnitId, isActive: true } });
    await writeAuditEvent(tx, { data: { actorId, action: "CREATE_UNIT", entityType: "UNIT", entityId: unit.id, entityReference: code, afterState: unit } });
    return { success: true, unit };
  }, formData); refresh(); return result;
}
export async function updateUnitAction(id: string, formData: FormData) {
  const result = await change(async (tx, actorId) => {
    const current = await tx.unit.findUnique({ where: { id } });
    if (!current) return { error: "Unit not found." };
    const code = String(formData.get("code") ?? current.code).trim().toUpperCase();
    const name = String(formData.get("name") ?? current.name).trim();
    const unitType = String(formData.get("unitType") ?? current.unitType);
    const campus = String(formData.get("campus") ?? current.campus);
    const raw = String(formData.get("parentUnitId") ?? "");
    const parentUnitId = raw && raw !== "NONE" ? raw : null;
    if (parentUnitId === id) return { error: "A college or unit cannot be its own parent unit." };
    if (code !== current.code && await tx.unit.findUnique({ where: { code } })) return { error: `Unit code '${code}' is already taken by another unit.` };
    const unit = await tx.unit.update({ where: { id }, data: { code, name, unitType, campus, parentUnitId } });
    await writeAuditEvent(tx, { data: { actorId, action: "UPDATE_UNIT", eventKind: "UPDATE", entityType: "UNIT", entityId: id, entityReference: code, beforeState: current, afterState: unit } });
    return { success: true, unit };
  }, formData); refresh(); return result;
}
export async function toggleUnitStatusAction(id: string, expectedIsActive?: boolean) {
  const result = await change(async (tx, actorId) => {
    const current = await tx.unit.findUnique({ where: { id } });
    if (!current) return { error: "Unit not found." };
    if (expectedIsActive !== undefined && typeof expectedIsActive !== "boolean") return { error: "Reload the unit before changing its status." };
    if (expectedIsActive !== undefined && current.isActive !== expectedIsActive) return { success: true, isActive: current.isActive };
    const updated = await tx.unit.update({ where: { id }, data: { isActive: !current.isActive } });
    await writeAuditEvent(tx, { data: { actorId, action: "TOGGLE_UNIT_STATUS", entityType: "UNIT", entityId: id, entityReference: current.code, beforeState: { isActive: current.isActive }, afterState: { isActive: updated.isActive } } });
    return { success: true, isActive: updated.isActive };
  }); refresh(); return result;
}
export async function createCategoryAction(formData: FormData) {
  try {
    const result = await change(async (tx, actorId) => {
      const code = String(formData.get("code") ?? "").trim().toUpperCase();
      const name = String(formData.get("name") ?? "").trim();
      const classification = String(formData.get("classification") ?? "PPE");
      const usefulLifeYears = Number(formData.get("usefulLifeYears") ?? "5");
      if (!/^[A-Z0-9-]{3,15}$/.test(code)) return { error: "Use 3–15 letters, numbers, or hyphens for the category code." };
      if (!name || name.length > 100) return { error: "Category name is required and must be 100 characters or fewer." };
      if (!["PPE", "SEMI_EXPENDABLE"].includes(classification)) return { error: "Select a valid category classification." };
      if (!Number.isInteger(usefulLifeYears) || usefulLifeYears < 1 || usefulLifeYears > 50) return { error: "Government useful life benchmark must be between 1 and 50 years (COA Circular No. 2020-006)." };
      if (await tx.category.findUnique({ where: { code } })) return { error: `Category code '${code}' already exists.` };
      const category = await tx.category.create({ data: { code, name, classification, usefulLifeYears } });
      await writeAuditEvent(tx, { data: { actorId, action: "CREATE_CATEGORY", entityType: "CATEGORY", entityId: category.id, entityReference: code, afterState: category } });
      return { success: true, category };
    }, formData); refresh(); return result;
  } catch { return { error: "Unable to create the category. Please review and retry." }; }
}
export async function updateCategoryAction(id: string, formData: FormData) {
  const result = await change(async (tx, actorId) => {
    const current = await tx.category.findUnique({ where: { id } });
    if (!current) return { error: "Category not found." };
    const name = String(formData.get("name") ?? current.name).trim();
    const classification = String(formData.get("classification") ?? current.classification);
    const usefulLifeYears = Number(formData.get("usefulLifeYears") ?? current.usefulLifeYears);
    if (!name || name.length > 100 || !["PPE", "SEMI_EXPENDABLE"].includes(classification) || !Number.isInteger(usefulLifeYears) || usefulLifeYears < 1 || usefulLifeYears > 50) return { error: "Check category name, classification, and useful life (1–50 years)." };
    const category = await tx.category.update({ where: { id }, data: { name, classification, usefulLifeYears } });
    await writeAuditEvent(tx, { data: { actorId, action: "UPDATE_CATEGORY", eventKind: "UPDATE", entityType: "CATEGORY", entityId: id, entityReference: current.code, beforeState: current, afterState: category } });
    return { success: true, category };
  }, formData); refresh(); return result;
}
export async function deleteCategoryAction(id: string) {
  const result = await change(async (tx, actorId) => {
    const current = await tx.category.findUnique({ where: { id } });
    if (!current) return { error: "Category not found." };
    if (await tx.asset.count({ where: { categoryId: id } })) return { error: "This category has assigned assets and cannot be deleted." };
    await tx.category.delete({ where: { id } });
    await writeAuditEvent(tx, { data: { actorId, action: "DELETE_CATEGORY", entityType: "CATEGORY", entityId: id, entityReference: current.code, beforeState: current } });
    return { success: true };
  }); refresh(); return result;
}
async function saveProduct(id: string | null, formData: FormData) {
  const result = await change(async (tx, actorId) => {
    const current = id ? await tx.productTemplate.findUnique({ where: { id } }) : null;
    if (id && !current) return { error: "Product template not found." };
    const name = String(formData.get("name") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "");
    const classification = String(formData.get("classification") ?? "PPE");
    const cost = String(formData.get("benchmarkCost") ?? "");
    const benchmarkCost = cost ? Number(cost) : null;
    const specifications = String(formData.get("specifications") ?? "").trim() || null;
    if (!name || !categoryId) return { error: "Product Name and Category are required." };
    if (!["PPE", "SEMI_EXPENDABLE"].includes(classification) || (benchmarkCost !== null && (!Number.isFinite(benchmarkCost) || benchmarkCost < 0))) return { error: "Check classification and benchmark cost." };
    if (!await tx.category.findUnique({ where: { id: categoryId } })) return { error: "Selected category does not exist." };
    const data = { name, categoryId, classification, benchmarkCost, specifications };
    const template = id ? await tx.productTemplate.update({ where: { id }, data, include: { category: true } }) : await tx.productTemplate.create({ data, include: { category: true } });
    await writeAuditEvent(tx, { data: { actorId, action: id ? "UPDATE_PRODUCT_TEMPLATE" : "CREATE_PRODUCT_TEMPLATE", eventKind: id ? "UPDATE" : "CREATE", entityType: "PRODUCT_TEMPLATE", entityId: template.id, entityReference: template.name, beforeState: current ?? Prisma.JsonNull, afterState: template } });
    return { success: true, template };
  }, formData); refresh(); return result;
}
export async function createProductTemplateAction(formData: FormData) { return saveProduct(null, formData); }
export async function updateProductTemplateAction(id: string, formData: FormData) { return saveProduct(id, formData); }
export async function deleteProductTemplateAction(id: string) {
  const result = await change(async (tx, actorId) => {
    const current = await tx.productTemplate.findUnique({ where: { id } });
    if (!current) return { error: "Product template not found." };
    await tx.productTemplate.delete({ where: { id } });
    await writeAuditEvent(tx, { data: { actorId, action: "DELETE_PRODUCT_TEMPLATE", entityType: "PRODUCT_TEMPLATE", entityId: id, entityReference: current.name, beforeState: current } });
    return { success: true };
  }); refresh(); return result;
}
