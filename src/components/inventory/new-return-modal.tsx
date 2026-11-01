"use client";
import { useOperationId } from "@/lib/use-operation-id";

import * as React from "react";
import { ManualPersonFields } from "@/components/people/manual-person-fields";
import { createReturnRequestAction } from "@/actions/return-actions";

interface ReturnModalProps {
  assets: {
    id: string;
    propertyNo: string;
    name: string;
    unitCode: string;
    currentCustodian?: string | null;
  }[];
}

export function NewReturnModal({ assets }: ReturnModalProps) {
  const operationId = useOperationId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const [selectedAssetId, setSelectedAssetId] = React.useState("");


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("operationId", operationId(formData));

    let res;
    try { res = await createReturnRequestAction(formData); }
    catch { setError("The response could not be confirmed. Refresh the transaction list before retrying."); setLoading(false); return; }
    setLoading(false);

    if ("error" in res) {
      setError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        operationId.reset(); setIsOpen(false);
        setSelectedAssetId("");
      }, 1200);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="h-10 px-4 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-2 border border-[#A60212] transition-colors shadow-sm"
      >
        <span className="material-symbols-outlined text-[18px]">assignment_return</span>
        <span>Initiate Asset Surrender</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#3B0A0F] flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#A60212]">
                  Property Custody Surrender
                </span>
                <h3 className="text-base font-extrabold text-[#3B0A0F]">
                  Return Asset to Central AMO Storage
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#6E2B32] hover:text-[#3B0A0F] p-1 rounded hover:bg-cream"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {error && (
              <div className="mt-3 bg-cream border border-[#A60212] text-[#A60212] px-3 py-2 rounded text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mt-3 bg-cream border border-[#D97B1A] text-[#3B0A0F] px-3 py-2 rounded text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#A60212]">
                  check_circle
                </span>
                <span>Return request filed! Awaiting warehouse intake verification.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#3B0A0F] block mb-1">
                  Select Asset to Surrender *
                </label>
                <select
                  name="assetId"
                  required
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full h-10 px-3 rounded border border-border bg-cream text-xs font-semibold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                >
                  <option value="">-- Choose asset by product code --</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.propertyNo}] {a.name} ({a.unitCode})
                    </option>
                  ))}
                </select>
              </div>

              <ManualPersonFields label="Person returning the item" college={<label className="block text-xs font-bold">College<input readOnly value={assets.find(a => a.id === selectedAssetId)?.unitCode || "Select an asset"} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm" /></label>} />
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="h-9 px-4 rounded border border-border text-[#3B0A0F] hover:bg-cream font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-9 px-4 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">done_all</span>
                      <span>File Return Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
