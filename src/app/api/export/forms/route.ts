import { writeAuditEvent } from "@/lib/audit-log-write";
import { NextRequest, NextResponse } from "next/server";
import { getReportSession as getSession } from "@/lib/report-access";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { FormExportError, validateFormChanges, formUnitScope,type AutofillChange } from "@/lib/form-templates";
import { loadFormTemplate, generateFormExport } from "@/lib/form-template-engine";
import { getFormHistory } from "@/lib/form-history";
import { getAutofillRecords } from "@/lib/form-autofill-source";
import { autofillPageCount,applyAutomaticExclusions,mapAutofill } from "@/lib/form-autofill-mapping";
import { REPORT_SECTIONS,compatibleExportTemplates,reportSection,validateReportScope,type ReportScope } from "@/lib/report-sections";
import { getReportFilterOptions } from "@/lib/report-filter-options";
import { buildAutofillBatch,mapAutofillBatchPage } from "@/lib/form-autofill-batch";
import { formCollection,exportTemplateIds } from "@/lib/form-collections";
import { loadFormCollection,describeFormCollection } from "@/lib/form-collection-engine";
import { respondWithFormCollection } from "@/lib/form-collection-response";
import { documentPreviewResponse } from "@/lib/document-preview-response";
import { createReportWorkbook } from "@/lib/report-workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control":"private, no-store" };
function fail(err: unknown) {
  if (err instanceof FormExportError) return NextResponse.json({error:err.message,code:err.code},{status:err.status,headers:privateHeaders});
  console.error("Form export failed",err);
  return NextResponse.json({error:"The form could not be prepared. Please retry.",code:"EXPORT_FAILED"},{status:500,headers:privateHeaders});
}
function text(value: unknown, fallback=""): string {
  if (value===undefined || value===null) return fallback;
  if (typeof value!=="string" || value.length>150) throw new FormExportError("Invalid filter.");
  return value;
}
export async function GET(req: NextRequest) {
  try {
    const user=await getSession();
    if (!user) throw new FormExportError("Please sign in to access export forms.","UNAUTHORIZED",401);
    if(!rateLimit(`form-preview-${user.id}`,60,60000).allowed)throw new FormExportError("Too many form previews. Please retry in one minute.","RATE_LIMIT",429);
    const scope=formUnitScope(user,text(req.nextUrl.searchParams.get("unitId")));
    const section=reportSection(req.nextUrl.searchParams.get("reportSection"));
    const classification=text(req.nextUrl.searchParams.get("classification"),"ALL")||"ALL";
    validateReportScope({reportSection:section,classification});
    if(scope&&!await prisma.unit.findUnique({where:{id:scope},select:{id:true}}))throw new FormExportError("Operating unit not found.","INVALID_FILTER");
    const id=req.nextUrl.searchParams.get("templateId");
    if (!id) {
      const [categories,units]=await Promise.all([
        prisma.category.findMany({select:{id:true,name:true},orderBy:{name:"asc"}}),
        prisma.unit.findMany({where:{isActive:true,...(user.role==="CUSTODIAN"?{id:scope}:{})},select:{id:true,code:true,name:true},orderBy:{code:"asc"}}),
      ]);
      const filters=section?await getReportFilterOptions({unitId:scope}):{persons:[],sessions:[]};
      const templates=compatibleExportTemplates(section,classification).map(t=>({...t,reportSections:REPORT_SECTIONS.filter(s=>exportTemplateIds(t.id).every(id=>s.templates.some(tid=>tid===id))).map(s=>s.id)}));
      return NextResponse.json({templates,categories,units,...filters,sections:REPORT_SECTIONS,unitId:scope??"ALL",unitLocked:user.role==="CUSTODIAN"},{headers:privateHeaders});
    }
    validateReportScope({reportSection:section,classification},id);
    if(formCollection(id))return NextResponse.json(describeFormCollection(await loadFormCollection(id)),{headers:privateHeaders});
    const {description}=await loadFormTemplate(id);
    return NextResponse.json(description,{headers:privateHeaders});
  } catch(err) {return fail(err);}
}
export async function POST(req: NextRequest) {
  try {
    const user=await getSession();
    if (!user) throw new FormExportError("Please sign in to export forms.","UNAUTHORIZED",401);
    if (Number(req.headers.get("content-length")??0)>300000) throw new FormExportError("Export request is too large.");
    const raw=await req.text(); if(raw.length>300000) throw new FormExportError("Export request is too large.");
    let body;
    try {body=JSON.parse(raw);} catch {throw new FormExportError("Invalid export request.");}
    if (!body || typeof body!=="object" || Array.isArray(body)) throw new FormExportError("Invalid export request.");
    if(!["download","preview","history","autofill-options","autofill"].includes(body.action))throw new FormExportError("Unknown export action.");
    if((body.autofill||body.bundle)&&!["download","preview"].includes(body.action))throw new FormExportError("Automatic output requires download or preview.");
    const selectionMode=["download","preview"].includes(body.action)?body.autofill?.selection:body.selection;
    if(selectionMode!==undefined&&!['all','single'].includes(selectionMode))throw new FormExportError("Choose all matching records or one record.","INVALID_FILTER");
    const allMatching=selectionMode==="all";
    const automatic:AutofillChange[]=[];
    const downloading=body.action==="download",visualPreview=body.action==="preview";
    if(!rateLimit(`${visualPreview?"document-preview":downloading?"export":"form-preview"}-${user.id}`,visualPreview?6:downloading?5:60,60000).allowed)throw new FormExportError(downloading?"Export limit reached. Please retry in one minute.":"Too many form previews. Please retry in one minute.","RATE_LIMIT",429);
    const unitId=formUnitScope(user,text(body.unitId));
    const categoryId=text(body.categoryId,"ALL")||"ALL";
    const classification=text(body.classification,"ALL")||"ALL";
    const reportScope:ReportScope={reportSection:reportSection(body.reportSection),categoryId,unitId,classification,
      personId:text(body.personId)||undefined,sessionId:text(body.sessionId)||undefined,status:text(body.status)||undefined,eventType:text(body.eventType)||undefined,eventId:text(body.eventId)||undefined};
    validateReportScope(reportScope,body.action==="history"?undefined:text(body.templateId),(body.action==="autofill"||!!body.autofill||(["download","preview"].includes(body.action)&&Array.isArray(body.changes)&&body.changes.length>0))&&!allMatching);
    if(body.action==="history"&&(reportScope.personId||reportScope.sessionId||reportScope.status||reportScope.eventId))throw new FormExportError("Use an applicable history event-type filter.","INVALID_FILTER");
    let exportSourceVersion:string|undefined;let exportRecordCount=1;let exportGroupCount=1;
    if(["history","autofill-options","autofill"].includes(body.action)||body.autofill){
      if (categoryId!=="ALL" && !await prisma.category.findUnique({where:{id:categoryId},select:{id:true}})) throw new FormExportError("Category not found.");
      if (unitId && !await prisma.unit.findUnique({where:{id:unitId},select:{id:true}})) throw new FormExportError("Operating unit not found.");
      if (!["ALL","PPE","SEMI_EXPENDABLE"].includes(classification)) throw new FormExportError("Invalid classification.");
    }
    if(formCollection(text(body.templateId))&&body.action!=="history"){
      if(body.action==="autofill-options"&&reportScope.reportSection==="accountable-person"&&!reportScope.personId&&!allMatching)return NextResponse.json({records:[]},{headers:privateHeaders});
      return await respondWithFormCollection(body,{...reportScope,categoryId},user.id,allMatching);
    }
    if(body.action==="autofill-options"||body.action==="autofill"||body.autofill){
      const templateId=text(body.templateId);
      if(body.action==="autofill-options"&&reportScope.reportSection==="accountable-person"&&!reportScope.personId&&!allMatching)return NextResponse.json({records:[]},{headers:privateHeaders});
      const records=await getAutofillRecords(templateId,{...reportScope,categoryId},allMatching);
      if(body.action==="autofill-options")return NextResponse.json({records:records.map(r=>({id:r.id,label:r.label,rowCount:r.rows.length,pageCount:autofillPageCount(templateId,r)})),recordCount:records.length,totalRowCount:records.reduce((sum,r)=>sum+r.rows.length,0)},{headers:privateHeaders});
      const selection=body.action==="autofill"?body:body.autofill;
      if(!selection||typeof selection!=="object")throw new FormExportError("Choose a recorded transaction or count session.");
      const record=allMatching?undefined:records.find(r=>r.id===text(selection.recordId));
      if(!allMatching&&!record)throw new FormExportError("This record is unavailable in your selected scope. Reload the matching records.","RECORD_UNAVAILABLE",403);
      const {description}=await loadFormTemplate(templateId);
      const page=selection.page??1;
      const batch=allMatching?buildAutofillBatch(templateId,records):undefined;
      const pagePlan=(n:number)=>batch?mapAutofillBatchPage(description,batch,n):mapAutofill(description,record!,n,true);
      const plan=pagePlan(page);
      exportSourceVersion=plan.sourceVersion;exportRecordCount=batch?.recordCount??1;exportGroupCount=batch?.groups.length??1;
      if(body.action==="autofill")return NextResponse.json(plan,{headers:privateHeaders});
      if(selection.sourceVersion!==plan.sourceVersion)throw new FormExportError("Recorded data changed. Select the record again to refresh the populated form.","SOURCE_CHANGED",409);
      const excluded:unknown=body.excludedFields??[];
      const filteredAutomatic=applyAutomaticExclusions(templateId,plan,excluded);
      if(body.version!==description.version)throw new FormExportError("The reference changed. Reload the form.","VERSION_MISMATCH",409);
      // Validate protected fields and manual edits before building the complete workbook.
      validateFormChanges(description,body.changes);
      const entry=batch?.pages[page-1],group=entry?batch!.groups[entry.group]:record!;
      const edits=[...filteredAutomatic.filter(c=>c.value===""&&plan.changes.some(p=>p.fieldId===c.fieldId&&p.value!=="")).map(c=>({fieldId:c.fieldId,value:""})),...body.changes];
      const output=await createReportWorkbook([{templateId,records:allMatching?records:[record!]}],{correction:{templateId,recordId:group.id,page:entry?.page??page,changes:edits}});
      if(visualPreview)return await documentPreviewResponse(output);
      await writeAuditEvent(prisma, {data:{actorId:user.id,action:"EXPORT_AUTOFILLED_FORMS",entityType:"REPORT",entityId:templateId,afterState:{templateVersion:description.version,sourceVersion:plan.sourceVersion,rowCount:output.rowCount,sheetCount:output.sheetCount,reportSection:reportScope.reportSection??"legacy",overrideCount:edits.length,recordCount:batch?.recordCount??1,selection:allMatching?"all":"single"}}});
      return new NextResponse(new Uint8Array(output.data),{headers:{...privateHeaders,"Content-Type":output.mime,"Content-Disposition":`attachment; filename="${output.filename}"`,"X-Content-Type-Options":"nosniff"}});
    }
    if (body.action==="history") {
      const events=await getFormHistory({categoryId,unitId,classification,eventType:reportScope.eventType});
      return NextResponse.json({events},{headers:privateHeaders});
    }
    if(!["download","preview"].includes(body.action)) throw new FormExportError("Unknown export action.");
    // Internal automatic changes always come from fresh authorized records, never from request JSON.
    const {data,description}=await generateFormExport(text(body.templateId),text(body.version),body.changes,automatic);
    if(visualPreview)return await documentPreviewResponse({data,filename:description.filename});
    await writeAuditEvent(prisma, {data:{actorId:user.id,action:"EXPORT_REFERENCE_FORM",entityType:"REPORT",entityId:description.templateId,afterState:{templateVersion:description.version,reportSection:reportScope.reportSection??"legacy",sourceVersion:exportSourceVersion??null,pageCount:1,overrideCount:body.changes.length,selection:allMatching?"all":"single",recordCount:exportRecordCount,groupCount:exportGroupCount,fieldIds:Array.from(new Set([...automatic.map(c=>c.fieldId),...body.changes.map((c:{fieldId:string})=>c.fieldId)]))}}});
    const extension=description.filename.split(".").pop();
    const mime=extension==="xls"?"application/vnd.ms-excel":extension==="docx"?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return new NextResponse(new Uint8Array(data),{headers:{...privateHeaders,"Content-Type":mime,"Content-Disposition":`attachment; filename="${description.templateId}.${extension}"; filename*=UTF-8''${encodeURIComponent(description.filename)}`,"X-Content-Type-Options":"nosniff"}});
  }catch(err){return fail(err);}
}
