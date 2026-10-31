import ExcelJS from "exceljs";
import { createReportLayout,templateItemRegions,type ItemRegion as Region } from "./report-layout";
import { preserveTemplateParts,type TemplateSheetParts } from "./report-template-parts";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { FORM_TEMPLATES,FormExportError,type FormChange } from "./form-templates";
import { autofillGroupKey,buildAutofillBatch } from "./form-autofill-batch";
import { actualDescription,autofillCapacity,mapAutofill,type AutofillRecord,type AutofillRow } from "./form-autofill-mapping";
import { generateFormExport,loadFormTemplate } from "./form-template-engine";
import { validateFormChanges } from "./form-templates";

export interface WorkbookSource {templateId:string;records:AutofillRecord[]}
interface WorkbookOptions {
  correction?:{templateId:string;recordId:string;page:number;changes:FormChange[]};
}
const mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const legacyIds=new Set(["par","ptr","itr","rpcppe"]);
const digest=(data:Buffer)=>createHash("sha256").update(data).digest("hex");
function safeText(value:unknown):string {
  const text=value==null?"":String(value);
  if(text.length>32767||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/.test(text))throw new FormExportError("A recorded value exceeds Excel's cell limit or contains unsupported text.","INVALID_WORKBOOK_VALUE",422);
  return text;
}
async function templateBytes(id:string){
  const template=FORM_TEMPLATES.find(t=>t.id===id);
  if(!template||id==="information")throw new FormExportError("Choose a supported Excel reference.");
  let bytes:Buffer;
  if(legacyIds.has(id)){
    const root=path.join(process.cwd(),"resources","workbook-templates");
    const manifest:Record<string,{sourceHash:string;workbookHash:string}>=JSON.parse(await readFile(path.join(root,"manifest.json"),"utf8"));
    bytes=await readFile(path.join(root,`${id}.xlsx`));
    const original=await readFile(path.join(process.cwd(),"resources","export-templates",template.filename));
    if(manifest[id]?.sourceHash!==digest(original)||manifest[id]?.workbookHash!==digest(bytes))throw new FormExportError("The Excel working reference no longer matches the supplied original.","MAPPING_CHANGED",422);
  }else bytes=await readFile(path.join(process.cwd(),"resources","export-templates",template.filename));
  return bytes;
}
async function templateWorkbook(id:string){
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(new Uint8Array(await templateBytes(id)).buffer);return workbook;
}
function copyCell(source:ExcelJS.Cell,target:ExcelJS.Cell,map:(formula:string)=>string,clear=false){
  target.style=structuredClone(source.style);
  if(clear||source.type===ExcelJS.ValueType.Merge){target.value=null;return;}
  if(source.type===ExcelJS.ValueType.Formula){
    target.value={formula:map(source.formula),result:source.result};
  }else target.value=structuredClone(source.value);
}
function appendBlock(source:ExcelJS.Worksheet,target:ExcelJS.Worksheet,body:Region[],count:number,offset:number){
  const layout=createReportLayout(body,count,offset),map=layout.requiredRow,merges=source.model.merges??[];
  let meaningfulEnd=1;
  source.eachRow(row=>row.eachCell(cell=>{if(cell.type!==ExcelJS.ValueType.Merge&&cell.value!==null&&(cell.type===ExcelJS.ValueType.Formula||cell.text.trim()))meaningfulEnd=Math.max(meaningfulEnd,row.number);}));
  const printedEnd=Number(source.pageSetup.printArea?.match(/(\d+)$/)?.[1]??0);
  const copyEnd=body.length&&printedEnd?Math.max(printedEnd,meaningfulEnd):source.rowCount;
  if(map(source.rowCount)>1048576)throw new FormExportError("Narrow the selection: the reference sections exceed Excel worksheet capacity.","SCOPE_TOO_LARGE",422);
  source.eachRow({includeEmpty:true},row=>{
    if(row.number>copyEnd||body.some(region=>row.number>=region.start&&row.number<=region.end))return;
    const next=target.getRow(map(row.number));if(row.height)next.height=row.height;next.hidden=row.hidden;
    if(body.some(region=>row.number===region.end+1)&&!row.values?.toString().trim())next.height=Math.min(next.height??15,15);
    row.eachCell({includeEmpty:true},cell=>copyCell(cell,next.getCell(Number(cell.col)),layout.formula));
  });
  for(const region of layout.regions){
    for(let i=0;i<count;i++){
      const original=source.getRow(region.start+Math.min(i,region.end-region.start)),next=target.getRow(region.outputStart+i);
      next.height=original.height??source.properties.defaultRowHeight??15;next.hidden=original.hidden;
      original.eachCell({includeEmpty:true},cell=>copyCell(cell,next.getCell(Number(cell.col)),layout.formula,true));
    }
  }
  const decode=(address:string)=>{const match=/^([A-Z]+)(\d+)$/.exec(address.replace(/\$/g,""))!;return {row:Number(match[2]),col:Array.from(match[1]).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)};};
  for(const range of merges){
    const cells=range.split(":"),first=decode(cells[0]),last=decode(cells[1]??cells[0]);
    const region=layout.regions.find(region=>first.row>=region.start&&last.row<=region.end);
    if(region){
      if(first.row===region.start&&last.row===region.start)for(let i=0;i<count;i++)target.mergeCells(region.outputStart+i,first.col,region.outputStart+i,last.col);
      else if(first.row!==last.row&&layout.retainedRow(first.row)!==undefined&&layout.retainedRow(last.row)!==undefined)target.mergeCells(map(first.row),first.col,map(last.row),last.col);
    }else if(!body.some(region=>first.row<=region.end&&last.row>=region.start))target.mergeCells(map(first.row),first.col,map(last.row),last.col);
  }
  // Preserve the closing edge after removing the source table's final empty rows.
  for(const region of layout.regions)for(let col=1;col<=source.columnCount;col++){
    const bottom=source.getCell(region.end,col).border?.bottom;
    if(bottom?.style){const cell=target.getCell(region.outputEnd,col);cell.border={...structuredClone(cell.border),bottom:structuredClone(bottom)};}
  }
  for(const image of source.getImages()){
    const id=target.workbook.addImage(source.workbook.getImage(Number(image.imageId)));
    const move=(anchor:ExcelJS.Anchor)=>({col:anchor.col,row:layout.referenceRow(Math.floor(anchor.row)+1)-1+(anchor.row%1)}) as ExcelJS.Anchor;
    target.addImage(id,{tl:move(image.range.tl),br:move(image.range.br),editAs:"oneCell"});
  }
  for(const br of source.model.rowBreaks??[]){const row=layout.retainedRow(br.id);if(row!==undefined&&br.id<=copyEnd)target.getRow(row).addPageBreak(br.min,br.max);}
  return {map,layout,end:map(Math.max(meaningfulEnd,printedEnd))};
}

