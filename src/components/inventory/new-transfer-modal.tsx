"use client";
import { useOperationId } from "@/lib/use-operation-id";

import * as React from "react";
import { ManualPersonFields } from "@/components/people/manual-person-fields";
import { createTransferRequestAction } from "@/actions/transfer-actions";

interface TransferModalProps {
  assets: {
    id: string;
    propertyNo: string;
    name: string;
    unitId: string;
    unitCode: string;
    currentCustodian?: string | null;
  }[];
  units: { id: string; code: string; name: string }[];
  persons: { id: string; fullName: string; position: string; unitId: string }[];
  defaultAssetId?: string;
  triggerButton?: React.ReactNode;
}

export function NewTransferModal({
  assets,
  units,
  defaultAssetId,
  triggerButton,
}: TransferModalProps) {
  const operationId = useOperationId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const [selectedAssetId, setSelectedAssetId] = React.useState(defaultAssetId || "");
  const [selectedUnitId, setSelectedUnitId] = React.useState("");

  const selectedAsset = assets.find((a) => a.id === (selectedAssetId || defaultAssetId));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("operationId", operationId(formData));

    let res;
    try { res = await createTransferRequestAction(formData); }
    catch { setError("The response could not be confirmed. Refresh the transaction list before retrying."); setLoading(false); return; }
    setLoading(false);

    if ("error" in res) {
      setError(res.error || "Unable to save this transfer request.");
    } else {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        operationId.reset(); setIsOpen(false);
        setSelectedAssetId("");
        setSelectedUnitId("");
      }, 1200);
    }
  };

  return (
    <>
      {triggerButton ? (
        <div onClick={() => setIsOpen(true)} className="inline-block cursor-pointer">
          {triggerButton}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="h-10 px-4 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-2 border border-[#A60212] transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Initiate Transfer Request</span>
        </button>
      )}


      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#3B0A0F]/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EBD3B2]">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#A60212]">
                  Property Transfer Report (PTR)
                </span>
                <h3 className="text-base font-extrabold text-[#3B0A0F]">
                  Request Inter-Unit Asset Transfer
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#6E2B32] hover:text-[#3B0A0F] p-1 rounded hover:bg-[#FFF4E0]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Error / Success Banners */}
            {error && (
              <div className="mt-3 bg-[#FFF4E0] border border-[#A60212] text-[#A60212] px-3 py-2 rounded text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mt-3 bg-[#FFF4E0] border border-[#D97B1A] text-[#3B0A0F] px-3 py-2 rounded text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#A60212]">
                  check_circle
                </span>
                <span>Transfer request submitted for AMO approval!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Asset Selector */}
              <div>
                <label className="text-xs font-bold text-[#3B0A0F] block mb-1">
                  Select Asset to Transfer *
                </label>
                <select
                  name="assetId"
                  required
                  value={selectedAssetId || defaultAssetId || ""}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full h-10 px-3 rounded border border-[#EBD3B2] bg-[#FFF4E0] text-xs font-semibold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                >
                  <option value="">-- Choose asset by product code or title --</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.propertyNo}] {a.name} — Current: {a.unitCode} (
                      {a.currentCustodian || "Unassigned"})
                    </option>
                  ))}
                </select>
              </div>

              {selectedAsset && (
                <div className="bg-[#FFF4E0] border border-[#EBD3B2] p-3 rounded text-xs space-y-1">
                  <div className="text-[11px] text-[#6E2B32] font-semibold">Origin Unit:</div>
                  <div className="font-bold text-[#3B0A0F]">
                    {selectedAsset.unitCode} • Custodian: {selectedAsset.currentCustodian || "None"}
                  </div>
                </div>
              )}

              {/* Destination Unit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ManualPersonFields label="New receiver" college={<div>
                  <label className="text-xs font-bold text-[#3B0A0F] block mb-1">
                    College *
                  </label>
                  <select
                    name="toUnitId"
                    required
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className="w-full h-10 px-3 rounded border border-[#EBD3B2] bg-[#FFF4E0] text-xs font-semibold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                  >
                    <option value="">-- Choose receiving unit --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.name}
                      </option>
                    ))}
                  </select>
                </div>} />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EBD3B2]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="h-9 px-4 rounded border border-[#EBD3B2] text-[#3B0A0F] hover:bg-[#FFF4E0] font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-9 px-4 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      <span>Submit Transfer Request</span>
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
