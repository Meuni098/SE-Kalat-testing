import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { getReportSession as getSession } from "@/lib/report-access";
import { formatCurrency } from "@/lib/utils";
import { ReportsStudioClient } from "@/components/reports/reports-studio-client";
import { formUnitScope } from "@/lib/form-templates";
import { reportSection,REPORT_SECTIONS,validateReportScope } from "@/lib/report-sections";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface ReportsPageProps {
  searchParams: Promise<{
    year?: string;
    unitId?: string;
    classification?: string;categoryId?:string;reportSection?:string;personId?:string;templateId?:string;sessionId?:string;status?:string;eventType?:string;eventId?:string;
  }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user=await getSession();
  if(!user)redirect("/login");
  const params = await searchParams;
  let section;
  try{section=reportSection(params.reportSection)??"inventory";validateReportScope({...params,reportSection:section},params.templateId);}catch{return <p role="alert">Choose a valid report section. <a href="/reports">Return to reports</a></p>;}
  let unitId:string|undefined;
  try{unitId=formUnitScope(user,params.unitId);}catch{return <p role="alert">An operating unit must be assigned before you can access reports.</p>;}

  const whereClause: Record<string, unknown> = {
    isDeleted: false,
  };

  if (params.classification && ["PPE","SEMI_EXPENDABLE"].includes(params.classification)) {
    whereClause.classification = params.classification;
  }

  if (unitId) {
    whereClause.unitId = unitId;
  }

  if(params.categoryId&&params.categoryId!=="ALL")whereClause.categoryId=params.categoryId;
  if(section==="accountable-person"&&params.personId)whereClause.accountablePersonId=params.personId;
  const [assets, units,categories] = await Promise.all([
    prisma.asset.findMany({
      where: whereClause,
      include: {
        category: true,
        unit: true,
        accountablePerson: true,
      },
      orderBy: { propertyNo: "asc" },take:5001,
    }),
    prisma.unit.findMany({ where: { isActive: true,...(user.role==="CUSTODIAN"?{id:unitId}:{}) }, orderBy: { code: "asc" } }),
    prisma.category.findMany({select:{id:true,name:true},orderBy:{name:"asc"}}),
  ]);

  if(assets.length>5000)return <p role="alert">Choose a narrower category or operating unit to load fewer report source records. <a href="/reports/inventory">Return to inventory reports</a></p>;
  const totalValue = assets.reduce((sum, a) => sum + a.acquisitionCost, 0);

  const selectedUnit = units.find((u) => u.id === unitId);

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Page Header */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#FFF4E0] text-[#A60212] border border-[#A60212] px-2 py-0.5 rounded text-[11px] font-bold font-mono">
              ORIGINAL DOCUMENT FORMS
            </span>
            <span className="bg-[#FFF4E0] text-[#6E2B32] border border-[#EBD3B2] px-2 py-0.5 rounded text-[11px] font-mono">
              RPCPPE &amp; ICS STUDIO
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            {REPORT_SECTIONS.find(s=>s.id===section)?.name}
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-0.5">
            Choose a document purpose and automatically fill the supplied original files from matching recorded data
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="bg-[#FFF4E0] border border-[#EBD3B2] px-3 py-1.5 rounded font-bold text-[#3B0A0F]">
            Total Ledger: {formatCurrency(totalValue)}
          </span>
        </div>
      </div>

      {/* Interactive Reports Studio Client */}
      <Suspense fallback={<div className="text-xs text-[#6E2B32]">Loading Reports Studio...</div>}>
        <ReportsStudioClient
          assets={assets.map((a) => ({
            id: a.id,
            propertyNo: a.propertyNo,
            name: a.name,
            description: a.description,
            classification: a.classification,
            categoryName: a.category.name,
            unitCode: a.unit.code,
            unitName: a.unit.name,
            accountablePerson: a.accountablePerson?.fullName || "Unassigned",
            acquisitionCost: a.acquisitionCost,
            condition: a.condition,
            status: a.status,
          }))}
          reportSection={section} categories={categories} unitLocked={user.role==="CUSTODIAN"}
          units={units.map((u) => ({ id: u.id, code: u.code, name: u.name }))}
          selectedUnitName={selectedUnit ? `${selectedUnit.code} — ${selectedUnit.name}` : "All Operating Units"}
        />
      </Suspense>
    </div>
  );
}
