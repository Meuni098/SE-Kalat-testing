import { TransactionAttributionButton } from "@/components/audit/transaction-attribution-button";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate, formatCurrency } from "@/lib/utils";
import { NewTransferModal } from "@/components/inventory/new-transfer-modal";
import { TransferDecisionButtons } from "@/components/inventory/transfer-decision-button";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TransfersPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const status = (await searchParams).status;
  const statusFilter = typeof status === "string" && ["PENDING", "APPROVED", "REJECTED"].includes(status) ? status : "ALL";
  const requestScope = user.role === "CUSTODIAN" ? { OR: [{ fromUnitId: user.unitId ?? "" }, { toUnitId: user.unitId ?? "" }] } : {};

  const [transfers, assets, units] = await Promise.all([
    prisma.transferRequest.findMany({
      where: requestScope,
      include: {
        asset: {
          include: { category: true, unit: true },
        },
        fromUnit: true,
        toUnit: true,
        fromPerson: true,
        toPerson: true,
        requestedBy: { select: { name: true } },
        decidedBy: { select: { name: true } },
      },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { isDeleted: false, status: { in: ["IN_USE", "IN_STORAGE", "UNDER_REPAIR"] }, transferRequests: { none: { status: "PENDING" } }, returnRequests: { none: { status: "PENDING" } }, ...(user?.role === "CUSTODIAN" ? { unitId: user.unitId ?? "" } : {}) },
      include: { unit: true, accountablePerson: true },
      orderBy: { propertyNo: "asc" },
    }),
    prisma.unit.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
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

  const visibleTransfers = transfers.filter((transfer) => statusFilter === "ALL" || transfer.status === statusFilter);

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-border p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Transfer Requests &amp; Custody Reassignments
          </h1>
        </div>

        <div>
          {["ADMIN", "STAFF", "CUSTODIAN"].includes(user?.role ?? "") && <NewTransferModal assets={modalAssets} units={units} />}
        </div>
      </div>

      {/* KPI Overview Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Pending Decisions
            </span>
            <span className="text-2xl font-black text-[#A60212] font-mono mt-0.5 block">
              {pendingCount}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">Awaiting AMO</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">pending_actions</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Approved Transfers
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {approvedCount} <span className="text-xs font-normal text-[#6E2B32]">Completed</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Rejected Requests
            </span>
            <span className="text-2xl font-black text-[#6E2B32] font-mono mt-0.5 block">
              {rejectedCount} <span className="text-xs font-normal text-[#6E2B32]">Archived</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#6E2B32] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">cancel</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Total Logged PTRs
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {transfers.length} <span className="text-xs font-normal text-[#6E2B32]">Historical</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
          </div>
        </div>
      </div>

      {user.role === "CUSTODIAN" && !user.unitId && <p role="status" className="text-sm text-[#6E2B32]">Your account is not linked to a college or unit. Contact AMO.</p>}
      <nav aria-label="Transfer request status" className="flex flex-wrap gap-2">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((filter) => <Link key={filter} href={filter === "ALL" ? "/inventory/transfers" : `/inventory/transfers?status=${filter}`} aria-current={statusFilter === filter ? "page" : undefined} className={`rounded border px-4 py-2 text-xs font-bold ${statusFilter === filter ? "bg-[#A60212] text-[#FFF4E0] border-[#A60212]" : "bg-white text-[#3B0A0F] border-border"}`}>{filter === "ALL" ? "All Requests" : filter.charAt(0) + filter.slice(1).toLowerCase()}</Link>)}
      </nav>
      {/* Main Transfers Table */}
      <div className="bg-[#FFFFFF] border border-border rounded shadow-sm overflow-hidden">
        <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">sync_alt</span>
            <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
              Transfer Request Docket
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded border badge-solid badge-amber">
            {visibleTransfers.length} Record(s) Found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-cream text-[#3B0A0F] border-b border-border font-black uppercase text-[11px]">
                <th className="py-2.5 px-3">Date Requested</th>
                <th className="py-2.5 px-3">Asset Product Code &amp; Name</th>
                <th className="py-2.5 px-3">Origin Unit / Custodian</th>
                <th className="py-2.5 px-3">Receiving College / Unit</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Remarks / Reason</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#6E2B32] font-medium">
                    <span className="material-symbols-outlined text-[32px] block text-[#EBD3B2] mb-1">
                      move_to_inbox
                    </span>
                    {statusFilter === "ALL" ? "No transfer requests recorded for your view." : `No ${statusFilter.toLowerCase()} transfer requests found. Choose All Requests to view other statuses.`}
                  </td>
                </tr>
              ) : (
                visibleTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-cream transition-colors">
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
                        {t.toPerson?.fullName || "College custody"}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={` inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider  badge-solid ${
                          t.status === "PENDING"
                            ? "border badge-solid badge-amber"
                            : t.status === "APPROVED"
                            ? "border badge-solid badge-green"
                            : "border badge-solid badge-crimson"
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
