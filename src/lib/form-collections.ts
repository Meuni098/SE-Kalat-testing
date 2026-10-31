import { FORM_TEMPLATES, formPurpose, type FormDescription, FormExportError } from "./form-templates";

export const FORM_COLLECTIONS = [
  {id:"all-acknowledgment",name:"All classifications — PAR + ICS",filename:"PAR_and_ICS.xlsx",purpose:"acknowledgment",templates:["par","ics"]},
  {id:"all-transfer",name:"All classifications — PTR + ITR",filename:"PTR_and_ITR.xlsx",purpose:"transfer",templates:["ptr","itr"]},
  {id:"all-physical-count",name:"All classifications — RPCPPE + RPCSP",filename:"RPCPPE_and_RPCSP.xlsx",purpose:"physical-count",templates:["rpcppe","rpcsp"]},
] as const;
export function formCollection(id:string){return FORM_COLLECTIONS.find(c=>c.id===id);}
export function exportPurpose(id:string){return formCollection(id)?.purpose??formPurpose(id)?.id;}
export function exportTemplateIds(id:string):readonly string[]{return formCollection(id)?.templates??[id];}
export function collectionForPurpose(purpose:string){return FORM_COLLECTIONS.find(c=>c.purpose===purpose);}
export function validateCollectionScope(id:string,classification?:string){
  if(formCollection(id)&&classification&&classification!=="ALL")throw new FormExportError("Combined forms require All classifications.","INCOMPATIBLE_TEMPLATE");
}
export function resolveExportTemplate(id:string,purpose:string,classification?:string){
  if((!classification||classification==="ALL")&&(!id||exportPurpose(id)===purpose))return collectionForPurpose(purpose)?.id??id;
  return id;
}
export function collectionDescription(id:string,forms:FormDescription[],version:string):FormDescription {
  const collection=formCollection(id);
  if(!collection||collection.templates.some(t=>!forms.some(f=>f.templateId===t)))throw new FormExportError("Combined form references are unavailable.","MAPPING_CHANGED",422);
  return {templateId:id,filename:collection.filename,version,fields:[]};
}
export const EXPORT_TEMPLATES=[...FORM_COLLECTIONS,...FORM_TEMPLATES];
