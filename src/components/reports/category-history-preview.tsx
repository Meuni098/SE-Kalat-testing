"use client";
import Link from "next/link";
import { reportHref } from "@/lib/report-sections";
import { FORM_TEMPLATES } from "@/lib/form-templates";
import * as React from "react";
import type { FormHistoryEvent } from "@/lib/form-templates";
interface CategoryHistoryPreviewProps {
  events:FormHistoryEvent[];categoryId:string;unitId?:string;classification?:string;error?:string;
}
export function CategoryHistoryPreview({events,categoryId,unitId,classification,error}:CategoryHistoryPreviewProps) {
  const [query,setQuery]=React.useState("");
  const filtered=events.filter(e=>`${e.propertyNo} ${e.assetName} ${e.eventType} ${e.status}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-5">
    <section className="bg-white border rounded p-4 space-y-2"><h2 className="font-bold">History and supporting documents</h2><p className="text-sm">Open an event’s linked form for its supporting document. These forms do not export the full history.</p><Link className="text-sm underline" href={reportHref("requests-returns",{templateId:"information"})}>Request copies of documents</Link></section>
    <section className="rounded border border-border bg-white p-5 space-y-3 print:hidden">
      <h2 className="font-bold text-[#3B0A0F]">Recorded history</h2>

      {error?<p role="alert">{error}</p>:<>
        <label className="block text-sm">Search history<input className="block mt-1 border rounded p-2 w-full" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <p className="text-xs">{filtered.length} matching events{filtered.length>300?" · Showing the first 300; search to narrow the results.":""}</p>
        <div className="overflow-auto"><table className="w-full text-left text-sm border-collapse"><thead><tr className="bg-cream">{["Date","Property number","Asset","Event","Status","Official document"].map(h=><th key={h} className="p-2 border-b">{h}</th>)}</tr></thead>
          <tbody>{filtered.slice(0,300).map(e=><tr key={e.eventId}>{[e.date,e.propertyNo,e.assetName,e.eventType.replaceAll("_"," "),e.status].map((v,i)=><td key={i} className="p-2 border-b">{v}</td>)}<td className="p-2 border-b"><div className="flex flex-col gap-2">
            {e.source?.templateIds.map(id=><Link className="underline" key={id} href={reportHref("category-history",{categoryId,unitId,classification,templateId:id,recordId:e.source!.recordId,eventId:e.eventId})}>{FORM_TEMPLATES.find(t=>t.id===id)?.name}</Link>)}
          </div></td></tr>)}</tbody>
        </table></div>{!filtered.length&&<p>No history matches this scope.</p>}
      </>}
    </section>
    <p className="hidden print:block">Download the required original form from Official document exports, then print the downloaded file in Excel or Word.</p>
  </div>;
}
