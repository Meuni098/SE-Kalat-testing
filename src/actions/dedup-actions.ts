"use server";

import { writeAuditEvent, requireAuditActor, updateAuditedAsset } from "@/lib/audit-log-write";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function mergeAssetsAction(masterAssetId: string, duplicateAssetId: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  try { return await prisma.$transaction(async tx => {
    await requireAuditActor(tx, user.id, ["ADMIN","STAFF"]);


  if (masterAssetId === duplicateAssetId) return { error: "Choose two different assets." };
  const [master, duplicate] = await Promise.all([
    tx.asset.findUnique({ where: { id: masterAssetId } }),
    tx.asset.findUnique({ where: { id: duplicateAssetId } }),
  ]);

  if (!master || !duplicate) {
    return { error: "One or both assets could not be found." };
  }

  if (master.isDeleted || duplicate.isDeleted) return { error: "A selected asset has already been archived. Refresh before merging." };
  // 1. Move related inspections
  await tx.inspection.updateMany({
    where: { assetId: duplicateAssetId },
    data: { assetId: masterAssetId },
  });

  // 2. Move physical count entries
  await tx.physicalCountEntry.updateMany({
    where: { assetId: duplicateAssetId },
    data: { assetId: masterAssetId },
  });

  // 3. Move missing reports
  await tx.missingReport.updateMany({
    where: { assetId: duplicateAssetId },
    data: { assetId: masterAssetId },
  });

  // 4. Archive duplicate asset (soft delete)
  await updateAuditedAsset(tx, user.id, {
    where: { id: duplicateAssetId },
    data: {
      isDeleted: true,
      status: "DISPOSED",
      description: `${duplicate.description || ""} [MERGED INTO ${master.propertyNo}]`,
    },
  });

  // 5. Audit log
  await writeAuditEvent(tx, {
    data: {
      actorId: user.id,
      action: "MERGE_ASSETS",
      entityType: "ASSET",
      entityId: masterAssetId, eventKind: "UPDATE", relatedAssetIds: [masterAssetId, duplicateAssetId],
      beforeState: {
        duplicatePropertyNo: duplicate.propertyNo,
        masterPropertyNo: master.propertyNo,
      },
      afterState: {
        mergedAt: new Date(),
        retainedMaster: master.propertyNo,
        archivedDuplicate: duplicate.propertyNo,
      },
    },
  });

  revalidatePath("/data-engine/deduplication");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return { success: true };

  }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch { return { error: "The action could not be saved. Please review and try again." }; }
}
