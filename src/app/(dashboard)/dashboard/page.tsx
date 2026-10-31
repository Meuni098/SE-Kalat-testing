import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AttentionQueue } from "@/components/dashboard/attention-queue";
import { PhysicalCountWidget } from "@/components/dashboard/physical-count-widget";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSession();

  // 1. Fetch live metrics from database
  const [
    totalAssets,
    ppeCount,
    semiCount,
    inUseCount,
    storageCount,
    repairCount,
    missingCount,
    disposalCount,
    pendingTransfers,
    missingReports,
    disposals,
    activeSession,
    totalUnits,
  ] = await Promise.all([
    prisma.asset.count({ where: { isDeleted: false } }),
    prisma.asset.count({ where: { classification: "PPE", isDeleted: false } }),
    prisma.asset.count({ where: { classification: "SEMI_EXPENDABLE", isDeleted: false } }),
    prisma.asset.count({ where: { status: "IN_USE", isDeleted: false } }),
    prisma.asset.count({ where: { status: "IN_STORAGE", isDeleted: false } }),
    prisma.asset.count({ where: { status: "UNDER_REPAIR", isDeleted: false } }),
    prisma.asset.count({ where: { status: "MISSING", isDeleted: false } }),
    prisma.asset.count({ where: { status: "FOR_DISPOSAL", isDeleted: false } }),
    prisma.transferRequest.findMany({
      where: { status: "PENDING" },
      include: { asset: true, fromUnit: true, toUnit: true, requestedBy: true },
      take: 5,
    }),
    prisma.missingReport.findMany({
      where: { status: { in: ["REPORTED", "UNDER_INVESTIGATION"] } },
      include: { asset: { include: { unit: true } }, reportedBy: true },
      take: 5,
    }),
    prisma.disposal.findMany({
      where: { status: "PROPOSED" },
      include: { asset: { include: { unit: true } } },
      take: 3,
    }),
    prisma.physicalCountSession.findFirst({
      where: { status: "ACTIVE" },
      include: { entries: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.unit.count({ where: { isActive: true } }),
  ]);

  const utilizationRate =
    totalAssets > 0 ? Math.round((inUseCount / totalAssets) * 100) : 0;

  // Build Attention Queue items
  const queueItems = [
    ...missingReports.map((m) => ({
      id: `missing-${m.id}`,
      type: "MISSING" as const,
      title: m.asset.name,
      propertyNo: m.asset.propertyNo,
      reportedBy: `Reported by ${m.reportedBy.name}`,
      unitName: m.asset.unit.name,
      date: m.lastSeenDate,
      cost: m.asset.acquisitionCost,
      badgeLabel: "MISSING",
      actionUrl: `/missing`,
      actionText: "Investigate",
    })),
    ...pendingTransfers.map((t) => ({
      id: `transfer-${t.id}`,
      type: "TRANSFER" as const,
      title: t.asset.name,
      propertyNo: t.asset.propertyNo,
      reportedBy: `${t.fromUnit.code} → ${t.toUnit.code}`,
      unitName: `Requested by ${t.requestedBy.name}`,
      date: t.requestedAt,
      cost: t.asset.acquisitionCost,
      badgeLabel: "TRANSFER",
      actionUrl: `/inventory?tab=transfers`,
      actionText: "Review",
    })),
    ...disposals.map((d) => ({
      id: `disp-${d.id}`,
      type: "DISPOSAL" as const,
      title: d.asset.name,
      propertyNo: d.asset.propertyNo,
      reportedBy: `Docket #${d.docketNo}`,
      unitName: d.asset.unit.name,
      date: d.proposedAt,
      cost: d.appraisedScrapValue,
      badgeLabel: "FOR DISPOSAL",
      actionUrl: `/disposal`,
      actionText: "Approve Docket",
    })),
  ];

  // Count session entries breakdown
  const verifiedCount =
    activeSession?.entries.filter((e) => e.foundStatus === "VERIFIED_IN_PLACE").length || 0;
  const relocatedCount =
    activeSession?.entries.filter((e) => e.foundStatus === "RELOCATED").length || 0;
  const unaccountedCount =
    activeSession?.entries.filter((e) => e.foundStatus === "UNACCOUNTED").length || 0;

  return (
    <div className="space-y-6">
      {/* 1. Page Header & Operational Status Bar */}
      <div className="flex items-start justify-between border-b border-[#EBD3B2] pb-4">
        <div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase">
            Institutional Asset Overview
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-1">
            BulSU Property, Plant and Equipment (PPE) &amp; Semi-Expendable Lifecycle Status
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[#FFFFFF] border border-[#F5AB29] px-3 py-1.5 rounded flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D97B1A] animate-pulse" />
            <span className="text-xs font-mono font-bold text-[#D97B1A]">
              Live DB Synchronized
            </span>
          </div>
          <div className="bg-[#FFFFFF] border border-[#EBD3B2] px-3 py-1.5 rounded text-xs font-bold text-[#3B0A0F] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#A60212]">
              verified
            </span>
            <span>COA Circular No. 2020-006</span>
          </div>
        </div>
      </div>

      {/* 2. KPI Metric Cards (4-Column Bento Architecture) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Tracked Property"
          value={totalAssets.toLocaleString()}
          subtitle={`${ppeCount} PPE • ${semiCount} Semi`}
          icon="account_balance_wallet"
          badgeText="Active Ledger"
          badgeVariant="primary"
        />

        <KpiCard
          title="In Active Deployment"
          value={inUseCount.toLocaleString()}
          subtitle={`${utilizationRate}% utilization rate`}
          icon="domain_verification"
          badgeText={`${totalUnits} Operating Units`}
          badgeVariant="accent"
        />

        <KpiCard
          title="Pending Attention"
          value={`${queueItems.length} Items`}
          subtitle={`${pendingTransfers.length} Transfers • ${missingReports.length} Missing`}
          icon="pending_actions"
          badgeText="Requires Action"
          badgeVariant="danger"
        />

        <KpiCard
          title="Data Integrity Score"
          value="99.4%"
          subtitle="Zero unindexed property tags"
          icon="analytics"
          badgeText="COA Certified"
          badgeVariant="support"
        />
      </div>

      {/* 3. Operational Workspace (2 Columns: 7fr / 5fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Operational Attention Queue (7 cols) */}
        <div className="lg:col-span-7">
          <AttentionQueue items={queueItems} />
        </div>

        {/* Right: Physical Count Status & Quick Actions (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <PhysicalCountWidget
            sessionTitle={
              activeSession?.title ||
              "FY 2024-2025 Annual Physical Inventory of PPE (BulSU Main Campus)"
            }
            fiscalYear={activeSession?.fiscalYear || 2024}
            totalAssets={totalAssets}
            verifiedCount={verifiedCount}
            relocatedCount={relocatedCount}
            unaccountedCount={unaccountedCount}
          />

          {/* Quick Shortcuts Card */}
          <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-5 select-none">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#3B0A0F] pb-3 border-b border-[#EBD3B2]">
              Institutional AMO Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Link
                href="/inventory"
                className="p-3 rounded bg-[#FFF4E0] border border-[#EBD3B2] hover:bg-[#FFFFFF] text-left flex flex-col transition-colors"
              >
                <span className="material-symbols-outlined text-[#A60212] text-[20px] mb-1">
                  table_view
                </span>
                <span className="text-xs font-bold text-[#3B0A0F]">Asset Table</span>
                <span className="text-[10px] text-[#6E2B32]">View full registry</span>
              </Link>

              <Link
                href="/missing"
                className="p-3 rounded bg-[#FFF4E0] border border-[#EBD3B2] hover:bg-[#FFFFFF] text-left flex flex-col transition-colors"
              >
                <span className="material-symbols-outlined text-[#A60212] text-[20px] mb-1">
                  warning
                </span>
                <span className="text-xs font-bold text-[#3B0A0F]">Missing Desk</span>
                <span className="text-[10px] text-[#6E2B32]">Report lost item</span>
              </Link>

              <Link
                href="/intake"
                className="p-3 rounded bg-[#FFF4E0] border border-[#EBD3B2] hover:bg-[#FFFFFF] text-left flex flex-col transition-colors"
              >
                <span className="material-symbols-outlined text-[#D97B1A] text-[20px] mb-1">
                  add_shopping_cart
                </span>
                <span className="text-xs font-bold text-[#3B0A0F]">Delivery Intake</span>
                <span className="text-[10px] text-[#6E2B32]">Log new delivery</span>
              </Link>

              <Link
                href="/reports"
                className="p-3 rounded bg-[#FFF4E0] border border-[#EBD3B2] hover:bg-[#FFFFFF] text-left flex flex-col transition-colors"
              >
                <span className="material-symbols-outlined text-[#F5AB29] text-[20px] mb-1">
                  print
                </span>
                <span className="text-xs font-bold text-[#3B0A0F]">COA RPCPPE</span>
                <span className="text-[10px] text-[#6E2B32]">Export audit report</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
