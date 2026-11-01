"use client";
import { useOperationId } from "@/lib/use-operation-id";

import * as React from "react";
import { CategoryModal, type CategoryItem } from "@/components/master-data/category-modal";
import { Button } from "@/components/ui/button";
import {
  createProductTemplateAction,
  updateProductTemplateAction,
  deleteProductTemplateAction,
} from "@/actions/master-data-actions";

export interface ProductTemplateItem {
  id: string;
  name: string;
  categoryId: string;
  category?: { id: string; code: string; name: string };
  classification: string;
  benchmarkCost?: number | null;
  specifications?: string | null;
  isActive: boolean;
  assetCount?: number;
}

interface ProductModalProps {
  existingProduct?: ProductTemplateItem | null;
  categories: { id: string; code: string; name: string; classification: string }[];
  triggerButton?: React.ReactNode;
  onSuccess?: () => void;
}

export function ProductModal({
  existingProduct,
  categories,
  triggerButton,
  onSuccess,
}: ProductModalProps) {
  const operationId = useOperationId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [createdCategories, setCreatedCategories] = React.useState<CategoryItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState(existingProduct?.categoryId || "");
  const categorySelectId = React.useId();
  const availableCategories = [
    ...categories,
    ...createdCategories.filter((created) => !categories.some((category) => category.id === created.id)),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const isEditing = Boolean(existingProduct);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("operationId", operationId(formData));
    const result = isEditing && existingProduct
      ? await updateProductTemplateAction(existingProduct.id, formData)
      : await createProductTemplateAction(formData);

    setIsPending(false);
    if (result.error) {
      setError(result.error);
    } else {
      operationId.reset(); setIsOpen(false);
      if (onSuccess) onSuccess();
    }
  };

  const handleDelete = async () => {
    if (!existingProduct) return;
    if (!confirm(`Delete standard product template '${existingProduct.name}'?`)) return;

    setIsDeleting(true);
    setError(null);

    const result = await deleteProductTemplateAction(existingProduct.id);
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
          <span className="material-symbols-outlined text-[18px]">post_add</span>
          <span>Add Standard Product</span>
        </Button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B0A0F] select-none">
          <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#A60212] text-[22px]">
                  {isEditing ? "edit_document" : "playlist_add"}
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#3B0A0F] uppercase tracking-wide">
                    {isEditing ? "Edit Product Template" : "Catalog Standard Product Item"}
                  </h2>

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
              <div>
                <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                  Standard Product Name *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={existingProduct?.name || ""}
                  placeholder="e.g. Desktop Computer Core i7 Workstation"
                  className="w-full px-3 py-2 border border-border rounded bg-cream focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                />
                <span className="text-[10px] text-[#6E2B32]">
                  Consistent title used across inventory and procurement delivery intake
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={categorySelectId} className="block font-bold text-[#3B0A0F] uppercase mb-1">
                    Product Category *
                  </label>
                  <select
                    id={categorySelectId}
                    name="categoryId"
                    required
                    value={selectedCategoryId}
                    onChange={(event) => setSelectedCategoryId(event.target.value)}
                    className="w-full px-3 py-2 border border-border rounded bg-cream focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                  >
                    <option value="" disabled>Select a category</option>
                    {availableCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-[#6E2B32]">
                    {availableCategories.length ? "Need another category? Create one below." : "No categories yet. Add one to continue."}
                  </p>
                  <CategoryModal
                    triggerButton={<Button type="button" variant="outline" size="sm" disabled={isPending || isDeleting} className="mt-2">Add Category</Button>}
                    onCreated={(category) => {
                      setCreatedCategories((current) => [...current, category]);
                      setSelectedCategoryId(category.id);
                      requestAnimationFrame(() => document.getElementById(categorySelectId)?.focus());
                    }}
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                    Classification
                  </label>
                  <select
                    name="classification"
                    defaultValue={existingProduct?.classification || "PPE"}
                    className="w-full px-3 py-2 border border-border rounded bg-cream focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                  >
                    <option value="PPE">PPE (≥ ₱50k)</option>
                    <option value="SEMI_EXPENDABLE">Semi-Expendable (&lt; ₱50k)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                  Benchmark Cost (PHP)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-[#6E2B32] font-bold">₱</span>
                  <input
                    name="benchmarkCost"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={existingProduct?.benchmarkCost || ""}
                    placeholder="e.g. 55000"
                    className="w-full pl-7 pr-3 py-2 border border-border rounded bg-cream focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212] font-mono"
                  />
                </div>
                <span className="text-[10px] text-[#6E2B32]">
                  Reference market cost for intake budget checking
                </span>
              </div>

              <div>
                <label className="block font-bold text-[#3B0A0F] uppercase mb-1">
                  Standard Specifications Template
                </label>
                <textarea
                  name="specifications"
                  rows={3}
                  defaultValue={existingProduct?.specifications || ""}
                  placeholder="e.g. Intel Core i7 13th Gen, 16GB DDR5 RAM, 1TB NVMe SSD, 24-inch IPS Monitor, Windows 11 Pro Edu"
                  className="w-full px-3 py-2 border border-border rounded bg-cream focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212]"
                />
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
                      <span>Delete Template</span>
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
                    disabled={isPending || isDeleting || !selectedCategoryId}
                    className="gap-1.5"
                  >
                    {isPending && (
                      <span className="material-symbols-outlined animate-spin text-[16px]">
                        progress_activity
                      </span>
                    )}
                    <span>{isEditing ? "Save Changes" : "Save Template"}</span>
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
