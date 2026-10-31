"use server";
import { registerProduct } from "@/lib/product-registration-service";
import { productRegistrationFailure } from "@/lib/product-registration-error";

import { writeAuditEvent, requireAuditActor } from "@/lib/audit-log-write";

import { createTransferRequestAction } from "./transfer-actions";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function registerAssetAction(formData: FormData) {
  const user = await getSession();
  if (!user) return { error: "Please sign in with an active account.", code: "UNAUTHORIZED" };
  try {
    const result = await registerProduct(prisma, user.id, formData);
    for (const path of ["/people/faculty-staff", "/people/accountable-persons", "/inventory", "/inventory/central", "/inventory/transferred", "/inventory/generate-qr", "/dashboard"]) revalidatePath(path);
    return result;
  } catch (error) { return productRegistrationFailure(error); }
}

export async function requestTransferAction(formData: FormData) {
  return createTransferRequestAction(formData);
}

export async function updateAssetStatusAction(assetId: string, status: string, condition?: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  try { return await prisma.$transaction(async tx => {
    const actor = await requireAuditActor(tx, user.id, ["ADMIN","STAFF","CUSTODIAN"]);


  const before = await tx.asset.findUnique({ where: { id: assetId } });
  if (!before || before.isDeleted) return { error: "Asset not found" };
  if (actor.role === "CUSTODIAN" && actor.unitId !== before.unitId) return { error: "You cannot update another office's asset." };
  if (!["IN_USE", "IN_STORAGE", "UNDER_REPAIR", "MISSING", "FOR_DISPOSAL", "DISPOSED"].includes(status) || (condition && !["EXCELLENT", "GOOD", "FAIR", "UNSERVICEABLE"].includes(condition))) return { error: "Choose a valid status and condition." };
  if (status === before.status && (!condition || condition === before.condition)) return { success: true };

  const updated = await tx.asset.update({
    where: { id: assetId },
    data: {
      status,
      condition: condition || before.condition,
      lastVerifiedAt: new Date(),
    },
  });

  await writeAuditEvent(tx, {
    data: {
      actorId: user.id,
      action: "UPDATE_STATUS",
      entityType: "ASSET",
      entityId: assetId,
      beforeState: { status: before.status, condition: before.condition },
      afterState: { status: updated.status, condition: updated.condition },
    },
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${assetId}`);
  revalidatePath("/dashboard");
  return { success: true };

  }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}
