import { TransactionAttributionButton } from "@/components/audit/transaction-attribution-button";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate, formatCurrency } from "@/lib/utils";
import { NewTransferModal } from "@/components/inventory/new-transfer-modal";
import { TransferDecisionButtons } from "@/components/inventory/transfer-decision-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const user = await getSession();

  const [transfers, assets, units, persons] = await Promise.all([
    prisma.transferRequest.findMany({
      include: {
        asset: {
          include: { category: true, unit: true },
        },
        fromUnit: true,
        toUnit: true,
        fromPerson: true,
        toPerson: true,
        requestedBy: true,
        decidedBy: true,
      },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { isDeleted: false },
      include: { unit: true, accountablePerson: true },
      orderBy: { propertyNo: "asc" },
    }),
    prisma.unit.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.person.findMany({ orderBy: { fullName: "asc" } }),
  ]);

  const canDecide = user?.role === "ADMIN" || user?.role === "STAFF";

  const pendingCount = transfers.filter((t) => t.status === "PENDING").length;
  const approvedCount = transfers.filter((t) => t.status === "APPROVED").length;
  const rejectedCount = transfers.filter((t) => t.status === "REJECTED").length;

  const modalAssets = assets.map((a) => ({
    id: a.id,
    propertyNo: a.propertyNo,
    name: a.name,
    unitId: a.unitId,
    unitCode: a.unit.code,
    currentCustodian: a.accountablePerson?.fullName || null,
  }));

  const modalPersons = persons.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    position: p.position,
    unitId: p.unitId,
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
              PROPERTY TRANSFER REPORT (PTR)
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Transfer Requests &amp; Custody Reassignments
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-0.5">
            Manage inter-college asset movements, temporary loans, and official COA property transfer vouchers
          </p>
        </div>

        <div>
          <NewTransferModal assets={modalAssets} units={units} persons={modalPersons} />
        </div>
      </div>

      {/* KPI Overview Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Pending Decisions
            </span>
            <span className="text-2xl font-black text-[#A60212] font-mono mt-0.5 block">
              {pendingCount}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">Awaiting AMO</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">pending_actions</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Approved Transfers
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {approvedCount} <span className="text-xs font-normal text-[#6E2B32]">Completed</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Rejected Requests
            </span>
            <span className="text-2xl font-black text-[#6E2B32] font-mono mt-0.5 block">
              {rejectedCount} <span className="text-xs font-normal text-[#6E2B32]">Archived</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#6E2B32] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">cancel</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Total Logged PTRs
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {transfers.length} <span className="text-xs font-normal text-[#6E2B32]">Historical</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
          </div>
        </div>
      </div>

      {/* Main Transfers Table */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded shadow-sm overflow-hidden">
        <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">sync_alt</span>
            <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
              Transfer Request Docket
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#F5AB29] bg-[#4E1117] px-2 py-0.5 rounded border border-[#6E2B32]">
            {transfers.length} Record(s) Found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FFF4E0] text-[#3B0A0F] border-b border-[#EBD3B2] font-black uppercase text-[11px]">
                <th className="py-2.5 px-3">Date Requested</th>
                <th className="py-2.5 px-3">Asset Product Code &amp; Name</th>
                <th className="py-2.5 px-3">Origin Unit / Custodian</th>
                <th className="py-2.5 px-3">Destination Unit / Recipient</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Remarks / Reason</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBD3B2]">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#6E2B32] font-medium">
                    <span className="material-symbols-outlined text-[32px] block text-[#EBD3B2] mb-1">
                      move_to_inbox
                    </span>
                    No asset transfer requests recorded. Click &quot;Initiate Transfer Request&quot; above to log a new movement.
                  </td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FFF4E0]/40 transition-colors">
                    <td className="py-3 px-3 text-[#3B0A0F] font-mono text-[11px] whitespace-nowrap">
                      {formatDate(t.requestedAt)}
<TransactionAttributionButton entityType="TRANSFER" entityId={t.id} />
                      <span className="block text-[10px] text-[#6E2B32]">
                        by {t.requestedBy.name}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <Link
                        href={`/inventory/${t.asset.id}`}
                        className="font-mono font-bold text-[#A60212] hover:underline block"
                      >
                        {t.asset.propertyNo}
                      </Link>
                      <span className="text-xs text-[#3B0A0F] font-medium block truncate max-w-[220px]">
                        {t.asset.name}
                      </span>
                      <span className="text-[10px] text-[#6E2B32] font-semibold">
                        {formatCurrency(t.asset.acquisitionCost)} • {t.asset.classification}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-[#3B0A0F] block">{t.fromUnit.code}</span>
                      <span className="text-[11px] text-[#6E2B32]">
                        {t.fromPerson?.fullName || "Unassigned"}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 font-bold text-[#A60212]">
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        <span>{t.toUnit.code}</span>
                      </div>
                      <span className="text-[11px] text-[#6E2B32]">
                        {t.toPerson?.fullName || "To be designated"}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          t.status === "PENDING"
                            ? "bg-[#FFF4E0] text-[#D97B1A] border border-[#F5AB29]"
                            : t.status === "APPROVED"
                            ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
                            : "bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{t.status}</span>
                      </span>
                      {t.decidedAt && (
                        <span className="block text-[9px] text-[#6E2B32] mt-0.5">
                          {formatDate(t.decidedAt)}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-[#3B0A0F] max-w-[200px]">
                      <span className="line-clamp-2 text-xs italic">
                        &quot;{t.remarks || "No remarks stated"}&quot;
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <TransferDecisionButtons
                        transferId={t.id}
                        status={t.status}
                        canDecide={canDecide}
                      />
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
