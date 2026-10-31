"use client";
import { useOperationId } from "@/lib/use-operation-id";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { createUnitAction, updateUnitAction } from "@/actions/master-data-actions";

export interface UnitItem {
  id: string;
  code: string;
  name: string;
  unitType: string;
  campus?: string;
  parentUnitId?: string | null;
  isActive: boolean;
  assetCount?: number;
  personCount?: number;
}

interface UnitModalProps {
  existingUnit?: UnitItem | null;
  allUnits: { id: string; code: string; name: string }[];
  triggerButton?: React.ReactNode;
  onSuccess?: () => void;
}

export function UnitModal({
  existingUnit,
  allUnits,
  triggerButton,
  onSuccess,
}: UnitModalProps) {
  const operationId = useOperationId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEditing = Boolean(existingUnit);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("operationId", operationId(formData));
    const result = isEditing && existingUnit
      ? await updateUnitAction(existingUnit.id, formData)
      : await createUnitAction(formData);

    setIsPending(false);
    if (result.error) {
      setError(result.error);
    } else {
      operationId.reset(); setIsOpen(false);
      if (onSuccess) onSuccess();
    }
  };

  return (
    <>
      {triggerButton ? (
        <span onClick={() => setIsOpen(true)} className="inline-block cursor-pointer">
          {triggerButton}
        </span>
      ) : (
        <Button
          variant="primary"
          onClick={() => setIsOpen(true)}
          className="gap-1.5 shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add_business</span>
          <span>Add College / Unit</span>
        </Button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B0A0F]/80 backdrop-blur-xs select-none">
          <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EBD3B2]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#A60212] text-[22px]">
                  {isEditing ? "edit_square" : "domain_add"}
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#3B0A0F] uppercase tracking-wide">
                    {isEditing ? `Edit Unit: ${existingUnit?.code}` : "Register New College or Operating Unit"}
                  </h2>
                  <p className="text-[11px] text-[#6E2B32]">
                    BulSU Institutional Organizational Hierarchy
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[#6E2B32] hover:text-[#A60212] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {error && (
              <div className="mt-3 p-3 bg-[#FEE2E2] border border-[#FECACA] rounded text-xs text-[#A60212] font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                    Unit / College Code *
                  </label>
                  <input
                    name="code"
                    type="text"
                    required
                    defaultValue={existingUnit?.code || ""}
                    placeholder="e.g. CICT, CON, AMO"
                    className="w-full uppercase font-mono font-bold px-3 py-2 border border-[#EBD3B2] rounded bg-[#FFF4E0]/30 focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                  />
                  <span className="text-[10px] text-[#6E2B32]">Unique organizational acronym</span>
                </div>

                <div>
                  <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                    Unit Type *
                  </label>
                  <select
                    name="unitType"
                    defaultValue={existingUnit?.unitType || "ACADEMIC"}
                    className="w-full px-3 py-2 border border-[#EBD3B2] rounded bg-[#FFF4E0]/30 focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                  >
                    <option value="ACADEMIC">Academic College / Dept</option>
                    <option value="ADMINISTRATIVE">Administrative Office</option>
                    <option value="AUXILIARY">Auxiliary Service / Facility</option>
                    <option value="SATELLITE_CAMPUS">Satellite Campus / Branch</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                  Full College or Office Name *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={existingUnit?.name || ""}
                  placeholder="e.g. College of Information and Communications Technology"
                  className="w-full px-3 py-2 border border-[#EBD3B2] rounded bg-[#FFF4E0]/30 focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                    Campus Location
                  </label>
                  <select
                    name="campus"
                    defaultValue={existingUnit?.campus || "MAIN_CAMPUS"}
                    className="w-full px-3 py-2 border border-[#EBD3B2] rounded bg-[#FFF4E0]/30 focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                  >
                    <option value="MAIN_CAMPUS">Main Campus (Malolos)</option>
                    <option value="BUSTOS">Bustos Campus</option>
                    <option value="MENESES">Meneses Campus (Bulakan)</option>
                    <option value="SARMIENTO">Sarmiento Campus (SJDM)</option>
                    <option value="HAGONOY">Hagonoy Campus</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                    Parent Hierarchy
                  </label>
                  <select
                    name="parentUnitId"
                    defaultValue={existingUnit?.parentUnitId || "NONE"}
                    className="w-full px-3 py-2 border border-[#EBD3B2] rounded bg-[#FFF4E0]/30 focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                  >
                    <option value="NONE">— Independent Top Unit —</option>
                    {allUnits
                      .filter((u) => u.id !== existingUnit?.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code} — {u.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#EBD3B2] flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isPending}
                  className="gap-1.5"
                >
                  {isPending && (
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                      progress_activity
                    </span>
                  )}
                  <span>{isEditing ? "Save Changes" : "Create Unit"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
