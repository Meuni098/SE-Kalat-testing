import { TransactionAttributionButton } from "@/components/audit/transaction-attribution-button";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NewDeliveryModal } from "@/components/intake/new-delivery-modal";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const user = await getSession();
  const canLogReceipt = !!user && (user.role === "ADMIN" || user.role === "STAFF") && user.unitCode === "AMO";

  const [intakes, categories] = await Promise.all([
    prisma.intakeRecord.findMany({
      include: {
        items: {
          include: {
            inspections: {
              include: { inspector: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalDeliveredValue = intakes.reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Page Header */}
      <div className="bg-[#FFFFFF] border border-border p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Procurement Delivery Intake &amp; Technical Inspection
          </h1>
        </div>

        <div>
          {canLogReceipt && <NewDeliveryModal categories={categories} />}
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Total Delivery Shipments
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {intakes.length} <span className="text-xs font-normal text-[#6E2B32]">Receipts Logged</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">local_shipping</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Total Procurement Value
            </span>
            <span className="text-2xl font-black text-[#A60212] font-mono mt-0.5 block">
              {formatCurrency(totalDeliveredValue)}
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              COA Threshold Engine
            </span>
            <span className="text-xs text-[#3B0A0F] font-medium leading-relaxed block mt-1">
              Unit values ≥ ₱50k classify automatically as capital PPE; below ₱50k as Semi-Expendable.
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">rule</span>
          </div>
        </div>
      </div>

      {/* Shipments & Inspection Log Table */}
      <div className="bg-[#FFFFFF] border border-border rounded overflow-hidden">
        <div className="p-4 bg-cream border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#A60212] text-[20px]">
              receipt_long
            </span>
            <h2 className="text-sm font-bold text-[#3B0A0F] uppercase">
              Incoming Delivery Receipts &amp; Inspection Reports
            </h2>
          </div>
          <span className="text-xs font-mono text-[#6E2B32]">
            {intakes.length} Shipments Processed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="h-9 bg-[#FFFFFF] border-b border-border text-[#3B0A0F] font-bold uppercase select-none">
                <th className="px-3.5 py-2 border-r border-border">PO &amp; DR Number</th>
                <th className="px-3.5 py-2 border-r border-border">Supplier / Vendor</th>
                <th className="px-3.5 py-2 border-r border-border">Delivered Items &amp; Qty</th>
                <th className="px-3.5 py-2 border-r border-border">Unit Cost &amp; Class</th>
                <th className="px-3.5 py-2 border-r border-border">Total Value</th>
                <th className="px-3.5 py-2 border-r border-border">Delivery Date</th>
                <th className="px-3.5 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {intakes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#6E2B32]">
                    No delivery shipments logged yet. Click &quot;Log New Delivery Receipt&quot; to begin intake.
                  </td>
                </tr>
              ) : (
                intakes.map((record) => (
                  <tr key={record.id} className="hover:bg-cream transition-colors">
                    <td className="px-3.5 py-3 border-r border-border font-mono whitespace-nowrap">
                      <div className="font-bold text-[#A60212]">{record.poNumber}<TransactionAttributionButton entityType="INTAKE" entityId={record.id} /></div>
                      <div className="text-[10px] text-[#6E2B32]">DR #{record.deliveryReceiptNo}</div>
                    </td>

                    <td className="px-3.5 py-3 border-r border-border">
                      <div className="font-bold text-[#3B0A0F]">{record.supplierName}</div>
                      {record.remarks && (
                        <div className="text-[10px] text-[#6E2B32]">{record.remarks}</div>
                      )}
                    </td>

                    <td className="px-3.5 py-3 border-r border-border">
                      {record.items.map((item) => (
                        <div key={item.id} className="font-semibold text-[#3B0A0F]">
                          {item.quantity}x {item.description}
                        </div>
                      ))}
                    </td>

                    <td className="px-3.5 py-3 border-r border-border whitespace-nowrap font-mono">
                      {record.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-1.5">
                          <span>{formatCurrency(item.unitCost)}</span>
                          <span
                            className={` px-1.5 py-0.2 rounded text-[9px] font-bold border  badge-solid ${
                              item.classification === "PPE"
                                ? " badge-solid badge-maroon"
                                : " badge-solid badge-slate"
                            }`}
                          >
                            {item.classification}
                          </span>
                        </div>
                      ))}
                    </td>

                    <td className="px-3.5 py-3 border-r border-border font-mono font-bold text-[#3B0A0F] whitespace-nowrap">
                      {formatCurrency(record.totalAmount)}
                    </td>

                    <td className="px-3.5 py-3 border-r border-border text-[11px] font-mono text-[#6E2B32] whitespace-nowrap">
                      {formatDate(record.deliveryDate)}
                    </td>

                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border font-mono badge-solid badge-green">
                        INSPECTED &amp; ACCEPTED
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
