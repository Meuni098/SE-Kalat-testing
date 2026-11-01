import type { Prisma } from "@prisma/client";

/** Only the delivery provenance needed to recognize the former generated description. */
export const productDescriptionInclude = {
  inspections: {
    select: {
      intakeItem: {
        select: {
          description: true,
          intakeRecord: {
            select: { poNumber: true, deliveryReceiptNo: true, supplierName: true },
          },
        },
      },
    },
  },
} as const satisfies Prisma.AssetInclude;

interface ProductDescriptionSource {
  description?: string | null;
  inspections?: readonly {
    intakeItem?: {
      description: string;
      intakeRecord: {
        poNumber: string;
        deliveryReceiptNo: string;
        supplierName: string;
      };
    } | null;
  }[];
}

/** Keep genuine recorded descriptions intact; recover only proven legacy delivery text. */
export function actualProductDescription(asset: ProductDescriptionSource): string | null | undefined {
  const recorded = asset.description;
  if (recorded == null || !recorded.trim()) return recorded;

  const candidates = new Set<string>();
  for (const inspection of asset.inspections ?? []) {
    const item = inspection.intakeItem;
    if (!item) continue;
    const { poNumber, deliveryReceiptNo, supplierName } = item.intakeRecord;
    const formerGeneratedDescription = `Delivered under PO #${poNumber}, DR #${deliveryReceiptNo} by ${supplierName}`;
    if (recorded !== formerGeneratedDescription) continue;
    // An empty or inconsistent source is insufficient evidence for a replacement.
    if (!item.description.trim()) return recorded;
    candidates.add(item.description);
  }
  return candidates.size === 1 ? candidates.values().next().value : recorded;
}
