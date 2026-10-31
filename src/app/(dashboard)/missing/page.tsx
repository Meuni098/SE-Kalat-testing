import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { MissingBoard, MissingIncident } from "@/components/missing/missing-board";
import { IncidentFilingModal } from "@/components/missing/incident-filing-modal";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MissingDeskPage() {
  await getSession();

  const [reportsRaw, availableAssets] = await Promise.all([
    prisma.missingReport.findMany({
      include: {
        asset: { include: { unit: true } },
        reportedBy: true,
      },
      orderBy: { reportedAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { isDeleted: false, status: { not: "MISSING" } },
      include: { unit: true },
      orderBy: { propertyNo: "asc" },
    }),
  ]);

  const incidents: MissingIncident[] = reportsRaw.map((r) => ({
    id: r.id,
    assetId: r.asset.id,
    propertyNo: r.asset.propertyNo,
    assetName: r.asset.name,
    unitCode: r.asset.unit.code,
    unitName: r.asset.unit.name,
    cost: r.asset.acquisitionCost,
    reportedByName: r.reportedBy.name,
    lastSeenDate: r.lastSeenDate,
    locationLastSeen: r.locationLastSeen,
    circumstances: r.circumstances,
    policeBlotterUrl: r.policeBlotterUrl,
    status: r.status as MissingIncident["status"],
  }));

  const totalValue = incidents.reduce((sum, i) => sum + i.cost, 0);
  const activeCount = incidents.filter(
    (i) => i.status === "REPORTED" || i.status === "UNDER_INVESTIGATION"
  ).length;
  const blotterCount = incidents.filter((i) => Boolean(i.policeBlotterUrl)).length;

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#FEE2E2] text-[#A60212] border border-[#FECACA] px-2 py-0.5 rounded text-[11px] font-bold font-mono">
              COA COMPLIANCE DESK
            </span>
            <span className="bg-[#FFF4E0] text-[#6E2B32] border border-[#EBD3B2] px-2 py-0.5 rounded text-[11px] font-mono">
              SEC 89 PD 1445 VERIFICATION
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Missing Property Investigation Desk
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-0.5">
            Official university incident logs, police blotters, and COA relief of accountability tracking
          </p>
        </div>

        <div>
          <IncidentFilingModal
            assets={availableAssets.map((a) => ({
              id: a.id,
              propertyNo: a.propertyNo,
              name: a.name,
              unitCode: a.unit.code,
            }))}
          />
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Active Incidents
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {activeCount} <span className="text-xs font-normal text-[#6E2B32]">Cases Open</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FEE2E2] border border-[#FECACA] text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">warning</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Total Incident Value
            </span>
            <span className="text-2xl font-black text-[#A60212] font-mono mt-0.5 block">
              {formatCurrency(totalValue)}
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Police / Blotter Filings
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {blotterCount} <span className="text-xs font-normal text-[#6E2B32]">Transmitted</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#D97B1A] text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">local_police</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              COA Relief Rule
            </span>
            <span className="text-xs text-[#3B0A0F] font-medium leading-relaxed block mt-1">
              90-day unrecovered cases escalate to Legal Disposal Condemnation.
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#3B0A0F] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">gavel</span>
          </div>
        </div>
      </div>

      {/* 4-Stage Kanban Board */}
      <MissingBoard incidents={incidents} />
    </div>
  );
}
