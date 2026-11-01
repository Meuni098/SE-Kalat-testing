import { actualProductDescription, productDescriptionInclude } from "@/lib/product-description";
import { classificationWhere } from "@/lib/classification-filter";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { InventoryTable, AssetRow } from "@/components/inventory/inventory-table";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { NewAssetModal } from "@/components/inventory/new-asset-modal";
import { CategoryExportModal } from "@/components/reports/category-export-modal";
import { InventoryNavTabs } from "@/components/inventory/inventory-nav-tabs";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface InventoryPageProps {
  searchParams: Promise<{
    search?: string;
    classification?: string;
    unitId?: string;
    status?: string;
  }>;
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  await getSession();
  const params = await searchParams;

  const whereClause: Record<string, unknown> = {
    isDeleted: false,
  };

  try{Object.assign(whereClause,classificationWhere(params.classification));}catch{return <p role="alert">Choose a valid classification. <Link href="/inventory">Reset inventory filters</Link></p>;}

  if (params.unitId) {
    whereClause.unitId = params.unitId;
  }

  if (params.status) {
    whereClause.status = params.status;
  }

  if (params.search) {
    const s = params.search.trim();
    whereClause.OR = [
      { propertyNo: { contains: s, mode: "insensitive" } },
      { name: { contains: s, mode: "insensitive" } },
      { serialNo: { contains: s, mode: "insensitive" } },
      { description: { contains: s, mode: "insensitive" } },
    ];
  }

  const [assetsRaw, units, categories, persons, amoCount, transferredCount, totalCount] =
    await Promise.all([
      prisma.asset.findMany({
        where: whereClause,
        include: {
          ...productDescriptionInclude,
          category: true,
          unit: true,
          accountablePerson: true,
        },
        orderBy: { acquisitionDate: "desc" },
      }),
      prisma.unit.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.person.findMany({ where: { assets: { some: { isDeleted: false } } }, orderBy: { fullName: "asc" } }),
      prisma.asset.count({
        where: {
          isDeleted: false,
          status: { not: "DISPOSED" },
          OR: [
            { unit: { code: "AMO" } },
            { unit: { code: "STORAGE" } },
            { unit: { unitType: { in: ["ADMINISTRATIVE", "AUXILIARY"] } } },
          ],
        },
      }),
      prisma.asset.count({
        where: {
          isDeleted: false,
          status: { not: "DISPOSED" },
          unit: { unitType: "ACADEMIC" },
        },
      }),
      prisma.asset.count({
        where: { isDeleted: false, status: { not: "DISPOSED" } },
      }),
    ]);


  const assetRows: AssetRow[] = assetsRaw.map((a) => ({
    id: a.id,
    propertyNo: a.propertyNo,
    name: a.name,
    description: actualProductDescription(a),
    classification: a.classification,
    categoryName: a.category.name,
    unitCode: a.unit.code,
    unitName: a.unit.name,
    accountablePerson: a.accountablePerson?.fullName || null,
    acquisitionDate: a.acquisitionDate,
    acquisitionCost: a.acquisitionCost,
    status: a.status,
    condition: a.condition,
    serialNo: a.serialNo,
  }));

  return (
    <div className="space-y-5 pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] p-5 border border-border rounded">
        <div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase">
            Asset Inventory Registry
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <CategoryExportModal
            categories={categories}
            units={units}
          />

          <Link
            href="/inventory/generate-qr"
            className="bg-[#FFFFFF] text-[#3B0A0F] border border-border hover:bg-cream px-3.5 py-2 text-xs font-bold rounded flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#D97B1A]">print</span>
            <span>Batch QR Labels</span>
          </Link>

          <Link
            href="/reports"
            className="bg-[#FFFFFF] text-[#3B0A0F] border border-border hover:bg-cream px-3.5 py-2 text-xs font-bold rounded flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Reports Studio</span>
          </Link>

          <NewAssetModal
            units={units}
            categories={categories}
            persons={persons}
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <InventoryNavTabs
        amoCount={amoCount}
        transferredCount={transferredCount}
        totalCount={totalCount}
      />

      {/* Filter Bar */}
      <Suspense fallback={<div className="text-xs text-[#6E2B32]">Loading filters...</div>}>

        <InventoryFilters units={units} />
      </Suspense>

      {/* Table */}
      <InventoryTable assets={assetRows} />
    </div>
  );
}
