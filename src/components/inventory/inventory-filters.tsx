"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface UnitOption {
  id: string;
  code: string;
  name: string;
}

interface InventoryFiltersProps {
  units: UnitOption[];
}

export function InventoryFilters({ units }: InventoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") || "";
  const classification = searchParams.get("classification")==="ALL"?"":searchParams.get("classification") || "";
  const unitId = searchParams.get("unitId") || "";
  const status = searchParams.get("status") || "";

  const [localSearch, setLocalSearch] = React.useState(search);

  const applyFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/inventory?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilter("search", localSearch.trim());
  };

  const handleClearAll = () => {
    setLocalSearch("");
    router.push("/inventory");
  };

  const hasActiveFilters = Boolean(search || classification || unitId || status);

  return (
    <div className="bg-[#FFFFFF] border border-border rounded p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-[280px]">
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[18px] text-[#6E2B32]">
              search
            </span>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search product code, serial, name..."
              className="w-full bg-cream text-[#3B0A0F] border border-border rounded pl-9 pr-3 py-1.5 text-xs font-medium focus:border-[#A60212] focus:outline-none"
            />
          </form>

          {/* Classification Dropdown */}
          <select
            aria-label="Inventory classification"
            value={classification}
            onChange={(e) => applyFilter("classification", e.target.value)}
            className="bg-[#FFFFFF] text-[#3B0A0F] border border-border rounded px-3 py-1.5 text-xs font-semibold hover:bg-cream focus:border-[#A60212] focus:outline-none cursor-pointer"
          >
            <option value="">Classification: All</option>
            <option value="PPE">Property, Plant &amp; Equipment (PPE)</option>
            <option value="SEMI_EXPENDABLE">Semi-Expendable Supplies</option>
          </select>

          {/* Unit Dropdown */}
          <select
            value={unitId}
            onChange={(e) => applyFilter("unitId", e.target.value)}
            className="bg-[#FFFFFF] text-[#3B0A0F] border border-border rounded px-3 py-1.5 text-xs font-semibold hover:bg-cream focus:border-[#A60212] focus:outline-none cursor-pointer"
          >
            <option value="">Unit: All Operating Units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.name}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={status}
            onChange={(e) => applyFilter("status", e.target.value)}
            className="bg-[#FFFFFF] text-[#3B0A0F] border border-border rounded px-3 py-1.5 text-xs font-semibold hover:bg-cream focus:border-[#A60212] focus:outline-none cursor-pointer"
          >
            <option value="">Status: All Statuses</option>
            <option value="IN_USE">In Active Use</option>
            <option value="IN_STORAGE">In Storage</option>
            <option value="UNDER_REPAIR">Under Repair</option>
            <option value="MISSING">Missing / Unaccounted</option>
            <option value="FOR_DISPOSAL">For Disposal</option>
            <option value="DISPOSED">Disposed</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-[#A60212] hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
