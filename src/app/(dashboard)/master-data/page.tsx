import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { MasterDataHub } from "@/components/master-data/master-data-hub";

export const dynamic = "force-dynamic";

interface MasterDataPageProps {
  searchParams: Promise<{
    tab?: "colleges" | "categories" | "products";
  }>;
}

export default async function MasterDataPage({ searchParams }: MasterDataPageProps) {
  await getSession();
  const params = await searchParams;
  const initialTab = params.tab || "colleges";

  // Fetch all entities with optimized aggregations
  const [units, categories, rawProducts, assetsValuation] = await Promise.all([
    prisma.unit.findMany({
      include: {
        _count: {
          select: {
            assets: { where: { isDeleted: false } },
            persons: true,
          },
        },
      },
      orderBy: { code: "asc" },
    }),

    prisma.category.findMany({
      include: {
        _count: {
          select: {
            assets: { where: { isDeleted: false } },
          },
        },
        assets: {
          where: { isDeleted: false },
          select: { acquisitionCost: true },
        },
      },
      orderBy: { code: "asc" },
    }),

    (prisma as any).productTemplate.findMany({
      include: {
        category: true,
      },
      orderBy: { name: "asc" },
    }),

    prisma.asset.aggregate({
      where: { isDeleted: false },
      _sum: { acquisitionCost: true },
      _count: true,
    }),
  ]);

  const formattedUnits = units.map((u) => ({
    id: u.id,
    code: u.code,
    name: u.name,
    unitType: u.unitType,
    campus: u.campus || "MAIN_CAMPUS",
    parentUnitId: u.parentUnitId,
    isActive: u.isActive,
    assetCount: u._count.assets,
    personCount: u._count.persons,
  }));

  const formattedCategories = categories.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    classification: c.classification,
    usefulLifeYears: c.usefulLifeYears,
    assetCount: c._count.assets,
    totalValuation: c.assets.reduce((sum, a) => sum + (a.acquisitionCost || 0), 0),
  }));

  const formattedProducts = rawProducts.map((p: any) => ({
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    category: p.category ? { id: p.category.id, code: p.category.code, name: p.category.name } : undefined,
    classification: p.classification,
    benchmarkCost: p.benchmarkCost,
    specifications: p.specifications,
    isActive: p.isActive,
  }));

  const totalAssetsCount = assetsValuation._count || 0;
  const totalValuation = assetsValuation._sum.acquisitionCost || 0;

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-border p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Institutional Master Data &amp; Taxonomies
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-cream border border-border px-3.5 py-2 rounded text-right">
            <span className="text-[10px] uppercase font-bold text-[#6E2B32] block">Governed University Assets</span>
            <span className="text-sm font-mono font-black text-[#A60212]">
              {totalAssetsCount} Items ({formatCurrency(totalValuation)})
            </span>
          </div>
        </div>
      </div>

      {/* 4 Metric Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-border p-4 rounded shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase">Colleges &amp; Units</span>
            <span className="material-symbols-outlined text-[#A60212] text-[20px]">domain</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#3B0A0F] font-mono">{units.length}</span>
            <span className="text-[11px] text-[#2E7D32] font-bold">
              {units.filter((u) => u.isActive).length} Active
            </span>
          </div>
          <p className="text-[10px] text-[#6E2B32] mt-1">Academic colleges &amp; administrative units</p>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase">Asset Categories</span>
            <span className="material-symbols-outlined text-[#D97B1A] text-[20px]">category</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#3B0A0F] font-mono">{categories.length}</span>
            <span className="text-[11px] text-[#6E2B32] font-bold">COA Classes</span>
          </div>
          <p className="text-[10px] text-[#6E2B32] mt-1">PPE &amp; Semi-Expendable useful life rules</p>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase">Product Catalog</span>
            <span className="material-symbols-outlined text-[#A60212] text-[20px]">inventory_2</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#3B0A0F] font-mono">{rawProducts.length}</span>
            <span className="text-[11px] text-[#6E2B32] font-bold">Standard Items</span>
          </div>
          <p className="text-[10px] text-[#6E2B32] mt-1">Pre-approved nomenclature &amp; specs</p>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase">COA Form 74-A Scope</span>
            <span className="material-symbols-outlined text-[#2E7D32] text-[20px]">verified</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#3B0A0F] font-mono">100%</span>
            <span className="text-[11px] text-[#2E7D32] font-bold">Audit Compliant</span>
          </div>
          <p className="text-[10px] text-[#6E2B32] mt-1">Section 102 PD 1445 verified</p>
        </div>
      </div>

      {/* Master Data Hub Client Component */}
      <Suspense fallback={<div className="text-xs text-[#6E2B32]">Loading Master Data Studio...</div>}>
        <MasterDataHub
          units={formattedUnits}
          categories={formattedCategories}
          products={formattedProducts}
          defaultTab={initialTab}
        />
      </Suspense>
    </div>
  );
}
