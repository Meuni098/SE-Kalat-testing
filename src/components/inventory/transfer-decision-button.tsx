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
  const inFlight = React.useRef(false);
  const [completed, setCompleted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  if (status !== "PENDING" || !canDecide || completed) {
    return null;
  }

  const handleDecision = async (decision: "APPROVED" | "REJECTED") => {
    if (inFlight.current) return;
    const promptMsg =
      decision === "APPROVED"
        ? "Approve this asset transfer? The asset will move to the receiving college or unit immediately."
        : "Are you sure you want to reject this transfer request?";
    if (!window.confirm(promptMsg)) return;

    inFlight.current = true;
    setLoading(true); setError("");
    try {
      const result = await decideTransferAction(transferId, decision);
      if ("error" in result) setError(result.error ?? "The transfer could not be saved.");
      else { setCompleted(true); router.refresh(); }
    } catch { setError("The response could not be confirmed. Refresh before retrying."); }
    finally { inFlight.current = false; setLoading(false); }
  };

  return (
    <div aria-busy={loading} className="flex flex-wrap items-center gap-1.5">
      {loading && <span role="status" className="w-full text-xs text-[#6E2B32]">Saving decision…</span>}
      {error && <p role="alert" className="w-full text-xs text-[#A60212]">{error}</p>}
      <button
        type="button"
        onClick={() => handleDecision("APPROVED")}
        disabled={loading}
        title="Approve and execute transfer"
        className="h-8 px-2.5 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-1 disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[15px]">check_circle</span>
        <span>Approve</span>
      </button>
      <button
        type="button"
        onClick={() => handleDecision("REJECTED")}
        disabled={loading}
        title="Reject transfer"
        className="h-8 px-2.5 rounded border border-[#6E2B32] text-[#6E2B32] hover:bg-cream font-bold text-xs flex items-center gap-1 disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed transition-colors"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[15px]">cancel</span>
        <span>Reject</span>
      </button>
    </div>
  );
}
