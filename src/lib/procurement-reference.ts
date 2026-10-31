import type { Prisma } from "@prisma/client";

export async function allocateProcurementReferences(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ value: bigint }[]>`
    SELECT nextval('"ProcurementReferenceSequence"'::regclass) AS value
  `;
  const suffix = row.value.toString().padStart(6, "0");
  return { poNumber: `BULSU-AMO-PO-${suffix}`, deliveryReceiptNo: `BULSU-AMO-DR-${suffix}` };
}
