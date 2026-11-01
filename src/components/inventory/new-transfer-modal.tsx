"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createTransferRequestAction } from "@/actions/transfer-actions";
import { useOperationId } from "@/lib/use-operation-id";

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
  defaultAssetId?: string;
  triggerButton?: React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>;
}

export function NewTransferModal({ assets, units, defaultAssetId, triggerButton }: TransferModalProps) {
  const router = useRouter();
  const operationId = useOperationId();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const submitting = React.useRef(false);
  const fieldId = React.useId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [success, setSuccess] = React.useState(false);
  const [selectedAssetId, setSelectedAssetId] = React.useState(defaultAssetId || "");
  const [selectedUnitId, setSelectedUnitId] = React.useState("");
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const destinations = units.filter((unit) => unit.id !== selectedAsset?.unitId);
  const hasDestination = destinations.some((unit) => unit.id === selectedUnitId);

  React.useEffect(() => {
    if (isOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [isOpen]);

  const openModal = () => {
    setSelectedAssetId(defaultAssetId || "");
    setSelectedUnitId("");
    setError(null);
    setFieldErrors({});
    setSuccess(false);
    formRef.current?.reset();
    operationId.reset();
    setIsOpen(true);
  };

  const submitTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || success) return;
    if (!selectedAsset || !hasDestination) {
      setError("Choose an available asset and a different receiving college or unit.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    formData.set("operationId", operationId(formData));
    submitting.current = true;
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await createTransferRequestAction(formData);
      if ("error" in result) {
        setError(result.error || "Unable to save this transfer request.");
        setFieldErrors("fieldErrors" in result ? result.fieldErrors ?? {} : {});
      } else {
        setSuccess(true);
        operationId.reset();
        router.refresh();
      }
    } catch {
      setError("The response could not be confirmed. Refresh the request list before retrying.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      {triggerButton ? React.cloneElement(triggerButton, {
        type: "button",
        onClick: (event) => { triggerButton.props.onClick?.(event); if (!event.defaultPrevented) openModal(); },
      }) : (
        <button type="button" onClick={openModal} className="h-10 px-4 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-2 border border-[#A60212] transition-colors shadow-sm">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Initiate Transfer Request</span>
        </button>
      )}
      <dialog ref={dialogRef} onClose={() => setIsOpen(false)} aria-labelledby={`${fieldId}-title`} onCancel={(event) => { if (submitting.current) event.preventDefault(); }} className="fixed inset-0 m-auto bg-white border-2 border-[#A60212] rounded-lg max-w-xl w-[calc(100%_-_2rem)] max-h-[90vh] overflow-y-auto p-6 shadow-2xl backdrop:bg-[#3B0A0F]">
        {isOpen && <>
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#A60212]">Property Transfer Report (PTR)</span>
            <h3 id={`${fieldId}-title`} className="text-base font-extrabold text-[#3B0A0F]">Request College Asset Transfer</h3>
          </div>
          <button type="button" aria-label="Close transfer request" disabled={loading} onClick={() => dialogRef.current?.close()} className="text-[#6E2B32] hover:text-[#3B0A0F] p-2 rounded hover:bg-cream disabled:opacity-50">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        {error && <div role="alert" className="mt-3 bg-cream border border-[#A60212] text-[#A60212] px-3 py-2 rounded text-xs font-semibold">{error}</div>}
        {success && <div role="status" className="mt-3 bg-cream border border-[#D97B1A] text-[#3B0A0F] px-3 py-2 rounded text-xs font-bold">Transfer request submitted for AMO approval. The asset remains with its current college until approved.</div>}
        <form ref={formRef} onSubmit={submitTransfer} className="mt-4 space-y-4" aria-busy={loading}>
          <fieldset disabled={loading || success} className="space-y-4">
            <div>
              <label htmlFor={`${fieldId}-asset`} className="text-xs font-bold text-[#3B0A0F] block mb-1">Asset to Transfer *</label>
              <select id={`${fieldId}-asset`} name="assetId" aria-invalid={Boolean(fieldErrors.assetId)} aria-describedby={fieldErrors.assetId ? `${fieldId}-asset-error` : undefined} required value={selectedAssetId} onChange={(event) => { setSelectedAssetId(event.target.value); setSelectedUnitId(""); setError(null); }} className="w-full h-10 px-3 rounded border border-border bg-cream text-xs font-semibold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]">
                <option value="">-- Choose asset by product code or title --</option>
                {assets.map((asset) => <option key={asset.id} value={asset.id}>[{asset.propertyNo}] {asset.name} — Current: {asset.unitCode}</option>)}
              </select>
              {fieldErrors.assetId && <p id={`${fieldId}-asset-error`} className="text-xs text-[#A60212]">{fieldErrors.assetId}</p>}
              {assets.length === 0 && <p className="mt-2 text-xs text-[#6E2B32]">No assets are currently eligible. Check pending requests or refresh this page.</p>}
            </div>
            {selectedAsset && <div className="bg-cream border border-border p-3 rounded text-xs space-y-1"><span className="text-[11px] text-[#6E2B32] font-semibold">Origin College / Unit</span><p className="font-bold text-[#3B0A0F]">{selectedAsset.unitCode}</p></div>}
            <div>
              <label htmlFor={`${fieldId}-college`} className="text-xs font-bold text-[#3B0A0F] block mb-1">Receiving College / Unit *</label>
              <select id={`${fieldId}-college`} name="toUnitId" aria-invalid={Boolean(fieldErrors.toUnitId)} aria-describedby={fieldErrors.toUnitId ? `${fieldId}-college-error` : undefined} required disabled={!selectedAsset || loading || success} value={hasDestination ? selectedUnitId : ""} onChange={(event) => setSelectedUnitId(event.target.value)} className="w-full h-10 px-3 rounded border border-border bg-cream text-xs font-semibold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]">
                <option value="">-- Choose receiving college or unit --</option>
                {destinations.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} — {unit.name}</option>)}
              </select>
              {fieldErrors.toUnitId && <p id={`${fieldId}-college-error`} className="text-xs text-[#A60212]">{fieldErrors.toUnitId}</p>}
              {selectedAsset && destinations.length === 0 && <p className="mt-2 text-xs text-[#6E2B32]">No other active receiving college or unit is available.</p>}
            </div>
            <p className="text-xs text-[#6E2B32]">This transfer is recorded by college. No recipient name or position is required.</p>
            <label className="block text-xs font-bold text-[#3B0A0F]">Remarks / Reason (optional)<textarea name="remarks" aria-invalid={Boolean(fieldErrors.remarks)} aria-describedby={fieldErrors.remarks ? `${fieldId}-remarks-error` : undefined} maxLength={500} rows={3} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm" /></label>
            {fieldErrors.remarks && <p id={`${fieldId}-remarks-error`} className="text-xs text-[#A60212]">{fieldErrors.remarks}</p>}
          </fieldset>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button type="button" disabled={loading} onClick={() => dialogRef.current?.close()} className="h-10 px-4 rounded border border-border text-[#3B0A0F] hover:bg-cream font-bold text-xs disabled:opacity-50">{success ? "Done" : "Cancel"}</button>
            {!success && <button type="submit" disabled={loading || !selectedAsset || !hasDestination} className="h-10 px-4 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs shadow-sm disabled:bg-sand disabled:text-[#6E2B32] disabled:cursor-not-allowed">{loading ? "Submitting…" : "Submit Transfer Request"}</button>}
          </div>
        </form>
        </>}
      </dialog>
    </>
  );
}
