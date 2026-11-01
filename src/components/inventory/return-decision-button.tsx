"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { decideReturnAction } from "@/actions/return-actions";

interface ReturnDecisionProps {
  returnId: string;
  status: string;
  canDecide: boolean;
}

export function ReturnDecisionButtons({ returnId, status, canDecide }: ReturnDecisionProps) {
  const router = useRouter();
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [condition, setCondition] = React.useState("GOOD");

  if (status !== "PENDING" || !canDecide) {
    return null;
  }

  const saveDecision = async (decision: "APPROVED" | "REJECTED") => {
    setLoading(true); setError("");
    try {
      const result = await decideReturnAction(returnId, decision, decision === "APPROVED" ? condition : undefined);
      if ("error" in result) setError(result.error ?? "The return could not be saved.");
      else { setShowPrompt(false); router.refresh(); }
    } catch { setError("The response could not be confirmed. Refresh before retrying."); }
    finally { setLoading(false); }
  };
  const handleApprove = () => saveDecision("APPROVED");
  const handleReject = async () => {
    if (window.confirm("Reject this return request?")) await saveDecision("REJECTED");
  };

  return (
    <>
      {error && <p role="alert" className="text-xs text-[#A60212]">{error}</p>}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowPrompt(true)}
          disabled={loading}
          title="Verify physical return and check-in to warehouse"
          className="h-8 px-2.5 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-1 disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[15px]">inventory</span>
          <span>Acknowledge Intake</span>
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          title="Reject return"
          className="h-8 px-2 rounded border border-[#6E2B32] text-[#6E2B32] hover:bg-cream font-bold text-xs flex items-center gap-1 disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">cancel</span>
        </button>
      </div>

      {showPrompt && (
        <div className="fixed inset-0 z-50 bg-[#3B0A0F] flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded-lg max-w-sm w-full p-5 shadow-2xl relative">
            <h4 className="text-sm font-black text-[#3B0A0F] uppercase">
              Verify Physical Condition
            </h4>
            <p className="text-xs text-[#6E2B32] mt-1">
              Select the condition of this asset upon warehouse storage receipt:
            </p>

            <div className="mt-3 space-y-2">
              {["GOOD", "FAIR", "UNSERVICEABLE"].map((c) => (
                <label
                  key={c}
                  className={`flex items-center justify-between p-2.5 rounded border text-xs font-bold cursor-pointer transition-colors ${
                    condition === c
                      ? "bg-cream border-[#A60212] text-[#A60212]"
                      : "border-border text-[#3B0A0F] hover:bg-cream"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="cond"
                      checked={condition === c}
                      onChange={() => setCondition(c)}
                      className="accent-[#A60212]"
                    />
                    <span>{c}</span>
                  </div>
                  <span className="text-[10px] text-[#6E2B32]">
                    {c === "UNSERVICEABLE"
                      ? "Stage for disposal"
                      : c === "FAIR"
                      ? "Minor wear"
                      : "Ready for reissue"}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowPrompt(false)}
                className="h-8 px-3 rounded border border-border text-xs font-bold text-[#3B0A0F]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={loading}
                className="h-8 px-4 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-1 shadow-sm"
              >
                {loading ? "Processing..." : "Confirm Storage Check-In"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
