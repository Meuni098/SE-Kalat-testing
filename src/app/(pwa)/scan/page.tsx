"use client";

import * as React from "react";
import Link from "next/link";
import { lookupAssetByPropertyNo, confirmPhysicalCountPresence } from "@/actions/custodian-actions";
import { formatCurrency } from "@/lib/utils";
import { getStatusBadgeStyle } from "@/config/theme";
import { Button } from "@/components/ui/button";

interface ScannedAsset {
  id: string;
  propertyNo: string;
  name: string;
  description?: string | null;
  classification: string;
  categoryName: string;
  unitCode: string;
  unitName: string;
  accountablePerson: string;
  acquisitionCost: number;
  status: string;
  condition: string;
}

export default function MobileScanPage() {
  const verificationOperation = React.useRef<string | null>(null);
  const [propertyInput, setPropertyInput] = React.useState("");
  const [manualModalOpen, setManualModalOpen] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [scannedAsset, setScannedAsset] = React.useState<ScannedAsset | null>(null);
  const [verifySuccess, setVerifySuccess] = React.useState(false);

  const sampleTags = [
    "BULSU-2024-PPE-0104",
    "BULSU-2024-PPE-0481",
    "BULSU-2024-PPE-0892",
    "BULSU-2024-PPE-0915",
  ];

  const handleLookup = async (propertyNo: string) => {
    setIsSearching(true);
    setSearchError(null);
    setVerifySuccess(false);
    verificationOperation.current = null;

    let result;
    try { result = await lookupAssetByPropertyNo(propertyNo); }
    catch { setIsSearching(false); setScannedAsset(null); setSearchError("Lookup could not be completed. Try again."); return; }
    setIsSearching(false);

    if ("error" in result) {
      setSearchError(result.error ?? "Lookup could not be completed.");
      setScannedAsset(null);
    } else if ("asset" in result) {
      setScannedAsset(result.asset as ScannedAsset);
      setManualModalOpen(false);
    }
  };

  const handleConfirmPresence = async () => {
    if (!scannedAsset) return;
    setIsSearching(true);
    verificationOperation.current ??= crypto.randomUUID();
    let res;
    try { res = await confirmPhysicalCountPresence(scannedAsset.propertyNo, undefined, verificationOperation.current); }
    catch { setIsSearching(false); setSearchError("The response could not be confirmed. Retry this verification."); return; }
    setIsSearching(false);
    if ("success" in res && res.success) {
      setVerifySuccess(true);
    } else { setSearchError(res.error ?? "Verification could not be saved."); }
  };

  return (
    <div className="min-h-screen bg-[#3B0A0F] flex items-center justify-center p-0 sm:py-6 select-none">
      {/* 375px PWA Mobile Shell */}
      <main className="w-full max-w-[420px] bg-[#FFF4E0] min-h-screen sm:min-h-[820px] sm:h-[820px] flex flex-col relative sm:border sm:border-[#EBD3B2] overflow-hidden">
        {/* Top Header */}
        <header className="h-14 px-4 bg-[#3B0A0F] border-b border-[#4E1117] flex items-center justify-between shrink-0 z-30">
          <Link
            href="/dashboard"
            className="w-8 h-8 rounded bg-[#4E1117] flex items-center justify-center text-[#FFF4E0] border border-[#6E2B32] hover:bg-[#A60212]"
            title="Return to Dashboard"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </Link>

          <div className="flex flex-col items-center">
            <span className="text-[#FFF4E0] font-black text-sm uppercase tracking-wide">
              AMO Asset Scanner
            </span>
            <span className="text-[#F5AB29] text-[10px] font-bold">Field Physical Audit</span>
          </div>

          <button
            onClick={() => setManualModalOpen(true)}
            className="w-8 h-8 rounded bg-[#4E1117] flex items-center justify-center text-[#F5AB29] border border-[#6E2B32] hover:bg-[#A60212]"
            title="Manual Input"
          >
            <span className="material-symbols-outlined text-[18px]">keyboard</span>
          </button>
        </header>

        {/* Viewfinder Section */}
        <section className="h-[320px] w-full bg-[#3B0A0F] flex flex-col items-center justify-center relative shrink-0 border-b border-[#EBD3B2]">
          {/* Target Bounding Box (220x220) */}
          <div className="w-[220px] h-[220px] rounded relative flex items-center justify-center">
            {/* 4 Amber Corners */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#F5AB29]" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#F5AB29]" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#F5AB29]" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#F5AB29]" />

            {/* Amber Laser Line Animation */}
            <div className="absolute left-2 right-2 h-[2px] bg-[#F5AB29] animate-pulse" />

            {/* Target Display */}
            <div className="w-36 h-36 bg-[#FFFFFF] border-2 border-[#3B0A0F] p-3 flex flex-col justify-between items-center text-center">
              <span className="material-symbols-outlined text-[#A60212] text-[40px]">
                qr_code_scanner
              </span>
              <span className="text-[10px] font-mono font-bold text-[#3B0A0F]">
                BULSU OPTICAL TAG
              </span>
              <span className="text-[9px] text-[#6E2B32]">Align tag in frame</span>
            </div>
          </div>

          {/* Quick Demo Scan Barcode Triggers */}
          <div className="mt-4 flex items-center gap-1.5 flex-wrap justify-center px-4">
            <span className="text-[10px] text-[#EBD3B2] uppercase font-bold mr-1">
              Simulate Scan:
            </span>
            {sampleTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleLookup(tag)}
                className="px-2 py-0.5 rounded bg-[#4E1117] text-[#F5AB29] border border-[#6E2B32] text-[10px] font-mono hover:bg-[#A60212] hover:text-[#FFF4E0] transition-colors"
              >
                {tag.replace("BULSU-2024-", "")}
              </button>
            ))}
          </div>
        </section>

        {/* Error Notification */}
        {searchError && (
          <div className="p-3 bg-[#FEE2E2] border-b border-[#FECACA] text-xs text-[#A60212] font-semibold flex items-center justify-between">
            <span>{searchError}</span>
            <button onClick={() => setSearchError(null)} className="font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Bottom Action Sheet (Scanned Asset Result) */}
        <section className="flex-1 bg-[#FFFFFF] p-5 flex flex-col justify-between overflow-y-auto">
          {scannedAsset ? (
            <div className="space-y-4">
              {/* Asset Identity Card */}
              <div className="p-3.5 bg-[#FFF4E0] border border-[#EBD3B2] rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-black text-[#A60212]">
                    {scannedAsset.propertyNo}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      getStatusBadgeStyle(scannedAsset.status).bg
                    } ${getStatusBadgeStyle(scannedAsset.status).border} ${
                      getStatusBadgeStyle(scannedAsset.status).text
                    }`}
                  >
                    {getStatusBadgeStyle(scannedAsset.status).label}
                  </span>
                </div>

                <h2 className="text-sm font-bold text-[#3B0A0F] leading-tight">
                  {scannedAsset.name}
                </h2>

                <div className="mt-2 pt-2 border-t border-[#EBD3B2] grid grid-cols-2 gap-2 text-[11px] text-[#6E2B32]">
                  <div>
                    <span className="block font-bold text-[#3B0A0F]">Operating Unit:</span>
                    <span>
                      {scannedAsset.unitCode} ({scannedAsset.unitName})
                    </span>
                  </div>
                  <div>
                    <span className="block font-bold text-[#3B0A0F]">Custodian:</span>
                    <span>{scannedAsset.accountablePerson}</span>
                  </div>
                  <div>
                    <span className="block font-bold text-[#3B0A0F]">Value:</span>
                    <span className="font-mono font-bold text-[#3B0A0F]">
                      {formatCurrency(scannedAsset.acquisitionCost)}
                    </span>
                  </div>
                  <div>
                    <span className="block font-bold text-[#3B0A0F]">Condition:</span>
                    <span>{scannedAsset.condition}</span>
                  </div>
                </div>
              </div>

              {verifySuccess && (
                <div className="p-3 bg-[#FFF4E0] border border-[#D97B1A] rounded text-xs text-[#3B0A0F] font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#A60212] text-[18px]">
                    check_circle
                  </span>
                  <span>Presence verified and logged in Annual Count Audit Sheet!</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleConfirmPresence}
                  disabled={isSearching || verifySuccess}
                  className="w-full gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                  <span>{verifySuccess ? "Presence Confirmed" : "1-Tap Confirm Presence"}</span>
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/inventory/${scannedAsset.id}`}
                    className="py-2 px-3 rounded bg-[#FFFFFF] border border-[#EBD3B2] hover:bg-[#FFF4E0] text-xs font-bold text-[#3B0A0F] text-center transition-colors"
                  >
                    View Dossier
                  </Link>

                  <Link
                    href={`/missing`}
                    className="py-2 px-3 rounded bg-[#FEE2E2] border border-[#FECACA] hover:bg-[#FECACA] text-xs font-bold text-[#A60212] text-center transition-colors"
                  >
                    Report Missing
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6E2B32]">
              <span className="material-symbols-outlined text-[48px] text-[#EBD3B2] mb-2">
                document_scanner
              </span>
              <p className="text-sm font-bold text-[#3B0A0F]">Awaiting Asset Scan</p>
              <p className="text-xs mt-1">
                Point your mobile camera at any BulSU property tag or tap one of the test badges
                above.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setManualModalOpen(true)}
                className="mt-4 gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                <span>Manual Lookup</span>
              </Button>
            </div>
          )}
        </section>

        {/* Manual Input Modal */}
        {manualModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B0A0F]/80">
            <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded w-full max-w-sm p-5 select-none">
              <div className="flex items-center justify-between pb-2 border-b border-[#EBD3B2]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#3B0A0F]">
                  Product Code Lookup
                </h3>
                <button
                  onClick={() => setManualModalOpen(false)}
                  className="text-[#6E2B32] hover:text-[#A60212]"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3">
                <label className="block text-xs font-bold text-[#3B0A0F] mb-1">
                  Enter Product Code
                </label>
                <input
                  type="text"
                  value={propertyInput}
                  onChange={(e) => setPropertyInput(e.target.value)}
                  placeholder="BULSU-2024-PPE-0104"
                  className="w-full bg-[#FFF4E0] border border-[#EBD3B2] rounded p-2 text-xs font-mono font-bold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setManualModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleLookup(propertyInput)}
                  disabled={!propertyInput.trim()}
                >
                  Lookup Tag
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
