"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { decideTransferAction } from "@/actions/transfer-actions";

interface TransferDecisionProps {
  transferId: string;
  status: string;
  canDecide: boolean;
}

export function TransferDecisionButtons({ transferId, status, canDecide }: TransferDecisionProps) {
  const router = useRouter();
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (status !== "PENDING" || !canDecide) {
    return null;
  }

  const handleDecision = async (decision: "APPROVED" | "REJECTED") => {
    const promptMsg =
      decision === "APPROVED"
        ? "Approve this asset transfer? The asset's designated unit and custodian will be updated immediately."
        : "Are you sure you want to reject this transfer request?";
    if (!window.confirm(promptMsg)) return;

    setLoading(true); setError("");
    try {
      const result = await decideTransferAction(transferId, decision);
      if ("error" in result) setError(result.error ?? "The transfer could not be saved.");
      else router.refresh();
    } catch { setError("The response could not be confirmed. Refresh before retrying."); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {error && <p role="alert" className="w-full text-xs text-[#A60212]">{error}</p>}
      <button
        onClick={() => handleDecision("APPROVED")}
        disabled={loading}
        title="Approve and execute transfer"
        className="h-8 px-2.5 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-1 disabled:opacity-50 transition-colors shadow-sm"
      >
        <span className="material-symbols-outlined text-[15px]">check_circle</span>
        <span>Approve</span>
      </button>
      <button
        onClick={() => handleDecision("REJECTED")}
        disabled={loading}
        title="Reject transfer"
        className="h-8 px-2.5 rounded border border-[#6E2B32] text-[#6E2B32] hover:bg-[#FFF4E0] font-bold text-xs flex items-center gap-1 disabled:opacity-50 transition-colors"
      >
        <span className="material-symbols-outlined text-[15px]">cancel</span>
        <span>Reject</span>
      </button>
    </div>
  );
}
