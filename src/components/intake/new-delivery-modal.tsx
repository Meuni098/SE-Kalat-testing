"use client";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useOperationId } from "@/lib/use-operation-id";

import * as React from "react";
import { createIntakeDeliveryAction } from "@/actions/intake-actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface NewDeliveryModalProps {
  categories: { id: string; code: string; name: string }[];
}

export function NewDeliveryModal({ categories }: NewDeliveryModalProps) {
  const operationId = useOperationId();
  const submitLock = React.useRef(false);
  const [saved, setSaved] = React.useState<{ count: number; poNumber: string; deliveryReceiptNo: string } | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const dialogRef = useModalFocus(isOpen, setIsOpen);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("operationId", operationId(formData));
    let result;
    try { result = await createIntakeDeliveryAction(formData); }
    catch { setError("The response could not be confirmed. Retry the same submission."); setIsPending(false); submitLock.current = false; return; }

    setIsPending(false);
    submitLock.current = false;
    if ("error" in result) {
      setError(result.error);
    } else {
      operationId.reset(); setSaved(result);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={() => { setSaved(null); setError(null); setIsOpen(true); }}
        className="gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">post_add</span>
        <span>Log New Delivery Receipt</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B0A0F]/80">
          <div ref={dialogRef} role="dialog" tabIndex={-1} aria-busy={isPending} aria-modal="true" aria-labelledby="delivery-title" className="bg-[#FFFFFF] border-2 border-[#A60212] rounded w-full max-w-lg p-6 select-none max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EBD3B2]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#A60212] text-[22px]">
                  local_shipping
                </span>
                <h3 id="delivery-title" className="text-sm font-bold text-[#3B0A0F] uppercase">
                  Log Procurement Delivery Receipt
                </h3>
              </div>
              <button
                disabled={isPending} aria-label="Close delivery form" onClick={() => setIsOpen(false)}
                className="text-[#6E2B32] hover:text-[#A60212]"
              >
                ✕
              </button>
            </div>

            {error && (
              <div role="alert" className="mt-3 p-2.5 bg-[#FEE2E2] border border-[#FECACA] rounded text-xs text-[#A60212] font-semibold">
                {error}
              </div>
            )}

            {saved ? <div className="mt-4 space-y-4">
              <p role="status" className="font-bold">Delivery saved. {saved.count} items received unique product codes.</p>
              <dl className="text-sm space-y-2 select-text">
                <div><dt className="font-bold">Generated PO Reference</dt><dd className="font-mono">{saved.poNumber}</dd></div>
                <div><dt className="font-bold">Generated DR Reference</dt><dd className="font-mono">{saved.deliveryReceiptNo}</dd></div>
              </dl>
              <p className="text-sm">QR labels are available for all saved items.</p>
              <Link href="/inventory/generate-qr" className="block text-[#A60212] underline">View and print QR labels</Link>
              <Link href="/inventory/central" className="block text-[#A60212] underline">View inventory</Link>
              <Button onClick={() => setIsOpen(false)}>Done</Button>
            </div> : <>
            {!categories.length && <p role="alert">Add a category before logging a delivery.</p>}
            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <p className="text-xs text-[#6E2B32]">PO reference, DR reference, product codes and QR labels are generated automatically when you save.</p>

              <div>
                <label htmlFor="delivery-supplierName" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Supplier / Vendor Name *
                </label>
                <input id="delivery-supplierName"
                  type="text"
                  name="supplierName"
                  required
                  placeholder="e.g. Micro-D International Solutions Inc."
                  className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded p-2 text-xs text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                />
              </div>

              <div>
                <label htmlFor="delivery-itemDescription" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Delivered Item Description &amp; Technical Specs *
                </label>
                <input id="delivery-itemDescription"
                  type="text"
                  name="itemDescription"
                  required
                  placeholder="e.g. Lenovo ThinkPad T14s Gen 4 (Core i7, 32GB RAM)"
                  className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded p-2 text-xs text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="delivery-quantity" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    Quantity Delivered
                  </label>
                  <input id="delivery-quantity"
                    type="number"
                    name="quantity"
                    max="10000" step="1"
                    min="1"
                    defaultValue="1"
                    required
                    className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded p-2 text-xs font-mono font-bold text-[#3B0A0F]"
                  />
                </div>

                <div>
                  <label htmlFor="delivery-unitCost" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    Unit Cost (₱ PHP) *
                  </label>
                  <input id="delivery-unitCost"
                    type="number"
                    step="0.01"
                    min="0"
                    name="unitCost"
                    required
                    defaultValue="65000"
                    placeholder="65000.00"
                    className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded p-2 text-xs font-mono font-bold text-[#3B0A0F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="receiving-unit" className="block text-xs font-bold text-[#3B0A0F] uppercase">
                      Receiving Unit
                    </label>
                    <span className="text-[9px] font-bold text-[#A60212] bg-[#FFF4E0] px-1 py-0.2 rounded border border-[#EBD3B2]">
                      AMO Central
                    </span>
                  </div>
                  <input
                    id="receiving-unit"
                    type="text"
                    value="AMO — Asset Management Office"
                    readOnly
                    className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded p-2 text-xs text-[#3B0A0F] font-semibold"
                  />
                  <p className="mt-1 text-[10px] text-[#6E2B32]">
                    All deliveries are received and handled by the AMO officer.
                  </p>
                </div>


                <div>
                  <label htmlFor="delivery-categoryId" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    Category *
                  </label>
                  <select id="delivery-categoryId"
                    name="categoryId"
                    required
                    className="w-full bg-[#FFFFFF] border border-[#EBD3B2] rounded p-2 text-xs text-[#3B0A0F]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="delivery-remarks" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Inspection Remarks (Optional)
                </label>
                <textarea id="delivery-remarks"
                  name="remarks"
                  rows={2}
                  placeholder="Inspected and verified against PO specs..."
                  className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded p-2 text-xs text-[#3B0A0F]"
                />
              </div>

              <div className="pt-3 border-t border-[#EBD3B2] flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isPending} aria-label="Close delivery form" onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending || !categories.length}
                >
                  {isPending ? "Logging..." : "Log Receipt & Generate Product Codes"}
                </Button>
              </div>
            </form>
            </>}
          </div>
        </div>
      )}
    </>
  );
}
