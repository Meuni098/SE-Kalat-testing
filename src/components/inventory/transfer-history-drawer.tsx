"use client";

import * as React from "react";
import {
  getAssetTransferHistoryAction,
  AssetTransferHistoryPayload,
} from "@/actions/transfer-history-actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

interface TransferHistoryDrawerProps {
  assetId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TransferHistoryDrawer({
  assetId,
  isOpen,
  onClose,
}: TransferHistoryDrawerProps) {
  const [data, setData] = React.useState<AssetTransferHistoryPayload | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !assetId) return;
    let isMounted = true;
    // Schedule async request state together; stale responses are ignored on close/asset change.
    queueMicrotask(() => { if (isMounted) { setData(null); setIsLoading(true); setError(null); } });

    getAssetTransferHistoryAction(assetId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error || "Failed to load transfer history.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "An unexpected error occurred.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, assetId]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const visibleData = data?.assetId === assetId ? data : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#3B0A0F]/60 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-[#FFFFFF] border-l-2 border-[#A60212] shadow-2xl flex flex-col justify-between overflow-hidden">
          {/* Drawer Header */}
          <div className="bg-[#3B0A0F] text-[#FFF4E0] px-5 py-4 border-b border-[#4E1117] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-[#A60212] border border-[#F5AB29] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">
                  sync_alt
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5AB29] font-mono">
                    CHAIN OF CUSTODY LEDGER
                  </span>
                  <span className="bg-[#4E1117] text-[#EBD3B2] border border-[#6E2B32] text-[9px] px-1.5 py-0.2 rounded font-mono">
                    COA PTR COMPLIANT
                  </span>
                </div>
                <h2 className="text-base font-black text-[#FFFFFF] tracking-tight uppercase">
                  Asset Transfer History
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-[#EBD3B2] hover:text-[#FFFFFF] p-1.5 rounded hover:bg-[#4E1117] transition-colors"
              title="Close drawer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#FAF7F2]">
            {isLoading && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-8 h-8 border-3 border-[#EBD3B2] border-t-[#A60212] rounded-full animate-spin" />
                <span className="text-xs font-semibold text-[#6E2B32]">
                  Compiling chronological transfer records...
                </span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-[#FFEBEE] border border-[#FFCDD2] rounded text-xs text-[#C62828] space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>Unable to retrieve transfer records</span>
                </div>
                <p>{error}</p>
                <button
                  onClick={() => {
                    if (assetId) {
                      setIsLoading(true);
                      setError(null);
                      getAssetTransferHistoryAction(assetId).then((res) => {
                        if (res.success && res.data) setData(res.data);
                        else setError(res.error || "Failed");
                        setIsLoading(false);
                      });
                    }
                  }}
                  className="px-2.5 py-1 bg-[#C62828] text-white rounded text-[11px] font-bold"
                >
                  Retry Query
                </button>
              </div>
            )}

            {visibleData && (
              <>
                <div className="rounded border border-[#EBD3B2] bg-white p-3 text-xs print:hidden">
                  <p><strong>Originally logged by: </strong>{visibleData.attribution.originallyLoggedBy?.name ?? "Not recorded"}</p>
                  <p><strong>Last updated by: </strong>{visibleData.attribution.lastUpdatedBy?.name ?? "No updates yet"}</p>
                  {visibleData.canViewAudit && <Link href={`/admin/security-audit?assetId=${visibleData.assetId}`} className="mt-2 block underline">View audit history</Link>}
                </div>
                {/* Asset Identity Card */}
                <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-[#A60212] bg-[#FFF4E0] border border-[#EBD3B2] px-2 py-0.5 rounded">
                          {visibleData.propertyNo}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                            visibleData.classification === "PPE"
                              ? "bg-[#FFF4E0] text-[#A60212] border-[#A60212]"
                              : "bg-[#FFFFFF] text-[#D97B1A] border-[#D97B1A]"
                          }`}
                        >
                          {visibleData.classification}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#3B0A0F] mt-1.5 line-clamp-2">
                        {visibleData.assetName}
                      </h3>
                      {visibleData.description && (
                        <p className="text-xs text-[#6E2B32] mt-0.5 line-clamp-2">
                          {visibleData.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] uppercase font-bold text-[#6E2B32] block">
                        Acquisition Cost
                      </span>
                      <span className="text-sm font-black font-mono text-[#3B0A0F]">
                        {formatCurrency(visibleData.acquisitionCost)}
                      </span>
                    </div>
                  </div>

                  {/* Current Custodial Status Ribbon */}
                  <div
                    className={`p-3 rounded border flex items-center justify-between gap-3 ${
                      visibleData.isInAmoCustody
                        ? "bg-[#FFF4E0] border-[#F5AB29] text-[#3B0A0F]"
                        : "bg-[#E8F5E9] border-[#A5D6A7] text-[#1B5E20]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{
                          color: visibleData.isInAmoCustody ? "#D97B1A" : "#2E7D32",
                        }}
                      >
                        {visibleData.isInAmoCustody ? "warehouse" : "domain"}
                      </span>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider block opacity-90">
                          {visibleData.isInAmoCustody
                            ? "Current Location: AMO Central Storage"
                            : `Deployed in College: ${visibleData.currentUnit.code}`}
                        </span>
                        <span className="text-xs font-black block">
                          {visibleData.currentUnit.name}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] font-bold uppercase block opacity-80">
                        Designated Custodian
                      </span>
                      <span className="text-xs font-bold font-mono">
                        {visibleData.currentCustodian?.fullName || "AMO Property Custodian"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline Header */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#3B0A0F] uppercase">
                    <span className="material-symbols-outlined text-[16px] text-[#A60212]">
                      timeline
                    </span>
                    <span>Movement Timeline ({visibleData.events.length} Events)</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#6E2B32]">
                    {visibleData.totalTransfersCount} Inter-College PTR(s)
                  </span>
                </div>

                {/* Vertical Timeline */}
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#EBD3B2]">
                  {visibleData.events.map((ev) => {
                    const isIntake = ev.type === "INTAKE";
                    const isTransfer = ev.type === "TRANSFER";
                    const isInspection = ev.type === "INSPECTION";

                    const badgeColor = isIntake
                      ? "bg-[#3B0A0F] text-[#F5AB29]"
                      : isTransfer
                      ? "bg-[#A60212] text-[#FFF4E0]"
                      : isInspection
                      ? "bg-[#D97B1A] text-[#FFFFFF]"
                      : "bg-[#6E2B32] text-[#FFF4E0]";

                    const iconName = isIntake
                      ? "local_shipping"
                      : isTransfer
                      ? "sync_alt"
                      : isInspection
                      ? "verified"
                      : "assignment_return";

                    return (
                      <div key={ev.id} className="relative group">
                        {/* Dot on line */}
                        <div
                          className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#FFFFFF] shadow-sm ${badgeColor}`}
                        >
                          <span className="material-symbols-outlined text-[11px]">
                            {iconName}
                          </span>
                        </div>

                        {/* Event Card */}
                        <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-3.5 shadow-xs hover:border-[#A60212] transition-colors space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase font-mono px-1.5 py-0.2 rounded bg-[#FFF4E0] text-[#A60212] border border-[#EBD3B2]">
                                  {ev.type}
                                </span>
                                {ev.ptrNumber && (
                                  <span className="text-[10px] font-bold font-mono text-[#3B0A0F] bg-[#FAF7F2] px-1.5 py-0.2 rounded border border-[#EBD3B2]">
                                    {ev.ptrNumber}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-black text-[#3B0A0F] mt-1">
                                {ev.title}
                              </h4>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <span className="text-[10px] font-mono font-bold text-[#6E2B32] block">
                                {formatDate(ev.date)}
                              </span>
                              <span
                                className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.2 rounded mt-0.5 ${
                                  ev.status === "APPROVED" || ev.status === "COMPLETED" || ev.status === "ACCEPTED"
                                    ? "bg-[#E8F5E9] text-[#2E7D32]"
                                    : ev.status === "PENDING"
                                    ? "bg-[#FFF4E0] text-[#D97B1A]"
                                    : "bg-[#FFEBEE] text-[#C62828]"
                                }`}
                              >
                                {ev.status}
                              </span>
                            </div>
                          </div>

                          {/* Origin -> Destination Flow */}
                          <div className="bg-[#FFF4E0]/60 border border-[#EBD3B2]/60 rounded p-2 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-1 font-bold text-[#3B0A0F]">
                              <span className="text-[10px] font-normal text-[#6E2B32] uppercase block">
                                From:
                              </span>
                              <span className="font-mono">{ev.originUnit.code}</span>
                            </div>

                            <span className="material-symbols-outlined text-[#A60212] text-[16px]">
                              trending_flat
                            </span>

                            <div className="flex items-center gap-1 font-bold text-[#A60212]">
                              <span className="text-[10px] font-normal text-[#6E2B32] uppercase block">
                                To:
                              </span>
                              <span className="font-mono">{ev.destinationUnit.code}</span>
                            </div>
                          </div>

                          {/* Releasing & Receiving People */}
                          {(ev.releasingPerson || ev.receivingPerson) && (
                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5 border-t border-[#EBD3B2]/50">
                              {ev.releasingPerson && (
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-[#6E2B32] block">
                                    Released By:
                                  </span>
                                  <span className="font-semibold text-[#3B0A0F] truncate block">
                                    {ev.releasingPerson.fullName}
                                  </span>
                                </div>
                              )}
                              {ev.receivingPerson && (
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-[#6E2B32] block">
                                    Received By:
                                  </span>
                                  <span className="font-semibold text-[#A60212] truncate block">
                                    {ev.receivingPerson.fullName}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Remarks */}
                          {ev.remarks && (
                            <div className="text-[11px] text-[#6E2B32] italic bg-[#FFFFFF] p-2 rounded border border-[#EBD3B2]/50">
                              &quot;{ev.remarks}&quot;
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-[#FFFFFF] border-t border-[#EBD3B2] flex items-center justify-between gap-3">
            {visibleData ? (
              <Link
                href={`/inventory/${visibleData.assetId}`}
                className="text-xs font-bold text-[#A60212] hover:text-[#3B0A0F] flex items-center gap-1"
              >
                <span>View Full Asset Dossier</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            ) : (
              <div />
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#3B0A0F] hover:bg-[#4E1117] text-[#FFF4E0] text-xs font-bold rounded transition-colors"
            >
              Close Ledger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
