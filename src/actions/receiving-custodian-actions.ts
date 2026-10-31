"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ReceivingCustodianService, ReceivingError } from "@/lib/receiving-custodian-service";
import type { ActionResult, AssignInput, RemoveInput, DirectoryFilters } from "@/types/receiving-custodian";
import type { ItemReceiptInput, ItemReceiptFilters } from "@/types/item-receipt";

async function run<T>(operation: (service: ReceivingCustodianService) => Promise<T>, write = false): Promise<ActionResult<T>> {
  try {
    const session = await getSession();
    if (!session) throw new ReceivingError("UNAUTHENTICATED", "Please sign in to continue.");
    if (write && !rateLimit(`receiving-custodian:${session.id}`, 30, 60000).allowed) throw new ReceivingError("RATE_LIMITED", "Too many attempts. Please try again after 60 seconds.");
    const data = await operation(new ReceivingCustodianService(prisma, session.id));
    return { success: true, data };
  } catch (error) {
    if (error instanceof ReceivingError) return { success: false, code: error.code, error: error.message, fieldErrors: error.fieldErrors };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return { success: false, code: "EMPLOYEE_NO_EXISTS", error: "This employee number or receiving designation already exists. Reload and choose Use a registered person if the employee is already registered." };
      if (["P2034", "P2028"].includes(error.code)) return { success: false, code: "CONFLICT", error: "Another update is in progress. Reload before saving." };
    }
    console.error("Receiving custodian operation failed", error instanceof Error ? error.name : "Unknown error");
    return { success: false, code: "INTERNAL_ERROR", error: "Unable to complete this request. Please retry." };
  }
}
export async function getReceivingCustodiansAction(filters: DirectoryFilters = {}) { return run(s => s.directory(filters)); }
export async function searchReceiptAssetsAction(input: { unitId: string; query?: string }) { return run(s => s.receiptAssets(input?.unitId, input?.query)); }
export async function getItemReceiptsAction(filters: ItemReceiptFilters = {}) { return run(s => s.receipts(filters)); }
export async function recordItemReceiptAction(input: ItemReceiptInput) {
  const result = await run(s => s.recordReceipt(input), true);
  if (result.success) {
    revalidatePath("/people/item-receipts");
    revalidatePath("/people/faculty-staff");
    revalidatePath("/people/accountable-persons");
    revalidatePath(`/inventory/${result.data.receipt.assetId}`);
    revalidatePath("/inventory");
    revalidatePath("/inventory/transferred");
    revalidatePath("/reports");
  }
  return result;
}
export async function getReceivingCustodianUnitAction(input: { unitId: string }) { return run(s => s.unit(input?.unitId)); }
export async function searchReceivingCustodianUnitsAction(input: { query?: string } = {}) { return run(s => s.units(input?.query)); }
export async function searchReceivingCustodianCandidatesAction(input: { unitId: string; query?: string }) { return run(s => s.candidates(input?.unitId, input?.query)); }
export async function getReceivingCustodianHistoryAction(input: { unitId: string; cursor?: string }) { return run(s => s.history(input?.unitId, input?.cursor)); }
export async function assignReceivingCustodianAction(input: AssignInput) {
  const result = await run(s => s.save(input), true);
  if (result.success) {
    revalidatePath("/people/receiving-custodians");
    if (result.data.createdPersonId) { revalidatePath("/people/faculty-staff"); revalidatePath("/people/accountable-persons"); }
  }
  return result;
}
export async function removeReceivingCustodianAction(input: RemoveInput) {
  const result = await run(s => s.save(input, true), true);
  if (result.success) revalidatePath("/people/receiving-custodians");
  return result;
}
