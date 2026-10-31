import { TransactionAttributionButton } from "@/components/audit/transaction-attribution-button";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { NewInspectionModal } from "@/components/inventory/new-inspection-modal";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  await getSession();

  const [inspections, assets] = await Promise.all([
    prisma.inspection.findMany({
      include: {
        asset: {
          include: { category: true, unit: true },
        },
        intakeItem: {
          include: { intakeRecord: true },
        },
        inspector: {
          select: { id: true, name: true, role: true, email: true },
        },
      },
      orderBy: { inspectedAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { isDeleted: false },
      include: { unit: true },
      orderBy: { propertyNo: "asc" },
    }),
  ]);

  const acceptedCount = inspections.filter((i) => i.result === "ACCEPTED").length;
  const conditionalCount = inspections.filter((i) => i.result === "CONDITIONAL").length;
  const rejectedCount = inspections.filter((i) => i.result === "REJECTED").length;

  const modalAssets = assets.map((a) => ({
    id: a.id,
    propertyNo: a.propertyNo,
    name: a.name,
    unitCode: a.unit.code,
    condition: a.condition,
  }));

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
              INSPECTION &amp; ACCEPTANCE (IAR)
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Inspection Records &amp; Condition Audits
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-0.5">
            Technical inspection documentation, pre-delivery acceptance checks, and operational condition grading
          </p>
        </div>

        <div>
          <NewInspectionModal assets={modalAssets} />
        </div>
      </div>

      {/* KPI Overview Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Total Inspections
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {inspections.length} <span className="text-xs font-normal text-[#6E2B32]">Logged</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">schedule</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Accepted As Compliant
            </span>
            <span className="text-2xl font-black text-[#2E7D32] font-mono mt-0.5 block">
              {acceptedCount} <span className="text-xs font-normal text-[#6E2B32]">Passed</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#2E7D32] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Conditional Acceptance
            </span>
            <span className="text-2xl font-black text-[#D97B1A] font-mono mt-0.5 block">
              {conditionalCount}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">Needs Work</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">warning</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Rejected / Non-Compliant
            </span>
            <span className="text-2xl font-black text-[#C62828] font-mono mt-0.5 block">
              {rejectedCount} <span className="text-xs font-normal text-[#6E2B32]">Defective</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#C62828] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">error</span>
          </div>
        </div>
      </div>

      {/* Main Inspections Table */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded shadow-sm overflow-hidden">
        <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">history_edu</span>
            <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
              Technical Inspection Logbook
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#F5AB29] bg-[#4E1117] px-2 py-0.5 rounded border border-[#6E2B32]">
            {inspections.length} Entry/Entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FFF4E0] text-[#3B0A0F] border-b border-[#EBD3B2] font-black uppercase text-[11px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Asset / Item Examined</th>
                <th className="py-2.5 px-3">Inspector Officer</th>
                <th className="py-2.5 px-3">Acceptance Result</th>
                <th className="py-2.5 px-3">Recorded Condition</th>
                <th className="py-2.5 px-3">Technical Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBD3B2]">
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6E2B32] font-medium">
                    <span className="material-symbols-outlined text-[32px] block text-[#EBD3B2] mb-1">
                      fact_check
                    </span>
                    No technical inspection records logged yet. Click &quot;Log Technical Inspection&quot; to add an entry.
                  </td>
                </tr>
              ) : (
                inspections.map((i) => (
                  <tr key={i.id} className="hover:bg-[#FFF4E0]/40 transition-colors">
                    <td className="py-3 px-3 text-[#3B0A0F] font-mono text-[11px] whitespace-nowrap">
                      {formatDate(i.inspectedAt)}<TransactionAttributionButton entityType="INSPECTION" entityId={i.id} />
                    </td>

                    <td className="py-3 px-3">
                      {i.asset ? (
                        <>
                          <Link
                            href={`/inventory/${i.asset.id}`}
                            className="font-mono font-bold text-[#A60212] hover:underline block"
                          >
                            {i.asset.propertyNo}
                          </Link>
                          <span className="text-xs text-[#3B0A0F] font-medium block truncate max-w-[220px]">
                            {i.asset.name}
                          </span>
                          <span className="text-[10px] text-[#6E2B32] font-semibold">
                            {i.asset.unit.code} • {i.asset.category.name}
                          </span>
                        </>
                      ) : i.intakeItem ? (
                        <>
                          <span className="font-bold text-[#3B0A0F] block truncate max-w-[220px]">
                            {i.intakeItem.description}
                          </span>
                          <span className="text-[10px] text-[#6E2B32] font-mono">
                            PO #{i.intakeItem.intakeRecord.poNumber} • DR #
                            {i.intakeItem.intakeRecord.deliveryReceiptNo}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-[#6E2B32] italic">
                          General Delivery Batch Inspection
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-[#3B0A0F] block">{i.inspector.name}</span>
                      <span className="text-[10px] text-[#6E2B32] font-semibold">
                        {i.inspector.role}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          i.result === "ACCEPTED"
                            ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
                            : i.result === "CONDITIONAL"
                            ? "bg-[#FFF4E0] text-[#D97B1A] border border-[#F5AB29]"
                            : "bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{i.result}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-[#3B0A0F] text-xs">
                        {i.asset?.condition || "GOOD"}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-[#3B0A0F] max-w-[240px]">
                      <span className="line-clamp-2 text-xs italic">
                        &quot;{i.remarks || "No specific technical remarks entered"}&quot;
                      </span>
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
