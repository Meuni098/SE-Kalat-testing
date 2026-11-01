import { TransactionAttributionButton } from "@/components/audit/transaction-attribution-button";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NewDocketModal } from "@/components/disposal/new-docket-modal";
import { approveDisposalDocketAction } from "@/actions/disposal-actions";

export const dynamic = "force-dynamic";

export default async function DisposalPage() {
  const user = await getSession();

  const [disposals, unserviceableAssets] = await Promise.all([
    prisma.disposal.findMany({
      include: {
        asset: {
          include: { unit: true, category: true },
        },
      },
      orderBy: { proposedAt: "desc" },
    }),
    prisma.asset.findMany({
      where: {
        isDeleted: false,
        OR: [
          { status: "FOR_DISPOSAL" },
          { condition: "UNSERVICEABLE" },
          { status: "UNDER_REPAIR" },
        ],
      },
      include: { unit: true },
      orderBy: { propertyNo: "asc" },
    }),
  ]);

  const totalScrapValue = disposals.reduce((sum, d) => sum + d.appraisedScrapValue, 0);
  const disposedCount = disposals.filter((d) => d.status === "DISPOSED").length;
  const pendingDockets = disposals.filter((d) => d.status !== "DISPOSED").length;

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Page Header */}
      <div className="bg-[#FFFFFF] border border-border p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Legal Disposal &amp; Condemnation Docket Management
          </h1>
        </div>

        <div>
          <NewDocketModal
            unserviceableAssets={unserviceableAssets.map((a) => ({
              id: a.id,
              propertyNo: a.propertyNo,
              name: a.name,
              unitCode: a.unit.code,
              cost: a.acquisitionCost,
            }))}
          />
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Pending Dockets
            </span>
            <span className="text-2xl font-black text-[#D97B1A] font-mono mt-0.5 block">
              {pendingDockets} <span className="text-xs font-normal text-[#6E2B32]">In Review</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-[#F5AB29] text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">pending_actions</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Appraised Scrap Value
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {formatCurrency(totalScrapValue)}
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#3B0A0F] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">price_change</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Executed Disposals
            </span>
            <span className="text-2xl font-black text-[#A60212] font-mono mt-0.5 block">
              {disposedCount} <span className="text-xs font-normal text-[#6E2B32]">Archived</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-[#A60212] text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Disposal Methods
            </span>
            <span className="text-xs text-[#3B0A0F] font-medium leading-relaxed block mt-1">
              Public Auction, Donation to DepEd schools, or Destruction / Scrapping.
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#3B0A0F] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">gavel</span>
          </div>
        </div>
      </div>

      {/* Condemnation Dockets Table */}
      <div className="bg-[#FFFFFF] border border-border rounded overflow-hidden">
        <div className="p-4 bg-cream border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#A60212] text-[20px]">
              folder_managed
            </span>
            <h2 className="text-sm font-bold text-[#3B0A0F] uppercase">
              Condemnation &amp; Retirement Dockets Ledger
            </h2>
          </div>
          <span className="text-xs font-mono text-[#6E2B32]">
            {disposals.length} Formal Dockets Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="h-9 bg-[#FFFFFF] border-b border-border text-[#3B0A0F] font-bold uppercase select-none">
                <th className="px-3.5 py-2 border-r border-border">Docket No.</th>
                <th className="px-3.5 py-2 border-r border-border">Condemned Property</th>
                <th className="px-3.5 py-2 border-r border-border">Unit &amp; Category</th>
                <th className="px-3.5 py-2 border-r border-border">Disposal Method</th>
                <th className="px-3.5 py-2 border-r border-border">Scrap Value</th>
                <th className="px-3.5 py-2 border-r border-border">3-Step Approval Stage</th>
                <th className="px-3.5 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {disposals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#6E2B32]">
                    No disposal dockets created yet.
                  </td>
                </tr>
              ) : (
                disposals.map((d) => {
                  const isDisposed = d.status === "DISPOSED";

                  return (
                    <tr key={d.id} className="hover:bg-cream transition-colors">
                      <td className="px-3.5 py-3 border-r border-border font-mono font-bold text-[#A60212] whitespace-nowrap">
                        {d.docketNo}<TransactionAttributionButton entityType="DISPOSAL" entityId={d.id} />
                        <div className="text-[10px] text-[#6E2B32]">{formatDate(d.proposedAt)}</div>
                      </td>

                      <td className="px-3.5 py-3 border-r border-border">
                        <Link
                          href={`/inventory/${d.asset.id}`}
                          className="font-bold text-[#3B0A0F] hover:underline"
                        >
                          {d.asset.name}
                        </Link>
                        <div className="text-[10px] text-[#A60212] font-mono mt-0.5">
                          {d.asset.propertyNo}
                        </div>
                        <div className="text-[10px] text-[#6E2B32] mt-0.5">{d.reason}</div>
                      </td>

                      <td className="px-3.5 py-3 border-r border-border">
                        <div className="font-bold text-[#3B0A0F]">{d.asset.unit.code}</div>
                        <div className="text-[10px] text-[#6E2B32]">{d.asset.category.name}</div>
                      </td>

                      <td className="px-3.5 py-3 border-r border-border whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border badge-solid badge-slate">
                          {d.method.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 border-r border-border font-mono font-bold text-[#3B0A0F] whitespace-nowrap">
                        {formatCurrency(d.appraisedScrapValue)}
                      </td>

                      <td className="px-3.5 py-3 border-r border-border">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isDisposed ? "bg-[#A60212]" : "bg-[#F5AB29]"
                            }`}
                          />
                          <span className={isDisposed ? "text-[#A60212]" : "text-[#D97B1A]"}>
                            {isDisposed
                              ? "3/3 University President Approved (Disposed)"
                              : "2/3 Inspection Committee Review"}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#6E2B32] mt-0.5 font-mono">
                          {d.coaApprovalRef || "COA Cir. 89-296"}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        {!isDisposed ? (
                          <form
                            action={async () => {
                              "use server";
                              await approveDisposalDocketAction(d.id);
                            }}
                          >
                            <button
                              type="submit"
                              disabled={user?.role !== "ADMIN"}
                              title={
                                user?.role !== "ADMIN"
                                  ? "Only ADMIN can approve disposal"
                                  : "Approve and soft-delete asset from active ledger"
                              }
                              className="px-2.5 py-1 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-[11px] border border-[#A60212] transition-colors disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed"
                            >
                              Approve &amp; Archive
                            </button>
                          </form>
                        ) : (
                          <span className="text-[11px] font-bold text-[#6E2B32]">
                            ✓ Disposed &amp; Soft-Deleted
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
