import { FORM_COLLECTIONS,formCollection,exportTemplateIds,exportPurpose,validateCollectionScope } from "./form-collections";
import { FORM_TEMPLATES, FormExportError, formClassification } from "./form-templates";

export const REPORT_SECTIONS = [
  {id:"inventory",name:"Inventory Reports",templates:["par","ics","rpcppe","rpcsp"],defaultPurpose:"acknowledgment"},
  {id:"category-history",name:"Category History Export",templates:["rpcppe","rpcsp","return","itr","ics","par","ptr"],defaultPurpose:"acknowledgment"},
  {id:"accountable-person",name:"Accountable Person Report",templates:["par","ics"],defaultPurpose:"acknowledgment"},
  {id:"physical-inventory",name:"Physical Inventory Reports",templates:["rpcppe","rpcsp"],defaultPurpose:"physical-count"},
  {id:"transfers",name:"Transfer Reports",templates:["ptr","itr"],defaultPurpose:"transfer"},
  {id:"requests-returns",name:"Requests & Returns",templates:["return","information"],defaultPurpose:"return"},
] as const;
export type ReportSection = typeof REPORT_SECTIONS[number]["id"];
export interface ReportScope {
  reportSection?: ReportSection;
  categoryId?: string;
  unitId?: string;
  classification?: string;
  personId?: string;
  sessionId?: string;
  status?: string;
  eventType?: string;
  eventId?: string;
}
export const HISTORY_EVENT_TYPES = ["ASSET_ACQUISITION","ITEM_RECEIPT","PROCUREMENT_INTAKE","INSPECTION_ACCEPTANCE","CUSTODIAL_TRANSFER","RETURN_SURRENDER","PHYSICAL_COUNT_VERIFICATION","MISSING_INCIDENT","DISPOSAL_CONDEMNATION","SYSTEM_AUDIT"] as const;

export function reportSection(value: unknown): ReportSection | undefined {
  if(value===undefined || value===null || value==="") return undefined;
  const section=REPORT_SECTIONS.find(s=>s.id===value);
  if(!section) throw new FormExportError("Choose a valid report section.","INVALID_FILTER");
  return section.id;
}
export function compatibleTemplates(section?: ReportSection, classification?: string) {
  const allowed=REPORT_SECTIONS.find(s=>s.id===section);
  return FORM_TEMPLATES.filter(t=>(!allowed||allowed.templates.some(id=>id===t.id)) &&
    (!classification||classification==="ALL"||!formClassification(t.id)||formClassification(t.id)===classification));
}
export function compatibleExportTemplates(section?:ReportSection,classification?:string){
  const originals=compatibleTemplates(section,classification);
  const collections=(!classification||classification==="ALL")?FORM_COLLECTIONS.filter(c=>c.templates.every(id=>originals.some(t=>t.id===id))):[];
  return [...collections,...originals];
}
export function validateReportScope(scope: ReportScope, templateId?: string, populated=false) {
  reportSection(scope.reportSection);
  if(scope.classification && !["ALL","PPE","SEMI_EXPENDABLE"].includes(scope.classification))throw new FormExportError("Choose a valid classification.","INVALID_FILTER");
  for(const key of ["personId","sessionId","status","eventType","eventId"] as const){
    if(scope[key]!==undefined&&(typeof scope[key]!=="string"||scope[key]!.length>150))throw new FormExportError("Invalid report filter.","INVALID_FILTER");
  }
  if(templateId && !formCollection(templateId) && !FORM_TEMPLATES.some(t=>t.id===templateId))throw new FormExportError("Unknown form.","NOT_FOUND",404);
  if(templateId && scope.reportSection && !exportTemplateIds(templateId).every(id=>compatibleTemplates(scope.reportSection).some(t=>t.id===id)))throw new FormExportError("This form is not compatible with the report section.","INCOMPATIBLE_TEMPLATE");
  if(templateId && scope.reportSection && !exportTemplateIds(templateId).every(id=>compatibleTemplates(scope.reportSection,scope.classification).some(t=>t.id===id)))throw new FormExportError("This form does not match the selected classification.","INCOMPATIBLE_TEMPLATE");
  if(templateId)validateCollectionScope(templateId,scope.classification);
  const purpose=templateId?exportPurpose(templateId):undefined;
  if(scope.personId && (purpose?purpose!=="acknowledgment":scope.reportSection!=="accountable-person"&&scope.reportSection!=="inventory"))throw new FormExportError("Person filters apply only to acknowledgment forms.","INVALID_FILTER");
  if(scope.sessionId && (purpose?purpose!=="physical-count":scope.reportSection!=="physical-inventory"&&scope.reportSection!=="inventory"))throw new FormExportError("Count session filters apply only to physical count forms.","INVALID_FILTER");
  if(scope.status && (purpose?!["transfer","return"].includes(purpose):!["transfers","requests-returns"].includes(scope.reportSection??"")))throw new FormExportError("Transaction status does not apply to this form.","INVALID_FILTER");
  if(scope.status && !(purpose==="return"?["PENDING","APPROVED"]:["PENDING","APPROVED","COMPLETED"]).includes(scope.status))throw new FormExportError("Choose a supported transaction status.","INVALID_FILTER");
  if(scope.eventType && (!HISTORY_EVENT_TYPES.some(t=>t===scope.eventType)||purpose&&purpose!=="information"))throw new FormExportError("Choose an applicable history event type.","INVALID_FILTER");
  if(populated && scope.reportSection==="accountable-person" && !scope.personId)throw new FormExportError("Choose an accountable person before filling the report.","PERSON_REQUIRED",422);
}

/** Route aliases preserve scope, while the selected section remains authoritative. */
export function reportHref(section: ReportSection, filters: Record<string,string|undefined> = {}) {
  const params=new URLSearchParams();
  for(const key of ["categoryId","unitId","classification","personId","sessionId","status","eventType","eventId","templateId","recordId"]){
    if(filters[key])params.set(key,filters[key]!);
  }
  params.set("reportSection",section);
  return `/reports?${params}`;
}
