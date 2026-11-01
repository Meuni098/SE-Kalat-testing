"use client";
import { TransactionAttributionButton } from "@/components/audit/transaction-attribution-button";

import * as React from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { updateMissingReportStatusAction } from "@/actions/missing-actions";
import { IncidentFilingModal } from "@/components/missing/incident-filing-modal";

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
  needsFiling?: boolean;
}

interface MissingBoardProps {
  incidents: MissingIncident[];
  canManage: boolean;
  canFile?: boolean;
}

export function MissingBoard({ incidents, canManage, canFile = false }: MissingBoardProps) {
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
  const [error, setError] = React.useState<{ reportId: string; message: string } | null>(null);
  const pending = React.useRef(false);

  const handleStageChange = async (
    reportId: string,
    newStatus: "REPORTED" | "UNDER_INVESTIGATION" | "FOUND" | "WRITTEN_OFF"
  ) => {
    if (pending.current || !canManage) return;
    pending.current = true;
    setIsUpdating(reportId);
    setError(null);
    try {
      const result = await updateMissingReportStatusAction(reportId, newStatus);
      if (result.error) setError({ reportId, message: result.error });
    } catch {
      setError({ reportId, message: "The incident could not be updated. Please try again." });
    } finally {
      pending.current = false;
      setIsUpdating(null);
    }
  };

  const columns = [
    {
      status: "REPORTED" as const,
      title: "Newly Reported",
      headerBg: "bg-[#A60212]",
      headerBorder: "border-[#A60212]",
      headerText: "text-[#FFFFFF]",
      dotColor: "bg-[#FFFFFF]",
      badge: "URGENT",
      nextAction: "Commence Investigation",
      nextStatus: "UNDER_INVESTIGATION" as const,
    },
    {
      status: "UNDER_INVESTIGATION" as const,
      title: "Under Investigation",
      headerBg: "bg-[#8A4B08]",
      headerBorder: "border-[#8A4B08]",
      headerText: "text-[#FFFFFF]",
      dotColor: "bg-[#FFFFFF]",
      badge: "POLICE BLOTTER",
      nextAction: "Mark Recovered",
      nextStatus: "FOUND" as const,
      secondaryAction: "Write Off (COA)",
      secondaryStatus: "WRITTEN_OFF" as const,
    },
    {
      status: "FOUND" as const,
      title: "Recovered / Found",
      headerBg: "bg-[#27633B]",
      headerBorder: "border-[#27633B]",
      headerText: "text-[#FFFFFF]",
      dotColor: "bg-[#FFFFFF]",
      badge: "RESTORED",
    },
    {
      status: "WRITTEN_OFF" as const,
      title: "Relief of Accountability",
      headerBg: "bg-[#455468]",
      headerBorder: "border-[#455468]",
      headerText: "text-[#FFFFFF]",
      dotColor: "bg-[#FFFFFF]",
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
            className="flex flex-col space-y-3 bg-[#E9EDF1] border border-border p-3 rounded"
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
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border badge-solid badge-slate">
                {col.badge}
              </span>
            </div>

            {/* Column Cards */}
            <div className="space-y-3">
              {colItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6E2B32] border border-border bg-[#FFFFFF] rounded">
                  No records in this stage.
                </div>
              ) : (
                colItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#FFFFFF] border border-border rounded p-3.5 space-y-2.5 hover:border-[#A60212] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] px-1.5 py-0.5 rounded border font-mono badge-solid badge-maroon">
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
                        {item.reportedByName}{!item.needsFiling && <TransactionAttributionButton entityType="MISSING_REPORT" entityId={item.id} />} • {item.needsFiling ? "Status recorded" : "Seen"}: {formatDate(item.lastSeenDate)}
                      </p>
                    </div>

                    <div className="bg-cream border border-border p-2 rounded text-[11px] text-[#3B0A0F] space-y-1">
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
                        <span>View attached blotter</span>
                      </a>
                    )}

                    {error?.reportId === item.id && <p role="alert" className="text-xs text-[#A60212]">{error.message}</p>}
                    {/* Actions */}
                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                      {item.needsFiling && canFile && <IncidentFilingModal
                        assets={[{ id: item.assetId, propertyNo: item.propertyNo, name: item.assetName, unitCode: item.unitCode }]}
                        defaultAssetId={item.assetId}
                        triggerLabel="Complete incident report"
                      />}
                      {canManage && !item.needsFiling && col.nextAction && (
                        <button
                          onClick={() => handleStageChange(item.id, col.nextStatus!)}
                          disabled={isUpdating !== null}
                          className="font-bold text-xs text-[#D97B1A] hover:text-[#A60212] flex items-center gap-1"
                        >
                          <span>{col.nextAction}</span>
                          <span className="material-symbols-outlined text-[14px]">
                            arrow_forward
                          </span>
                        </button>
                      )}

                      {canManage && col.secondaryAction && (
                        <button
                          onClick={() => handleStageChange(item.id, col.secondaryStatus!)}
                          disabled={isUpdating !== null}
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
