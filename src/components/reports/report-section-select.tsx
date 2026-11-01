"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { REPORT_SECTIONS, reportHref, reportSection, type ReportSection } from "@/lib/report-sections";

export function ReportSectionSelect({value}:{value:ReportSection}) {
  const router=useRouter(),params=useSearchParams();
  return <label className="block rounded border border-border bg-white p-4 text-sm font-bold print:hidden">Report section
    <select aria-label="Report section" className="block border rounded p-2 mt-1 w-full sm:w-auto" value={value} onChange={e=>{
      const section=reportSection(e.target.value)!;
      const common={unitId:params.get("unitId")??undefined,categoryId:params.get("categoryId")??undefined,classification:params.get("classification")??undefined};
      if(section==="category-history"){
        const query=new URLSearchParams();for(const [key,val] of Object.entries(common))if(val)query.set(key,val);
        router.push(`/reports/category-history?${query}`);
      }else router.push(reportHref(section,common));
    }}>{REPORT_SECTIONS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
  </label>;
}
