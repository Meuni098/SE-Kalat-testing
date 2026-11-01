"use client";
import { useOperationId } from "@/lib/use-operation-id";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/actions/master-data-actions";

export interface CategoryItem {
  id: string;
  code: string;
  name: string;
  classification: string;
  usefulLifeYears: number;
  assetCount?: number;
  totalValuation?: number;
}

interface CategoryModalProps {
  existingCategory?: CategoryItem | null;
  triggerButton?: React.ReactNode;
  onSuccess?: () => void;
  onCreated?: (category: CategoryItem) => void;
}

export function CategoryModal({
  existingCategory,
  triggerButton,
  onSuccess,
  onCreated,
}: CategoryModalProps) {
  const operationId = useOperationId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEditing = Boolean(existingCategory);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("operationId", operationId(formData));
    try {
      const result = isEditing && existingCategory
        ? await updateCategoryAction(existingCategory.id, formData)
        : await createCategoryAction(formData);

      if (result.error) {
        setError(result.error);
      } else if ("category" in result && result.category) {
        if (!isEditing) onCreated?.(result.category);
        operationId.reset(); setIsOpen(false);
        onSuccess?.();
      }
    } catch {
      setError("Unable to save the category. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async () => {
    if (!existingCategory) return;
    if (!confirm(`Are you sure you want to permanently delete category '${existingCategory.code}'?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const result = await deleteCategoryAction(existingCategory.id);
    setIsDeleting(false);

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
          <span className="material-symbols-outlined text-[18px]">category</span>
          <span>Add Asset Category</span>
        </Button>
      )}

      {isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B0A0F] select-none">
          <div role="dialog" aria-modal="true" aria-label={isEditing ? "Edit category" : "Create category"} className="bg-[#FFFFFF] border-2 border-[#A60212] rounded w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#A60212] text-[22px]">
                  {isEditing ? "edit_note" : "new_label"}
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#3B0A0F] uppercase tracking-wide">
                    {isEditing ? `Edit Category: ${existingCategory?.code}` : "Create Asset Category"}
                  </h2>

                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending || isDeleting}
                aria-label="Close category form"
                className="text-[#6E2B32] hover:text-[#A60212] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {error && (
              <div role="alert" className="mt-3 p-3 bg-[#FEE2E2] border border-[#FECACA] rounded text-xs text-[#A60212] font-semibold flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">warning</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                    Category Code *
                  </label>
                  <input
                    name="code"
                    type="text"
                    required
                    disabled={isEditing}
                    defaultValue={existingCategory?.code || ""}
                    placeholder="e.g. LAPTOPS"
                    minLength={3}
                    maxLength={15}
                    pattern="[A-Za-z0-9-]{3,15}"
                    className="w-full uppercase font-mono font-bold px-3 py-2 border border-border rounded bg-cream focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212] disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed disabled:cursor-not-allowed"
                  />
                  <span className="text-[10px] text-[#6E2B32]">
                    {isEditing ? "Category code is immutable" : "Standard institutional code (3–15 chars)"}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                    Primary COA Class *
                  </label>
                  <select
                    name="classification"
                    defaultValue={existingCategory?.classification || "PPE"}
                    className="w-full px-3 py-2 border border-border rounded bg-cream focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                  >
                    <option value="PPE">Property, Plant &amp; Equipment (PPE ≥ ₱50k)</option>
                    <option value="SEMI_EXPENDABLE">Semi-Expendable Supplies (&lt; ₱50k)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                  Category Name &amp; Description *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={existingCategory?.name || ""}
                  placeholder="e.g. Laptops, Phones, or Air Conditioners"
                  maxLength={100}
                  className="w-full px-3 py-2 border border-border rounded bg-cream focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                  Estimated Useful Life (Years) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    name="usefulLifeYears"
                    type="number"
                    min="1"
                    max="50"
                    required
                    defaultValue={existingCategory?.usefulLifeYears || 5}
                    className="w-32 font-mono font-bold px-3 py-2 border border-border rounded bg-cream focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                  />
                  <span className="text-[11px] text-[#6E2B32]">
                    Years (used for Straight-Line Depreciation in COA Form 74-A)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isPending || isDeleting}
                      className="text-xs text-[#A60212] hover:underline font-bold flex items-center gap-1 disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Delete Category</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={isPending || isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isPending || isDeleting}
                    className="gap-1.5"
                  >
                    {isPending && (
                      <span className="material-symbols-outlined animate-spin text-[16px]">
                        progress_activity
                      </span>
                    )}
                    <span>{isEditing ? "Save Changes" : "Create Category"}</span>
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
        , document.body
      )}
    </>
  );
}
