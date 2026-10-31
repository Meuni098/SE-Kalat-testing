"use client";

import * as React from "react";
import { formatDate } from "@/lib/utils";

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  actorRole: string;
  ipAddress?: string | null;
  createdAt: Date | string;
  beforeState: unknown;
  afterState: unknown;
}

interface AuditLogTableProps {
  logs: AuditLogEntry[];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "REGISTER_ASSET":
        return "bg-[#FFF4E0] text-[#A60212] border-[#A60212]";
      case "QR_VERIFY_PRESENCE":
        return "bg-[#FFF4E0] text-[#D97B1A] border-[#F5AB29]";
      case "REQUEST_TRANSFER":
      case "RECONCILE_DISCREPANCY_TRANSFER":
        return "bg-[#FFFFFF] text-[#3B0A0F] border-[#EBD3B2]";
      case "REPORT_MISSING":
        return "bg-[#FEE2E2] text-[#A60212] border-[#FECACA]";
      case "MERGE_ASSETS":
        return "bg-[#FFF4E0] text-[#D97B1A] border-[#D97B1A]";
      case "EXECUTE_LEGAL_DISPOSAL":
        return "bg-[#3B0A0F] text-[#FFF4E0] border-[#3B0A0F]";
      default:
        return "bg-[#FFFFFF] text-[#3B0A0F] border-[#EBD3B2]";
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded overflow-hidden select-none">
      <div className="p-4 bg-[#FFF4E0] border-b border-[#EBD3B2] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#A60212] text-[20px]">
            history_edu
          </span>
          <h2 className="text-sm font-bold text-[#3B0A0F] uppercase">
            Read-only activity history
          </h2>
        </div>
        <span className="text-xs font-mono text-[#6E2B32]">
          {logs.length} events on this page
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="h-9 bg-[#FFFFFF] border-b border-[#EBD3B2] text-[#3B0A0F] font-bold uppercase select-none">
              <th className="px-3.5 py-2 border-r border-[#EBD3B2]">Timestamp</th>
              <th className="px-3.5 py-2 border-r border-[#EBD3B2]">Actor &amp; Role</th>
              <th className="px-3.5 py-2 border-r border-[#EBD3B2]">Event Action</th>
              <th className="px-3.5 py-2 border-r border-[#EBD3B2]">Entity Reference</th>
              <th className="px-3.5 py-2 border-r border-[#EBD3B2]">Terminal IP</th>
              <th className="px-3.5 py-2 text-center">Payload Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EBD3B2]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[#6E2B32]">
                  No audit log events recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedId === log.id;

                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-[#FFF4E0] transition-colors">
                      <td className="px-3.5 py-3 border-r border-[#EBD3B2] font-mono text-[#6E2B32] whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>

                      <td className="px-3.5 py-3 border-r border-[#EBD3B2]">
                        <div className="font-bold text-[#3B0A0F]">{log.actorName}</div>
                        <div className="text-[10px] text-[#A60212] font-mono">{log.actorRole}</div>
                      </td>

                      <td className="px-3.5 py-3 border-r border-[#EBD3B2] whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 border-r border-[#EBD3B2] font-mono">
                        <span className="font-bold text-[#3B0A0F]">{log.entityType}</span>
                        <span className="text-[10px] text-[#6E2B32] ml-1">
                          #{log.entityId.slice(0, 8)}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 border-r border-[#EBD3B2] font-mono text-[11px] text-[#6E2B32]">
                        {log.ipAddress || "Not recorded"}
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="px-2 py-1 rounded bg-[#FFF4E0] border border-[#EBD3B2] hover:bg-[#A60212] hover:text-[#FFF4E0] text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <span>{isExpanded ? "Hide Diff" : "View Diff"}</span>
                          <span className="material-symbols-outlined text-[13px]">
                            {isExpanded ? "expand_less" : "expand_more"}
                          </span>
                        </button>
                      </td>
                    </tr>

                    {/* Expandable JSON Diff Row */}
                    {isExpanded && (
                      <tr className="bg-[#3B0A0F] text-[#FFF4E0]">
                        <td colSpan={6} className="p-4 font-mono text-xs">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-[#4E1117] p-3 rounded border border-[#6E2B32]">
                              <p className="text-[11px] font-bold text-[#FECACA] uppercase mb-1">
                                Before State:
                              </p>
                              <pre className="text-[11px] whitespace-pre-wrap overflow-x-auto text-[#FECACA]">
                                {log.beforeState
                                  ? JSON.stringify(log.beforeState, null, 2)
                                  : "null (Initial Record Creation)"}
                              </pre>
                            </div>

                            <div className="bg-[#4E1117] p-3 rounded border border-[#6E2B32]">
                              <p className="text-[11px] font-bold text-[#F5AB29] uppercase mb-1">
                                After State (Committed):
                              </p>
                              <pre className="text-[11px] whitespace-pre-wrap overflow-x-auto text-[#F5AB29]">
                                {log.afterState
                                  ? JSON.stringify(log.afterState, null, 2)
                                  : "null"}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
