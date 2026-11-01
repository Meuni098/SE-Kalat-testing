import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { resolveDiscrepancyTransferAction } from "@/actions/audit-actions";

export const dynamic = "force-dynamic";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function PhysicalCountSessionPage({ params }: SessionPageProps) {
  await getSession();
  const { id } = await params;

  let session = null;
  if (id === "current") {
    session = await prisma.physicalCountSession.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
      include: {
        entries: {
          include: {
            asset: {
              include: { unit: true, accountablePerson: true },
            },
          },
          orderBy: { countedAt: "desc" },
        },
      },
    });
  } else {
    session = await prisma.physicalCountSession.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            asset: {
              include: { unit: true, accountablePerson: true },
            },
          },
          orderBy: { countedAt: "desc" },
        },
      },
    });
  }

  if (!session) {
    return <div className="rounded border border-border bg-white p-5"><h1 className="font-bold">No physical inventory session found</h1><p className="mt-2">Scan and verify an asset to start the current physical inventory session.</p><Link href="/inventory/scanner" className="mt-3 block underline">Open QR scanner</Link></div>;
  }

  const [allAssets, units] = await Promise.all([
    prisma.asset.findMany({
      where: { isDeleted: false },
      include: { unit: true, accountablePerson: true },
    }),
    prisma.unit.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const countedAssetIds = new Set(session.entries.map((e) => e.assetId));
  const uncountedAssets = allAssets.filter((a) => !countedAssetIds.has(a.id));

  const totalAssets = allAssets.length;
  const verifiedCount = session.entries.filter((e) => e.foundStatus === "VERIFIED_IN_PLACE").length;
  const relocatedCount = session.entries.filter((e) => e.foundStatus === "RELOCATED").length;
  const pendingCount = uncountedAssets.length;

  const verifiedPercent = totalAssets > 0 ? Math.round((verifiedCount / totalAssets) * 100) : 0;

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Session Active Banner (Solid Dark Maroon #3B0A0F) */}
      <div className="bg-[#3B0A0F] border border-[#4E1117] text-[#FFF4E0] p-6 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">

            <span className="text-[#F5AB29] text-xs font-mono font-bold">
              FY {session.fiscalYear} Annual Verification
            </span>
          </div>
          <h1 className="text-xl font-black text-[#FFF4E0] tracking-tight">
            {session.title}
          </h1>
          <p className="text-xs text-[#EBD3B2] mt-1">
            Started: {formatDate(session.startedAt)} • Supervised by AMO Inspection Committee
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/scan"
            className="px-4 py-2.5 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-2 border border-[#F5AB29] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            <span>Launch Field Scanner</span>
          </Link>
        </div>
      </div>

      {/* Progress Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase">Verified In Place</span>
            <span className="text-2xl font-black text-[#A60212] font-mono mt-0.5 block">
              {verifiedCount} <span className="text-xs font-normal text-[#6E2B32]">({verifiedPercent}%)</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase">Relocated Tags</span>
            <span className="text-2xl font-black text-[#D97B1A] font-mono mt-0.5 block">
              {relocatedCount} <span className="text-xs font-normal text-[#6E2B32]">Discrepancies</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-[#F5AB29] text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase">Pending Physical Scan</span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {pendingCount} <span className="text-xs font-normal text-[#6E2B32]">Remaining</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#3B0A0F] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">pending</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase">Total Universe</span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {totalAssets} <span className="text-xs font-normal text-[#6E2B32]">Active Assets</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#3B0A0F] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">domain</span>
          </div>
        </div>
      </div>

      {/* Discrepancy Auditing & Field Log Table */}
      <div className="bg-[#FFFFFF] border border-border rounded overflow-hidden">
        <div className="p-4 bg-cream border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#A60212] text-[20px]">
              checklist
            </span>
            <h2 className="text-sm font-bold text-[#3B0A0F] uppercase">
              Physical Verification Log &amp; Discrepancy Auditing
            </h2>
          </div>
          <span className="text-xs font-mono text-[#6E2B32]">
            {session.entries.length} Field Scans Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="h-9 bg-[#FFFFFF] border-b border-border text-[#3B0A0F] font-bold uppercase select-none">
                <th className="px-3.5 py-2 border-r border-border">Property Tag</th>
                <th className="px-3.5 py-2 border-r border-border">Asset Description</th>
                <th className="px-3.5 py-2 border-r border-border">Registered Unit</th>
                <th className="px-3.5 py-2 border-r border-border">Scanned Location</th>
                <th className="px-3.5 py-2 border-r border-border">Audit Finding</th>
                <th className="px-3.5 py-2 border-r border-border">Timestamp</th>
                <th className="px-3.5 py-2 text-center">Reconciliation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {session.entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#6E2B32]">
                    No field count entries logged yet. Open the Field Scanner to start recording
                    property presence.
                  </td>
                </tr>
              ) : (
                session.entries.map((entry) => {
                  const isVerified = entry.foundStatus === "VERIFIED_IN_PLACE";
                  const isRelocated = entry.foundStatus === "RELOCATED";

                  return (
                    <tr key={entry.id} className="hover:bg-cream transition-colors">
                      <td className="px-3.5 py-3 border-r border-border font-mono font-bold text-[#A60212]">
                        <Link href={`/inventory/${entry.asset.id}`} className="hover:underline">
                          {entry.asset.propertyNo}
                        </Link>
                      </td>

                      <td className="px-3.5 py-3 border-r border-border font-semibold text-[#3B0A0F]">
                        {entry.asset.name}
                      </td>

                      <td className="px-3.5 py-3 border-r border-border">
                        <div className="font-bold text-[#3B0A0F]">{entry.asset.unit.code}</div>
                        <div className="text-[10px] text-[#6E2B32]">
                          {entry.asset.accountablePerson?.fullName || "Unassigned"}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 border-r border-border font-mono">
                        {entry.scannedLocation || "Default Room"}
                      </td>

                      <td className="px-3.5 py-3 border-r border-border">
                        <span
                          className={` px-2 py-0.5 rounded text-[10px] font-bold border font-mono  badge-solid ${
                            isVerified
                              ? " badge-solid badge-maroon"
                              : isRelocated
                              ? " badge-solid badge-amber"
                              : " badge-solid badge-crimson"
                          }`}
                        >
                          {entry.foundStatus.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 border-r border-border text-[11px] font-mono text-[#6E2B32]">
                        {formatDate(entry.countedAt)}
                      </td>

                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        {isRelocated ? (
                          <form
                            action={async () => {
                              "use server";
                              await resolveDiscrepancyTransferAction(entry.asset.id, entry.asset.unitId);
                            }}
                          >
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded bg-cream border border-[#D97B1A] text-[#D97B1A] hover:bg-[#D97B1A] hover:text-[#FFFFFF] text-[11px] font-bold transition-colors"
                            >
                              Create Transfer PAR
                            </button>
                          </form>
                        ) : (
                          <span className="text-[#6E2B32] text-[11px] font-medium">
                            ✓ Reconciled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
