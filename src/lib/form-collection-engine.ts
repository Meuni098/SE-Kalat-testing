import { createHash } from "node:crypto";
import { FormExportError, type FormDescription, type AutofillPreview, type AutofillOption } from "./form-templates";
import { formCollection,collectionDescription } from "./form-collections";
import { buildAutofillBatch,mapAutofillBatchPage,type AutofillBatch } from "./form-autofill-batch";
import { mapAutofill,autofillPageCount,type AutofillRecord } from "./form-autofill-mapping";
import { loadFormTemplate } from "./form-template-engine";
import { getAutofillRecords,type AutofillScope } from "./form-autofill-source";

interface CollectionEntry {form:FormDescription;records:AutofillRecord[];batch?:AutofillBatch}
export interface FormCollectionData {
  id:string;entries:CollectionEntry[];version:string;sourceVersion:string;
  pages:{entry:number;page:number}[];pageCount:number;recordCount:number;rowCount:number;groupCount:number;
  variants:{templateId:string;filename:string;recordCount:number;rowCount:number;pageCount:number}[];
}
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildFormCollection(id:string,input:{form:FormDescription;records:AutofillRecord[]}[]):FormCollectionData {
  const collection=formCollection(id);
  if(!collection)throw new FormExportError("Unknown combined form.","NOT_FOUND",404);
  const entries:CollectionEntry[]=collection.templates.map(templateId=>{
    const entry=input.find(e=>e.form.templateId===templateId);
    if(!entry)throw new FormExportError("A combined form reference is missing.","MAPPING_CHANGED",422);
    return {...entry,batch:entry.records.length?buildAutofillBatch(templateId,entry.records):undefined};
  });
  const pages:FormCollectionData["pages"]=[];
  for(let entry=0;entry<entries.length;entry++){
    const count=entries[entry].batch?.pages.length??0;
    if(entries.reduce((n,e)=>n+e.records.reduce((total,r)=>total+r.rows.length,0),0)>100000)throw new FormExportError("Narrow the selection to at most 100,000 transaction rows.","SCOPE_TOO_LARGE",422);
    for(let page=1;page<=count;page++)pages.push({entry,page});
  }
  const variants=entries.map(e=>({templateId:e.form.templateId,filename:e.form.filename,recordCount:e.records.length,rowCount:e.records.reduce((n,r)=>n+r.rows.length,0),pageCount:e.batch?.pages.length??0}));
  return {id,entries,pages,pageCount:pages.length,variants,
    version:digest(["all-classifications-v2-single-workbook",entries.map(e=>[e.form.templateId,e.form.version])]),
    sourceVersion:digest(entries.map(e=>[e.form.templateId,e.batch?.sourceVersion??"empty"])),
    recordCount:variants.reduce((n,v)=>n+v.recordCount,0),rowCount:variants.reduce((n,v)=>n+v.rowCount,0),groupCount:entries.reduce((n,e)=>n+(e.batch?.groups.length??0),0)};
}
export function describeFormCollection(collection:FormCollectionData){
  return collectionDescription(collection.id,collection.entries.map(e=>e.form),collection.version);
}
export async function loadFormCollection(id:string,scope?:AutofillScope,allMatching=true){
  const collection=formCollection(id);
  if(!collection)throw new FormExportError("Unknown combined form.","NOT_FOUND",404);
  const entries=await Promise.all(collection.templates.map(async templateId=>{
    const [{description},records]=await Promise.all([loadFormTemplate(templateId),scope?getAutofillRecords(templateId,scope,allMatching):Promise.resolve([])]);
    return {form:description,records};
  }));
  return buildFormCollection(id,entries);
}
export function collectionOptions(collection:FormCollectionData):AutofillOption[]{
  return collection.entries.flatMap(e=>e.records.map(r=>({id:`${e.form.templateId}::${r.id}`,label:`${e.form.templateId.toUpperCase()} · ${r.label}`,rowCount:r.rows.length,pageCount:autofillPageCount(e.form.templateId,r)})));
}
export function mapFormCollectionPage(collection:FormCollectionData,page:number):AutofillPreview {
  if(!collection.pageCount)throw new FormExportError("No matching records exist in either classification.","NO_MATCHING_DATA",422);
  if(!Number.isInteger(page)||page<1||page>collection.pageCount)throw new FormExportError("Choose an available combined report page.");
  const selected=collection.pages[page-1],entry=collection.entries[selected.entry];
  const plan=mapAutofillBatchPage(entry.form,entry.batch!,selected.page);
  return {...plan,recordId:"all-classifications",page,pageCount:collection.pageCount,form:entry.form,referenceVersion:collection.version,sourceVersion:collection.sourceVersion,
    recordCount:collection.recordCount,totalRowCount:collection.rowCount,groupCount:collection.groupCount,variants:collection.variants,
    warnings:[...plan.warnings,"All classifications includes both original form variants. Empty variants contain no matching records and are not fabricated."]};
}
export function mapFormCollectionRecord(collection:FormCollectionData,recordId:string,page:number):AutofillPreview {
  for(const entry of collection.entries){
    const record=entry.records.find(r=>`${entry.form.templateId}::${r.id}`===recordId);
    if(record){const plan=mapAutofill(entry.form,record,page,true);return {...plan,recordId,form:entry.form,referenceVersion:collection.version,sourceVersion:collection.sourceVersion,variants:collection.variants};}
  }
  throw new FormExportError("This record is unavailable in either authorized classification.","RECORD_UNAVAILABLE",403);
}
