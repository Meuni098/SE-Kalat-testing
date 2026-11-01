"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { TransferService } from "@/lib/transfer-service";
import { revalidatePath } from "next/cache";

function refreshTransferViews() {
  revalidatePath("/inventory/[id]", "page");
  for (const path of ["/inventory/transfers", "/inventory", "/inventory/central", "/inventory/transferred", "/dashboard", "/people/accountable-persons", "/people/faculty-staff", "/reports", "/reports/transfers"]) revalidatePath(path);
}

export async function getTransferRequestsAction(statusFilter?: string) {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");

  const whereClause: Prisma.TransferRequestWhereInput = user.role === "CUSTODIAN" ? { OR: [{ fromUnitId: user.unitId ?? "" }, { toUnitId: user.unitId ?? "" }] } : {};
  if (statusFilter && ["PENDING", "APPROVED", "REJECTED", "COMPLETED"].includes(statusFilter)) {
    whereClause.status = statusFilter;
  }

  const transfers = await prisma.transferRequest.findMany({
    where: whereClause,
    include: {
      asset: {
        include: {
          category: true,
        },
      },
      fromUnit: true,
      toUnit: true,
      fromPerson: true,
      toPerson: true,
      requestedBy: {
        select: { id: true, name: true, email: true, role: true },
      },
      decidedBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  return { success: true, transfers };
}

export async function createTransferRequestAction(formData: FormData) {
  const user = await getSession();
  if (!user) return { error: "Please sign in before requesting a transfer." };
  const result = await new TransferService(prisma, user.id).create(formData);
  if ("success" in result) refreshTransferViews();
  return result;
}

export async function decideTransferAction(transferId: string, decision: "APPROVED" | "REJECTED", remarks?: string) {
  const user = await getSession();
  if (!user) return { error: "Please sign in before deciding a transfer." };
  const result = await new TransferService(prisma, user.id).decide(transferId, decision, remarks);
  if ("success" in result) refreshTransferViews();
  return result;
}
