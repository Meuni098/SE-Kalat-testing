import { TransactionAttributionButton } from "@/components/audit/transaction-attribution-button";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate, formatCurrency } from "@/lib/utils";
import { NewReturnModal } from "@/components/inventory/new-return-modal";
import { ReturnDecisionButtons } from "@/components/inventory/return-decision-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const user = await getSession();

  const [returns, assets] = await Promise.all([
    prisma.returnRequest.findMany({
      include: {
        asset: {
          include: { category: true, unit: true, accountablePerson: true },
        },
      },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { isDeleted: false, status: "IN_USE" },
      include: { unit: true, accountablePerson: true },
      orderBy: { propertyNo: "asc" },
    }),
  ]);

  const snapshots = await prisma.auditLog.findMany({
    where: { entityType: "RETURN", action: "REQUEST_RETURN", entityId: { in: returns.map(r => r.id) } },
    select: { entityId: true, afterState: true },
  });
  const returnDetails = new Map(snapshots.map(log => {
    const state = log.afterState && typeof log.afterState === "object" && !Array.isArray(log.afterState) ? log.afterState : {};
    const person = state.person && typeof state.person === "object" && !Array.isArray(state.person) ? state.person : {};
    return [log.entityId, { position: typeof person.position === "string" ? person.position : "", employeeNo: typeof person.employeeNo === "string" ? person.employeeNo : "", unitCode: typeof state.unitCode === "string" ? state.unitCode : "" }];
  }));

  const canDecide = user?.role === "ADMIN" || user?.role === "STAFF";

  const pendingCount = returns.filter((r) => r.status === "PENDING").length;
  const approvedCount = returns.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = returns.filter((r) => r.status === "REJECTED").length;

  const modalAssets = assets.map((a) => ({
    id: a.id,
    propertyNo: a.propertyNo,
    name: a.name,
    unitCode: a.unit.code,
    currentCustodian: a.accountablePerson?.fullName || null,
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
              PROPERTY RETURN &amp; STORAGE SURRENDER
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Return Requests &amp; Warehouse Check-In
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-0.5">
            Log returned institutional equipment from faculty, verify physical condition, and update property custody records
          </p>
        </div>

        <div>
          <NewReturnModal assets={modalAssets} />
        </div>
      </div>

      {/* KPI Overview Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Pending Check-In
            </span>
            <span className="text-2xl font-black text-[#A60212] font-mono mt-0.5 block">
              {pendingCount}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">Awaiting Storage</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">assignment_return</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Stored &amp; Restocked
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {approvedCount} <span className="text-xs font-normal text-[#6E2B32]">In Warehouse</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Declined Returns
            </span>
            <span className="text-2xl font-black text-[#6E2B32] font-mono mt-0.5 block">
              {rejectedCount} <span className="text-xs font-normal text-[#6E2B32]">Returned to Unit</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#6E2B32] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">cancel</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Total Logged Surrenders
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {returns.length} <span className="text-xs font-normal text-[#6E2B32]">Receipts</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">receipt</span>
          </div>
        </div>
      </div>

      {/* Main Returns Table */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded shadow-sm overflow-hidden">
        <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">
              assignment_return
            </span>
            <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
              Asset Surrender &amp; Return Register
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#F5AB29] bg-[#4E1117] px-2 py-0.5 rounded border border-[#6E2B32]">
            {returns.length} Record(s) Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FFF4E0] text-[#3B0A0F] border-b border-[#EBD3B2] font-black uppercase text-[11px]">
                <th className="py-2.5 px-3">Date Filed</th>
                <th className="py-2.5 px-3">Asset Product Code &amp; Details</th>
                <th className="py-2.5 px-3">Surrendering Custodian</th>
                <th className="py-2.5 px-3">Reason for Return</th>
                <th className="py-2.5 px-3">Current Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBD3B2]">
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6E2B32] font-medium">
                    <span className="material-symbols-outlined text-[32px] block text-[#EBD3B2] mb-1">
                      inbox
                    </span>
                    No asset return requests currently logged. Click &quot;Initiate Asset Surrender&quot; to begin.
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.id} className="hover:bg-[#FFF4E0]/40 transition-colors">
                    <td className="py-3 px-3 text-[#3B0A0F] font-mono text-[11px] whitespace-nowrap">
                      {formatDate(r.requestedAt)}
<TransactionAttributionButton entityType="RETURN" entityId={r.id} />
                    </td>

                    <td className="py-3 px-3">
                      <Link
                        href={`/inventory/${r.asset.id}`}
                        className="font-mono font-bold text-[#A60212] hover:underline block"
                      >
                        {r.asset.propertyNo}
                      </Link>
                      <span className="text-xs text-[#3B0A0F] font-medium block truncate max-w-[220px]">
                        {r.asset.name}
                      </span>
                      <span className="text-[10px] text-[#6E2B32] font-semibold">
                        {returnDetails.get(r.id)?.unitCode || r.asset.unit.code} • {formatCurrency(r.asset.acquisitionCost)}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-[#3B0A0F] block">{r.returnedBy}</span>
                      <span className="block text-xs">{returnDetails.get(r.id)?.employeeNo}</span>
                      <span className="text-[11px] text-[#6E2B32]">
                        {returnDetails.get(r.id)?.position || "Position not recorded"}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-[#3B0A0F] max-w-[220px]">
                      <span className="line-clamp-2 text-xs italic">
                        &quot;{r.reason}&quot;
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          r.status === "PENDING"
                            ? "bg-[#FFF4E0] text-[#D97B1A] border border-[#F5AB29]"
                            : r.status === "APPROVED"
                            ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
                            : "bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{r.status === "APPROVED" ? "STORED" : r.status}</span>
                      </span>
                      {r.decidedAt && (
                        <span className="block text-[9px] text-[#6E2B32] mt-0.5">
                          {formatDate(r.decidedAt)}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <ReturnDecisionButtons
                        returnId={r.id}
                        status={r.status}
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
