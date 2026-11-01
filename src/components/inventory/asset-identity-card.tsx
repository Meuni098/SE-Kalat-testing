"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { getStatusBadgeStyle } from "@/config/theme";
import { IncidentFilingModal } from "@/components/missing/incident-filing-modal";
import Link from "next/link";
import { NewTransferModal } from "./new-transfer-modal";
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
  canTransfer: boolean;
  canReportMissing: boolean;
  hasActiveMissingReport: boolean;
  allUnits: { id: string; code: string; name: string }[];
}

export function AssetIdentityCard({ asset, allUnits, canTransfer, canReportMissing, hasActiveMissingReport }: AssetIdentityCardProps) {

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

  return (
    <div className="bg-[#FFFFFF] border border-border rounded p-6 select-none">
      {/* Top Identity Lockup */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="border font-black text-xs px-2.5 py-1 rounded font-mono badge-solid badge-amber">
              PRODUCT CODE: {asset.propertyNo}
            </span>
            <span
              className={` inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border  badge-solid ${badge.bg} ${badge.border} ${badge.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
              {badge.label}
            </span>
            <span className={`border text-xs font-bold px-2 py-1 rounded font-mono badge-solid ${asset.classification === "PPE" ? "badge-maroon" : "badge-slate"}`}>
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
          {canTransfer && <NewTransferModal
            assets={[{ id: asset.id, propertyNo: asset.propertyNo, name: asset.name, unitId: asset.unit.id, unitCode: asset.unit.code }]}
            units={allUnits}
            defaultAssetId={asset.id}
            triggerButton={<Button variant="secondary" size="sm" className="gap-1"><span aria-hidden="true" className="material-symbols-outlined text-[15px]">swap_horiz</span><span>Transfer Unit</span></Button>}
          />}

          {hasActiveMissingReport ? <Link href="/missing" className="text-xs font-bold text-[#A60212] hover:underline">View missing incident</Link> : canReportMissing && <IncidentFilingModal
            assets={[{ id: asset.id, propertyNo: asset.propertyNo, name: asset.name, unitCode: asset.unit.code }]}
            defaultAssetId={asset.id}
            triggerLabel={asset.status === "MISSING" ? "Complete incident report" : "Report Missing"}
          />}
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
            <span aria-hidden="true" className="material-symbols-outlined text-[#D97B1A] text-[16px]">
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
        <div className="mt-4 pt-3 border-t border-border bg-cream p-3 rounded text-xs text-[#3B0A0F]">
          <strong className="text-[#A60212] font-bold">Specs &amp; Configuration: </strong>
          {asset.description}
        </div>
      )}

    </div>
  );
}
