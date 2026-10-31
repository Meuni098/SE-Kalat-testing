"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { mergeAssetsAction } from "@/actions/dedup-actions";
import { Button } from "@/components/ui/button";

interface AssetSummary {
  id: string;
  propertyNo: string;
  name: string;
  description?: string | null;
  classification: string;
  unit: { code: string; name: string };
  accountablePerson?: { fullName: string; position: string } | null;
  serialNo?: string | null;
  acquisitionCost: number;
  acquisitionDate: Date;
  status: string;
  condition: string;
}

interface DeduplicationMergeCardProps {
  candidateA: AssetSummary;
  candidateB: AssetSummary;
}

export function DeduplicationMergeCard({
  candidateA,
  candidateB,
}: DeduplicationMergeCardProps) {
  const [selectedMaster, setSelectedMaster] = React.useState<"A" | "B">("A");
  const [isMerging, setIsMerging] = React.useState(false);
  const [mergeResult, setMergeResult] = React.useState<string | null>(null);

  const handleMerge = async () => {
    const master = selectedMaster === "A" ? candidateA : candidateB;
    const duplicate = selectedMaster === "A" ? candidateB : candidateA;

    if (
      !confirm(
        `Are you sure you want to merge duplicate asset ${duplicate.propertyNo} into master ${master.propertyNo}? This will re-link all inspection, count, and transfer trails.`
      )
    ) {
      return;
    }

    setIsMerging(true);
    const result = await mergeAssetsAction(master.id, duplicate.id);
    setIsMerging(false);

    if (result.success) {
      setMergeResult(
        `Successfully merged ${duplicate.propertyNo} into ${master.propertyNo}. Audit log created.`
      );
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-5 select-none">
      {/* Cluster Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-[#EBD3B2] gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 bg-[#D97B1A] rounded-full" />
          <h2 className="text-sm font-bold text-[#3B0A0F] uppercase">
            Duplicate Candidate Cluster: Reversible Consolidation
          </h2>
          <span className="bg-[#FFF4E0] text-[#A60212] text-[10px] font-bold px-2 py-0.5 rounded border border-[#A60212] font-mono">
            COA CONFLICT RESOLUTION
          </span>
        </div>
        <span className="text-xs text-[#6E2B32] font-mono">
          Rule: Identical Model &amp; Overlapping Custody
        </span>
      </div>

      {mergeResult && (
        <div className="mt-3 p-3 bg-[#FFF4E0] border border-[#D97B1A] rounded text-xs text-[#3B0A0F] font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[#A60212] text-[18px]">
            verified
          </span>
          <span>{mergeResult}</span>
        </div>
      )}

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Candidate A (Master Framing) */}
        <div
          onClick={() => setSelectedMaster("A")}
          className={`bg-[#FFFFFF] border-2 rounded p-4 flex flex-col justify-between cursor-pointer transition-colors ${
            selectedMaster === "A"
              ? "border-[#A60212] bg-[#FFF4E0]/30"
              : "border-[#EBD3B2] hover:border-[#A60212]"
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#EBD3B2]">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-[#3B0A0F]">
                <input
                  type="radio"
                  name="masterCandidate"
                  checked={selectedMaster === "A"}
                  onChange={() => setSelectedMaster("A")}
                  className="accent-[#A60212]"
                />
                <span>Candidate A (Master Record)</span>
              </label>
              <span className="bg-[#FFF4E0] text-[#A60212] text-[10px] font-bold px-2 py-0.5 rounded border border-[#A60212] font-mono">
                {selectedMaster === "A" ? "SELECTED MASTER" : "CANONICAL"}
              </span>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#EBD3B2]">
                <span className="text-[#6E2B32]">Property Number</span>
                <span className="font-mono font-bold text-[#A60212]">
                  {candidateA.propertyNo}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EBD3B2]">
                <span className="text-[#6E2B32]">Serial Number</span>
                <span className="font-mono font-bold text-[#3B0A0F]">
                  {candidateA.serialNo || "NO SERIAL"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EBD3B2]">
                <span className="text-[#6E2B32]">Description</span>
                <span className="font-semibold text-[#3B0A0F] text-right truncate max-w-[180px]">
                  {candidateA.name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EBD3B2]">
                <span className="text-[#6E2B32]">Operating Unit</span>
                <span className="font-medium text-[#3B0A0F]">{candidateA.unit.code}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EBD3B2]">
                <span className="text-[#6E2B32]">Acquisition Cost</span>
                <span className="font-mono font-bold text-[#3B0A0F]">
                  {formatCurrency(candidateA.acquisitionCost)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#6E2B32]">Acquisition Date</span>
                <span className="font-mono">{formatDate(candidateA.acquisitionDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Candidate B (Duplicate Framing) */}
        <div
          onClick={() => setSelectedMaster("B")}
          className={`bg-[#FFFFFF] border-2 rounded p-4 flex flex-col justify-between cursor-pointer transition-colors ${
            selectedMaster === "B"
              ? "border-[#A60212] bg-[#FFF4E0]/30"
              : "border-[#D97B1A] hover:border-[#A60212]"
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#EBD3B2]">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-[#3B0A0F]">
                <input
                  type="radio"
                  name="masterCandidate"
                  checked={selectedMaster === "B"}
                  onChange={() => setSelectedMaster("B")}
                  className="accent-[#A60212]"
                />
                <span>Candidate B (Conflicting Record)</span>
              </label>
              <span className="bg-[#FFF4E0] text-[#D97B1A] text-[10px] font-bold px-2 py-0.5 rounded border border-[#D97B1A] font-mono">
                {selectedMaster === "B" ? "SELECTED MASTER" : "DUPLICATE TARGET"}
              </span>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#EBD3B2]">
                <span className="text-[#6E2B32]">Property Number</span>
                <span className="font-mono font-bold text-[#A60212]">
                  {candidateB.propertyNo}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EBD3B2]">
                <span className="text-[#6E2B32]">Serial Number</span>
                <span className="font-mono font-bold text-[#3B0A0F]">
                  {candidateB.serialNo || "NO SERIAL"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EBD3B2]">
                <span className="text-[#6E2B32]">Description</span>
                <span className="font-semibold text-[#3B0A0F] text-right truncate max-w-[180px]">
                  {candidateB.name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EBD3B2]">
                <span className="text-[#6E2B32]">Operating Unit</span>
                <span className="font-medium text-[#3B0A0F]">{candidateB.unit.code}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EBD3B2]">
                <span className="text-[#6E2B32]">Acquisition Cost</span>
                <span className="font-mono font-bold text-[#3B0A0F]">
                  {formatCurrency(candidateB.acquisitionCost)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#6E2B32]">Acquisition Date</span>
                <span className="font-mono">{formatDate(candidateB.acquisitionDate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Merge Action Footer */}
      <div className="mt-4 pt-3 border-t border-[#EBD3B2] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs text-[#6E2B32]">
          Retaining <strong className="text-[#3B0A0F]">{selectedMaster === "A" ? candidateA.propertyNo : candidateB.propertyNo}</strong> as the master record. Conflicting history will be consolidated with full COA audit log.
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleMerge}
          disabled={isMerging}
          className="gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">merge</span>
          <span>{isMerging ? "Merging..." : "Execute Reversible Merge"}</span>
        </Button>
      </div>
    </div>
  );
}
