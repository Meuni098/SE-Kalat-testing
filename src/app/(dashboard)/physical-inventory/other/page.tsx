import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PhysicalInventoryOtherPage() {
  await getSession();

  const [relocatedEntries, unserviceableAssets, missingReports] = await Promise.all([
    prisma.physicalCountEntry.findMany({
      where: { foundStatus: "RELOCATED" },
      include: {
        asset: {
          include: { unit: true, category: true, accountablePerson: true },
        },
        session: true,
      },
      orderBy: { countedAt: "desc" },
    }),
    prisma.asset.findMany({
      where: {
        isDeleted: false,
        OR: [{ condition: "UNSERVICEABLE" }, { status: "FOR_DISPOSAL" }],
      },
      include: { unit: true, category: true },
      orderBy: { acquisitionCost: "desc" },
    }),
    prisma.missingReport.findMany({
      where: { status: { in: ["REPORTED", "UNDER_INVESTIGATION"] } },
      include: { asset: { include: { unit: true } } },
    }),
  ]);

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-border p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Physical Inventory &quot;Other&quot; Desk
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/inventory/scanner"
            className="h-10 px-4 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-2 border border-[#A60212] transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            <span>Scan Tag to Reconcile</span>
          </Link>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Relocated Discrepancies
            </span>
            <span className="text-2xl font-black text-[#A60212] font-mono mt-0.5 block">
              {relocatedEntries.length}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">Found off-site</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">wrong_location</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Unserviceable Scrap Staged
            </span>
            <span className="text-2xl font-black text-[#D97B1A] font-mono mt-0.5 block">
              {unserviceableAssets.length}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">For Disposal</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Active Investigations
            </span>
            <span className="text-2xl font-black text-[#C62828] font-mono mt-0.5 block">
              {missingReports.length}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">Missing notices</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#C62828] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">assignment_late</span>
          </div>
        </div>
      </div>

      {/* Section 1: Relocated Equipment Table */}
      <div className="bg-[#FFFFFF] border border-border rounded shadow-sm overflow-hidden">
        <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">
              wrong_location
            </span>
            <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
              Relocated Equipment (Scanned Outside Designated Unit)
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded border badge-solid badge-amber">
            {relocatedEntries.length} Items Flagged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-cream text-[#3B0A0F] border-b border-border font-black uppercase text-[11px]">
                <th className="py-2.5 px-3">Date Scanned</th>
                <th className="py-2.5 px-3">Property No. &amp; Item</th>
                <th className="py-2.5 px-3">Official Assigned Unit</th>
                <th className="py-2.5 px-3">Physical Location Discovered</th>
                <th className="py-2.5 px-3">Auditor Notes</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {relocatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#6E2B32] font-medium">
                    No relocated equipment discrepancies currently open.
                  </td>
                </tr>
              ) : (
                relocatedEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-cream transition-colors">
                    <td className="py-3 px-3 font-mono text-[11px] text-[#3B0A0F]">
                      {formatDate(e.countedAt)}
                    </td>
                    <td className="py-3 px-3">
                      <Link
                        href={`/inventory/${e.asset.id}`}
                        className="font-mono font-bold text-[#A60212] hover:underline block"
                      >
                        {e.asset.propertyNo}
                      </Link>
                      <span className="text-xs text-[#3B0A0F] font-medium block truncate max-w-[200px]">
                        {e.asset.name}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-[#3B0A0F]">{e.asset.unit.code}</td>
                    <td className="py-3 px-3 font-bold text-[#A60212]">
                      {e.scannedLocation || "Off-unit"}
                    </td>
                    <td className="py-3 px-3 text-[#6E2B32] italic max-w-[200px] truncate">
                      {e.remarks || "Found during physical sweep"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/inventory/transfers?propertyNo=${e.asset.propertyNo}`}
                        className="h-7 px-2.5 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-[11px] inline-flex items-center gap-1 shadow-sm"
                      >
                        <span>Reassign Unit</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Unserviceable Salvage Items Table */}
      <div className="bg-[#FFFFFF] border border-border rounded shadow-sm overflow-hidden">
        <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">
              delete_sweep
            </span>
            <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
              Unserviceable &amp; Condemned Assets Staged for Salvage / IIRUP
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded border badge-solid badge-amber">
            {unserviceableAssets.length} Assets
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-cream text-[#3B0A0F] border-b border-border font-black uppercase text-[11px]">
                <th className="py-2.5 px-3">Property No.</th>
                <th className="py-2.5 px-3">Asset Title &amp; Category</th>
                <th className="py-2.5 px-3">Holding Unit</th>
                <th className="py-2.5 px-3">Acquisition Cost</th>
                <th className="py-2.5 px-3">Condition Status</th>
                <th className="py-2.5 px-3 text-right">Disposal Routing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {unserviceableAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#6E2B32] font-medium">
                    No unserviceable scrap assets currently awaiting disposal docket.
                  </td>
                </tr>
              ) : (
                unserviceableAssets.map((a) => (
                  <tr key={a.id} className="hover:bg-cream transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#A60212]">
                      <Link href={`/inventory/${a.id}`} className="hover:underline">
                        {a.propertyNo}
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-[#3B0A0F] block truncate max-w-[220px]">
                        {a.name}
                      </span>
                      <span className="text-[10px] text-[#6E2B32] font-semibold">
                        {a.category.name}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-[#3B0A0F]">{a.unit.code}</td>
                    <td className="py-3 px-3 font-mono text-[#3B0A0F]">
                      {formatCurrency(a.acquisitionCost)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="border px-2 py-0.5 rounded text-[10px] font-bold uppercase badge-solid badge-crimson">
                        {a.condition}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href="/disposal"
                        className="h-7 px-2.5 rounded bg-cream hover:bg-sand text-[#3B0A0F] font-bold text-[11px] inline-flex items-center gap-1 border border-border"
                      >
                        <span className="material-symbols-outlined text-[14px]">gavel</span>
                        <span>Route to IIRUP</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
