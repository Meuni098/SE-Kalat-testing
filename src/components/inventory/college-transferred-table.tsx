"use client";

import * as React from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TransferHistoryDrawer } from "./transfer-history-drawer";
import { NewTransferModal } from "./new-transfer-modal";

export interface TransferredAssetRow {
  id: string;
  unitId: string;
  canTransfer: boolean;
  propertyNo: string;
  name: string;
  description?: string | null;
  classification: string;
  categoryName: string;
  unitCode: string;
  unitName: string;
  accountablePerson?: string | null;
  accountablePersonPosition?: string | null;
  acquisitionCost: number;
  transferredAt: Date;
  ptrNumber?: string | null;
  status: string;
  condition: string;
  serialNo?: string | null;
  originUnitCode?: string | null;
}

interface CollegeTransferredTableProps {
  assets: TransferredAssetRow[];
  colleges: { id: string; code: string; name: string }[];
  allUnits: { id: string; code: string; name: string }[];
}

export function CollegeTransferredTable({
  assets,
  colleges,
  allUnits,
}: CollegeTransferredTableProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [collegeFilter, setCollegeFilter] = React.useState("ALL");
  const [classFilter, setClassFilter] = React.useState("ALL");
  const [historyAssetId, setHistoryAssetId] = React.useState<string | null>(null);

  // Filter assets
  const filteredAssets = React.useMemo(() => {
    return assets.filter((asset) => {
      // College
      if (collegeFilter !== "ALL" && asset.unitCode !== collegeFilter) {
        return false;
      }
      // Classification
      if (classFilter !== "ALL" && asset.classification !== classFilter) {
        return false;
      }
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesProp = asset.propertyNo.toLowerCase().includes(q);
        const matchesName = asset.name.toLowerCase().includes(q);
        const matchesCollege = asset.unitCode.toLowerCase().includes(q) || asset.unitName.toLowerCase().includes(q);
        const matchesCustodian = asset.accountablePerson?.toLowerCase().includes(q) || false;
        const matchesSerial = asset.serialNo?.toLowerCase().includes(q) || false;
        const matchesPtr = asset.ptrNumber?.toLowerCase().includes(q) || false;
        return matchesProp || matchesName || matchesCollege || matchesCustodian || matchesSerial || matchesPtr;
      }
      return true;
    });
  }, [assets, collegeFilter, classFilter, searchTerm]);

  // Modal assets shape
  const modalAssets = React.useMemo(() => {
    return assets.filter((a) => a.canTransfer).map((a) => ({
      id: a.id,
      propertyNo: a.propertyNo,
      name: a.name,
      unitId: a.unitId,
      unitCode: a.unitCode,
      currentCustodian: a.accountablePerson || "College Custodian",
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
            placeholder="Search product code, item name, college, custodian, or PTR #..."
            className="w-full pl-9 pr-3 py-1.5 bg-cream border border-border rounded text-xs font-medium text-[#3B0A0F] placeholder-[#6E2B32]/70 focus:outline-none focus:border-[#A60212]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* College Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase">College:</span>
            <select
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="bg-[#FFFFFF] border border-border rounded px-2.5 py-1.5 text-xs text-[#3B0A0F] font-semibold focus:outline-none focus:border-[#A60212]"
            >
              <option value="ALL">All Deployed Colleges</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Classification Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase">Class:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-[#FFFFFF] border border-border rounded px-2.5 py-1.5 text-xs text-[#3B0A0F] font-semibold focus:outline-none focus:border-[#A60212]"
            >
              <option value="ALL">All Classifications</option>
              <option value="PPE">PPE (Capital Equipment)</option>
              <option value="SEMI_EXPENDABLE">Semi-Expendable</option>
            </select>
          </div>

          {(searchTerm || collegeFilter !== "ALL" || classFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setCollegeFilter("ALL");
                setClassFilter("ALL");
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
            <span aria-hidden="true" className="material-symbols-outlined text-[#F5AB29] text-[20px]">domain</span>
            <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
              College Deployed Property &amp; Inter-Unit Asset Registry
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded border badge-solid badge-amber">
            {filteredAssets.length} of {assets.length} Deployed Asset(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-cream text-[#3B0A0F] border-b border-border font-black uppercase text-[11px]">
                <th className="py-2.5 px-3">Product Code</th>
                <th className="py-2.5 px-3">Equipment / Asset Item</th>
                <th className="py-2.5 px-3">Current College</th>
                <th className="py-2.5 px-3">Received By</th>
                <th className="py-2.5 px-3">Date Transferred</th>
                <th className="py-2.5 px-3">Origin &amp; PTR #</th>
                <th className="py-2.5 px-3">Class &amp; Cost</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#6E2B32] font-medium">
                    <span aria-hidden="true" className="material-symbols-outlined text-[36px] block text-[#EBD3B2] mb-1">
                      domain_disabled
                    </span>
                    No deployed assets match the selected college or filter criteria.
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
                    <td className="py-3 px-3 max-w-[220px]">
                      <span className="font-bold text-[#3B0A0F] block truncate">
                        {asset.name}
                      </span>
                      <span className="text-[10px] text-[#6E2B32] block truncate">
                        {asset.categoryName}
                      </span>
                    </td>

                    {/* Current College */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-bold text-[#3B0A0F]">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black font-mono border badge-solid badge-maroon">
                          {asset.unitCode}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#6E2B32] block truncate max-w-[140px] mt-0.5">
                        {asset.unitName}
                      </span>
                    </td>

                    {/* Received By */}
                    <td className="py-3 px-3 max-w-[170px]">
                      <span className="font-semibold text-[#3B0A0F] block truncate">
                        {asset.accountablePerson || "To be designated"}
                      </span>
                      {asset.accountablePersonPosition && (
                        <span className="text-[10px] text-[#6E2B32] block truncate">
                          {asset.accountablePersonPosition}
                        </span>
                      )}
                    </td>

                    {/* Date Transferred */}
                    <td className="py-3 px-3 text-[11px] font-mono text-[#6E2B32] whitespace-nowrap">
                      {formatDate(asset.transferredAt)}
                    </td>

                    {/* Origin & PTR */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                      <div className="flex items-center gap-1 text-[#6E2B32]">
                        <span>From:</span>
                        <span className="font-bold text-[#3B0A0F]">{asset.originUnitCode || "AMO"}</span>
                      </div>
                      <span className="text-[10px] text-[#A60212] font-bold block">
                        {asset.ptrNumber || "PTR-APPROVED"}
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

                    {/* Actions */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Transfer History Primary Action */}
                        <button
                          onClick={() => setHistoryAssetId(asset.id)}
                          title="View Complete Movement History & PTR Chain"
                          className="bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] px-2.5 py-1.5 text-xs font-bold rounded flex items-center gap-1 border border-[#A60212] transition-colors shadow-xs"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[15px]">history</span>
                          <span>History</span>
                        </button>

                        {/* Inter-College Re-Transfer or Return */}
                        {asset.canTransfer && <NewTransferModal
                          assets={modalAssets}
                          units={allUnits}
                          defaultAssetId={asset.id}
                          triggerButton={
                            <button
                              title="Initiate Re-Transfer to another college or return to AMO"
                              className="bg-[#FFFFFF] hover:bg-cream text-[#3B0A0F] border border-border px-2.5 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors"
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-[#D97B1A]">
                                swap_horiz
                              </span>
                              <span>Move</span>
                            </button>
                          }
                        />}
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
