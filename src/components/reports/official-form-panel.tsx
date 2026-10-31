"use client";
import { compatibleTemplates,type ReportSection } from "@/lib/report-sections";
import { ReferenceFormExport } from "./reference-form-export";

export function OfficialFormPanel({categoryId,unitId,classification,reportSection}:{categoryId?:string;unitId?:string;classification?:string;reportSection?:ReportSection}) {
  return <section className="rounded border border-[#EBD3B2] bg-white p-5 space-y-4 print:hidden" aria-label="Official document exports">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-lg font-bold text-[#3B0A0F]">Official document exports</h2><p className="text-sm text-[#6E2B32]">Choose the form for the action: accountability, physical count, transfer, return, or requesting document copies.</p></div>
      <ReferenceFormExport reportSection={reportSection} defaultCategoryId={categoryId} defaultUnitId={unitId} defaultClassification={classification}/>
    </div>
    <p className="text-sm">Choose a college / operating unit and document purpose to automatically include all matching records. All classifications includes both PPE and semi-expendable forms. Products fill consecutive rows in each supplied worksheet; different recipients do not repeat the form.</p>
    {reportSection==="inventory"&&<p className="text-sm">These are related official forms. None of the supplied templates is a general inventory-list report.</p>}
    {reportSection==="requests-returns"&&<p className="text-sm">PPE: request a return. Semi-expendable: acknowledge an item actually received back. A pending request is not proof of receipt. Document Requests is a separate manual form for requesting copies.</p>}
    {reportSection==="category-history"&&<p className="text-sm">These forms support individual history events. Document-copy requests belong under Requests &amp; Returns, not the history report.</p>}
    <details className="text-sm"><summary className="cursor-pointer font-semibold">Compatible supplied source files</summary><ul className="mt-2 space-y-1 list-disc pl-5 break-words">{compatibleTemplates(reportSection,classification).map(t=><li key={t.id}>{t.filename}</li>)}</ul></details>
    <p className="text-xs text-[#6E2B32]">For a printed submission, open the downloaded file in Excel or Word and print it there.</p>
  </section>;
}
