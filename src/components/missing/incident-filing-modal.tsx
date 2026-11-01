"use client";
import { useOperationId } from "@/lib/use-operation-id";

import * as React from "react";
import { fileMissingIncidentAction } from "@/actions/missing-actions";
import { Button } from "@/components/ui/button";

interface IncidentFilingModalProps {
  assets: { id: string; propertyNo: string; name: string; unitCode: string }[];
  defaultAssetId?: string;
  triggerLabel?: string;
}

export function IncidentFilingModal({ assets, defaultAssetId, triggerLabel = "File New Missing Incident" }: IncidentFilingModalProps) {
  const operationId = useOperationId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submitting = React.useRef(false);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("operationId", operationId(formData));
    try {
      const result = await fileMissingIncidentAction(formData);
      if (result.error) {
        setError(result.error);
      } else {
        operationId.reset(); setIsOpen(false);
      }
    } catch {
      setError("The incident could not be submitted. Please try again.");
    } finally {
      submitting.current = false;
      setIsPending(false);
    }
  };

  return (
    <>
      <Button
        variant="danger"
        onClick={() => { setError(null); setIsOpen(true); }}
        disabled={assets.length === 0}
        className="gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">report_problem</span>
        <span>{triggerLabel}</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B0A0F]">
          <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded w-full max-w-lg p-6 select-none max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#A60212] text-[22px]">
                  warning
                </span>
                <h3 className="text-sm font-bold text-[#3B0A0F] uppercase">
                  COA Incident Blotter Filing
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                disabled={isPending}
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

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Select Missing Property *
                </label>
                <select
                  name="assetId"
                  defaultValue={defaultAssetId ?? ""}
                  required
                  className="w-full bg-cream border border-border rounded p-2 text-xs text-[#3B0A0F] font-semibold"
                >
                  <option value="">Select university property...</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.propertyNo} — {a.name} ({a.unitCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    Date Last Seen *
                  </label>
                  <input
                    type="date"
                    name="lastSeenDate"
                    required
                    defaultValue={today}
                    max={today}
                    className="w-full bg-cream border border-border rounded p-2 text-xs text-[#3B0A0F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    Location Last Seen *
                  </label>
                  <input
                    type="text"
                    name="locationLastSeen"
                    required
                    placeholder="e.g. CICT Lab 304, Cabinet #2"
                    className="w-full bg-cream border border-border rounded p-2 text-xs text-[#3B0A0F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Circumstances / Narrative Description *
                </label>
                <textarea
                  name="circumstances"
                  rows={3}
                  required
                  placeholder="Detail the discovery of the loss, witnesses, security checks, and initial departmental action..."
                  className="w-full bg-cream border border-border rounded p-2 text-xs text-[#3B0A0F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Police Blotter / Security Log Link (Optional)
                </label>
                <input
                  type="url"
                  name="policeBlotterUrl"
                  placeholder="https://police.bulsu.edu.ph/blotter/2024-..."
                  className="w-full bg-cream border border-border rounded p-2 text-xs text-[#3B0A0F]"
                />
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                >
                  {isPending ? "Submitting..." : "Submit Incident Report"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
