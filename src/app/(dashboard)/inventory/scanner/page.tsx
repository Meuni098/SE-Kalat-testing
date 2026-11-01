"use client";

import * as React from "react";
import Link from "next/link";
import { lookupAssetByPropertyNo, confirmPhysicalCountPresence } from "@/actions/custodian-actions";
import { formatCurrency } from "@/lib/utils";

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

export default function WebQRScannerPage() {
  const verificationOperation = React.useRef<string | null>(null);
  const [propertyInput, setPropertyInput] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [scannedAsset, setScannedAsset] = React.useState<ScannedAsset | null>(null);
  const [verifySuccess, setVerifySuccess] = React.useState(false);
  const [isCameraActive, setIsCameraActive] = React.useState(false);

  const sampleTags = [
    "BULSU-2024-PPE-0104",
    "BULSU-2024-PPE-0481",
    "BULSU-2024-PPE-0892",
    "BULSU-2024-PPE-0915",
    "BULSU-2024-PPE-0312",
  ];

  const handleLookup = async (propertyNo: string) => {
    if (!propertyNo.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setVerifySuccess(false);
    verificationOperation.current = null;

    let result;
    try { result = await lookupAssetByPropertyNo(propertyNo.trim()); }
    catch { setIsSearching(false); setScannedAsset(null); setSearchError("Lookup could not be completed. Try again."); return; }
    setIsSearching(false);

    if ("error" in result) {
      setSearchError(result.error ?? "Lookup could not be completed.");
      setScannedAsset(null);
    } else if ("asset" in result) {
      setScannedAsset(result.asset as ScannedAsset);
      setPropertyInput(result.asset.propertyNo);
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
    <div className="space-y-6 pb-16 select-none">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-border p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Desktop QR Scanner &amp; Quick Verification
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/scan"
            target="_blank"
            className="h-10 px-4 rounded bg-cream hover:bg-sand text-[#3B0A0F] font-bold text-xs flex items-center gap-1.5 border border-border transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px] text-[#A60212]">
              phone_android
            </span>
            <span>Open Mobile PWA Scanner</span>
          </Link>
        </div>
      </div>

      {/* Main Scanner Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Optical Viewfinder & Input (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#FFFFFF] border border-border rounded shadow-sm overflow-hidden">
            <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">
                  qr_code_scanner
                </span>
                <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
                  Optical Viewfinder
                </span>
              </div>
              <button
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
                  isCameraActive
                    ? "bg-[#A60212] text-[#FFF4E0] border border-[#F5AB29]"
                    : "bg-[#4E1117] text-[#F5AB29] border border-[#6E2B32] hover:bg-[#6E2B32]"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isCameraActive ? "videocam" : "videocam_off"}
                </span>
                <span>{isCameraActive ? "Active Camera" : "Turn On Camera"}</span>
              </button>
            </div>

            {/* Viewfinder simulation box */}
            <div className="bg-[#240508] p-8 flex flex-col items-center justify-center min-h-[300px] relative border-b border-border">
              {isCameraActive ? (
                <div className="w-[240px] h-[240px] border-2 border-dashed border-[#F5AB29] rounded-lg relative flex flex-col items-center justify-center bg-[#3B0A0F] animate-pulse">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#F5AB29]" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#F5AB29]" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#F5AB29]" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#F5AB29]" />
                  <span className="material-symbols-outlined text-[48px] text-[#F5AB29]/80 mb-2">
                    center_focus_strong
                  </span>
                  <span className="text-xs text-[#FFF4E0] font-bold text-center px-4">
                    Position BulSU asset QR tag inside frame
                  </span>
                </div>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-16 h-16 rounded-full bg-[#3B0A0F] border border-[#6E2B32] text-[#F5AB29] flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-[32px]">qr_code_2</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#FFF4E0]">Camera Standby</h4>
                  <p className="text-xs text-[#EBD3B2] max-w-sm mx-auto">
                    Turn on the camera or enter a product code.
                  </p>
                </div>
              )}
            </div>

            {/* Fast Manual / Handheld Scanner Barcode Input */}
            <div className="p-4 bg-cream">
              <label className="text-xs font-bold text-[#3B0A0F] block mb-1">
                Product Code / Barcode Scan Input
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={propertyInput}
                  onChange={(e) => setPropertyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup(propertyInput)}
                  placeholder="e.g. BULSU-2024-PPE-0104"
                  className="flex-1 h-10 px-3 rounded border border-border bg-[#FFFFFF] text-xs font-bold text-[#3B0A0F] font-mono focus:outline-none focus:border-[#A60212]"
                />
                <button
                  onClick={() => handleLookup(propertyInput)}
                  disabled={isSearching}
                  className="h-10 px-5 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">search</span>
                  <span>{isSearching ? "Searching..." : "Lookup Code"}</span>
                </button>
              </div>

              {/* Sample Tag Chips */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-[#6E2B32]">Quick Test Tags:</span>
                {sampleTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleLookup(tag)}
                    className="px-2 py-0.5 rounded bg-[#FFFFFF] hover:bg-sand border border-border text-[10px] font-mono font-bold text-[#A60212] transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Scanned Asset Dossier (5 Cols) */}
        <div className="lg:col-span-5">
          <div className="bg-[#FFFFFF] border border-border rounded shadow-sm overflow-hidden h-full flex flex-col justify-between">
            <div>
              <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">badge</span>
                  <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
                    Asset Verification Dossier
                  </span>
                </div>
                {scannedAsset && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded badge-solid badge-amber">
                    TAG RESOLVED
                  </span>
                )}
              </div>

              {searchError && (
                <div className="m-4 bg-[#FFEBEE] border border-[#FFCDD2] text-[#C62828] p-4 rounded text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">warning</span>
                  <span>{searchError}</span>
                </div>
              )}

              {verifySuccess && (
                <div className="m-4 bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32] p-4 rounded text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  <span>Physical presence verified and timestamp logged in audit ledger!</span>
                </div>
              )}

              {scannedAsset ? (
                <div className="p-5 space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#6E2B32] tracking-wider block">
                      Product Code
                    </span>
                    <span className="text-lg font-black text-[#A60212] font-mono block">
                      {scannedAsset.propertyNo}
                    </span>
                    <h3 className="text-base font-extrabold text-[#3B0A0F] mt-1 leading-snug">
                      {scannedAsset.name}
                    </h3>
                    <p className="text-xs text-[#6E2B32] mt-0.5">{scannedAsset.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border text-xs">
                    <div>
                      <span className="text-[10px] text-[#6E2B32] font-semibold block">
                        Assigned Unit:
                      </span>
                      <span className="font-bold text-[#3B0A0F] block">
                        {scannedAsset.unitCode} ({scannedAsset.unitName})
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#6E2B32] font-semibold block">
                        Received By:
                      </span>
                      <span className="font-bold text-[#3B0A0F] block">
                        {scannedAsset.accountablePerson}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#6E2B32] font-semibold block">
                        Acquisition Valuation:
                      </span>
                      <span className="font-mono font-bold text-[#A60212] block">
                        {formatCurrency(scannedAsset.acquisitionCost)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#6E2B32] font-semibold block">
                        Classification:
                      </span>
                      <span className="font-bold text-[#3B0A0F] block">
                        {scannedAsset.classification}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#6E2B32] font-semibold block">Status:</span>
                      <span className="font-bold text-[#D97B1A] block">{scannedAsset.status}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#6E2B32] font-semibold block">
                        Physical Condition:
                      </span>
                      <span className="font-bold text-[#2E7D32] block">
                        {scannedAsset.condition}
                      </span>
                    </div>
                  </div>

                  {/* Operational Action Controls */}
                  <div className="pt-4 border-t border-border space-y-2">
                    <button
                      onClick={handleConfirmPresence}
                      disabled={isSearching}
                      className="w-full h-10 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">fact_check</span>
                      <span>Verify In-Place for Physical Audit</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/inventory/transfers?propertyNo=${scannedAsset.propertyNo}`}
                        className="h-9 px-3 rounded bg-cream hover:bg-sand border border-border text-[#3B0A0F] font-bold text-xs flex items-center justify-center gap-1 transition-colors text-center"
                      >
                        <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                        <span>Request Transfer</span>
                      </Link>

                      <Link
                        href={`/inventory/${scannedAsset.id}`}
                        className="h-9 px-3 rounded bg-[#FFFFFF] hover:bg-cream border border-border text-[#3B0A0F] font-bold text-xs flex items-center justify-center gap-1 transition-colors text-center"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        <span>Full Dossier</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-10 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-cream border border-border text-[#6E2B32] flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-[28px]">search</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#3B0A0F]">No Asset Currently Loaded</h4>
                  <p className="text-xs text-[#6E2B32] max-w-xs mx-auto">
                    Scan or enter a product code to view the item.
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-cream border-t border-border text-[11px] text-[#6E2B32] flex items-center justify-between">
              <span>COA Physical Verification System</span>
              <span className="font-mono font-bold text-[#A60212]">BulSU-AMO-2024</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
