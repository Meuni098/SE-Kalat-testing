import { writeAuditEvent } from "@/lib/audit-log-write";
import { documentPreviewResponse } from "./document-preview-response";
import { NextResponse } from "next/server";
import { createReportWorkbook,createReferenceWorkbook } from "./report-workbook";
import { prisma } from "./db";
import { FormExportError,validateFormChanges } from "./form-templates";
import { applyAutomaticExclusions } from "./form-autofill-mapping";
import { loadFormCollection,collectionOptions,mapFormCollectionPage,mapFormCollectionRecord } from "./form-collection-engine";
import type { AutofillScope } from "./form-autofill-source";

const privateHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export async function respondWithFormCollection(body:Record<string,unknown>,scope:AutofillScope,userId:string,allMatching:boolean){
  const id=String(body.templateId),original=["download","preview"].includes(String(body.action))&&!body.autofill;
  const collection=await loadFormCollection(id,original?undefined:scope,allMatching);
  if(body.action==="autofill-options")return NextResponse.json({records:collectionOptions(collection),recordCount:collection.recordCount,totalRowCount:collection.rowCount,variants:collection.variants},{headers:privateHeaders});
  if(original){
    if(body.version!==collection.version)throw new FormExportError("The reference changed. Reload the combined forms.","VERSION_MISMATCH",409);
    if(!Array.isArray(body.changes)||body.changes.length)throw new FormExportError("Choose a recorded preview before editing a combined form.");
    const output=await createReferenceWorkbook(collection.entries.map(e=>e.form.templateId));
    if(body.action==="preview")return documentPreviewResponse(output);
    await writeAuditEvent(prisma, {data:{actorId:userId,action:"EXPORT_REFERENCE_FORMS",entityType:"REPORT",entityId:id,afterState:{templateVersion:collection.version,reportSection:scope.reportSection??"legacy",templateIds:collection.entries.map(e=>e.form.templateId)}}});
    return new NextResponse(new Uint8Array(output.data),{headers:{...privateHeaders,"Content-Type":output.mime,"Content-Disposition":`attachment; filename="${output.filename}"`}});
  }
  const raw=body.action==="autofill"?body:body.autofill;
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new FormExportError("Choose a combined report preview.");
  // The transport boundary is validated here; no client record ID becomes a path or query scope.
  const selection=raw as Record<string,unknown>;
  const page=selection.page??1;
  if(typeof page!=="number")throw new FormExportError("Choose an available report page.");
  if(!allMatching&&typeof selection.recordId!=="string")throw new FormExportError("Choose a matching record from either classification.");
  const pagePlan=(n:number)=>allMatching?mapFormCollectionPage(collection,n):mapFormCollectionRecord(collection,String(selection.recordId),n);
  const plan=pagePlan(page);
  if(body.action==="autofill")return NextResponse.json(plan,{headers:privateHeaders});
  if(body.version!==collection.version)throw new FormExportError("The reference changed. Reload the combined forms.","VERSION_MISMATCH",409);
  if(selection.sourceVersion!==collection.sourceVersion)throw new FormExportError("Recorded data changed in one of the classifications. Refresh the combined report.","SOURCE_CHANGED",409);
  const automatic=applyAutomaticExclusions(plan.form!.templateId,plan,body.excludedFields??[]);
  const form=plan.form!;
  validateFormChanges(form,body.changes);
  const selected=allMatching?collection.pages[page-1]:undefined;
  const entry=selected?collection.entries[selected.entry]:collection.entries.find(e=>e.form.templateId===form.templateId)!;
  const local=selected?entry.batch!.pages[selected.page-1]:undefined;
  const record=local?entry.batch!.groups[local.group]:entry.records.find(r=>`${form.templateId}::${r.id}`===selection.recordId)!;
  const edits=[...automatic.filter(c=>c.value===""&&plan.changes.some(p=>p.fieldId===c.fieldId&&p.value!=="")).map(c=>({fieldId:c.fieldId,value:""})),...body.changes as {fieldId:string;value:string}[]];
  const sources=allMatching?collection.entries.map(e=>({templateId:e.form.templateId,records:e.records})):[{templateId:form.templateId,records:[record]}];
  const output=await createReportWorkbook(sources,{correction:{templateId:form.templateId,recordId:record.id,page:local?.page??page,changes:edits}});
  if(body.action==="preview")return documentPreviewResponse(output);
  await writeAuditEvent(prisma, {data:{actorId:userId,action:"EXPORT_ALL_CLASSIFICATIONS",entityType:"REPORT",entityId:id,afterState:{templateVersion:collection.version,sourceVersion:collection.sourceVersion,reportSection:scope.reportSection??"legacy",templateIds:collection.entries.map(e=>e.form.templateId),recordCount:allMatching?collection.recordCount:1,rowCount:output.rowCount,sheetCount:output.sheetCount,selection:allMatching?"all":"single",overrideCount:edits.length}}});
  return new NextResponse(new Uint8Array(output.data),{headers:{...privateHeaders,"Content-Type":output.mime,"Content-Disposition":`attachment; filename="${output.filename}"`}});
}
