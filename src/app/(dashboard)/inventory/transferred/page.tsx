import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { CustodySegregationKpi } from "@/components/inventory/custody-segregation-kpi";
import {
  CollegeTransferredTable,
  TransferredAssetRow,
} from "@/components/inventory/college-transferred-table";
import { InventoryNavTabs } from "@/components/inventory/inventory-nav-tabs";
import { NewTransferModal } from "@/components/inventory/new-transfer-modal";

export const dynamic = "force-dynamic";

export default async function CollegeTransferredPage() {
  await getSession();

  // Query assets deployed in academic colleges or satellite departments
  const [transferredRaw, colleges, allUnits, persons, amoCount, totalCount] =
    await Promise.all([
      prisma.asset.findMany({
        where: {
          isDeleted: false,
          status: { not: "DISPOSED" },
          unit: {
            unitType: "ACADEMIC",
          },
        },
        include: {
          category: true,
          unit: true,
          accountablePerson: true,
          transferRequests: {
            where: { status: "APPROVED" },
            include: { fromUnit: true },
            orderBy: { decidedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.unit.findMany({
        where: { isActive: true, unitType: "ACADEMIC" },
        orderBy: { code: "asc" },
      }),
      prisma.unit.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
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
        where: { isDeleted: false, status: { not: "DISPOSED" } },
      }),
    ]);

  const assetRows: TransferredAssetRow[] = transferredRaw.map((a) => {
    const lastTransfer = a.transferRequests[0];
    const transferDate = lastTransfer?.decidedAt || lastTransfer?.requestedAt || a.acquisitionDate;
    const ptrNumber = lastTransfer
      ? `PTR-BULSU-${lastTransfer.id.substring(0, 8).toUpperCase()}`
      : "PTR-INITIAL-ALLOC";

    return {
      id: a.id,
      propertyNo: a.propertyNo,
      name: a.name,
      description: a.description,
      classification: a.classification,
      categoryName: a.category.name,
      unitCode: a.unit.code,
      unitName: a.unit.name,
      accountablePerson: a.accountablePerson?.fullName || null,
      accountablePersonPosition: a.accountablePerson?.position || null,
      acquisitionCost: a.acquisitionCost,
      transferredAt: transferDate,
      ptrNumber,
      status: a.status,
      condition: a.condition,
      serialNo: a.serialNo,
      originUnitCode: lastTransfer?.fromUnit?.code || "AMO",
    };
  });

  const totalValue = assetRows.reduce((sum, a) => sum + a.acquisitionCost, 0);
  const activeColleges = Array.from(new Set(assetRows.map((a) => a.unitCode))).length;

  const modalAssets = assetRows.map((a) => ({
    id: a.id,
    propertyNo: a.propertyNo,
    name: a.name,
    unitId: colleges.find((u) => u.code === a.unitCode)?.id || "",
    unitCode: a.unitCode,
    currentCustodian: a.accountablePerson || "College Custodian",
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
              INTER-COLLEGE ALLOCATION
            </span>
            <span className="bg-[#FFF4E0] text-[#6E2B32] border border-[#EBD3B2] px-2 py-0.5 rounded text-[11px] font-mono">
              PROPERTY TRANSFER REPORT (PTR)
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            College-Transferred Asset Registry
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-0.5">
            Official university tracking ledger for assets transferred from AMO and currently deployed in academic colleges, laboratories, and departments
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/reports/transfers"
            className="bg-[#FFFFFF] text-[#3B0A0F] border border-[#EBD3B2] hover:bg-[#FFF4E0] px-3.5 py-2 text-xs font-bold rounded flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#A60212]">receipt_long</span>
            <span>Transfer Reports Studio</span>
          </Link>

          <NewTransferModal
            assets={modalAssets}
            units={allUnits}
            persons={modalPersons}
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <InventoryNavTabs
        amoCount={amoCount}
        transferredCount={assetRows.length}
        totalCount={totalCount}
      />

      {/* KPI Overview */}
      <CustodySegregationKpi
        mode="COLLEGE_TRANSFERRED"
        totalCount={assetRows.length}
        totalValue={totalValue}
        activeCollegesCount={activeColleges}
        recentTransfersCount={assetRows.length}
      />

      {/* Interactive Table with College Filter and Transfer History Drawer */}
      <CollegeTransferredTable
        assets={assetRows}
        colleges={colleges}
        allUnits={allUnits}
        persons={persons}
      />
    </div>
  );
}
