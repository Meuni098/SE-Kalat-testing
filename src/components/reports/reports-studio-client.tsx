"use client";
import { useRouter,useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { ReportSectionSelect } from "./report-section-select";
import type { ReportSection } from "@/lib/report-sections";
import { OfficialFormPanel } from "./official-form-panel";
export interface ReportAssetItem {
  id:string;propertyNo:string;name:string;description?:string|null;classification:string;
  categoryName:string;unitCode:string;unitName:string;accountablePerson:string;
  acquisitionCost:number;condition:string;status:string;
}
interface ReportsStudioClientProps {assets:ReportAssetItem[];units:{id:string;code:string;name:string}[];selectedUnitName:string;reportSection:ReportSection;categories:{id:string;name:string}[];unitLocked:boolean}
export function ReportsStudioClient({assets,units,selectedUnitName,reportSection,categories,unitLocked}:ReportsStudioClientProps) {
  const router=useRouter(),params=useSearchParams();
  const unitId=unitLocked?(units[0]?.id??""):params.get("unitId")||"",classification=params.get("classification")==="ALL"?"":params.get("classification")||"";
  function filter(key:string,value:string){const next=new URLSearchParams(params.toString());for(const name of ["recordId","eventId","templateId","personId","sessionId"])next.delete(name);if(value)next.set(key,value);else next.delete(key);router.push(`/reports?${next}`);}
  return <div className="space-y-5">
    <ReportSectionSelect value={reportSection}/>
    <OfficialFormPanel reportSection={reportSection} categoryId={params.get("categoryId")||undefined} unitId={unitId} classification={classification}/>
    <section className="bg-white rounded border border-border p-5 space-y-4 print:hidden">
      <h2 className="font-bold">Current inventory source records</h2>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">Product category<select className="block border rounded p-2 mt-1" value={params.get("categoryId")||""} onChange={e=>filter("categoryId",e.target.value)}><option value="">All categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-sm">College / operating unit<select disabled={unitLocked} className="block border rounded p-2 mt-1" value={unitId} onChange={e=>filter("unitId",e.target.value)}>{!unitLocked&&<option value="">All authorized units</option>}{units.map(u=><option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}</select></label>
        <label className="text-sm">Classification<select className="block border rounded p-2 mt-1" value={classification} onChange={e=>filter("classification",e.target.value)}><option value="">All classifications</option><option value="PPE">PPE</option><option value="SEMI_EXPENDABLE">Semi-expendable</option></select></label>
        <Link className="text-sm underline p-2" href={`/reports/category-history?${new URLSearchParams({categoryId:params.get("categoryId")||"ALL",unitId:unitId||"ALL",classification:classification||"ALL"})}`}>View recorded history</Link>
      </div>
      <p className="text-sm">{selectedUnitName} · {assets.length} assets · {formatCurrency(assets.reduce((total,a)=>total+a.acquisitionCost,0))} acquisition cost</p>
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-cream">{["Property number","Asset","Unit","Accountable person","Cost","Status"].map(h=><th key={h} className="p-2 border-b">{h}</th>)}</tr></thead>
        <tbody>{assets.map(a=><tr key={a.id}>{[a.propertyNo,a.name,a.unitCode,a.accountablePerson,formatCurrency(a.acquisitionCost),a.status].map((value,i)=><td key={i} className="p-2 border-b">{value}</td>)}</tr>)}</tbody>
      </table></div>{!assets.length&&<p>No assets match this scope.</p>}
    </section>
    <p className="hidden print:block">Download the required original form from Official document exports, then print the downloaded file in Excel or Word.</p>
  </div>;
}
