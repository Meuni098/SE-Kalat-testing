"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/utils";

interface AmoCentralKpiProps {
  mode: "AMO_CENTRAL";
  totalCount: number;
  totalValue: number;
  readyForDispatchCount: number;
  pendingTransferCount: number;
}

interface CollegeTransferredKpiProps {
  mode: "COLLEGE_TRANSFERRED";
  totalCount: number;
  totalValue: number;
  activeCollegesCount: number;
  recentTransfersCount: number;
}

type CustodySegregationKpiProps = AmoCentralKpiProps | CollegeTransferredKpiProps;

export function CustodySegregationKpi(props: CustodySegregationKpiProps) {
  if (props.mode === "AMO_CENTRAL") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total In-House */}
        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase tracking-wider block">
              In-House Holdings
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {props.totalCount}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">Items at AMO</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">warehouse</span>
          </div>
        </div>

        {/* Total Valuation */}
        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase tracking-wider block">
              Central Holding Valuation
            </span>
            <span className="text-xl font-black text-[#A60212] font-mono mt-0.5 block">
              {formatCurrency(props.totalValue)}
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </div>
        </div>

        {/* Ready for College Dispatch */}
        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase tracking-wider block">
              Ready for Allocation
            </span>
            <span className="text-2xl font-black text-[#2E7D32] font-mono mt-0.5 block">
              {props.readyForDispatchCount}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">Available</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">outbox</span>
          </div>
        </div>

        {/* Active Transfer In-Progress */}
        <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-[#6E2B32] uppercase tracking-wider block">
              Transfer Underway (PTR)
            </span>
            <span className="text-2xl font-black text-[#D97B1A] font-mono mt-0.5 block">
              {props.pendingTransferCount}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">Awaiting Sign-off</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#F5AB29] text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">pending_actions</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Transferred */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-[#6E2B32] uppercase tracking-wider block">
            College Deployed Property
          </span>
          <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
            {props.totalCount}{" "}
            <span className="text-xs font-normal text-[#6E2B32]">In Colleges</span>
          </span>
        </div>
        <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center">
          <span className="material-symbols-outlined text-[20px]">domain</span>
        </div>
      </div>

      {/* Total Deployed Valuation */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-[#6E2B32] uppercase tracking-wider block">
            Total Deployed Valuation
          </span>
          <span className="text-xl font-black text-[#A60212] font-mono mt-0.5 block">
            {formatCurrency(props.totalValue)}
          </span>
        </div>
        <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#A60212] flex items-center justify-center">
          <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
        </div>
      </div>

      {/* Active Colleges */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-[#6E2B32] uppercase tracking-wider block">
            Colleges with Custody
          </span>
          <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
            {props.activeCollegesCount}{" "}
            <span className="text-xs font-normal text-[#6E2B32]">Academic Units</span>
          </span>
        </div>
        <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] text-[#D97B1A] flex items-center justify-center">
          <span className="material-symbols-outlined text-[20px]">school</span>
        </div>
      </div>

      {/* Movements */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-[#6E2B32] uppercase tracking-wider block">
            Completed Movements
          </span>
          <span className="text-2xl font-black text-[#2E7D32] font-mono mt-0.5 block">
            {props.recentTransfersCount}{" "}
            <span className="text-xs font-normal text-[#6E2B32]">PTRs Executed</span>
          </span>
        </div>
        <div className="w-10 h-10 rounded bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32] flex items-center justify-center">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
        </div>
      </div>
    </div>
  );
}
