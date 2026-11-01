"use client";
import { useOperationId } from "@/lib/use-operation-id";

import * as React from "react";
import { createDisposalDocketAction } from "@/actions/disposal-actions";
import { Button } from "@/components/ui/button";

interface NewDocketModalProps {
  unserviceableAssets: {
    id: string;
    propertyNo: string;
    name: string;
    unitCode: string;
    cost: number;
  }[];
}

export function NewDocketModal({ unserviceableAssets }: NewDocketModalProps) {
  const operationId = useOperationId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("operationId", operationId(formData));
    const result = await createDisposalDocketAction(formData);

    setIsPending(false);
    if (result.error) {
      setError(result.error);
    } else {
      operationId.reset(); setIsOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">gavel</span>
        <span>Initiate Disposal Docket</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B0A0F]">
          <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded w-full max-w-lg p-6 select-none max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#A60212] text-[22px]">
                  gavel
                </span>
                <h3 className="text-sm font-bold text-[#3B0A0F] uppercase">
                  COA Legal Condemnation Docket
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#6E2B32] hover:text-[#A60212]"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-3 p-2.5 bg-[#FEE2E2] border border-[#FECACA] rounded text-xs text-[#A60212] font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Select Unserviceable Asset *
                </label>
                <select
                  name="assetId"
                  required
                  className="w-full bg-cream border border-border rounded p-2 text-xs text-[#3B0A0F] font-semibold"
                >
                  <option value="">Select asset for condemnation...</option>
                  {unserviceableAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.propertyNo} — {a.name} ({a.unitCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    Disposal Method *
                  </label>
                  <select
                    name="method"
                    required
                    className="w-full bg-[#FFFFFF] border border-border rounded p-2 text-xs text-[#3B0A0F]"
                  >
                    <option value="PUBLIC_AUCTION">Public Auction (Bidding)</option>
                    <option value="DONATION">Donation to Public School</option>
                    <option value="DESTRUCTION">Destruction / Scrap Salvage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    Appraised Scrap Value (₱ PHP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="appraisedScrapValue"
                    defaultValue="2500"
                    placeholder="2500.00"
                    className="w-full bg-cream border border-border rounded p-2 text-xs font-mono font-bold text-[#3B0A0F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Technical Condemnation Justification *
                </label>
                <textarea
                  name="reason"
                  rows={3}
                  required
                  placeholder="Detail parts obsolescence, repair cost vs residual value analysis, and why property is beyond economical repair..."
                  className="w-full bg-cream border border-border rounded p-2 text-xs text-[#3B0A0F]"
                />
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                >
                  {isPending ? "Submitting..." : "Generate Disposal Docket"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
