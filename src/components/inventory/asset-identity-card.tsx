"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getStatusBadgeStyle } from "@/config/theme";
import { updateAssetStatusAction, requestTransferAction } from "@/actions/inventory-actions";
import { Button } from "@/components/ui/button";

interface AssetIdentityCardProps {
  asset: {
    id: string;
    propertyNo: string;
    name: string;
    description?: string | null;
    classification: string;
    category: { name: string; usefulLifeYears: number };
    unit: { id: string; code: string; name: string };
    accountablePerson?: { id: string; fullName: string; position: string } | null;
    serialNo?: string | null;
    acquisitionCost: number;
    acquisitionDate: Date;
    status: string;
    condition: string;
    lastVerifiedAt?: Date | null;
  };
  allUnits: { id: string; code: string; name: string }[];
}

export function AssetIdentityCard({ asset, allUnits }: AssetIdentityCardProps) {
  const [transferModalOpen, setTransferModalOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const badge = getStatusBadgeStyle(asset.status);

  // Compute straight-line depreciation
  const acqYear = new Date(asset.acquisitionDate).getFullYear();
  const currentYear = new Date().getFullYear();
  const elapsedYears = Math.max(0, currentYear - acqYear);
  const usefulLife = asset.category.usefulLifeYears || 5;
  const annualDepreciation = asset.acquisitionCost / usefulLife;
  const accumulatedDepreciation = Math.min(
    asset.acquisitionCost,
    annualDepreciation * elapsedYears
  );
  const bookValue = Math.max(0, asset.acquisitionCost - accumulatedDepreciation);
  const amortizedPercent = Math.min(100, Math.round((accumulatedDepreciation / asset.acquisitionCost) * 100));

  const handleTransferSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("assetId", asset.id);
    await requestTransferAction(formData);
    setIsPending(false);
    setTransferModalOpen(false);
  };

  const handleMarkStatus = async (status: string) => {
    if (confirm(`Change asset status to ${status}?`)) {
      await updateAssetStatusAction(asset.id, status);
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-6 select-none">
      {/* Top Identity Lockup */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-[#EBD3B2]">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-[#FFF4E0] text-[#A60212] border border-[#D97B1A] font-black text-xs px-2.5 py-1 rounded font-mono">
              PRODUCT CODE: {asset.propertyNo}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border ${badge.bg} ${badge.border} ${badge.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
              {badge.label}
            </span>
            <span className="bg-[#FFFFFF] text-[#3B0A0F] border border-[#EBD3B2] text-xs font-bold px-2 py-1 rounded font-mono">
              {asset.classification}
            </span>
          </div>
          <h1 className="text-xl font-black text-[#3B0A0F] tracking-tight leading-tight">
            {asset.name}
          </h1>
          <p className="text-xs text-[#6E2B32] mt-1">
            Acquired: {formatDate(asset.acquisitionDate)} • Initial Cost:{" "}
            {formatCurrency(asset.acquisitionCost)}
          </p>
        </div>

        {/* Quick Operations Button Cluster */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTransferModalOpen(true)}
            className="gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
            <span>Transfer Unit</span>
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => handleMarkStatus("MISSING")}
            className="gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">warning</span>
            <span>Report Missing</span>
          </Button>
        </div>
      </div>

      {/* 3-Column Metadata Grid */}
      <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6 text-xs">
        <div>
          <p className="font-bold text-[#6E2B32] uppercase tracking-wider text-[11px]">Category</p>
          <p className="text-[#3B0A0F] font-semibold mt-0.5">{asset.category.name}</p>
        </div>

        <div>
          <p className="font-bold text-[#6E2B32] uppercase tracking-wider text-[11px]">
            Serial Number
          </p>
          <p className="text-[#3B0A0F] font-bold mt-0.5 font-mono">
            {asset.serialNo || "NO SERIAL RECORDED"}
          </p>
        </div>

        <div>
          <p className="font-bold text-[#6E2B32] uppercase tracking-wider text-[11px]">Condition</p>
          <p className="text-[#3B0A0F] font-semibold mt-0.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[#D97B1A] text-[16px]">
              verified
            </span>
            <span>{asset.condition} (Inspected)</span>
          </p>
        </div>

        <div>
          <p className="font-bold text-[#6E2B32] uppercase tracking-wider text-[11px]">
            Operating Unit
          </p>
          <p className="text-[#3B0A0F] font-semibold mt-0.5">
            {asset.unit.code} — {asset.unit.name}
          </p>
        </div>

        <div>
          <p className="font-bold text-[#6E2B32] uppercase tracking-wider text-[11px]">
            Received By
          </p>
          <p className="text-[#3B0A0F] font-semibold mt-0.5">
            {asset.accountablePerson?.fullName || "Unassigned Storage Pool"}
          </p>
          {asset.accountablePerson && (
            <p className="text-[10px] text-[#6E2B32]">{asset.accountablePerson.position}</p>
          )}
        </div>

        <div>
          <p className="font-bold text-[#6E2B32] uppercase tracking-wider text-[11px]">
            Current Carrying Book Value
          </p>
          <p className="text-[#A60212] font-black text-sm font-mono mt-0.5">
            {formatCurrency(bookValue)}
          </p>
          <p className="text-[10px] text-[#6E2B32] font-mono">
            {amortizedPercent}% Depreciated ({usefulLife} Yrs Life)
          </p>
        </div>
      </div>

      {/* Description Strip */}
      {asset.description && (
        <div className="mt-4 pt-3 border-t border-[#EBD3B2] bg-[#FFF4E0] p-3 rounded text-xs text-[#3B0A0F]">
          <strong className="text-[#A60212] font-bold">Specs &amp; Configuration: </strong>
          {asset.description}
        </div>
      )}

      {/* Transfer Request Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B0A0F]/80">
          <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded w-full max-w-md p-6 select-none">
            <h3 className="text-sm font-bold text-[#3B0A0F] uppercase pb-2 border-b border-[#EBD3B2]">
              Initiate Custody Transfer Request
            </h3>
            <p className="text-xs text-[#6E2B32] mt-2">
              Transfer asset <strong className="text-[#A60212]">{asset.propertyNo}</strong> from{" "}
              {asset.unit.code} to another operating unit.
            </p>

            <form onSubmit={handleTransferSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Destination Operating Unit *
                </label>
                <select
                  name="toUnitId"
                  required
                  className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded p-2 text-xs text-[#3B0A0F] font-semibold"
                >
                  <option value="">Select target unit...</option>
                  {allUnits
                    .filter((u) => u.id !== asset.unit.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3B0A0F] uppercase mb-1">
                  Transfer Justification / Purpose
                </label>
                <textarea
                  name="remarks"
                  rows={2}
                  required
                  placeholder="e.g. Laboratory re-allocation for academic research..."
                  className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded p-2 text-xs text-[#3B0A0F]"
                />
              </div>

              <div className="pt-3 border-t border-[#EBD3B2] flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setTransferModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                >
                  {isPending ? "Submitting..." : "Submit Transfer Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
