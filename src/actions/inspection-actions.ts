"use server";
import { auditedTransaction, operationFromForm } from "@/lib/audited-transaction";

import { writeAuditEvent, requireAuditActor, updateAuditedAsset } from "@/lib/audit-log-write";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getInspectionRecordsAction() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const inspections = await prisma.inspection.findMany({
    include: {
      asset: {
        include: {
          category: true,
          unit: true,
          accountablePerson: true,
        },
      },
      intakeItem: {
        include: {
          intakeRecord: true,
        },
      },
      inspector: {
        select: { id: true, name: true, role: true, email: true },
      },
    },
    orderBy: { inspectedAt: "desc" },
  });

  return { success: true, inspections };
}

export async function createInspectionRecordAction(
  formData: FormData
): Promise<{ success?: boolean; inspectionId?: string; error?: string }> {
  try {
    const user = await getSession();
    if (!user) return { error: "Unauthorized" };

    return await auditedTransaction(prisma, user.id, operationFromForm(formData, ["ADMIN", "STAFF", "AUDITOR"]), async tx => {
    await requireAuditActor(tx, user.id, ["ADMIN","STAFF","AUDITOR"]);
    const assetId = formData.get("assetId")?.toString() || null;
    const result = formData.get("result")?.toString() || "ACCEPTED";
    const remarks = formData.get("remarks")?.toString()?.trim() || null;
    const condition = formData.get("condition")?.toString() || "GOOD";

    if (!["ACCEPTED", "REJECTED", "CONDITIONAL"].includes(result) || !["EXCELLENT", "GOOD", "FAIR", "UNSERVICEABLE"].includes(condition)) return { error: "Choose a valid inspection result and condition." };
    const inspection = await tx.inspection.create({
      data: {
        assetId,
        inspectorId: user.id,
        result,
        remarks,
      },
    });

    if (assetId) {
      await updateAuditedAsset(tx, user.id, {
        where: { id: assetId },
        data: {
          condition,
          lastVerifiedAt: new Date(),
        },
      });
    }

    await writeAuditEvent(tx, {
      data: {
        actorId: user.id,
        action: "LOG_INSPECTION",
        entityType: "INSPECTION",
        entityId: inspection.id,
        afterState: { assetId, result, condition, remarks },
      },
    });

    revalidatePath("/physical-inventory/inspections");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");

    return { success: true, inspectionId: inspection.id };
    }, { isolationLevel: "Serializable" });
  } catch { return { error: "The action could not be saved. Please try again." }; }
}
