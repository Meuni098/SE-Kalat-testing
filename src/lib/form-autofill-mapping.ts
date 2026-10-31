import { createHash } from "node:crypto";
import { FormExportError,formClassification,formPurpose,type AutofillChange,type AutofillPreview,type FormDescription,type FieldReview } from "./form-templates";

export interface AutofillRow {
  assetId:string;propertyNo:string;name:string;description?:string|null;classification:string;
  cost:number;acquired:string;category:string;condition:string;unitName:string;
  accountableName?:string;accountablePosition?:string;usefulLife?:number;
  onHand?:number;remarks?:string|null;
}
export interface AutofillRecord {
  id:string;label:string;kind:"transfer"|"return"|"physical-count"|"acknowledgment"|"information";
  date:string;status:string;rows:AutofillRow[];remarks?:string|null;
  fromName?:string;fromPosition?:string;fromUnit?:string;toName?:string;toPosition?:string;toUnit?:string;
  approvedBy?:string;approvedDate?:string;summary?:string;
  eventType?:string;financialImpact?:number|null;responsibleOfficer?:string;referenceDocument?:string|null;groupKey?:string;identitySource?:"receipt-snapshot";requestedDate?:string;decisionDate?:string;
}
export function actualDescription(row:Pick<AutofillRow,"description">):string {return row.description?.trim()?row.description:"";}
export function autofillCapacity(id:string,record?:AutofillRecord){return id==="rpcppe"||id==="ptr"?20:id==="rpcsp"?15:id==="itr"?17:id==="par"?19:id==="return"?(record?.rows[0]?.classification==="SEMI_EXPENDABLE"?23:22):1;}
// The Word form's visible Purpose line is 10pt. Its apparent description row
// is a 2pt spacer, not a usable entry area. Keep each purpose line compact.
function summaryPages(text:string){
  const pages:string[]=[];let page="",width=0;
  const charWidth=(c:string)=>/[WM]/.test(c)?9:/[A-Z0-9]/.test(c)?7:/[\u0000-\u007f]/.test(c)?5:10;
  for(const c of text.replace(/\r?\n/g," · ")){
    const w=charWidth(c);
    if(page.length+c.length>70||width+w>300){
      const split=page.lastIndexOf(" ")+1;
      if(split>page.length/2){pages.push(page.slice(0,split));page=page.slice(split);width=Array.from(page).reduce((n,c)=>n+charWidth(c),0);}
      else{pages.push(page);page="";width=0;}
    }
    page+=c;width+=w;
  }
  pages.push(page);return pages;
}
function rowsFor(record:AutofillRecord){return record.kind==="physical-count"?Array.from(new Map(record.rows.map(r=>[r.assetId,r])).values()):record.rows;}
export function autofillPageCount(id:string,record:AutofillRecord){return id==="information"?summaryPages(record.summary??"").length:Math.max(1,Math.ceil(rowsFor(record).length/autofillCapacity(id,record)));}
export function sourceVersion(record:AutofillRecord){return createHash("sha256").update(JSON.stringify(record)).digest("hex");}

/** Only these extra fields bypass the manual editor's formula-input protection. */
export function isAutomaticExtra(id:string,fieldId:string){return id==="ics"&&["0:A11","0:C11","0:D11","0:A39","0:C39","0:D39","0:F26","0:F54"].includes(fieldId)||id==="return"&&fieldId==="1:D36";}

/** A deselected automatic value becomes blank, never the source form's sample value. */
export function applyAutomaticExclusions(templateId:string,plan:AutofillPreview,excluded:unknown):AutofillChange[] {
  if(!Array.isArray(excluded)||excluded.some(f=>typeof f!=="string"||!plan.changes.some(c=>c.fieldId===f)||isAutomaticExtra(templateId,f))||new Set(excluded).size!==excluded.length)throw new FormExportError("Invalid excluded automatic fields.");
  return plan.changes.map(c=>excluded.includes(c.fieldId)?{fieldId:c.fieldId,value:""}:c);
}

