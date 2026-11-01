import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { MissingBoard, MissingIncident } from "@/components/missing/missing-board";
import { IncidentFilingModal } from "@/components/missing/incident-filing-modal";
import { formatCurrency } from "@/lib/utils";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MissingDeskPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const canManage = ["ADMIN", "STAFF"].includes(user.role);
  const canFile = canManage || user.role === "CUSTODIAN";
  const officeScope = user.role === "CUSTODIAN" ? { unitId: user.unitId ?? "" } : {};

  const [reportsRaw, availableAssets] = await Promise.all([
    prisma.missingReport.findMany({
      where: { asset: { isDeleted: false, ...officeScope } },
      include: {
        asset: { include: { unit: true } },
        reportedBy: true,
      },
      orderBy: { reportedAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { isDeleted: false, ...officeScope, status: { in: ["IN_USE", "IN_STORAGE", "UNDER_REPAIR", "MISSING"] }, missingReports: { none: { status: { in: ["REPORTED", "UNDER_INVESTIGATION"] } } } },
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

  // Status-only losses from the former dossier shortcut must remain visible
  // while an authorized user supplies the missing incident details.
  for (const asset of availableAssets.filter(a => a.status === "MISSING")) {
    incidents.unshift({
      id: `unfiled-${asset.id}`, assetId: asset.id, propertyNo: asset.propertyNo,
      assetName: asset.name, unitCode: asset.unit.code, unitName: asset.unit.name,
      cost: asset.acquisitionCost, reportedByName: "Incident details pending",
      lastSeenDate: asset.updatedAt, locationLastSeen: "Last-seen location not recorded",
      circumstances: "", status: "REPORTED", needsFiling: true,
    });
  }

  const totalValue = incidents.reduce((sum, i) => sum + i.cost, 0);
  const activeCount = incidents.filter(
    (i) => i.status === "REPORTED" || i.status === "UNDER_INVESTIGATION"
  ).length;
  const blotterCount = incidents.filter((i) => Boolean(i.policeBlotterUrl)).length;

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="bg-[#FFFFFF] border border-border p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Missing Property Investigation Desk
          </h1>
        </div>

        <div>
          {canFile && <IncidentFilingModal
            assets={availableAssets.map((a) => ({
              id: a.id,
              propertyNo: a.propertyNo,
              name: a.name,
              unitCode: a.unit.code,
            }))}
          />}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
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

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Total Incident Value
            </span>
            <span className="text-2xl font-black text-[#A60212] font-mono mt-0.5 block">
              {formatCurrency(totalValue)}
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Police / Blotter Filings
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {blotterCount} <span className="text-xs font-normal text-[#6E2B32]">Transmitted</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-[#D97B1A] text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">local_police</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              COA Relief Rule
            </span>
            <span className="text-xs text-[#3B0A0F] font-medium leading-relaxed block mt-1">
              90-day unrecovered cases escalate to Legal Disposal Condemnation.
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#3B0A0F] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">gavel</span>
          </div>
        </div>
      </div>

      {/* 4-Stage Kanban Board */}
      <MissingBoard incidents={incidents} canManage={canManage} canFile={canFile} />
    </div>
  );
}
