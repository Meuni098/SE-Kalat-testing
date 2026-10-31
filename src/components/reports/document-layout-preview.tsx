"use client";
import * as React from "react";
import type { DocumentLayoutPreview } from "@/lib/document-preview";

export function DocumentLayoutPreviewPanel({preview}:{preview:DocumentLayoutPreview}){
  const [sheet,setSheet]=React.useState("all"),[zoom,setZoom]=React.useState(100);
  const selected=preview.sheets.some(s=>s.id===sheet)?sheet:"all";
  const html=preview.html.replace("</head>",`<style>body{zoom:${zoom/100}}${selected!=="all"?`section[data-preview-sheet]:not([data-preview-sheet="${selected}"]){display:none}`:""}</style></head>`);
  return <section aria-label="Document layout preview" className="border rounded bg-[#FFF4E0] p-3 space-y-3">
    <h3 className="font-bold">Document layout preview</h3>
    <p className="text-sm break-words">{preview.filename}</p>
    <div className="flex flex-wrap gap-4">
      <label className="text-sm">Worksheet<select aria-label="Preview worksheet" className="block border rounded p-2 bg-white" value={selected} onChange={e=>setSheet(e.target.value)}><option value="all">All worksheets / pages</option>{preview.sheets.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="text-sm">Zoom<select aria-label="Preview zoom" className="block border rounded p-2 bg-white" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[50,75,100,125,150].map(value=><option key={value} value={value}>{value}%</option>)}</select></label>
    </div>
    <p className="text-xs">{preview.notice}</p>
    <iframe title="Generated document appearance" sandbox="" referrerPolicy="no-referrer" srcDoc={html} className="w-full h-[600px] bg-white border rounded"/>
  </section>;
}
