import type { Prisma } from "@prisma/client";

export const PRODUCT_CODE_PREFIX = "BULSU-AMO-";
export const MAX_DELIVERY_QUANTITY = 10000;

export function formatProductCode(value: bigint): string {
  if (value <= BigInt(0)) throw new Error("Product sequence must be positive.");
  return `${PRODUCT_CODE_PREFIX}${value.toString().padStart(6, "0")}`;
}

/** PostgreSQL sequences are atomic across processes and never reuse rolled-back allocations. */
export async function allocateProductCodes(tx: Prisma.TransactionClient, count = 1): Promise<string[]> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_DELIVERY_QUANTITY) {
    throw new Error("Invalid product code allocation size.");
  }
  const rows = await tx.$queryRaw<{ value: bigint }[]>`
    SELECT nextval('"ProductCodeSequence"'::regclass) AS value FROM generate_series(1, ${count}::integer)
  `;
  return rows.map(row => formatProductCode(row.value));
}
