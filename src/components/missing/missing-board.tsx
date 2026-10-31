"use client";
import { TransactionAttributionButton } from "@/components/audit/transaction-attribution-button";

import * as React from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { updateMissingReportStatusAction } from "@/actions/missing-actions";

export interface MissingIncident {
  id: string;
  assetId: string;
  propertyNo: string;
  assetName: string;
  unitCode: string;
  unitName: string;
  cost: number;
  reportedByName: string;
  lastSeenDate: Date | string;
  locationLastSeen: string;
  circumstances: string;
  policeBlotterUrl?: string | null;
  status: "REPORTED" | "UNDER_INVESTIGATION" | "FOUND" | "WRITTEN_OFF";
}

interface MissingBoardProps {
  incidents: MissingIncident[];
}

export function MissingBoard({ incidents }: MissingBoardProps) {
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);

  const handleStageChange = async (
    reportId: string,
    newStatus: "REPORTED" | "UNDER_INVESTIGATION" | "FOUND" | "WRITTEN_OFF"
  ) => {
    setIsUpdating(reportId);
    await updateMissingReportStatusAction(reportId, newStatus);
    setIsUpdating(null);
  };

  const columns = [
    {
      status: "REPORTED" as const,
      title: "Newly Reported",
      headerBg: "bg-[#FEE2E2]",
      headerBorder: "border-[#FECACA]",
      headerText: "text-[#A60212]",
      dotColor: "bg-[#A60212]",
      badge: "URGENT",
      nextAction: "Commence Investigation",
      nextStatus: "UNDER_INVESTIGATION" as const,
    },
    {
      status: "UNDER_INVESTIGATION" as const,
      title: "Under Investigation",
      headerBg: "bg-[#FFF4E0]",
      headerBorder: "border-[#D97B1A]",
      headerText: "text-[#D97B1A]",
      dotColor: "bg-[#D97B1A]",
      badge: "POLICE BLOTTER",
      nextAction: "Mark Recovered",
      nextStatus: "FOUND" as const,
      secondaryAction: "Write Off (COA)",
      secondaryStatus: "WRITTEN_OFF" as const,
    },
    {
      status: "FOUND" as const,
      title: "Recovered / Found",
      headerBg: "bg-[#FFF4E0]",
      headerBorder: "border-[#F5AB29]",
      headerText: "text-[#3B0A0F]",
      dotColor: "bg-[#F5AB29]",
      badge: "RESTORED",
    },
    {
      status: "WRITTEN_OFF" as const,
      title: "Relief of Accountability",
      headerBg: "bg-[#FFFFFF]",
      headerBorder: "border-[#EBD3B2]",
      headerText: "text-[#6E2B32]",
      dotColor: "bg-[#6E2B32]",
      badge: "COA SEC 89",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[580px] items-start select-none">
      {columns.map((col) => {
        const colItems = incidents.filter((i) => i.status === col.status);

        return (
          <div
            key={col.status}
            className="flex flex-col space-y-3 bg-[#FFF4E0] border border-[#EBD3B2] p-3 rounded"
          >
            {/* Column Header */}
            <div
              className={`${col.headerBg} border ${col.headerBorder} rounded px-3 py-2 flex items-center justify-between`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                <h3 className={`font-bold text-xs ${col.headerText}`}>
                  {col.title} ({colItems.length})
                </h3>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#EBD3B2] text-[#3B0A0F]">
                {col.badge}
              </span>
            </div>

            {/* Column Cards */}
            <div className="space-y-3">
              {colItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6E2B32] border border-dashed border-[#EBD3B2] rounded">
                  No records in this stage.
                </div>
              ) : (
                colItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-3.5 space-y-2.5 hover:border-[#A60212] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-[#A60212] bg-[#FEE2E2] px-1.5 py-0.5 rounded border border-[#FECACA] font-mono">
                        {item.propertyNo}
                      </span>
                      <span className="text-[10px] text-[#6E2B32] font-mono font-bold">
                        {item.unitCode}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs text-[#3B0A0F] leading-snug">
                        {item.assetName}
                      </h4>
                      <p className="text-[11px] text-[#6E2B32] mt-0.5">
                        {item.reportedByName}<TransactionAttributionButton entityType="MISSING_REPORT" entityId={item.id} /> • Seen: {formatDate(item.lastSeenDate)}
                      </p>
                    </div>

                    <div className="bg-[#FFF4E0] border border-[#EBD3B2] p-2 rounded text-[11px] text-[#3B0A0F] space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-[#6E2B32]">Book Value:</span>
                        <span className="font-bold">{formatCurrency(item.cost)}</span>
                      </div>
                      <div className="text-[10px] text-[#A60212] truncate font-medium">
                        📍 {item.locationLastSeen}
                      </div>
                    </div>

                    {item.policeBlotterUrl && (
                      <a
                        href={item.policeBlotterUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[#D97B1A] font-bold hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          local_police
                        </span>
                        <span>Police Blotter Verified</span>
                      </a>
                    )}

                    {/* Actions */}
                    <div className="pt-2 border-t border-[#EBD3B2] flex items-center justify-between text-xs">
                      {col.nextAction && (
                        <button
                          onClick={() => handleStageChange(item.id, col.nextStatus!)}
                          disabled={isUpdating === item.id}
                          className="font-bold text-xs text-[#D97B1A] hover:text-[#A60212] flex items-center gap-1"
                        >
                          <span>{col.nextAction}</span>
                          <span className="material-symbols-outlined text-[14px]">
                            arrow_forward
                          </span>
                        </button>
                      )}

                      {col.secondaryAction && (
                        <button
                          onClick={() => handleStageChange(item.id, col.secondaryStatus!)}
                          disabled={isUpdating === item.id}
                          className="font-bold text-[11px] text-[#A60212] hover:underline"
                        >
                          {col.secondaryAction}
                        </button>
                      )}

                      <Link
                        href={`/inventory/${item.assetId}`}
                        className="text-[11px] text-[#6E2B32] hover:text-[#3B0A0F] font-semibold"
                        title="View Asset Dossier"
                      >
                        Dossier
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
