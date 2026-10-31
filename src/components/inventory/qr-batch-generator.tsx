"use client";

import * as React from "react";
import QRCode from "qrcode";
import { areAllVisibleSelected, toggleVisibleSelection } from "@/lib/qr-selection";
import { escapeLabelText, finishLabelPrint } from "@/lib/qr-label";

interface AssetForQr {
  id: string;
  propertyNo: string;
  name: string;
  classification: string;
  categoryName: string;
  unitCode: string;
}

interface QrBatchGeneratorProps {
  assets: AssetForQr[];
  units: { id: string; code: string; name: string }[];
}

export function QrBatchGenerator({ assets, units }: QrBatchGeneratorProps) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [selectedUnit, setSelectedUnit] = React.useState<string>("ALL");
  const cache = React.useRef<Record<string, string>>({});
  const [generation, setGeneration] = React.useState<{ key: string; images: Record<string, string>; failed: boolean }>({ key: "", images: {}, failed: false });
  const [printError, setPrintError] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);

  // Filter assets
  const filteredAssets = assets.filter((a) => {
    if (selectedUnit !== "ALL" && a.unitCode !== selectedUnit) return false;
    return true;
  });

  const visibleIds = filteredAssets.map(asset => asset.id);
  const allVisibleSelected = areAllVisibleSelected(selectedIds, visibleIds);
  const toggleSelectAll = () => setSelectedIds(previous => toggleVisibleSelection(previous, visibleIds));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectedAssets = React.useMemo(() => assets.filter(a => selectedIds.includes(a.id)), [assets, selectedIds]);
  const generationKey = JSON.stringify([selectedAssets.map(asset => [asset.id, asset.propertyNo]), retry]);
  const isGenerating = selectedAssets.length > 0 && generation.key !== generationKey;
  const qrMap = generation.images;
  const generationError = generation.key === generationKey && generation.failed
    ? "Some QR labels could not be generated. Retry before printing." : null;
  const qrError = printError ?? generationError;
  React.useEffect(() => {
    let active = true;
    async function generate() {
      const images: Record<string, string> = {};
      let failed = false;
      for (const asset of selectedAssets) {
        if (!active) return;
        try {
          const image = cache.current[asset.propertyNo] ?? await QRCode.toDataURL(asset.propertyNo, {
            width: 240, margin: 4, color: { dark: "#3B0A0F", light: "#FFFFFF" },
          });
          if (!active) return;
          cache.current[asset.propertyNo] = image;
          images[asset.propertyNo] = image;
        } catch { failed = true; }
      }
      if (active) setGeneration({ key: generationKey, images, failed });
    }
    generate().catch(() => { if (active) setGeneration({ key: generationKey, images: {}, failed: true }); });
    return () => { active = false; };
  }, [selectedAssets, generationKey]);
  const allReady = !isGenerating && selectedAssets.length > 0 && selectedAssets.every(asset => !!qrMap[asset.propertyNo]);

  const handlePrintSheet = () => {
    if (!allReady) return;

    const printWin = window.open("", "_blank");
    if (!printWin) { setPrintError("The print window was blocked. Allow popups for this site and try again."); return; }

    setPrintError(null);
    const cardsHtml = selectedAssets
      .map(
        (a) => `
        <div class="sticker">
          <div class="header">BulSU-Bustos Campus Inventory</div>
          <div class="prop-no">${escapeLabelText(a.propertyNo)}</div>
          <div class="asset-title">${escapeLabelText(a.name)}</div>
          <img class="qr-img" src="${qrMap[a.propertyNo] || ""}" />
          <div class="footer">${escapeLabelText(a.unitCode)} • ${escapeLabelText(a.classification)}</div>
        </div>
      `
      )
      .join("");

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>BulSU Product QR Labels — (${selectedAssets.length} tags)</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 4mm;
            }
            .sticker {
              border: 1.5px solid #3B0A0F;
              border-radius: 4px;
              padding: 6px;
              text-align: center;
              box-sizing: border-box;
              height: 48mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              page-break-inside: avoid;
            }
            .header {
              font-size: 8px;
              font-weight: bold;
              color: #A60212;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .prop-no {
              font-size: 11px;
              font-weight: 900;
              color: #3B0A0F;
              font-family: monospace;
              margin-top: 2px;
            }
            .asset-title {
              font-size: 9px;
              font-weight: 600;
              color: #333;
              max-height: 22px;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.1;
            }
            .qr-img {
              width: 80px;
              height: 80px;
              margin: 2px auto;
            }
            .footer {
              font-size: 8px;
              font-weight: bold;
              color: #6E2B32;
              border-top: 0.5px solid #ddd;
              width: 100%;
              padding-top: 2px;
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${cardsHtml}
          </div>

        </body>
      </html>
    `);
    finishLabelPrint(printWin);
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-4 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <label htmlFor="qr-unit-filter" className="text-[11px] font-bold text-[#6E2B32] uppercase tracking-wider block mb-1">
              Filter by Unit
            </label>
            <select id="qr-unit-filter"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="h-9 px-3 rounded border border-[#EBD3B2] bg-[#FFF4E0] text-xs font-bold text-[#3B0A0F] focus:outline-none focus:border-[#A60212]"
            >
              <option value="ALL">All Campus Units</option>
              {units.map((u) => (
                <option key={u.id} value={u.code}>
                  {u.code} — {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4">
            <button type="button"
              disabled={filteredAssets.length === 0}
              onClick={toggleSelectAll}
              className="h-9 px-3 rounded border border-[#EBD3B2] bg-[#FFFFFF] hover:bg-[#FFF4E0] text-xs font-bold text-[#3B0A0F] transition-colors"
            >
              {allVisibleSelected ? "Deselect All Visible" : "Select All Available"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[#3B0A0F]">
            Selected: <span className="font-mono text-[#A60212] font-black">{selectedAssets.length}</span> items ({filteredAssets.length} visible)
          </span>

          <button type="button"
            onClick={handlePrintSheet}
            disabled={!allReady || isGenerating}
            className="h-10 px-5 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>
              {isGenerating ? "Preparing Labels..." : `Print Label Sheet (${selectedAssets.length})`}
            </span>
          </button>
        </div>
      </div>

      {qrError && <div role="alert" className="text-sm text-[#A60212]">{qrError} <button type="button" className="underline" onClick={() => { setPrintError(null); setRetry(value => value + 1); }}>Retry labels</button></div>}
      <p role="status" aria-live="polite" className="text-xs text-[#6E2B32]">
        {isGenerating ? "Preparing QR labels for selected items…" : selectedAssets.length === 0 ? "Select an item card or use Select All Available to prepare QR labels." : allReady ? `${selectedAssets.length} QR labels ready to print. Printing includes selected items from other units.` : "Some labels are unavailable. Retry labels to enable printing."}
      </p>
      {!filteredAssets.length && <p>No items available for QR labels.</p>}
      {/* Asset Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssets.map((asset) => {
          const isSelected = selectedIds.includes(asset.id);
          const qrUrl = qrMap[asset.propertyNo];

          return (
            <label
              key={asset.id}
              className={`p-4 rounded border-2 transition-all cursor-pointer flex items-start gap-3 select-none ${
                isSelected
                  ? "bg-[#FFF4E0] border-[#A60212] shadow-sm"
                  : "bg-[#FFFFFF] border-[#EBD3B2] hover:border-[#F5AB29]"
              }`}
            >
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  aria-label={`Select ${asset.propertyNo} ${asset.name}`}
                  checked={isSelected}
                  onChange={() => toggleSelect(asset.id)}
                  className="w-4 h-4 rounded accent-[#A60212] cursor-pointer"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-xs text-[#A60212]">
                    {asset.propertyNo}
                  </span>
                  <span className="text-[10px] font-bold bg-[#3B0A0F] text-[#F5AB29] px-1.5 py-0.2 rounded">
                    {asset.unitCode}
                  </span>
                </div>

                <span className="block text-xs font-bold text-[#3B0A0F] truncate mt-1">
                  {asset.name}
                </span>

                <p className="text-[10px] text-[#6E2B32] mt-0.5 truncate">
                  {asset.categoryName} • {asset.classification}
                </p>

                {isSelected && !qrUrl && <span className="block text-xs mt-2">{isGenerating ? "Generating QR…" : "QR unavailable — retry labels."}</span>}
                {isSelected && qrUrl && (
                  <div className="mt-2 pt-2 border-t border-[#EBD3B2] flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrUrl}
                      alt={asset.propertyNo}
                      className="w-12 h-12 border border-[#EBD3B2] rounded bg-white p-0.5"
                    />
                    <span className="text-[10px] text-[#2E7D32] font-bold">
                      ✓ Ready for 3x8 Sheet Print
                    </span>
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
