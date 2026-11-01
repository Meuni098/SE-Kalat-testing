import { actualProductDescription, productDescriptionInclude } from "@/lib/product-description";
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
  const user = await getSession();
  const canRequestTransfer = ["ADMIN", "STAFF", "CUSTODIAN"].includes(user?.role ?? "");

  // Query assets deployed in academic colleges or satellite departments
  const [transferredRaw, colleges, allUnits, amoCount, totalCount] =
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
          ...productDescriptionInclude,
          category: true,
          unit: true,
          accountablePerson: true,
          returnRequests: { where: { status: "PENDING" }, select: { id: true } },
          transferRequests: {
            where: { status: { in: ["APPROVED", "PENDING"] } },
            include: { fromUnit: true },
            orderBy: { decidedAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.unit.findMany({
        where: { isActive: true, unitType: "ACADEMIC" },
        orderBy: { code: "asc" },
      }),
      prisma.unit.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
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
    const lastTransfer = a.transferRequests.find((transfer) => transfer.status === "APPROVED");
    const transferDate = lastTransfer?.decidedAt || lastTransfer?.requestedAt || a.acquisitionDate;
    const ptrNumber = lastTransfer
      ? `PTR-BULSU-${lastTransfer.id.substring(0, 8).toUpperCase()}`
      : "PTR-INITIAL-ALLOC";

    return {
      id: a.id,
      unitId: a.unitId,
      canTransfer: canRequestTransfer && (user?.role !== "CUSTODIAN" || user.unitId === a.unitId) && ["IN_USE", "IN_STORAGE", "UNDER_REPAIR"].includes(a.status) && !a.transferRequests.some((transfer) => transfer.status === "PENDING") && a.returnRequests.length === 0,
      propertyNo: a.propertyNo,
      name: a.name,
      description: actualProductDescription(a),
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

  const modalAssets = assetRows.filter((a) => a.canTransfer).map((a) => ({
    id: a.id,
    propertyNo: a.propertyNo,
    name: a.name,
    unitId: a.unitId,
    unitCode: a.unitCode,
    currentCustodian: a.accountablePerson || "College Custodian",
  }));

  return (
    <div className="space-y-5 pb-16 select-none">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] p-5 border border-border rounded shadow-xs">
        <div>

          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            College-Transferred Asset Registry
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/reports/transfers"
            className="bg-[#FFFFFF] text-[#3B0A0F] border border-border hover:bg-cream px-3.5 py-2 text-xs font-bold rounded flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#A60212]">receipt_long</span>
            <span>Transfer Reports Studio</span>
          </Link>

          {canRequestTransfer && <NewTransferModal
            assets={modalAssets}
            units={allUnits}
          />}
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
      />
    </div>
  );
}
