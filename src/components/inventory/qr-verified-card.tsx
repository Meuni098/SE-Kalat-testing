"use client";
import * as React from "react";
import QRCode from "qrcode";
import { escapeLabelText, finishLabelPrint } from "@/lib/qr-label";

interface QrVerifiedCardProps {
  propertyNo: string;
  assetName: string;
  unitCode: string;
}

export function QrVerifiedCard({ propertyNo, assetName, unitCode }: QrVerifiedCardProps) {
  const [image, setImage] = React.useState<{ code: string; url: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const qrDataUrl = image?.code === propertyNo ? image.url : "";
  React.useEffect(() => {
    let active = true;
    QRCode.toDataURL(propertyNo, { width: 240, margin: 4, color: { dark: "#3B0A0F", light: "#FFFFFF" } })
      .then(url => { if (active) { setImage({ code: propertyNo, url }); setError(null); } })
      .catch(() => { if (active) setError("Unable to generate the QR image. Your product code is saved."); });
    return () => { active = false; };
  }, [propertyNo, attempt]);

  const handlePrint = () => {
    if (!qrDataUrl) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { setError("The print window was blocked. Allow popups for this site and try again."); return; }
    setError(null);
    printWindow.document.write(`<!DOCTYPE html><html><head><title>BulSU Product QR Label</title>
      <style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;padding:24px}.tag{border:2px solid #3B0A0F;padding:16px;text-align:center;width:280px;overflow-wrap:anywhere}.code{font-family:monospace;font-weight:bold}img{width:180px;height:180px}</style>
      </head><body><div class="tag"><strong>Bulacan State University • AMO</strong>
      <p>Product Code</p><p class="code">${escapeLabelText(propertyNo)}</p>
      <p>${escapeLabelText(assetName)}</p><img src="${qrDataUrl}" alt="Product QR code">
      <p>${escapeLabelText(unitCode)}</p></div></body></html>`);
    finishLabelPrint(printWindow);
  };

  return <div className="bg-white border-2 border-[#3B0A0F] rounded p-5 text-center">
    <h3 className="text-sm font-bold text-[#3B0A0F]">Product QR Label</h3>
    <p className="text-xs text-[#6E2B32] my-2">Scan or enter the product code to look up this item.</p>
    {qrDataUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={qrDataUrl} alt={`QR code for ${propertyNo}`} width={200} height={200} className="mx-auto" />
    ) : <div role="status" className="h-[200px] flex items-center justify-center text-sm">{error ? "QR image unavailable" : "Generating QR…"}</div>}
    <p className="text-xs mt-2">Product Code</p>
    <p className="font-mono font-bold text-[#A60212] select-text break-all">{propertyNo}</p>
    <p className="text-xs mt-1">{unitCode}</p>
    {error && <div role="alert" className="text-sm text-[#A60212] mt-3">{error}
      {!qrDataUrl && <button type="button" className="underline ml-2" onClick={() => { setError(null); setAttempt(value => value + 1); }}>Retry QR</button>}
    </div>}
    <button type="button" disabled={!qrDataUrl} onClick={handlePrint} className="mt-4 text-sm text-[#A60212] font-bold underline disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed">Print QR Label</button>
  </div>;
}
