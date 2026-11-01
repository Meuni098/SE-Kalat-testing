"use client";
import { compatibleTemplates,type ReportSection } from "@/lib/report-sections";
import { ReferenceFormExport } from "./reference-form-export";

export function OfficialFormPanel({categoryId,unitId,classification,reportSection}:{categoryId?:string;unitId?:string;classification?:string;reportSection?:ReportSection}) {
  return <section className="rounded border border-border bg-white p-5 space-y-4 print:hidden" aria-label="Official document exports">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-lg font-bold text-[#3B0A0F]">Official documents</h2></div>
      <ReferenceFormExport reportSection={reportSection} defaultCategoryId={categoryId} defaultUnitId={unitId} defaultClassification={classification}/>
    </div>
    {reportSection==="inventory"&&<p className="text-sm">These official forms support specific purposes; they are not a general inventory-list report.</p>}
    {reportSection==="requests-returns"&&<p className="text-sm">PPE requests a return; semi-expendable forms acknowledge receipt. Pending requests are not proof of receipt.</p>}
    {reportSection==="category-history"&&<p className="text-sm">Forms support individual events. Request document copies under Requests &amp; Returns.</p>}
    <details className="text-sm text-[#6E2B32]">
      <summary className="cursor-pointer font-semibold">Report help</summary>
      <div className="mt-3 space-y-3">
        <p>Choose a college / operating unit and document purpose to include matching records. All classifications includes both PPE and semi-expendable forms.</p>
        <p>Products fill consecutive rows in each supplied worksheet; different recipients do not repeat the form.</p>
        {reportSection==="requests-returns"&&<p>Document Requests is a separate manual form for requesting copies.</p>}
        <p className="font-semibold">Compatible source templates</p>
        <ul className="space-y-1 list-disc pl-5 break-words">{compatibleTemplates(reportSection,classification).map(t=><li key={t.id}>{t.filename}</li>)}</ul>
        <p>To print, open the downloaded file in Excel or Word.</p>
      </div>
    </details>
  </section>;
}