export function mapAutofill(form:FormDescription,record:AutofillRecord,page:number,expanded=false):AutofillPreview {
  const id=form.templateId;
  if(formPurpose(id)?.id!==record.kind)throw new FormExportError("This record does not match the document purpose.");
  const classification=formClassification(id);
  if(classification&&record.rows.some(r=>r.classification!==classification))throw new FormExportError("The record classification does not match this form.");
  const pageCount=autofillPageCount(id,record);
  if(!Number.isInteger(page)||page<1||page>pageCount)throw new FormExportError("Choose an available document page.");
  const rows=id==="information"?record.rows:rowsFor(record).slice((page-1)*autofillCapacity(id,record),page*autofillCapacity(id,record));
  if(!rows.length)throw new FormExportError("There are no matching recorded items.","NO_MATCHING_DATA",422);
  const fields=new Map(form.fields.map(f=>[f.id,f]));
  const changes=new Map<string,AutofillChange>();const warnings=new Set<string>();
  const put=(fieldId:string,value:string|number|undefined|null,numeric=false,formulaResult=false)=>{
    if(value===undefined||value===null)return;
    const field=fields.get(fieldId);
    if(!field&&!isAutomaticExtra(id,fieldId))throw new FormExportError(`The source form no longer has mapped field ${fieldId}.`,"MAPPING_CHANGED",422);
    const text=String(value);
    if(text.length>(expanded?32767:(field?.maxLength??180)))throw new FormExportError(`Recorded text exceeds the space allowed for ${field?.label??fieldId}. Review the source record before exporting.`,"VALUE_TOO_LONG",422);
    if(numeric&&!Number.isFinite(Number(value)))throw new FormExportError("Invalid recorded amount.");
    changes.set(fieldId,{fieldId,value:text,...(numeric?{numeric:true}:{}),...(formulaResult?{formulaResult:true}:{})});
  };
  const xls=(row:number,col:number,value:string|number|undefined|null,numeric=false)=>put(`0:${row}:${col}`,value,numeric);
  const xlsx=(sheet:number,cell:string,value:string|number|undefined|null,numeric=false,formula=false)=>put(`${sheet}:${cell}`,value,numeric,formula);
  const description=actualDescription;
  const a=rows[0];
  const below=a.classification==="SEMI_EXPENDABLE";
  if(id!=="information"&&record.rows.some(r=>r.classification!==a.classification))throw new FormExportError("Different classifications require separate forms.");
  // Remove sample entries in the selected form's data area, never labels or other sheets.
  for(const field of form.fields){
    const key=field.id.split(":");let inBody=false;
    if(id==="ics"){const row=Number(key[1].match(/\d+/)?.[0]);inBody=row>=11&&row<=17||row>=39&&row<=45;}
    if(id==="return"){const row=Number(key[1].match(/\d+/)?.[0]);inBody=+key[0]===(below?1:0)&&(below?row>=8&&row<=30:row>=10&&row<=31);}
    if(inBody&&field.original.trim())put(field.id,"");
  }
  if(id==="ptr"||id==="itr"){
    const ptr=id==="ptr";
    rows.forEach((r,i)=>{const row=(ptr?18:12)+i;
      xls(row,1,r.acquired);xls(row,2,r.propertyNo);xls(row,4,description(r));xls(row,ptr?8:7,r.cost,true);xls(row,ptr?9:8,r.condition);
    });
    xls(ptr?8:6,1,`From Accountable Officer/Agency/Fund Cluster: ${[record.fromName,record.fromUnit].filter(Boolean).join(" / ")}`);
    xls(ptr?9:7,1,`To Accountable Officer/Agency/Fund Cluster: ${[record.toName,record.toUnit].filter(Boolean).join(" / ")}`);
    xls(ptr?9:7,ptr?8:7,`Date: ${record.date}`);
    xls(ptr?39:29,1,`${ptr?"":"Reason/s for Transfer: "}${record.remarks??""}`);
    xls(ptr?46:35,ptr?6:5,record.fromName??"");xls(ptr?47:36,ptr?6:5,record.fromPosition??"");
    xls(ptr?46:35,ptr?8:7,record.toName??"");xls(ptr?47:36,ptr?8:7,record.toPosition??"");
    const approved=["APPROVED","COMPLETED"].includes(record.status);
    xls(ptr?46:35,2,approved?record.approvedBy??"":"");xls(ptr?47:36,2,"");xls(ptr?48:37,2,approved?record.approvedDate??"":"");
    if(!ptr)warnings.add("ICS number/date is not stored on transfer records and remains unfilled.");
    warnings.add(`Transaction status: ${record.status}. Names do not constitute signatures.`);
  }else if(id==="return"){
    const si=below?1:0;
    if(below){
      rows.forEach((r,i)=>{const row=8+i;xlsx(si,`A${row}`,description(r));xlsx(si,`B${row}`,1,true);xlsx(si,`D${row}`,record.fromName??"");xlsx(si,`E${row}`,r.remarks??record.remarks??"");});
      xlsx(si,"D4",`Date: ${record.date}`);xlsx(si,"A35",record.fromName??"");xlsx(si,"D35","");xlsx(si,"D36","");
    }else{
      rows.forEach((r,i)=>{const row=10+i;xlsx(si,`A${row}`,r.acquired);xlsx(si,`B${row}`,description(r));xlsx(si,`D${row}`,r.cost,true);xlsx(si,`E${row}`,r.condition);xlsx(si,`F${row}`,r.remarks??record.remarks??"");});
      xlsx(si,"E7",`Date: ${record.date}`);xlsx(si,"A35",record.fromName??"");xlsx(si,"D40","");xlsx(si,"D41","");
    }
    warnings.add(`Return status: ${record.status}. Receipt numbers and receiving signatures are not inferred.`);
  }else if(id==="par"){
    rows.forEach((r,i)=>{const row=9+i;xls(row,1,1,true);xls(row,3,description(r));xls(row,4,r.propertyNo);xls(row,5,r.acquired);xls(row,6,r.cost,true);});
    xls(31,1,record.toName??a.accountableName??"");xls(33,1,record.toPosition??a.accountablePosition??"");xls(35,1,record.date);
    xls(31,4,"");xls(33,4,"");xls(35,4,"");
  }else if(id==="ics"){
    for(const offset of [0,28]){
      xlsx(0,`A${11+offset}`,1,true);xlsx(0,`C${11+offset}`,a.cost,true);xlsx(0,`D${11+offset}`,a.cost,true,true);
      xlsx(0,`B${11+offset}`,"");xlsx(0,`E${11+offset}`,description(a));xlsx(0,`G${11+offset}`,a.propertyNo);xlsx(0,`H${11+offset}`,a.usefulLife??"");
      xlsx(0,`A${21+offset}`,"");xlsx(0,`A${23+offset}`,"");xlsx(0,`A${25+offset}`,"");
      xlsx(0,`F${21+offset}`,record.toName??a.accountableName??"");xlsx(0,`F${23+offset}`,record.toPosition??a.accountablePosition??"");xlsx(0,`F${25+offset}`,"");
      // Its original signature line is only 8.4pt high; preserve that line and
      // put the date beside its existing Date label in the full-height cell.
      if(record.date)xlsx(0,`F${26+offset}`,`Date: ${record.date}`);
    }
  }else if(id==="rpcppe"||id==="rpcsp"){
    const ppe=id==="rpcppe";
    rows.forEach((r,i)=>{
      const row=i+(ppe?15:14),count=r.onHand,shortage=count===undefined?undefined:1-count;
      if(ppe){
        [r.name,description(r),r.propertyNo,undefined,r.cost,1,count,shortage,shortage===undefined?undefined:shortage*r.cost,r.remarks??""].forEach((v,j)=>xls(row,j+3,v,[4,5,6,7,8].includes(j)));
      }else{
        [r.name,description(r),r.propertyNo,undefined,r.cost,1,count,shortage,shortage===undefined?undefined:shortage*r.cost,r.remarks??""].forEach((v,j)=>xlsx(0,`${String.fromCharCode(65+j)}${row}`,v,[4,5,6,7,8].includes(j)));
      }
      if(count===undefined)warnings.add("A recorded count result could not be interpreted; its count/variance fields remain blank.");
    });
    if(ppe){xls(4,3,Array.from(new Set(rows.map(r=>r.category))).join(", "));xls(6,3,`As at ${record.date}`);}
    else{xlsx(0,"C3",Array.from(new Set(rows.map(r=>r.category))).join(", "));xlsx(0,"C5",`As at ${record.date}`);}
  }else if(id==="information"){
    for(const copy of [0,3]){put(`${copy}:8:1`,summaryPages(record.summary??"")[page-1]);put(`${copy}:6:4`,a.name);}
    warnings.add("History is placed in the existing Purpose line; additional original-form copies carry long entries.");
    warnings.add("No documented-information request record exists: requestor, request date, request number and approvals require review.");
  }
  if(record.requestedDate)warnings.add(`Requested: ${record.requestedDate}. Decision: ${record.decisionDate??"Not recorded"}.`);
  if(record.kind==="physical-count")warnings.add("Counts use the latest recorded scan per asset. Unit and accountable-person grouping use current inventory, not historical ownership snapshots.");
  if(record.kind==="transfer")warnings.add("Transfer parties use recorded relationships with live person names; asset details use current inventory.");
  if(record.kind==="acknowledgment"&&!record.identitySource)warnings.add("Current accountability is not a historical receipt. No receipt date is inferred.");
  warnings.add("Missing official document numbers, fund clusters, units of measure and signatures are not invented.");
  const sourceFor=(fieldId:string):FieldReview["source"]=>{
    if(record.kind==="information")return "history";
    if(record.kind==="physical-count"){
      if(fieldId===(id==="rpcppe"?"0:6:3":"0:C5"))return "count-entry";
      const col=id==="rpcppe"?Number(fieldId.split(":")[2]):fieldId.split(":")[1]?.replace(/\d+/,"");
      return (id==="rpcppe"?[9,10,11,12].includes(Number(col)):["G","H","I","J"].includes(String(col)))?"count-entry":"current-inventory";
    }
    if(id==="ptr"||id==="itr")return (Number(fieldId.split(":")[1])>=(id==="ptr"?18:12)&&Number(fieldId.split(":")[1])<(id==="ptr"?18:12)+rows.length)?"current-inventory":"transaction";
    if(id==="return"){
      const address=fieldId.split(":")[1],row=Number(address.replace(/[^0-9]/g,""));
      const transactionBody=below?row>=8&&row<8+rows.length&&/^[DE]/.test(address):row>=10&&row<10+rows.length&&address.startsWith("F");
      return transactionBody||["D4","E7","A35"].includes(address)?"transaction":"current-inventory";
    }
    const identity=id==="par"?(["0:31:1","0:33:1","0:35:1"].includes(fieldId)||(Number(fieldId.split(":")[1])>=9&&Number(fieldId.split(":")[1])<9+rows.length&&fieldId.endsWith(":4"))):/[FG](21|23|26|49|51|54)$/.test(fieldId)||/G(11|39)$/.test(fieldId);
    return identity?(record.identitySource??"current-inventory"):"current-inventory";
  };
  // Unused body rows are not missing required fields; show active mappings and header gaps.
  const activeFields=form.fields.filter(f=>{
    const [sheet,key]=f.id.split(":");
    if(id==="return"&&Number(sheet)!==(below?1:0))return false;
    const row=Number(id==="rpcppe"||id==="ptr"||id==="itr"||id==="par"?key:key.replace(/[^0-9]/g,""));
    let body=false,active=true;
    if(id==="ics"){body=row>=11&&row<=17||row>=39&&row<=45;active=row===11||row===39;}
    if(id==="return"){body=below?row>=8&&row<=30:row>=10&&row<=31;active=row<(below?8:10)+rows.length;}
    if(id==="rpcppe"){body=row>=15&&row<=34;active=row<15+rows.length;}
    if(id==="rpcsp"){body=row>=14&&row<=28;active=row<14+rows.length;}
    if(id==="ptr"){body=row>=18&&row<=37;active=row<18+rows.length;}
    if(id==="itr"){body=row>=12&&row<=28;active=row<12+rows.length;}
    if(id==="par"){body=row>=9&&row<=27;active=row<9+rows.length;}
    return !body||active;
  });
  const reviewedIds=new Set(activeFields.map(f=>f.id));
  for(const change of changes.values())if(change.value!==""||!fields.has(change.fieldId))reviewedIds.add(change.fieldId);
  const fieldReview:FieldReview[]=Array.from(reviewedIds).map(fieldId=>{
    const change=changes.get(fieldId),filled=change!==undefined&&change.value!=="";
    return {fieldId,state:filled?"automatic":"missing",source:filled?sourceFor(fieldId):"unavailable"};
  });
  return {fieldReview,recordId:record.id,sourceVersion:sourceVersion(record),page,pageCount,rowCount:rows.length,changes:Array.from(changes.values()),warnings:Array.from(warnings)};
}