function referenceSheet(workbook:ExcelJS.Workbook,source:ExcelJS.Worksheet,name:string){
  const target=workbook.getWorksheet(name)??workbook.addWorksheet(name,{properties:structuredClone(source.properties),pageSetup:structuredClone(source.pageSetup)});
  source.columns.forEach((column,i)=>{const next=target.getColumn(i+1);next.width=column.width;next.hidden=!!column.hidden;next.style=structuredClone(column.style??{});});
  target.views=structuredClone(source.views);target.headerFooter=structuredClone(source.headerFooter);
  return target;
}
function cellAddress(id:string){
  const parts=id.split(":");return {sheet:Number(parts[0]),row:parts.length===3?Number(parts[1]):Number(parts[1].replace(/[^0-9]/g,"")),col:parts.length===3?Number(parts[2]):Array.from(parts[1].replace(/[0-9]/g,"")).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)};
}
function setValue(sheet:ExcelJS.Worksheet,row:number,col:number,value:unknown,numeric=false){
  const cell=sheet.getCell(row,col);
  if(numeric){if(typeof value!=="number"||!Number.isFinite(value))throw new FormExportError("A report contains an invalid recorded number.","INVALID_WORKBOOK_VALUE",422);cell.value=value;}
  else cell.value=safeText(value);

}
function populateRows(id:string,sheetIndex:number,sheet:ExcelJS.Worksheet,record:AutofillRecord,map:(row:number)=>number){
  const describe=actualDescription;
  for(let i=0;i<record.rows.length;i++){
    const item=record.rows[i],put=(row:number,col:number,value:unknown,numeric=false)=>setValue(sheet,map(row)+i,col,value,numeric);
    if(id==="par"){put(9,1,1,true);put(9,3,describe(item));put(9,4,item.propertyNo);put(9,5,item.acquired);put(9,6,item.cost,true);}
    if(id==="ptr"||id==="itr"){const row=id==="ptr"?18:12;put(row,1,item.acquired);put(row,2,item.propertyNo);put(row,4,describe(item));put(row,id==="ptr"?8:7,item.cost,true);put(row,id==="ptr"?9:8,item.condition);}
    if(id==="return"){
      if(sheetIndex===0){put(10,1,item.acquired);put(10,2,describe(item));put(10,4,item.cost,true);put(10,5,item.condition);put(10,6,item.remarks??record.remarks);}
      else{put(8,1,describe(item));put(8,2,1,true);put(8,4,record.fromName);put(8,5,item.remarks??record.remarks);}
    }
    if(id==="ics")for(const start of [11,39]){
      put(start,1,1,true);put(start,3,item.cost,true);put(start,5,describe(item));put(start,7,item.propertyNo);put(start,8,item.usefulLife??"");
      const row=map(start)+i;sheet.getCell(row,4).value={formula:`A${row}*C${row}`,result:item.cost};
    }
    if(id==="rpcppe"||id==="rpcsp"){
      const start=id==="rpcppe"?15:14,col=id==="rpcppe"?3:1;
      const values=[item.name,describe(item),item.propertyNo,"",item.cost,1,item.onHand,item.onHand===undefined?undefined:1-item.onHand,item.onHand===undefined?undefined:(1-item.onHand)*item.cost,item.remarks??""];
      values.forEach((value,j)=>{if(value!==undefined)put(start,col+j,value,typeof value==="number");});
    }
  }
}
interface ReportItem {record:AutofillRecord;item:AutofillRow}
const headerKeys=["date","status","fromName","fromPosition","fromUnit","toName","toPosition","toUnit","approvedBy","approvedDate","identitySource","requestedDate","decisionDate","remarks"] as const;
/** Header fields describe the entire table only when every record agrees. */
function continuousHeader(records:AutofillRecord[],rows:AutofillRow[]):AutofillRecord {
  const header={...records[0],rows};
  for(const key of headerKeys){if(records.some(record=>(record[key]??"")!==(records[0][key]??"")))Object.assign(header,{[key]:""});}
  return header;
}
/** Keep the template's fonts/borders/columns; let multiline recorded details remain visible. */
function fitMultilineRows(sheet:ExcelJS.Worksheet,body:Region[],count:number,map:(row:number)=>number){
  for(const region of body)for(let i=0;i<count;i++){
    const row=sheet.getRow(map(region.start)+i);
    row.eachCell(cell=>{
      if(cell.type===ExcelJS.ValueType.Merge||!cell.text)return;
      let width=sheet.getColumn(Number(cell.col)).width??10;
      for(let col=Number(cell.col)+1;col<=sheet.columnCount;col++){
        const next=row.getCell(col);if(next.type!==ExcelJS.ValueType.Merge||next.master.address!==cell.address)break;
        width+=sheet.getColumn(col).width??10;
      }
      const lines=cell.text.split("\n").reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/Math.max(1,width-2))),0);
      if(lines===1&&!cell.text.includes("\n"))return;
      cell.alignment={...cell.alignment,wrapText:true};
      row.height=Math.min(409,Math.max(row.height??15,lines*(cell.font?.size??11)*1.4+4));
    });
  }
}

