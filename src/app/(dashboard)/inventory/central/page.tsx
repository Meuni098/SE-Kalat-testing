import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { CustodySegregationKpi } from "@/components/inventory/custody-segregation-kpi";
import { AmoCentralTable, AmoCentralAssetRow } from "@/components/inventory/amo-central-table";
import { InventoryNavTabs } from "@/components/inventory/inventory-nav-tabs";
import { NewTransferModal } from "@/components/inventory/new-transfer-modal";

export const dynamic = "force-dynamic";

export default async function AmoCentralHoldingsPage() {
  await getSession();

  // Query in-house assets: unit code AMO or STORAGE/AUXILIARY/ADMINISTRATIVE
  const [inHouseRaw, allUnits, categories, persons, transferredCount, totalCount] =
    await Promise.all([
      prisma.asset.findMany({
        where: {
          isDeleted: false,
          status: { not: "DISPOSED" },
          OR: [
            { unit: { code: "AMO" } },
            { unit: { code: "STORAGE" } },
            { unit: { unitType: { in: ["ADMINISTRATIVE", "AUXILIARY"] } } },
          ],
        },
        include: {
          category: true,
          unit: true,
          accountablePerson: true,
          transferRequests: {
            where: { status: "PENDING" },
            include: { toUnit: true },
          },
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
          unit: { unitType: "ACADEMIC" },
        },
      }),
      prisma.asset.count({
        where: { isDeleted: false, status: { not: "DISPOSED" } },
      }),
    ]);

  const assetRows: AmoCentralAssetRow[] = inHouseRaw.map((a) => {
    const pendingTr = a.transferRequests[0];
    return {
      id: a.id,
      propertyNo: a.propertyNo,
      name: a.name,
      description: a.description,
      classification: a.classification,
      categoryName: a.category.name,
      acquisitionCost: a.acquisitionCost,
      acquisitionDate: a.acquisitionDate,
      status: a.status,
      condition: a.condition,
      serialNo: a.serialNo,
      hasPendingTransfer: Boolean(pendingTr),
      pendingTransferId: pendingTr?.id || null,
      pendingToUnitCode: pendingTr?.toUnit?.code || null,
      pendingPtrNo: pendingTr ? `PTR-${pendingTr.id.substring(0, 8).toUpperCase()}` : null,
    };
  });

  const totalValue = assetRows.reduce((sum, a) => sum + a.acquisitionCost, 0);
  const pendingCount = assetRows.filter((a) => a.hasPendingTransfer).length;
  const readyCount = assetRows.length - pendingCount;

  const modalAssets = assetRows
    .filter((a) => !a.hasPendingTransfer)
    .map((a) => ({
      id: a.id,
      propertyNo: a.propertyNo,
      name: a.name,
      unitId: allUnits.find((u) => u.code === "AMO")?.id || "",
      unitCode: "AMO",
      currentCustodian: "AMO Central Property Storage",
    }));

  const modalPersons = persons.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    position: p.position,
    unitId: p.unitId,
  }));

  return (
    <div className="space-y-5 pb-16 select-none">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] p-5 border border-[#EBD3B2] rounded shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#FFF4E0] text-[#A60212] border border-[#A60212] px-2 py-0.5 rounded text-[11px] font-bold font-mono">
              AMO CENTRAL WAREHOUSE
            </span>
            <span className="bg-[#FFF4E0] text-[#6E2B32] border border-[#EBD3B2] px-2 py-0.5 rounded text-[11px] font-mono">
              IN-HOUSE STAGING LEDGER
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            AMO Central Holdings (In-House Inventory)
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-0.5">
            Registry of all newly delivered, inspected, and warehouse-held assets currently under AMO custody awaiting transfer to colleges
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/intake"
            className="bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] px-3.5 py-2 text-xs font-bold rounded flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">local_shipping</span>
            <span>Log Delivery Intake</span>
          </Link>

          <Link
            href="/inventory/generate-qr"
            className="bg-[#FFFFFF] text-[#3B0A0F] border border-[#EBD3B2] hover:bg-[#FFF4E0] px-3.5 py-2 text-xs font-bold rounded flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#D97B1A]">print</span>
            <span>Batch QR Labels</span>
          </Link>

          <NewTransferModal
            assets={modalAssets}
            units={allUnits.filter((u) => u.code !== "AMO")}
            persons={modalPersons}
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <InventoryNavTabs
        amoCount={assetRows.length}
        transferredCount={transferredCount}
        totalCount={totalCount}
      />

      {/* KPI Overview */}
      <CustodySegregationKpi
        mode="AMO_CENTRAL"
        totalCount={assetRows.length}
        totalValue={totalValue}
        readyForDispatchCount={readyCount}
        pendingTransferCount={pendingCount}
      />

      {/* Interactive Table */}
      <AmoCentralTable
        assets={assetRows}
        units={allUnits}
        persons={persons}
      />
    </div>
  );
}
