import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PhysicalInventoryHubPage() {
  await getSession();

  const [sessions, allAssets, totalInspections] = await Promise.all([
    prisma.physicalCountSession.findMany({
      include: {
        entries: {
          include: { asset: true },
        },
      },
      orderBy: { startedAt: "desc" },
    }),
    prisma.asset.findMany({ where: { isDeleted: false } }),
    prisma.inspection.count(),
  ]);

  const activeSession = sessions.find((s) => s.status === "ACTIVE") || sessions[0];
  const totalAssetsCount = allAssets.length;
  const verifiedCount = activeSession ? activeSession.entries.length : 0;
  const verifiedPercent = totalAssetsCount > 0 ? Math.round((verifiedCount / totalAssetsCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#FFF4E0] text-[#A60212] border border-[#A60212] px-2 py-0.5 rounded text-[11px] font-bold font-mono">
              BULSU INVENTORY SYSTEM
            </span>
            <span className="bg-[#FFF4E0] text-[#6E2B32] border border-[#EBD3B2] px-2 py-0.5 rounded text-[11px] font-mono">
              COA CIRCULAR 2020-006 AUDIT DESK
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Physical Inventory &amp; Asset Verification
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-0.5">
            Conduct annual and periodic physical inventory counts, verify in-place asset tags, and monitor count reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/physical-inventory/sessions/current"
            className="h-10 px-4 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-2 border border-[#A60212] transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">play_circle</span>
            <span>Enter Live Audit Session</span>
          </Link>
        </div>
      </div>

      {/* Active Session Highlight Card */}
      {activeSession && (
        <div className="bg-[#3B0A0F] border border-[#4E1117] rounded p-6 text-[#FFF4E0] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#F5AB29] text-[#3B0A0F] text-[10px] font-black px-2 py-0.5 rounded uppercase">
                  ACTIVE COUNT SESSION
                </span>
                <span className="text-xs font-mono font-bold text-[#F5AB29]">
                  FY {activeSession.fiscalYear}
                </span>
              </div>
              <h2 className="text-xl font-black text-[#FFF4E0] mt-1">{activeSession.title}</h2>
              <p className="text-xs text-[#EBD3B2]">
                Started on {formatDate(activeSession.startedAt)} • Supervised by BulSU AMO Inventory Team
              </p>
            </div>

            <Link
              href="/inventory/scanner"
              className="h-9 px-4 rounded bg-[#F5AB29] hover:bg-[#e09b20] text-[#3B0A0F] font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm self-start"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span>Scan Next Tag</span>
            </Link>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Overall Campus Count Progress</span>
              <span className="font-mono text-[#F5AB29]">{verifiedPercent}% Completed</span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#240508] border border-[#4E1117] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#A60212] to-[#F5AB29] transition-all duration-500"
                style={{ width: `${verifiedPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#EBD3B2] font-mono">
              <span>{verifiedCount} Verified in Place</span>
              <span>{totalAssetsCount - verifiedCount} Uncounted</span>
            </div>
          </div>
        </div>
      )}

      {/* 3 Navigational Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/physical-inventory/sessions/current"
          className="bg-[#FFFFFF] border-2 border-[#EBD3B2] hover:border-[#A60212] p-5 rounded transition-all group shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">fact_check</span>
            </div>
            <h3 className="text-base font-extrabold text-[#3B0A0F] group-hover:text-[#A60212] transition-colors">
              Physical Count Sessions
            </h3>
            <p className="text-xs text-[#6E2B32] mt-1 leading-relaxed">
              Access the active live session ledger, verify items room-by-room, record relocated equipment, and review unaccounted cards.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#EBD3B2] flex items-center justify-between text-xs font-bold text-[#A60212]">
            <span>View Active Session</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </div>
        </Link>

        <Link
          href="/physical-inventory/inspections"
          className="bg-[#FFFFFF] border-2 border-[#EBD3B2] hover:border-[#A60212] p-5 rounded transition-all group shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">schedule</span>
            </div>
            <h3 className="text-base font-extrabold text-[#3B0A0F] group-hover:text-[#A60212] transition-colors">
              Inspection Records
            </h3>
            <p className="text-xs text-[#6E2B32] mt-1 leading-relaxed">
              Official Inspection and Acceptance Report (IAR) logging for newly received assets, periodic condition evaluations, and repairs.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#EBD3B2] flex items-center justify-between text-xs font-bold text-[#A60212]">
            <span>{totalInspections} Recorded Inspections</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </div>
        </Link>

        <Link
          href="/physical-inventory/other"
          className="bg-[#FFFFFF] border-2 border-[#EBD3B2] hover:border-[#A60212] p-5 rounded transition-all group shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">inventory</span>
            </div>
            <h3 className="text-base font-extrabold text-[#3B0A0F] group-hover:text-[#A60212] transition-colors">
              Other &amp; Discrepancy Desk
            </h3>
            <p className="text-xs text-[#6E2B32] mt-1 leading-relaxed">
              Handle unrecorded items found during physical count, damaged property tags needing re-issuance, and surplus salvage items.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#EBD3B2] flex items-center justify-between text-xs font-bold text-[#A60212]">
            <span>Open Discrepancy Desk</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </div>
        </Link>
      </div>

      {/* Historical Sessions Table */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded shadow-sm overflow-hidden">
        <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">history</span>
            <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
              Annual &amp; Semestral Count Sessions
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FFF4E0] text-[#3B0A0F] border-b border-[#EBD3B2] font-black uppercase text-[11px]">
                <th className="py-2.5 px-3">Fiscal Year</th>
                <th className="py-2.5 px-3">Session Title</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Date Commenced</th>
                <th className="py-2.5 px-3">Entries Counted</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBD3B2]">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-[#FFF4E0]/40 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-[#A60212]">{s.fiscalYear}</td>
                  <td className="py-3 px-3 font-bold text-[#3B0A0F]">{s.title}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        s.status === "ACTIVE"
                          ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
                          : "bg-[#FFF4E0] text-[#6E2B32] border border-[#EBD3B2]"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>{s.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#6E2B32] font-mono">{formatDate(s.startedAt)}</td>
                  <td className="py-3 px-3 font-mono font-bold text-[#3B0A0F]">
                    {s.entries.length} assets
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link
                      href={`/physical-inventory/sessions/${s.id}`}
                      className="h-7 px-2.5 rounded bg-[#FFF4E0] hover:bg-[#EBD3B2] text-[#3B0A0F] font-bold text-xs inline-flex items-center gap-1 border border-[#EBD3B2]"
                    >
                      <span>Open Count</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
