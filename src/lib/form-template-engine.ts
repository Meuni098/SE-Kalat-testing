import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { FORM_TEMPLATES, FormExportError, validateFormChanges, type FormDescription, type FormField,type AutofillChange } from "./form-templates";
import { isAutomaticExtra } from "./form-autofill-mapping";
import { readBiff, patchBiff } from "./biff-template";

const S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const escape = (value: string) => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const COLUMN_LABELS: Record<string,string[]> = {
  rpcppe:["","","Article","Description","Property number","Unit of measure","Unit value","Quantity per card","Quantity per count","Shortage / overage quantity","Shortage / overage value","Remarks"],
  rpcsp:["Article","Description","Property number","Unit of measure","Unit value","Quantity per card","Quantity per count","Shortage / overage quantity","Shortage / overage value","Remarks"],
  itr:["Date acquired","Item number","ICS number / date","Description","Description","Description","Amount","Condition"],
  par:["Quantity","Unit","Description","Property number","Date acquired","Amount"],
  ptr:["Date acquired","Property number","Property number","Description","Description","Description","Description","Amount","Condition"],
  ics:["Quantity","Unit","Unit cost","Total cost","Description","Description","Inventory item number","Estimated useful life"],
};
function fieldLabel(id:string,si:number,row:number,col:number,address:string):string {
  if(!inBody(id,si,row,col)){
    const names:Record<string,Record<string,string>>={
      rpcppe:{C4:"Property category",C6:"Count date",C9:"Fund cluster",C10:"Accountability statement"},
      rpcsp:{C3:"Property category",C5:"Count date",A7:"Fund cluster",A9:"Accountability statement"},
      par:{A4:"Entity name",A5:"Fund cluster",E5:"PAR number",A31:"Received by",D31:"Issued by",A33:"Receiver designation",D33:"Issuer designation",A35:"Received date",D35:"Issued date"},
      ptr:{A6:"Entity name",G6:"Fund cluster",A8:"From officer / agency",H8:"PTR number",A9:"To officer / agency",H9:"Transaction date",A39:"Reason for transfer",A40:"Transfer reason continuation",A41:"Transfer reason continuation",B46:"Approved by",F46:"Released by",H46:"Received by",B47:"Approver designation",F47:"Sender designation",H47:"Receiver designation",B48:"Approval date",F48:"Released date",H48:"Received date"},
      itr:{A6:"From officer / agency",G6:"ITR number",A7:"To officer / agency",G7:"Transaction date",A29:"Reason for transfer",B35:"Approved by",E35:"Released by",G35:"Received by",B36:"Approver designation",E36:"Sender designation",G36:"Receiver designation",B37:"Approval date",E37:"Released date",G37:"Received date"},
      ics:{C5:"Entity name",C6:"Fund cluster",G6:"ICS number",A21:"Issued by",F21:"Received by",A23:"Issuer designation",F23:"Receiver designation",A25:"Issued date",F25:"Receiver signature date",C33:"Entity name (copy 2)",C34:"Fund cluster (copy 2)",G34:"ICS number (copy 2)",A49:"Issued by (copy 2)",F49:"Received by (copy 2)",A51:"Issuer designation (copy 2)",F51:"Receiver designation (copy 2)",A53:"Issued date (copy 2)",F53:"Receiver signature date (copy 2)"},
      return:{E7:"Request date",D4:"Request date",D5:"Request number",A35:"Requested by",D35:"Receiving official",D40:"Receiving official",D41:"Receiver designation",A37:"Requestor designation",D37:"Receiver designation"},
    };
    return `${address} — ${names[id]?.[address]??"Additional information"}`;
  }
  const columns=id==="return"?(si===0?["Date acquired","Description","Description","Amount","Condition","Remarks"]:["Item description","Quantity","ICS number","End user","Remarks"]):COLUMN_LABELS[id];
  return `${address} — ${columns?.[col-1]??"Value"}`;
}
function letters(col: number): string { let s = ""; for (;col;col = Math.floor((col-1)/26)) s=String.fromCharCode(65+(col-1)%26)+s; return s; }
function inBody(id: string, sheet: number, row: number, col: number): boolean {
  switch (id) {
    case "rpcppe": return row>=15 && row<=34 && col>=3 && col<=12;
    case "rpcsp": return row>=14 && row<=28 && col<=10;
    case "return": return sheet===0 ? row>=10 && row<=31 && col<=6 : row>=8 && row<=30 && col<=5;
    case "itr": return row>=12 && row<=28 && col<=8;
    case "par": return row>=9 && row<=27 && col<=6;
    case "ptr": return row>=18 && row<=37 && col<=9;
    case "ics": return ((row>=11 && row<=17) || (row>=39 && row<=45)) && col<=8;
    default: return false;
  }
}
const HEADERS: Record<string, string[]> = {
  rpcppe: ["C4","C6","C9","C10"], rpcsp: ["C3","C5","A7","A9"],
  return: ["E7","A35","D35","D40","D41"],
  itr: ["A6","A7","G6","G7","A29","B35","E35","G35","B36","E36","G36","B37","E37","G37"],
  par: ["A4","A5","E5","A31","D31","A33","D33","A35","D35"],
  ptr: ["A6","G6","A8","H8","A9","H9","A39","A40","A41","B46","F46","H46","B47","F47","H47","B48","F48","H48"],
  ics: ["C5","C6","G6","A21","F21","A23","F23","A25","F25","C33","C34","G34","A49","F49","A51","F51","A53","F53"],
};
const RETURN_BELOW_HEADERS=["D4","D5","A35","D35","A37","D37"];
const DOC_FIELDS: [number,number,string][] = [
  [0,1,"Requestor"],[0,3,"Date"],[0,6,"RDR number"],[2,1,"College / Office"],[2,3,"Number of copies"],
  [6,1,"Documented information number"],[6,4,"Title"],
  [8,1,"Purpose"],[12,0,"Requested by"],[12,2,"Approved by"],[14,1,"Requestor designation"],[14,3,"Requestor date"],[14,5,"Approver designation"],
];
export async function loadFormTemplate(id: string) {
  const template = FORM_TEMPLATES.find(t => t.id===id);
  if (!template) throw new FormExportError("Unknown form.", "NOT_FOUND", 404);
  const source = await readFile(path.join(process.cwd(),"resources","export-templates",template.filename));
  const version = createHash("sha256").update(source).update("mapping-v10-compact-description-only").digest("hex");
  const fields: FormField[] = [];
  if (template.filename.endsWith(".xls")) {
    const { sheets } = readBiff(source);
    sheets.forEach((sheet,si) => {
      for (const cell of sheet.cells.values()) {
        const address = `${letters(cell.col)}${cell.row}`;
        const covered = sheet.merges.some(([r1,r2,c1,c2]) => cell.row>=r1 && cell.row<=r2 && cell.col>=c1 && cell.col<=c2 && (cell.row!==r1 || cell.col!==c1));
        if (covered || cell.formula || !(inBody(id,si,cell.row,cell.col) || HEADERS[id]?.includes(address))) continue;
        fields.push({ id: `${si}:${cell.row}:${cell.col}`, section: sheet.name, label: fieldLabel(id,si,cell.row,cell.col,address), original: cell.text, maxLength: 180 });
      }
    });
  } else {
    const zip = await JSZip.loadAsync(source);
    if (template.filename.endsWith(".xlsx")) {
      const workbook = parse(await zip.file("xl/workbook.xml")!.async("string"));
      const sheets = Array.from(workbook.getElementsByTagNameNS(S,"sheet"));
      const stringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
      const strings = stringsXml ? Array.from(parse(stringsXml).getElementsByTagNameNS(S,"si")).map(si=>Array.from(si.getElementsByTagNameNS(S,"t")).map(t=>t.textContent??"").join("")) : [];
      for (let si=0;si<sheets.length;si++) {
        const xml = await zip.file(`xl/worksheets/sheet${si+1}.xml`)!.async("string");
        const doc = parse(xml);
        const merges = Array.from(doc.getElementsByTagNameNS(S,"mergeCell")).map(m=>m.getAttribute("ref")!);
        const cells = Array.from(doc.getElementsByTagNameNS(S,"c"));
        const protectedInputs = new Set<string>();
        for (const formula of Array.from(doc.getElementsByTagNameNS(S,"f"))) for (const ref of (formula.textContent??"").matchAll(/\$?([A-Z]+)\$?(\d+)/g)) protectedInputs.add(`${ref[1]}${ref[2]}`);
        for (const cell of cells) {
          const address = cell.getAttribute("r")!, [,lettersPart,rowText] = /^([A-Z]+)(\d+)$/.exec(address)!;
          const row = Number(rowText), col = Array.from(lettersPart).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
          const covered = merges.some(merge => {
            const [start,end] = merge.split(":"); if (!end) return false;
            const a=/^([A-Z]+)(\d+)$/.exec(start)!, b=/^([A-Z]+)(\d+)$/.exec(end)!;
            const column=(s:string)=>Array.from(s).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
            return row>=+a[2] && row<=+b[2] && col>=column(a[1]) && col<=column(b[1]) && address!==start;
          });
          const headerAllowed=id==="return"&&si===1?RETURN_BELOW_HEADERS.includes(address):si===0&&HEADERS[id]?.includes(address);
          if (covered || protectedInputs.has(address) || cell.getElementsByTagNameNS(S,"f").length || !(inBody(id,si,row,col) || headerAllowed)) continue;
          const raw = cell.getElementsByTagNameNS(S,"v")[0]?.textContent??"";
          const original = cell.getAttribute("t")==="s" ? strings[Number(raw)]??"" : cell.getAttribute("t")==="inlineStr" ? cell.textContent??"" : raw;
          fields.push({ id: `${si}:${address}`, section: sheets[si].getAttribute("name")!, label: fieldLabel(id,si,row,col,address), original, maxLength: 180 });
        }
      }
    } else {
      const doc = parse(await zip.file("word/document.xml")!.async("string"));
      const tables = Array.from(doc.getElementsByTagNameNS(W,"tbl"));
      for (const ti of [0,3]) {
        const rows = Array.from(tables[ti].getElementsByTagNameNS(W,"tr"));
        for (const [ri,ci,label] of DOC_FIELDS) {
          const cell = rows[ri].getElementsByTagNameNS(W,"tc")[ci];
          if (!cell || cell.getElementsByTagNameNS(W,"fldChar").length || cell.getElementsByTagNameNS(W,"drawing").length) continue;
          fields.push({ id: `${ti}:${ri}:${ci}`, section: `Copy ${ti===0?1:2}`, label, original: Array.from(cell.getElementsByTagNameNS(W,"t")).map(t=>t.textContent??"").join(""), maxLength: ri===5 ? 500 : 100 });
        }
      }
    }
  }
  // A35 is a reserved signature entry above its printed label, omitted from source XML.
  if(id==="return"&&!fields.some(f=>f.id==="0:A35"))fields.push({id:"0:A35",section:"Above 50k",label:"A35 — Requested by",original:"",maxLength:180});
  const sortKey=(f:FormField)=>f.id.replace(/:([A-Z]+)(\d+)$/,":$2:$1");
  fields.sort((a,b)=>a.section.localeCompare(b.section)||sortKey(a).localeCompare(sortKey(b),undefined,{numeric:true}));
  const description: FormDescription = { templateId:id, version, filename:template.filename, fields };
  return { source, description };
}

