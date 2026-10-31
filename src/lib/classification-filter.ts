import { FormExportError } from "./form-templates";

/** ALL is a query scope, never a stored asset classification. */
export function classificationWhere(value?:string|null):{classification?:"PPE"|"SEMI_EXPENDABLE"} {
  if(!value||value==="ALL")return {};
  if(value==="PPE"||value==="SEMI_EXPENDABLE")return {classification:value};
  throw new FormExportError("Choose a valid classification.","INVALID_FILTER");
}
