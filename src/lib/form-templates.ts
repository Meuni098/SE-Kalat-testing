/** Public metadata only. Original files are served through the authenticated API. */
export const FORM_TEMPLATES = [
  { id: "rpcppe", name: "Physical Count of PPE (RPCPPE)", filename: "Appendix-73-RPCPPE.xls" },
  { id: "rpcsp", name: "Physical Count of Semi-Expendable Property (RPCSP)", filename: "REPORT ON THE PHYSICAL COUNT OF SEMI-EXPENDABLE PROPERTY (RPCSP).xlsx" },
  { id: "return", name: "PPE Return Request / Semi-expendable Return Receipt", filename: "Request for Return (Above 50k & Below 50K).xlsx" },
  { id: "information", name: "Request for Documented Information", filename: "Request for Documented Information.docx" },
  { id: "itr", name: "Inventory Transfer Report — Below P50K", filename: "ITR for Below P50K.xls" },
  { id: "ics", name: "Inventory Custodian Slip (ICS)", filename: "ICS.xlsx" },
  { id: "par", name: "Property Acknowledgment Receipt — Above P50K", filename: "PAR for Above P50K.xls" },
  { id: "ptr", name: "Property Transfer Report — Above P50K", filename: "PTR for Above P50K.xls" },
] as const;

export const FORM_PURPOSES = [
  {id:"physical-count",name:"Physical inventory count",templates:["rpcppe","rpcsp"]},
  {id:"transfer",name:"Transferring property",templates:["ptr","itr"]},
  {id:"return",name:"Returning property",templates:["return"]},
  {id:"acknowledgment",name:"Property acknowledgment / custody",templates:["par","ics"]},
  {id:"information",name:"Document Requests — request document copies",templates:["information"]},
] as const;
export function formPurpose(templateId:string){return FORM_PURPOSES.find(p=>p.templates.some(id=>id===templateId))!;}
export function formClassification(templateId:string):"PPE"|"SEMI_EXPENDABLE"|undefined {
  return ["rpcppe","ptr","par"].includes(templateId)?"PPE":["rpcsp","itr","ics"].includes(templateId)?"SEMI_EXPENDABLE":undefined;
}

export interface AutofillOption {id:string;label:string;rowCount:number;pageCount:number}
export interface AutofillChange extends FormChange {numeric?:boolean;formulaResult?:boolean}
export interface AutofillPreview {
  recordId:string;sourceVersion:string;page:number;pageCount:number;rowCount:number;
  form?:FormDescription;referenceVersion?:string;variants?:{templateId:string;filename:string;recordCount:number;rowCount:number;pageCount:number}[];
  selection?:"all";recordCount?:number;totalRowCount?:number;groupCount?:number;groupLabel?:string;
  changes:AutofillChange[];warnings:string[];fieldReview?:FieldReview[];
}

export interface FieldReview {
  fieldId:string;
  state:"automatic"|"missing"|"manual";
  source:"current-inventory"|"receipt-snapshot"|"transaction"|"count-entry"|"history"|"manual"|"unavailable";
}
export interface FormField {
  id: string;
  section: string;
  label: string;
  original: string;
  maxLength: number;
}
export interface FormDescription {
  templateId: string;
  version: string;
  filename: string;
  fields: FormField[];
}
export interface FormChange { fieldId: string; value: string }

export const HISTORY_COLUMNS = [
  "date", "timestamp", "propertyNo", "assetName", "eventType", "status", "responsibleOfficer",
  "fromEntity", "toEntity", "remarks", "referenceDocument", "financialImpact",
] as const;
export type HistoryColumn = typeof HISTORY_COLUMNS[number];
export interface FormHistoryEvent {
  classification?:string;categoryName?:string;unitName?:string;
  source?: {templateIds:string[];recordId:string};
  eventId: string;
  date: string;
  timestamp: string;
  propertyNo: string;
  assetName: string;
  eventType: string;
  status: string;
  responsibleOfficer: string;
  fromEntity: string | null;
  toEntity: string | null;
  remarks: string | null;
  referenceDocument: string | null;
  financialImpact: number | null;
}

export class FormExportError extends Error {
  constructor(message: string, public code = "INVALID_CHANGE", public status = 400) { super(message); }
}

export function validateFormChanges(description: FormDescription, value: unknown): FormChange[] {
  if (!Array.isArray(value) || value.length > description.fields.length) throw new FormExportError("Invalid selected fields.");
  const allowed = new Map(description.fields.map(field => [field.id, field]));
  const seen = new Set<string>();
  return value.map(change => {
    if (!change || typeof change !== "object" || typeof change.fieldId !== "string" || typeof change.value !== "string") throw new FormExportError("Each change needs a field and text value.");
    const field = allowed.get(change.fieldId);
    if (!field || seen.has(field.id)) throw new FormExportError("Unknown or duplicate field.");
    if (change.value.length > field.maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/.test(change.value)) throw new FormExportError(`Invalid value for ${field.label}; maximum ${field.maxLength} characters.`);
    seen.add(field.id);
    return { fieldId: field.id, value: change.value };
  });
}

/** No implicit ALL fallback for malformed or unauthorized scopes. */
export function formUnitScope(user: { role: string; unitId?: string | null }, requested?: string): string | undefined {
  if (user.role === "CUSTODIAN") {
    if (!user.unitId) throw new FormExportError("No operating unit is assigned to your account.", "FORBIDDEN", 403);
    return user.unitId;
  }
  if (!["ADMIN", "STAFF", "AUDITOR"].includes(user.role)) throw new FormExportError("Access denied.", "FORBIDDEN", 403);
  return requested && requested !== "ALL" ? requested : undefined;
}
