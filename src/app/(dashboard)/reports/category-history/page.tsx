import { prisma } from "@/lib/db";
import { getReportSession as getSession } from "@/lib/report-access";
import { redirect } from "next/navigation";
import { getFormHistory } from "@/lib/form-history";
import { formUnitScope,FormExportError,type FormHistoryEvent } from "@/lib/form-templates";
import { CategoryHistoryPreview } from "@/components/reports/category-history-preview";
import { HISTORY_EVENT_TYPES } from "@/lib/report-sections";
import { ReportSectionSelect } from "@/components/reports/report-section-select";
import Link from "next/link";
export const dynamic="force-dynamic";
interface PageProps {searchParams:Promise<{categoryId?:string;unitId?:string;classification?:string;eventType?:string}>}
export default async function CategoryHistoryPage({searchParams}:PageProps) {
  const user=await getSession();if(!user)redirect("/login");
  const params=await searchParams;
  let scope:string|undefined;
  try{scope=formUnitScope(user,params.unitId);}catch{return <p role="alert">An operating unit must be assigned before you can access reports.</p>;}
  const categoryId=params.categoryId||"ALL";
  const classification=["PPE","SEMI_EXPENDABLE","ALL"].includes(params.classification??"")?params.classification!:"ALL";
  const [categories,units]=await Promise.all([
    prisma.category.findMany({orderBy:{name:"asc"}}),
    prisma.unit.findMany({where:{isActive:true,...(scope&&user.role==="CUSTODIAN"?{id:scope}:{})},orderBy:{code:"asc"}}),
  ]);
  let events:FormHistoryEvent[]=[];let error="";
  try{
    if(categoryId!=="ALL"&&!categories.some(c=>c.id===categoryId))throw new FormExportError("Select an existing category.");
    if(params.eventType&&!HISTORY_EVENT_TYPES.some(t=>t===params.eventType))throw new FormExportError("Select a valid history event type.");
    events=await getFormHistory({categoryId,unitId:scope,classification,eventType:params.eventType});
  }catch(err){if(err instanceof FormExportError)error=err.message;else throw err;}
  return <div className="space-y-5 pb-16">
    <ReportSectionSelect value="category-history"/>
    <header className="bg-white border border-border rounded p-5 space-y-2 print:hidden">
      <h1 className="text-2xl font-bold text-[#3B0A0F]">Recorded asset history</h1>
      <div className="flex gap-4 text-sm underline"><Link href="/inventory">Inventory</Link><Link href="/reports">Reports</Link></div>
    </header>
    <form method="get" className="bg-white border border-border rounded p-4 flex flex-wrap items-end gap-3 print:hidden">
      <label className="text-sm">Product category<select className="block border rounded p-2 mt-1" name="categoryId" defaultValue={categoryId}><option value="ALL">All categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></label>
      <label className="text-sm">College / operating unit<select className="block border rounded p-2 mt-1" name="unitId" defaultValue={scope||"ALL"}>{user.role!=="CUSTODIAN"&&<option value="ALL">All authorized units</option>}{units.map(u=><option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}</select></label>
      <label className="text-sm">Classification<select className="block border rounded p-2 mt-1" name="classification" defaultValue={classification}><option value="ALL">All classifications</option><option value="PPE">PPE</option><option value="SEMI_EXPENDABLE">Semi-expendable</option></select></label>
      <label className="text-sm">Event type<select name="eventType" className="block border rounded p-2 mt-1" defaultValue={params.eventType??""}><option value="">All event types</option>{HISTORY_EVENT_TYPES.map(t=><option key={t} value={t}>{t.replaceAll("_"," ")}</option>)}</select></label>
      <button className="rounded bg-[#3B0A0F] text-white px-4 py-2 text-sm" type="submit">Load history</button>
    </form>
    <CategoryHistoryPreview key={`${categoryId}:${scope}:${classification}:${params.eventType}`} events={events} categoryId={categoryId} unitId={scope} classification={classification} error={error}/>
  </div>;
}