/** Populate the supplied Word form in-place; keep all other package parts unchanged. */
async function createHistoryDocument(records:AutofillRecord[],rowCount:number){
  const {description}=await loadFormTemplate("information");
  const plan=mapAutofill(description,records[0],1,true);
  const summary=records.map(record=>record.summary??record.remarks??record.label).join("\n\n");
  const subjects=Array.from(new Set(records.flatMap(record=>record.rows.map(row=>row.name)))).join(", ");
  const changes=plan.changes.map(change=>({...change,value:change.fieldId.endsWith(":8:1")?summary:change.fieldId.endsWith(":6:4")?subjects:change.value}));
  const output=await generateFormExport("information",description.version,[],changes,true);
  return {data:output.data,mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",filename:description.filename,rowCount,sheetCount:0};
}

/** One XLSX per selection. Rows grow within reference-derived sheets; no nested files or sheet per product. */
export async function createReportWorkbook(sources:WorkbookSource[],options:WorkbookOptions={}){
  if(!sources.some(s=>s.records.length))throw new FormExportError("No matching report records are available.","NO_MATCHING_DATA",422);
  if(options.correction?.templateId==="information"&&options.correction.changes.length)throw new FormExportError("History exports use recorded data. Correct the source record before exporting.");
  const rowCount=sources.reduce((sum,source)=>sum+source.records.reduce((total,record)=>total+record.rows.length,0),0);
  if(rowCount>100000)throw new FormExportError("Narrow the report to at most 100,000 transaction rows.","SCOPE_TOO_LARGE",422);
  const history=sources.filter(source=>source.templateId==="information").flatMap(source=>source.records);
  if(history.length){
    if(sources.some(source=>source.templateId!=="information"&&source.records.length))throw new FormExportError("Choose one document purpose for the export.");
    return createHistoryDocument(history,rowCount);
  }
  const workbook=new ExcelJS.Workbook();workbook.calcProperties.fullCalcOnLoad=true;
  const parts:TemplateSheetParts[]=[];
  for(const source of sources){
    if(source.templateId==="information"||!source.records.length)continue;
    const native=await templateWorkbook(source.templateId),{description}=await loadFormTemplate(source.templateId),batch=buildAutofillBatch(source.templateId,source.records);
    // Partition only by the supplied worksheet, never by recipient, date, status or transaction.
    const partitions=new Map<number,ReportItem[]>();
    for(const record of source.records)for(const item of record.rows){
      const si=source.templateId==="return"&&item.classification==="SEMI_EXPENDABLE"?1:0;
      const items=partitions.get(si)??[];items.push({record,item});partitions.set(si,items);
    }
    for(const [si,items] of partitions){
      const original=native.worksheets[si],target=referenceSheet(workbook,original,original.name),body=templateItemRegions(source.templateId,si);
      const {map,layout,end}=appendBlock(original,target,body,items.length,0);
      parts.push({source:await templateBytes(source.templateId),sourceSheet:si+1,targetSheet:target.id,maps:[row=>layout.referenceRow(row)]});
      const records=Array.from(new Set(items.map(entry=>entry.record))),rows=items.map(entry=>({...entry.item,remarks:entry.item.remarks??entry.record.remarks})),header=continuousHeader(records,rows);
      const first={...rows[0],accountableName:header.toName??"",accountablePosition:header.toPosition??""};
      const plan=mapAutofill(description,{...header,rows:[first]},1,true);
      for(const change of plan.changes){const address=cellAddress(change.fieldId);if(address.sheet!==si||body.some(r=>address.row>=r.start&&address.row<=r.end))continue;setValue(target,map(address.row),address.col,change.numeric?Number(change.value):change.value,change.numeric);}
      if(source.templateId==="rpcppe"||source.templateId==="rpcsp")setValue(target,map(source.templateId==="rpcppe"?4:3),3,Array.from(new Set(rows.map(row=>row.category))).join(", "));
      // Each original record supplies its own row-specific fields, even when headers differ.
      for(let i=0;i<items.length;i++)populateRows(source.templateId,si,target,{...items[i].record,rows:[rows[i]]},row=>map(row)+i);
      const correction=options.correction;
      if(correction?.templateId===source.templateId){
        const group=batch.groups.find(group=>group.id===correction.recordId);
        if(group){
          const key=autofillGroupKey(source.templateId,group),targets=items.flatMap((entry,index)=>autofillGroupKey(source.templateId,entry.record)===key?[index]:[]);
          for(const change of validateFormChanges(description,correction.changes)){
            const address=cellAddress(change.fieldId);if(address.sheet!==si)continue;
            const region=body.find(region=>address.row>=region.start&&address.row<=region.end);
            const index=region?targets[address.row-region.start+(correction.page-1)*autofillCapacity(source.templateId,group)]:undefined;
            if(region&&index===undefined)throw new FormExportError("This correction has no selected item in the available rows.");
            setValue(target,region?map(region.start)+index!:map(address.row),address.col,change.value);
          }
        }
      }
      fitMultilineRows(target,body,items.length,map);
      const lastColumn=original.pageSetup.printArea?.split(":").pop()?.match(/[A-Z]+/)?.[0]??target.getColumn(source.templateId==="rpcppe"?12:source.templateId==="ptr"?9:source.templateId==="ics"||source.templateId==="itr"?8:source.templateId==="rpcsp"?10:6).letter;
      target.pageSetup.printArea=`A1:${lastColumn}${end}`;
    }
  }

  return {data:await preserveTemplateParts(Buffer.from(await workbook.xlsx.writeBuffer()),parts),mime,filename:"category-report.xlsx",rowCount,sheetCount:workbook.worksheets.length};
}

export async function createReferenceWorkbook(ids:readonly string[]){
  const workbook=new ExcelJS.Workbook(),parts:TemplateSheetParts[]=[];
  for(const id of ids){
    const bytes=await templateBytes(id),source=await templateWorkbook(id);
    for(let i=0;i<source.worksheets.length;i++){
      const original=source.worksheets[i],target=referenceSheet(workbook,original,original.name);
      appendBlock(original,target,[],0,0);
      parts.push({source:bytes,sourceSheet:i+1,targetSheet:target.id,maps:[row=>row]});
    }
  }
  return {data:await preserveTemplateParts(Buffer.from(await workbook.xlsx.writeBuffer()),parts),mime,filename:"reference-templates.xlsx"};
}
