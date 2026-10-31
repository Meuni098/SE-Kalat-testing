"use server";
import { auditedTransaction, operationFromForm } from "@/lib/audited-transaction";

import { writeAuditEvent, requireAuditActor, updateAuditedAsset } from "@/lib/audit-log-write";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createDisposalDocketAction(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  try { return await auditedTransaction(prisma, user.id, operationFromForm(formData), async tx => {
    await requireAuditActor(tx, user.id, ["ADMIN"]);


  const assetId = formData.get("assetId")?.toString();
  const reason = formData.get("reason")?.toString().trim();
  const method = formData.get("method")?.toString() || "PUBLIC_AUCTION";
  const appraisedScrapValue = parseFloat(formData.get("appraisedScrapValue")?.toString() || "0");

  if (!assetId || !reason) {
    return { error: "Please select an asset and state the condemnation reason." };
  }

  const asset = await tx.asset.findUnique({ where: { id: assetId } });
  if (!asset) return { error: "Asset not found." };

  const docketNo = `BULSU-DISP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  const disposal = await tx.disposal.create({
    data: {
      assetId,
      docketNo,
      reason,
      method,
      appraisedScrapValue,
      status: "PROPOSED",
      coaApprovalRef: "COA Circular No. 89-296",
    },
  });

  await updateAuditedAsset(tx, user.id, {
    where: { id: assetId },
    data: {
      status: "FOR_DISPOSAL",
      condition: "UNSERVICEABLE",
    },
  });

  await writeAuditEvent(tx, {
    data: {
      actorId: user.id,
      action: "PROPOSE_DISPOSAL_DOCKET",
      entityType: "DISPOSAL",
      entityId: disposal.id,
      afterState: { docketNo, assetPropertyNo: asset.propertyNo, appraisedScrapValue, method },
    },
  });

  revalidatePath("/disposal");
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${assetId}`);
  revalidatePath("/dashboard");

  return { success: true, docketId: disposal.id };

  }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}

export async function approveDisposalDocketAction(disposalId: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  try { return await prisma.$transaction(async tx => {
    await requireAuditActor(tx, user.id, ["ADMIN"]);


  const disposal = await tx.disposal.findUnique({
    where: { id: disposalId },
    include: { asset: true },
  });

  if (!disposal) return { error: "Disposal docket not found." };

  if (disposal.status === "DISPOSED") return { success: true };
  // Update docket status to DISPOSED
  await tx.disposal.update({
    where: { id: disposalId },
    data: {
      status: "DISPOSED",
      approvedAt: new Date(),
    },
  });

  // Soft delete asset from active counts
  await updateAuditedAsset(tx, user.id, {
    where: { id: disposal.assetId },
    data: {
      status: "DISPOSED",
      isDeleted: true,
    },
  });

  await writeAuditEvent(tx, {
    data: {
      actorId: user.id,
      action: "EXECUTE_LEGAL_DISPOSAL",
      entityType: "DISPOSAL",
      entityId: disposal.id,
      beforeState: { status: disposal.status },
      afterState: {
        status: "DISPOSED",
        assetSoftDeleted: true,
        approvedBy: user.name,
      },
    },
  });

  revalidatePath("/disposal");
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${disposal.assetId}`);
  revalidatePath("/dashboard");

  return { success: true };

  }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}
