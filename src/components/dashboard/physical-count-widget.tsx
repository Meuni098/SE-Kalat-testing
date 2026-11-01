import * as React from "react";
import Link from "next/link";

interface PhysicalCountWidgetProps {
  sessionTitle: string;
  fiscalYear: number;
  totalAssets: number;
  verifiedCount: number;
  relocatedCount: number;
  unaccountedCount: number;
}

export function PhysicalCountWidget({
  sessionTitle,
  fiscalYear,
  totalAssets,
  verifiedCount,
  relocatedCount,
  unaccountedCount,
}: PhysicalCountWidgetProps) {
  const verifiedPercent = totalAssets > 0 ? Math.round((verifiedCount / totalAssets) * 100) : 0;
  const pendingCount = Math.max(0, totalAssets - verifiedCount - relocatedCount);
  const pendingPercent = totalAssets > 0 ? Math.round((pendingCount / totalAssets) * 100) : 0;

  return (
    <section className="bg-[#FFFFFF] border border-border rounded p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[#F5AB29] text-[22px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              fact_check
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#3B0A0F] leading-tight">
                Annual Physical Count
              </h2>
              <p className="text-[11px] text-[#6E2B32] font-mono">FY {fiscalYear} COA Audit</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold border badge-solid badge-amber">
            ACTIVE CYCLE
          </span>
        </div>

        <p className="text-xs text-[#3B0A0F] font-semibold mt-3 leading-relaxed">
          {sessionTitle}
        </p>

        {/* Progress Breakdown Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="font-bold text-[#3B0A0F]">{verifiedPercent}% Verified In Place</span>
            <span className="text-[#6E2B32]">
              {verifiedCount} of {totalAssets} Assets
            </span>
          </div>

          {/* Segmented solid bar */}
          <div className="w-full h-3 bg-cream border border-border rounded flex overflow-hidden">
            <div
              style={{ width: `${verifiedPercent}%` }}
              className="bg-[#A60212] h-full"
              title={`Verified: ${verifiedCount}`}
            />
            <div
              style={{ width: `${(relocatedCount / (totalAssets || 1)) * 100}%` }}
              className="bg-[#F5AB29] h-full"
              title={`Relocated: ${relocatedCount}`}
            />
            <div
              style={{ width: `${pendingPercent}%` }}
              className="bg-sand h-full"
              title={`Pending: ${pendingCount}`}
            />
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A60212]" />
              <span className="text-[#3B0A0F] font-semibold">Verified ({verifiedCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F5AB29]" />
              <span className="text-[#3B0A0F] font-semibold">Relocated ({relocatedCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sand" />
              <span className="text-[#6E2B32] font-semibold">Pending ({pendingCount})</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-border flex items-center gap-2">
        <Link
          href="/scan"
          className="flex-1 py-2 px-3 rounded bg-[#A60212] text-[#FFF4E0] hover:bg-[#85010E] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#A60212]"
        >
          <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
          <span>Open Field Scanner</span>
        </Link>
        <Link
          href="/physical-inventory/sessions/current"
          className="py-2 px-3 rounded bg-cream text-[#3B0A0F] border border-border hover:bg-[#FFFFFF] text-xs font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <span>Audit Sheet</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>
    </section>
  );
}
