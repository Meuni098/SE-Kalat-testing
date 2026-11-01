"use client";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useOperationId } from "@/lib/use-operation-id";

import * as React from "react";
import { ManualPersonFields } from "@/components/people/manual-person-fields";
import { registerAssetAction } from "@/actions/inventory-actions";
import Link from "next/link";
import { QrVerifiedCard } from "./qr-verified-card";
import { Button } from "@/components/ui/button";

interface NewAssetModalProps {
  units: { id: string; code: string; name: string }[];
  categories: { id: string; code: string; name: string; classification: string }[];
  persons: { id: string; fullName: string; position: string }[];
}

export function NewAssetModal({ units, categories }: NewAssetModalProps) {
  const operationId = useOperationId();
  const submitLock = React.useRef(false);
  const [saved, setSaved] = React.useState<{ assetId: string; productCode: string; assetName: string; unitCode: string } | null>(null);
  const confirmationRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => { if (saved) confirmationRef.current?.focus(); }, [saved]);
  const [isOpen, setIsOpen] = React.useState(false);
  const dialogRef = useModalFocus(isOpen, setIsOpen);
  const [cost, setCost] = React.useState<number>(55000);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isPPE = cost >= 50000;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("operationId", operationId(formData));
    let result;
    try { result = await registerAssetAction(formData); }
    catch { setError("The response could not be confirmed. Retry the same submission to recover your saved product code."); setIsPending(false); submitLock.current = false; return; }

    setIsPending(false);
    submitLock.current = false;
    if ("error" in result) {
      setError(result.error ?? "Unable to save this asset.");
    } else {
      operationId.reset(); setSaved(result);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={() => { setSaved(null); setError(null); setIsOpen(true); }}
        className="gap-1.5"
      >
        <span className="material-symbols-outlined text-[18px]">add_box</span>
        <span>Register New Asset</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B0A0F]">
          <div ref={dialogRef} role="dialog" tabIndex={-1} aria-busy={isPending} aria-modal="true" aria-labelledby="registration-title" className="bg-[#FFFFFF] border-2 border-[#A60212] rounded w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#A60212] text-[22px]">
                  post_add
                </span>
                <h2 id="registration-title" className="text-base font-bold text-[#3B0A0F] uppercase">
                  Institutional Asset Registration
                </h2>
              </div>
              <button
                disabled={isPending} aria-label="Close registration" onClick={() => setIsOpen(false)}
                className="text-[#6E2B32] hover:text-[#A60212]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {error && (
              <div role="alert" className="mt-3 p-2.5 bg-[#FEE2E2] border border-[#FECACA] rounded text-xs text-[#A60212] font-semibold">
                {error}
              </div>
            )}

            {saved ? <div className="mt-4 space-y-4">
              <h3 ref={confirmationRef} tabIndex={-1} className="font-bold" role="status">Item saved. Your product code and QR label are ready below.</h3>
              <QrVerifiedCard propertyNo={saved.productCode} assetName={saved.assetName} unitCode={saved.unitCode} />
              <div className="flex items-center justify-end gap-4">
                <Link href={`/inventory/${saved.assetId}`} className="text-[#A60212] underline">View Item</Link>
                <Button onClick={() => setIsOpen(false)}>Done</Button>
              </div>
            </div> : <>
            <p className="mt-4 text-xs">Product code and QR code are generated automatically when you save.</p>
            {(!units.length || !categories.length) && <p role="alert" className="mt-2 text-sm text-[#A60212]">An active college or office and a category are required before registration.</p>}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="register-serialNo" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    Serial Number
                  </label>
                  <input id="register-serialNo"
                    type="text"
                    name="serialNo"
                    placeholder="SN-XXXX-9999"
                    className="w-full bg-cream border border-border rounded px-3 py-1.5 text-xs font-mono text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="register-name" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Asset Title / Model Name *
                </label>
                <input id="register-name"
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Dell Latitude 7440 Laptop"
                  className="w-full bg-cream border border-border rounded px-3 py-1.5 text-xs text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                />
              </div>

              <div>
                <label htmlFor="register-description" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Technical Specifications
                </label>
                <textarea id="register-description"
                  name="description"
                  rows={2}
                  placeholder="CPU, RAM, storage, optical parts, dimensions..."
                  className="w-full bg-cream border border-border rounded px-3 py-1.5 text-xs text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="register-categoryId" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    Category *
                  </label>
                  <select id="register-categoryId"
                    name="categoryId"
                    required
                    className="w-full bg-[#FFFFFF] border border-border rounded px-2.5 py-1.5 text-xs text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>


              </div>

              <div className="grid grid-cols-2 gap-3">
                <ManualPersonFields label="Received by" optional college={<div>
                  <label htmlFor="register-unitId" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    College *
                  </label>
                  <select id="register-unitId"
                    name="unitId"
                    required
                    className="w-full bg-[#FFFFFF] border border-border rounded px-2.5 py-1.5 text-xs text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.name}
                      </option>
                    ))}
                  </select>
                </div>} />

                <div>
                  <label htmlFor="register-acquisitionDate" className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                    Acquisition Date
                  </label>
                  <input id="register-acquisitionDate"
                    type="date"
                    name="acquisitionDate"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full bg-cream border border-border rounded px-3 py-1.5 text-xs text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                  />
                </div>
              </div>

              {/* Cost & Auto Classification */}
              <div>
                <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Acquisition Unit Cost (₱ PHP) *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="acquisitionCost"
                    required
                    value={cost}
                    onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                    className="w-1/2 bg-cream border border-border rounded px-3 py-1.5 text-xs font-mono font-bold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                  />
                  <div
                    className={`px-3 py-1.5 rounded text-xs font-bold border flex items-center gap-1.5 ${
                      isPPE
                        ? "bg-[#6E1829] text-[#FFFFFF] border-[#6E1829]"
                        : "bg-[#455468] text-[#FFFFFF] border-[#455468]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isPPE ? "shield" : "inventory"}
                    </span>
                    <span>
                      COA: {isPPE ? "Property, Plant & Equipment (PPE)" : "Semi-Expendable Supplies"}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-[#6E2B32] mt-1 font-mono">
                  * Threshold: ₱50,000.00 and above classifies automatically as capital PPE.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending} aria-label="Close registration" onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isPending || !units.length || !categories.length}
                >
                  {isPending ? "Registering..." : "Save & Generate Product Code"}
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
