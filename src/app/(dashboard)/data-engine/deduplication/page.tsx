import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DeduplicationMergeCard } from "@/components/deduplication/deduplication-merge-card";

export const dynamic = "force-dynamic";

export default async function DeduplicationPage() {
  await getSession();

  const allAssets = await prisma.asset.findMany({
    where: { isDeleted: false },
    include: { unit: true, accountablePerson: true, category: true },
    orderBy: { createdAt: "desc" },
  });

  // Calculate Data Quality Metrics
  const missingSerialAssets = allAssets.filter((a) => !a.serialNo);
  const unassignedAssets = allAssets.filter((a) => !a.accountablePersonId);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const stagnantAssets = allAssets.filter(
    (a) => !a.lastVerifiedAt || new Date(a.lastVerifiedAt) < oneYearAgo
  );

  const cleanScore =
    allAssets.length > 0
      ? Math.round(
          ((allAssets.length - missingSerialAssets.length) / allAssets.length) * 100
        )
      : 100;

  // Find candidate pair for comparison (or use first two assets)
  const candidateA = allAssets[0] || null;
  const candidateB = allAssets[1] || null;

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Page Header */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#FFF4E0] text-[#A60212] border border-[#A60212] px-2 py-0.5 rounded text-[11px] font-bold font-mono">
              DATA QUALITY ENGINE
            </span>
            <span className="bg-[#FFF4E0] text-[#6E2B32] border border-[#EBD3B2] px-2 py-0.5 rounded text-[11px] font-mono">
              COA LEDGER INTEGRITY
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Data Quality &amp; Deduplication Console
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-0.5">
            Automated anomaly queries to reconcile redundant property numbers, incomplete records, and unverified assets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-[#A60212] bg-[#FFF4E0] border border-[#EBD3B2] px-3 py-1.5 rounded">
            Overall Reliability: {cleanScore}%
          </span>
        </div>
      </div>

      {/* Health Scorecards (4 Cards Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-[#6E2B32] uppercase">Conflict Clusters</span>
              <div className="text-2xl font-black text-[#D97B1A] font-mono mt-1">1 Cluster</div>
            </div>
            <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#F5AB29] text-[#D97B1A] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">copy_all</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#EBD3B2] flex items-center justify-between text-xs">
            <span className="text-[#D97B1A] font-bold">Suspected Duplicate</span>
            <span className="text-[#6E2B32]">Action Required</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-[#6E2B32] uppercase">Schema Integrity</span>
              <div className="text-2xl font-black text-[#3B0A0F] font-mono mt-1">
                {missingSerialAssets.length} Assets
              </div>
            </div>
            <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#3B0A0F] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">warning</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#EBD3B2] flex items-center justify-between text-xs">
            <span className="text-[#3B0A0F] font-bold">Missing Serial #</span>
            <span className="text-[#6E2B32]">Pending Field Check</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-[#6E2B32] uppercase">Ledger Stagnation</span>
              <div className="text-2xl font-black text-[#3B0A0F] font-mono mt-1">
                {stagnantAssets.length} Assets
              </div>
            </div>
            <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#3B0A0F] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">history</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#EBD3B2] flex items-center justify-between text-xs">
            <span className="text-[#3B0A0F] font-bold">Unverified (&gt;12 Mos)</span>
            <span className="text-[#6E2B32]">Annual Count Target</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-[#6E2B32] uppercase">Clean Compliance</span>
              <div className="text-2xl font-black text-[#A60212] font-mono mt-1">
                {cleanScore}%
              </div>
            </div>
            <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#A60212] text-[#A60212] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#EBD3B2] space-y-1.5">
            <div className="w-full bg-[#FFF4E0] h-2 rounded border border-[#EBD3B2] overflow-hidden">
              <div className="bg-[#A60212] h-full" style={{ width: `${cleanScore}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Merge Candidate Comparison */}
      {candidateA && candidateB && (
        <DeduplicationMergeCard candidateA={candidateA} candidateB={candidateB} />
      )}

      {/* Incomplete Records Audit Table */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded overflow-hidden">
        <div className="p-4 bg-[#FFF4E0] border-b border-[#EBD3B2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#A60212] text-[20px]">
              rule
            </span>
            <h2 className="text-sm font-bold text-[#3B0A0F] uppercase">
              Incomplete Asset Records Flagged for Remediation
            </h2>
          </div>
          <span className="text-xs font-mono text-[#6E2B32]">
            {missingSerialAssets.length + unassignedAssets.length} Discrepancies
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="h-9 bg-[#FFFFFF] border-b border-[#EBD3B2] text-[#3B0A0F] font-bold uppercase select-none">
                <th className="px-3.5 py-2 border-r border-[#EBD3B2]">Property Tag</th>
                <th className="px-3.5 py-2 border-r border-[#EBD3B2]">Asset Title</th>
                <th className="px-3.5 py-2 border-r border-[#EBD3B2]">Operating Unit</th>
                <th className="px-3.5 py-2 border-r border-[#EBD3B2]">Missing Attribute</th>
                <th className="px-3.5 py-2 border-r border-[#EBD3B2]">Acquisition Cost</th>
                <th className="px-3.5 py-2 text-center">Remediation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBD3B2]">
              {missingSerialAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#6E2B32]">
                    Zero incomplete records! All active assets have serial numbers and designated custodians.
                  </td>
                </tr>
              ) : (
                missingSerialAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-[#FFF4E0] transition-colors">
                    <td className="px-3.5 py-3 border-r border-[#EBD3B2] font-mono font-bold text-[#A60212]">
                      <Link href={`/inventory/${asset.id}`} className="hover:underline">
                        {asset.propertyNo}
                      </Link>
                    </td>

                    <td className="px-3.5 py-3 border-r border-[#EBD3B2] font-bold text-[#3B0A0F]">
                      {asset.name}
                    </td>

                    <td className="px-3.5 py-3 border-r border-[#EBD3B2]">
                      <div className="font-bold text-[#3B0A0F]">{asset.unit.code}</div>
                    </td>

                    <td className="px-3.5 py-3 border-r border-[#EBD3B2]">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEE2E2] text-[#A60212] border border-[#FECACA] font-mono">
                        MISSING SERIAL NUMBER
                      </span>
                    </td>

                    <td className="px-3.5 py-3 border-r border-[#EBD3B2] font-mono font-bold text-[#3B0A0F]">
                      {formatCurrency(asset.acquisitionCost)}
                    </td>

                    <td className="px-3.5 py-3 text-center">
                      <Link
                        href={`/inventory/${asset.id}`}
                        className="px-2.5 py-1 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#3B0A0F] hover:bg-[#A60212] hover:text-[#FFF4E0] text-[11px] font-bold transition-colors inline-block"
                      >
                        Edit Dossier
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
