import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { QrBatchGenerator } from "@/components/inventory/qr-batch-generator";

export const dynamic = "force-dynamic";

export default async function GenerateQrPage() {
  const viewer = await getSession();
  if (!viewer) notFound();

  const [assets, units] = await Promise.all([
    prisma.asset.findMany({
      where: { isDeleted: false, ...(viewer.role === "CUSTODIAN" ? { unitId: viewer.unitId ?? "" } : {}) },
      include: { category: true, unit: true },
      orderBy: { propertyNo: "asc" },
    }),
    prisma.unit.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const mappedAssets = assets.map((a) => ({
    id: a.id,
    propertyNo: a.propertyNo,
    name: a.name,
    classification: a.classification,
    categoryName: a.category.name,
    unitCode: a.unit.code,
  }));

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-border p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Generate QR Code Sticker Sheets
          </h1>
        </div>
      </div>

      {/* Batch Generator Studio */}
      <QrBatchGenerator assets={mappedAssets} units={units} />
    </div>
  );
}
