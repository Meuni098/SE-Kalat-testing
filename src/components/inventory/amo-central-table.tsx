"use client";

import * as React from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TransferHistoryDrawer } from "./transfer-history-drawer";
import { NewTransferModal } from "./new-transfer-modal";

export interface AmoCentralAssetRow {
  id: string;
  unitId: string;
  unitCode: string;
  canTransfer: boolean;
  isTransferAvailable: boolean;
  propertyNo: string;
  name: string;
  description?: string | null;
  classification: string;
  categoryName: string;
  acquisitionCost: number;
  acquisitionDate: Date;
  status: string;
  condition: string;
  serialNo?: string | null;
  hasPendingTransfer: boolean;
  pendingTransferId?: string | null;
  pendingToUnitCode?: string | null;
  pendingPtrNo?: string | null;
}

interface AmoCentralTableProps {
  assets: AmoCentralAssetRow[];
  units: { id: string; code: string; name: string }[];
}

export function AmoCentralTable({ assets, units }: AmoCentralTableProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [classFilter, setClassFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [historyAssetId, setHistoryAssetId] = React.useState<string | null>(null);

  // Filter assets
  const filteredAssets = React.useMemo(() => {
    return assets.filter((asset) => {
      // Classification
      if (classFilter !== "ALL" && asset.classification !== classFilter) {
        return false;
      }
      // Status
      if (statusFilter === "AVAILABLE" && !asset.isTransferAvailable) {
        return false;
      }
      if (statusFilter === "PENDING_TRANSFER" && !asset.hasPendingTransfer) {
        return false;
      }
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesProp = asset.propertyNo.toLowerCase().includes(q);
        const matchesName = asset.name.toLowerCase().includes(q);
        const matchesCat = asset.categoryName.toLowerCase().includes(q);
        const matchesSerial = asset.serialNo?.toLowerCase().includes(q) || false;
        const matchesDesc = asset.description?.toLowerCase().includes(q) || false;
        return matchesProp || matchesName || matchesCat || matchesSerial || matchesDesc;
      }
      return true;
    });
  }, [assets, classFilter, statusFilter, searchTerm]);

  // Modal assets shape
  const modalAssets = React.useMemo(() => {
    return assets
      .filter((a) => a.canTransfer)
      .map((a) => ({
        id: a.id,
        propertyNo: a.propertyNo,
        name: a.name,
        unitId: a.unitId,
        unitCode: a.unitCode,
        currentCustodian: "AMO Central Property Storage",
      }));
  }, [assets]);

  return (
    <div className="space-y-4 select-none">
      {/* Search and Filters Bar */}
      <div className="bg-[#FFFFFF] border border-border p-3.5 rounded flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex-1 max-w-md relative">
          <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-2.5 text-[#6E2B32] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search product code, equipment name, serial #, or PO..."
            className="w-full pl-9 pr-3 py-1.5 bg-cream border border-border rounded text-xs font-medium text-[#3B0A0F] placeholder-[#6E2B32]/70 focus:outline-none focus:border-[#A60212]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Classification Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase">Class:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-[#FFFFFF] border border-border rounded px-2.5 py-1.5 text-xs text-[#3B0A0F] font-semibold focus:outline-none focus:border-[#A60212]"
            >
              <option value="ALL">All Classifications</option>
              <option value="PPE">PPE (Capital Equipment ≥ ₱50k)</option>
              <option value="SEMI_EXPENDABLE">Semi-Expendable (&lt; ₱50k)</option>
            </select>
          </div>

          {/* Transfer Readiness Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#FFFFFF] border border-border rounded px-2.5 py-1.5 text-xs text-[#3B0A0F] font-semibold focus:outline-none focus:border-[#A60212]"
            >
              <option value="ALL">All In-House Statuses</option>
              <option value="AVAILABLE">Available for College Allocation</option>
              <option value="PENDING_TRANSFER">Transfer Request Pending (PTR)</option>
            </select>
          </div>

          {(searchTerm || classFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setClassFilter("ALL");
                setStatusFilter("ALL");
              }}
              className="px-2 py-1.5 text-xs text-[#A60212] hover:underline font-bold"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#FFFFFF] border border-border rounded shadow-sm overflow-hidden">
        <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="material-symbols-outlined text-[#F5AB29] text-[20px]">warehouse</span>
            <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
              AMO In-House Equipment &amp; Supplies Docket
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded border badge-solid badge-amber">
            {filteredAssets.length} of {assets.length} In-House Item(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-cream text-[#3B0A0F] border-b border-border font-black uppercase text-[11px]">
                <th className="py-2.5 px-3">Product Code</th>
                <th className="py-2.5 px-3">Equipment / Supply Item</th>
                <th className="py-2.5 px-3">Class &amp; Cost</th>
                <th className="py-2.5 px-3">Date Received</th>
                <th className="py-2.5 px-3">Warehouse Location</th>
                <th className="py-2.5 px-3">Transfer Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#6E2B32] font-medium">
                    <span aria-hidden="true" className="material-symbols-outlined text-[36px] block text-[#EBD3B2] mb-1">
                      inventory_2
                    </span>
                    No in-house assets match your filters.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-cream transition-colors">
                    {/* Property No */}
                    <td className="py-3 px-3 font-mono">
                      <Link
                        href={`/inventory/${asset.id}`}
                        className="font-bold text-[#A60212] hover:underline block"
                      >
                        {asset.propertyNo}
                      </Link>
                      {asset.serialNo && (
                        <span className="text-[10px] text-[#6E2B32] block font-mono">
                          SN: {asset.serialNo}
                        </span>
                      )}
                    </td>

                    {/* Item Name */}
                    <td className="py-3 px-3 max-w-[240px]">
                      <span className="font-bold text-[#3B0A0F] block truncate">
                        {asset.name}
                      </span>
                      <span className="text-[10px] text-[#6E2B32] block truncate">
                        {asset.categoryName}
                      </span>
                    </td>

                    {/* Class & Cost */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-[#3B0A0F] block">
                        {formatCurrency(asset.acquisitionCost)}
                      </span>
                      <span
                        className={` inline-block text-[9px] font-bold uppercase px-1.5 py-0.2 rounded mt-0.5 border  badge-solid ${
                          asset.classification === "PPE"
                            ? " badge-solid badge-maroon"
                            : " badge-solid badge-slate"
                        }`}
                      >
                        {asset.classification}
                      </span>
                    </td>

                    {/* Date Received */}
                    <td className="py-3 px-3 text-[11px] font-mono text-[#6E2B32] whitespace-nowrap">
                      {formatDate(asset.acquisitionDate)}
                    </td>

                    {/* Warehouse Location */}
                    <td className="py-3 px-3">
                      <span className="font-semibold text-[#3B0A0F] block">
                        Central Warehouse
                      </span>
                      <span className="text-[10px] text-[#6E2B32]">
                        Condition: {asset.condition}
                      </span>
                    </td>

                    {/* Transfer Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {asset.hasPendingTransfer ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border badge-solid badge-amber">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D97B1A] animate-pulse" />
                            <span>TRANSFER PENDING</span>
                          </span>
                          {asset.pendingToUnitCode && (
                            <span className="block text-[10px] text-[#A60212] font-semibold">
                              ➔ {asset.pendingToUnitCode}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border badge-solid badge-green">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]" />
                          <span>{asset.isTransferAvailable ? "AVAILABLE FOR DISPATCH" : "NOT AVAILABLE FOR DISPATCH"}</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Transfer to College Action */}
                        {asset.canTransfer ? (
                          <NewTransferModal
                            assets={modalAssets}
                            units={units}
                            defaultAssetId={asset.id}
                            triggerButton={
                              <button
                                title="Transfer to College"
                                className="bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] px-2.5 py-1.5 text-xs font-bold rounded flex items-center gap-1 border border-[#A60212] transition-colors shadow-xs"
                              >
                                <span aria-hidden="true" className="material-symbols-outlined text-[15px]">sync_alt</span>
                                <span>Transfer</span>
                              </button>
                            }
                          />
                        ) : asset.hasPendingTransfer ? (
                          <Link
                            href="/inventory/transfers"
                            className="bg-cream hover:bg-[#FFE8CC] text-[#D97B1A] border border-[#F5AB29] px-2.5 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors"
                          >
                            <span aria-hidden="true" className="material-symbols-outlined text-[15px]">pending</span>
                            <span>Review PTR</span>
                          </Link>
                        ) : null}

                        {/* Transfer History Drawer Action */}
                        <button
                          onClick={() => setHistoryAssetId(asset.id)}
                          title="View Transfer & Intake History"
                          className="bg-[#FFFFFF] hover:bg-cream text-[#3B0A0F] border border-border px-2.5 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-[#A60212]">
                            history
                          </span>
                          <span>History</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Transfer History Drawer */}
      <TransferHistoryDrawer
        assetId={historyAssetId}
        isOpen={Boolean(historyAssetId)}
        onClose={() => setHistoryAssetId(null)}
      />
    </div>
  );
}
