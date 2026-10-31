"use client";

import * as React from "react";
import { createInspectionRecordAction } from "@/actions/inspection-actions";

interface InspectionModalProps {
  assets: {
    id: string;
    propertyNo: string;
    name: string;
    unitCode: string;
    condition: string;
  }[];
}

export function NewInspectionModal({ assets }: InspectionModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const [selectedAssetId, setSelectedAssetId] = React.useState("");
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await createInspectionRecordAction(formData);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
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
        <span className="material-symbols-outlined text-[18px]">add_circle</span>
        <span>Log Technical Inspection</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#3B0A0F]/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded-lg max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#EBD3B2]">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#A60212]">
                  Inspection &amp; Acceptance Report (IAR)
                </span>
                <h3 className="text-base font-extrabold text-[#3B0A0F]">
                  Record Physical Inspection
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#6E2B32] hover:text-[#3B0A0F] p-1 rounded hover:bg-[#FFF4E0]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

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
                <span>Inspection record logged and asset condition updated!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#3B0A0F] block mb-1">
                  Target Asset (Optional if General Delivery)
                </label>
                <select
                  name="assetId"
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full h-10 px-3 rounded border border-[#EBD3B2] bg-[#FFF4E0] text-xs font-semibold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                >
                  <option value="">-- General Inspection / Pre-delivery Batch --</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.propertyNo}] {a.name} ({a.unitCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#3B0A0F] block mb-1">
                    Inspection Result *
                  </label>
                  <select
                    name="result"
                    required
                    defaultValue="ACCEPTED"
                    className="w-full h-10 px-3 rounded border border-[#EBD3B2] bg-[#FFF4E0] text-xs font-semibold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                  >
                    <option value="ACCEPTED">ACCEPTED — Compliant with specifications</option>
                    <option value="CONDITIONAL">CONDITIONAL — Pending adjustments/repairs</option>
                    <option value="REJECTED">REJECTED — Non-compliant / Unserviceable</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#3B0A0F] block mb-1">
                    Condition Grading *
                  </label>
                  <select
                    name="condition"
                    required
                    defaultValue={selectedAsset?.condition || "GOOD"}
                    className="w-full h-10 px-3 rounded border border-[#EBD3B2] bg-[#FFF4E0] text-xs font-semibold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                  >
                    <option value="EXCELLENT">EXCELLENT — Pristine / Brand New</option>
                    <option value="GOOD">GOOD — Normal operational wear</option>
                    <option value="FAIR">FAIR — Minor defect / needs service</option>
                    <option value="UNSERVICEABLE">UNSERVICEABLE — Beyond repair / scrap</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#3B0A0F] block mb-1">
                  Technical Remarks &amp; Observations *
                </label>
                <textarea
                  name="remarks"
                  required
                  rows={3}
                  placeholder="e.g. Serial numbers verified against delivery receipt; power supply and thermal dissipation normal; all bundled cables intact..."
                  className="w-full p-2.5 rounded border border-[#EBD3B2] bg-[#FFF4E0] text-xs font-medium text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                />
              </div>

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
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      <span>Save Inspection Record</span>
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
