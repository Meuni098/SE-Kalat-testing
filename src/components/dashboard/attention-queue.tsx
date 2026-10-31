import * as React from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

interface QueueItem {
  id: string;
  type: "MISSING" | "TRANSFER" | "RETURN" | "DISPOSAL";
  title: string;
  propertyNo: string;
  reportedBy: string;
  unitName: string;
  date: Date | string;
  cost?: number;
  badgeLabel: string;
  actionUrl: string;
  actionText: string;
}

interface AttentionQueueProps {
  items: QueueItem[];
}

export function AttentionQueue({ items }: AttentionQueueProps) {
  const badgeStyles = {
    MISSING: "bg-[#FEE2E2] text-[#A60212] border-[#FECACA]",
    TRANSFER: "bg-[#FFF4E0] text-[#D97B1A] border-[#F5AB29]",
    RETURN: "bg-[#FFFFFF] text-[#3B0A0F] border-[#EBD3B2]",
    DISPOSAL: "bg-[#FFF4E0] text-[#A60212] border-[#A60212]",
  };

  return (
    <section className="bg-[#FFFFFF] border border-[#EBD3B2] rounded flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#EBD3B2] flex items-center justify-between bg-[#FFF4E0]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#A60212] text-[20px]">
            assignment_late
          </span>
          <h2 className="text-sm font-bold text-[#3B0A0F] uppercase tracking-wider">
            Operational Attention Queue
          </h2>
        </div>
        <span className="px-2.5 py-0.5 rounded bg-[#FFFFFF] text-[#A60212] font-bold text-xs border border-[#EBD3B2] font-mono">
          {items.length} Pending Actions
        </span>
      </div>

      {/* Queue Items */}
      <div className="divide-y divide-[#EBD3B2]">
        {items.length === 0 ? (
          <div className="p-8 text-center text-[#6E2B32] text-xs">
            No pending items in the attention queue. All records are up to date!
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-4 flex items-start justify-between hover:bg-[#FFF4E0] transition-colors"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border mt-0.5 font-mono ${
                    badgeStyles[item.type]
                  }`}
                >
                  {item.badgeLabel}
                </span>
                <div>
                  <h3 className="text-sm text-[#3B0A0F] font-bold leading-snug">
                    {item.title}{" "}
                    <span className="font-mono text-[#6E2B32] font-semibold text-xs">
                      ({item.propertyNo})
                    </span>
                  </h3>
                  <p className="text-xs text-[#6E2B32] mt-0.5">
                    {item.reportedBy} • {item.unitName} • {formatDate(item.date)}
                  </p>
                  {item.cost !== undefined && (
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#6E2B32] font-mono">
                      <span>Value: {formatCurrency(item.cost)}</span>
                    </div>
                  )}
                </div>
              </div>

              <Link
                href={item.actionUrl}
                className="px-3 py-1.5 rounded bg-[#FFF4E0] text-[#3B0A0F] border border-[#EBD3B2] hover:bg-[#A60212] hover:text-[#FFF4E0] hover:border-[#A60212] text-xs font-bold transition-colors flex items-center gap-1"
              >
                <span>{item.actionText}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
