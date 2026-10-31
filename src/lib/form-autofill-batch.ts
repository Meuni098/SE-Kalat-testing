import { createHash } from "node:crypto";
import { FormExportError, type FormDescription, type AutofillPreview } from "./form-templates";
import { autofillPageCount, mapAutofill, type AutofillRecord } from "./form-autofill-mapping";

export interface AutofillBatch {
  groups:AutofillRecord[];
  pages:{group:number;page:number}[];
  sourceVersion:string;
  recordCount:number;
  rowCount:number;
}

export function autofillGroupKey(templateId:string,record:AutofillRecord){
  return JSON.stringify(templateId==="information"?["information"]:[
      record.kind,record.groupKey??record.id,record.rows[0]?.classification,record.date,record.status,
      record.fromName,record.fromPosition,record.fromUnit,record.toName,record.toPosition,record.toUnit,
      record.approvedBy,record.approvedDate,record.identitySource,record.requestedDate,record.decisionDate,
      record.kind==="transfer"?record.remarks:null,
    ]);
}

/** Group only records with the same stable party/unit identity and printed header values. */
export function buildAutofillBatch(templateId:string,records:AutofillRecord[]):AutofillBatch {
  if(!records.length)throw new FormExportError("No matching records are available for this college/category and form.","NO_MATCHING_DATA",422);
  if(new Set(records.map(r=>r.id)).size!==records.length)throw new FormExportError("Duplicate source records were returned. Refresh the report.","INVALID_SOURCE",422);
  const sourceVersion=createHash("sha256").update(JSON.stringify({templateId,records:records.slice().sort((a,b)=>a.id.localeCompare(b.id))})).digest("hex");
  const grouped=new Map<string,AutofillRecord>();
  for(const record of records){
    const key=autofillGroupKey(templateId,record);
    const rows=record.rows.map(row=>({...row,remarks:row.remarks??record.remarks}));
    const group=grouped.get(key);
    if(group)group.rows.push(...rows);
    else grouped.set(key,{...record,rows});
  }
  const groups=Array.from(grouped.values());
  if(templateId==="information")for(const group of groups){group.summary=records.map(r=>r.summary??"").filter(Boolean).join("\n");group.rows=group.rows.map(row=>({...row,name:"Recorded history for selected scope"}));}
  const pages:AutofillBatch["pages"]=[];
  for(let group=0;group<groups.length;group++){
    const count=autofillPageCount(templateId,groups[group]);
    if(records.reduce((n,r)=>n+r.rows.length,0)>100000)throw new FormExportError("Narrow the selection to at most 100,000 transaction rows.","SCOPE_TOO_LARGE",422);
    for(let page=1;page<=count;page++)pages.push({group,page});
  }
  return {groups,pages,sourceVersion,recordCount:records.length,rowCount:records.reduce((n,r)=>n+r.rows.length,0)};
}

export function mapAutofillBatchPage(form:FormDescription,batch:AutofillBatch,page:number):AutofillPreview {
  if(!Number.isInteger(page)||page<1||page>batch.pages.length)throw new FormExportError("Choose an available report page.");
  const entry=batch.pages[page-1],record=batch.groups[entry.group];
  const plan=mapAutofill(form,record,entry.page,true);
  return {...plan,recordId:"all-matching",selection:"all",sourceVersion:batch.sourceVersion,page,pageCount:batch.pages.length,
    recordCount:batch.recordCount,totalRowCount:batch.rowCount,groupCount:batch.groups.length,groupLabel:record.label,
    warnings:[...plan.warnings,"All matching records are included. Products fill one continuous table per supplied worksheet. Preview groups do not repeat the exported form; differing parties, dates and sessions stay with the relevant rows."]};
}