/** Patches only selected XML fragments; all other ZIP parts retain their original content. */
export async function generateFormExport(id: string, version: string, rawChanges: unknown, automaticChanges:AutofillChange[] = [], expandedHistory=false) {
  const { source, description } = await loadFormTemplate(id);
  if (version !== description.version) throw new FormExportError("The reference changed. Reload the form before applying changes.", "VERSION_MISMATCH", 409);
  const manual = validateFormChanges(description,rawChanges);
  const allowed=new Map(description.fields.map(f=>[f.id,f]));
  for(const c of automaticChanges){
    if(!allowed.has(c.fieldId)&&!isAutomaticExtra(id,c.fieldId))throw new FormExportError("Automatic field mapping is unavailable.","MAPPING_CHANGED",422);
    if(c.value.length>(expandedHistory&&id==="information"?4000000:allowed.get(c.fieldId)?.maxLength??180)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/.test(c.value))throw new FormExportError("Recorded text cannot fit this field.","VALUE_TOO_LONG",422);
    if(c.numeric&&!Number.isFinite(Number(c.value)))throw new FormExportError("Invalid recorded numeric value.");
  }
  const merged=new Map<string,AutofillChange>(automaticChanges.map(c=>[c.fieldId,c]));
  for(const c of manual)merged.set(c.fieldId,c);
  const changes=Array.from(merged.values());
  if (!changes.length) return { data:source, description };
  if (description.filename.endsWith(".xls")) return { data:patchBiff(source,new Map(changes.map(c=>[c.fieldId,c.value])),new Set(changes.filter(c=>c.numeric).map(c=>c.fieldId))), description };
  const zip = await JSZip.loadAsync(source);
  if (description.filename.endsWith(".xlsx")) {
    for (const si of new Set(changes.map(c=>+c.fieldId.split(":")[0]))) {
      const part = `xl/worksheets/sheet${si+1}.xml`;
      let xml = await zip.file(part)!.async("string");
      for (const change of changes.filter(c=>+c.fieldId.split(":")[0]===si)) {
        const address = change.fieldId.split(":")[1];
        const pattern = new RegExp(`<c\\b(?=[^>]*\\br="${address}")([^>]*?)(?:\\s*/>|>([\\s\\S]*?)</c>)`);
        if(!pattern.test(xml)&&id==="return"&&si===0&&address==="A35"){
          const row=/<row\b(?=[^>]*\br="35")[^>]*>/;
          if(!row.test(xml))throw new FormExportError("The return signature row is unavailable.","MAPPING_CHANGED",422);
          xml=xml.replace(row,match=>`${match}<c r="A35"/>`);
        }
        if (!pattern.test(xml)) throw new FormExportError("Selected cell is no longer available.", "VERSION_MISMATCH",409);
        xml = xml.replace(pattern,(_all,attrs:string,contents:string)=>{
          const attributes=attrs.replace(/\s+t="[^"]*"/g,"");
          if(change.formulaResult){
            if(!/<f\b/.test(contents??""))throw new FormExportError("Expected formula is missing.","MAPPING_CHANGED",422);
            const next=/<v\b[^>]*>[\s\S]*?<\/v>/.test(contents)?contents.replace(/<v\b[^>]*>[\s\S]*?<\/v>/,`<v>${change.value}</v>`):`${contents}<v>${change.value}</v>`;
            return `<c${attributes}>${next}</c>`;
          }
          if(change.numeric)return `<c${attributes}><v>${change.value}</v></c>`;
          return `<c${attributes} t="inlineStr"><is><t xml:space="preserve">${escape(change.value)}</t></is></c>`;
        });
      }
      zip.file(part,xml,{createFolders:false});
    }
  } else {
    let xml = await zip.file("word/document.xml")!.async("string");
    const selected = new Map(changes.map(c=>[c.fieldId,c.value]));
    let ti=-1;
    xml = xml.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g,table=>{
      ti++; let ri=-1;
      return table.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g,row=>{
        ri++; let ci=-1;
        return row.replace(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g,cell=>{
          ci++; const value=selected.get(`${ti}:${ri}:${ci}`); if (value===undefined) return cell;
          // Approved cells contain no drawings, fields, or existing text. Keep paragraph/run formatting.
          let inserted=false;
          return cell.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g,p=>{
            if (inserted) return p; inserted=true;
            const runProps=p.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/)?.[0]??"";
            const text=value.split("\n").map(line=>`<w:t xml:space="preserve">${escape(line)}</w:t>`).join("<w:br/>");
            return p.replace("</w:p>",`<w:r>${runProps}${text}</w:r></w:p>`);
          });
        });
      });
    });
    zip.file("word/document.xml",xml,{createFolders:false});
  }
  return { data: await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"}), description };
}
