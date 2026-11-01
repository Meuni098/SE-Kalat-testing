"use client";

import * as React from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getStatusBadgeStyle } from "@/config/theme";

export interface AssetRow {
  id: string;
  propertyNo: string;
  name: string;
  description?: string | null;
  classification: string;
  categoryName: string;
  unitCode: string;
  unitName: string;
  accountablePerson?: string | null;
  acquisitionDate: Date | string;
  acquisitionCost: number;
  status: string;
  condition: string;
  serialNo?: string | null;
}

interface InventoryTableProps {
  assets: AssetRow[];
}

export function InventoryTable({ assets }: InventoryTableProps) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(assets.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchPrint = () => {
    alert(`Batch printing QR codes for ${selectedIds.length} assets...`);
  };

  return (
    <div className="relative">
      <div className="bg-[#FFFFFF] border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="h-10 bg-cream border-b-2 border-border text-[#3B0A0F] text-xs font-bold uppercase select-none">
                <th className="w-10 px-3 text-center border-r border-border">
                  <input
                    type="checkbox"
                    checked={assets.length > 0 && selectedIds.length === assets.length}
                    onChange={handleSelectAll}
                    className="accent-[#A60212] cursor-pointer"
                  />
                </th>
                <th className="px-3.5 py-2 tracking-wider border-r border-border">
                  Product Code
                </th>
                <th className="px-3.5 py-2 tracking-wider border-r border-border">
                  Asset Description
                </th>
                <th className="px-3.5 py-2 tracking-wider border-r border-border">
                  Classification
                </th>
                <th className="px-3.5 py-2 tracking-wider border-r border-border">
                  Unit / Custodian
                </th>
                <th className="px-3.5 py-2 tracking-wider border-r border-border">
                  Acq. Date &amp; Cost
                </th>
                <th className="px-3.5 py-2 tracking-wider border-r border-border">
                  Status
                </th>
                <th className="px-3.5 py-2 tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#6E2B32]">
                    No assets found matching the selected filters.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => {
                  const badge = getStatusBadgeStyle(asset.status);
                  const isSelected = selectedIds.includes(asset.id);

                  return (
                    <tr
                      key={asset.id}
                      className={`hover:bg-cream transition-colors ${
                        isSelected ? "bg-cream" : "bg-[#FFFFFF]"
                      }`}
                    >
                      <td className="px-3 py-3 text-center border-r border-border">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(asset.id)}
                          className="accent-[#A60212] cursor-pointer"
                        />
                      </td>

                      <td className="px-3.5 py-3 border-r border-border whitespace-nowrap">
                        <Link
                          href={`/inventory/${asset.id}`}
                          className="font-mono font-bold text-[#A60212] hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                          <span>{asset.propertyNo}</span>
                        </Link>
                        {asset.serialNo && (
                          <div className="text-[10px] text-[#6E2B32] font-mono mt-0.5">
                            SN: {asset.serialNo}
                          </div>
                        )}
                      </td>

                      <td className="px-3.5 py-3 border-r border-border max-w-[280px]">
                        <div className="font-bold text-[#3B0A0F] leading-tight">
                          {asset.name}
                        </div>
                        {asset.description && (
                          <div className="text-[11px] text-[#6E2B32] truncate mt-0.5">
                            {asset.description}
                          </div>
                        )}
                      </td>

                      <td className="px-3.5 py-3 border-r border-border whitespace-nowrap">
                        <span
                          className={` px-2 py-0.5 rounded text-[10px] font-bold border font-mono  badge-solid ${
                            asset.classification === "PPE"
                              ? " badge-solid badge-maroon"
                              : " badge-solid badge-slate"
                          }`}
                        >
                          {asset.classification}
                        </span>
                        <div className="text-[10px] text-[#6E2B32] mt-1">
                          {asset.categoryName}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 border-r border-border">
                        <div className="font-bold text-[#3B0A0F]">{asset.unitCode}</div>
                        <div className="text-[11px] text-[#6E2B32]">
                          {asset.accountablePerson || "Unassigned"}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 border-r border-border whitespace-nowrap font-mono">
                        <div className="font-bold text-[#3B0A0F]">
                          {formatCurrency(asset.acquisitionCost)}
                        </div>
                        <div className="text-[10px] text-[#6E2B32]">
                          {formatDate(asset.acquisitionDate)}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 border-r border-border whitespace-nowrap">
                        <span
                          className={` inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border  badge-solid ${badge.bg} ${badge.border} ${badge.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          {badge.label}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <Link
                          href={`/inventory/${asset.id}`}
                          className="px-2.5 py-1 rounded bg-cream border border-border text-[#3B0A0F] hover:bg-[#A60212] hover:text-[#FFF4E0] hover:border-[#A60212] text-xs font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <span>View Dossier</span>
                          <span className="material-symbols-outlined text-[13px]">
                            arrow_forward
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-3 bg-cream border-t border-border flex items-center justify-between text-xs text-[#6E2B32] font-medium">
          <span>Showing {assets.length} official inventory records</span>
          <span className="font-mono text-[#3B0A0F] font-bold">
            Total Ledger Value:{" "}
            {formatCurrency(assets.reduce((sum, a) => sum + a.acquisitionCost, 0))}
          </span>
        </div>
      </div>

      {/* Floating Batch Action Dock */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#3B0A0F] border border-[#F5AB29] text-[#FFF4E0] px-5 py-3 rounded flex items-center gap-4 z-50 select-none">
          <span className="text-xs font-bold font-mono text-[#F5AB29]">
            {selectedIds.length} ASSETS SELECTED
          </span>
          <div className="h-4 w-[1px] bg-[#6E2B32]" />
          <button
            onClick={handleBatchPrint}
            className="px-3 py-1.5 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] text-xs font-bold flex items-center gap-1.5 border border-[#F5AB29] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Batch Print QR Tags</span>
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="text-xs text-[#EBD3B2] hover:text-[#FFF4E0] transition-colors"
          >
            Deselect All
          </button>
        </div>
      )}
    </div>
  );
}
