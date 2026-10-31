import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { createReportWorkbook,createReferenceWorkbook } from "../src/lib/report-workbook";
import { renderDocumentPreview } from "../src/lib/document-preview";
import type { AutofillRecord } from "../src/lib/form-autofill-mapping";
import { createReportLayout } from "../src/lib/report-layout";
import { preserveTemplateParts } from "../src/lib/report-template-parts";

function record(i:number,classification="PPE",kind:AutofillRecord["kind"]="acknowledgment"):AutofillRecord{return {id:`r-${i}`,groupKey:`party-${i}`,label:`Session ${i}`,kind,date:`2026-10-${30+i%2}`,status:i%2?"APPROVED":"PENDING",fromName:`Sender ${i}`,toName:`Receiver ${i}`,remarks:`Real reason ${i}`,rows:[{assetId:`a-${i}`,propertyNo:`PROP-${i}`,name:`Product ${i}`,description:`Actual description ${i}`,classification,cost:i===0?0:1000+i,acquired:"2026-01-01",category:"Equipment",condition:"GOOD",unitName:`College ${i}`,onHand:1}]};}
async function open(data:Buffer){const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(new Uint8Array(data).buffer);return workbook;}

test("compact PAR contains only actual descriptions and moves the footer below its two rows",async()=>{
  const output=await createReportWorkbook([{templateId:"par",records:[record(0),record(1)]}]),sheet=(await open(output.data)).worksheets[0];
  assert.equal(sheet.getCell("C9").text,"Actual description 0");assert.equal(sheet.getCell("C10").text,"Actual description 1");
  assert.equal(sheet.getCell("A12").text,"Received by: ");assert.equal(sheet.getCell("A14").text,"");assert.equal(sheet.rowCount,21);
  assert.equal(sheet.getCell("F9").value,0);assert.equal(sheet.getColumn(3).width,40.5546875);
  const preview=await renderDocumentPreview(output.data,output.filename);assert.ok(preview.html.includes("Actual description 0"));assert.ok(!preview.html.includes("Receiver 0"));
});

test("blank descriptions keep their item rows without product-name or metadata fallbacks",async()=>{
  const a=record(0),b=record(1);a.rows[0].description=null;b.rows[0].description=" \n ";
  const sheet=(await open((await createReportWorkbook([{templateId:"par",records:[a,b]}])).data)).worksheets[0];
  assert.equal(sheet.getCell("C9").text,"");assert.equal(sheet.getCell("C10").text,"");assert.equal(sheet.getCell("D10").text,"PROP-1");
});

test("description words are preserved verbatim and real remarks stay in their own fields",async()=>{
  const r=record(1,"SEMI_EXPENDABLE","return");r.rows[0].description="Receiver circuit, status LED, College model\nOriginal second line";
  const sheet=(await open((await createReportWorkbook([{templateId:"return",records:[r]}])).data)).worksheets[0];
  assert.equal(sheet.getCell("A8").text,r.rows[0].description);assert.equal(sheet.getCell("E8").text,"Real reason 1");
  assert.equal(sheet.getCell("A10").text,"Returned by:");
});

test("both ICS copies shrink cumulatively and keep all item formulas",async()=>{
  const output=await createReportWorkbook([{templateId:"ics",records:[record(0,"SEMI_EXPENDABLE"),record(1,"SEMI_EXPENDABLE")]}]),sheet=(await open(output.data)).worksheets[0];
  for(const start of [11,34])for(let i=0;i<2;i++){
    const row=start+i;assert.equal(sheet.getCell(row,5).text,`Actual description ${i}`);assert.equal(sheet.getCell(row,7).text,`PROP-${i}`);
    assert.equal(sheet.getCell(row,4).formula,`A${row}*C${row}`);assert.equal(sheet.getCell(row,4).result,i===0?0:1001);
  }
  assert.equal(sheet.rowCount,44);assert.ok(sheet.pageSetup.printArea?.includes("44"));
});

for(const [id,start,end,col,classification,kind] of [
  ["par",9,27,4,"PPE","acknowledgment"],["ptr",18,37,2,"PPE","transfer"],["itr",12,28,2,"SEMI_EXPENDABLE","transfer"],
  ["rpcppe",15,34,5,"PPE","physical-count"],["rpcsp",14,28,3,"SEMI_EXPENDABLE","physical-count"],
] as const)test(`${id} handles one item, exact capacity and overflow without dropping or repeating rows`,async()=>{
  for(const count of [1,end-start+1,end-start+2]){
    const records=Array.from({length:count},(_,i)=>record(i,classification,kind)),output=await createReportWorkbook([{templateId:id,records}]),sheet=(await open(output.data)).worksheets[0];
    assert.equal(output.rowCount,count);assert.deepEqual(Array.from({length:count},(_,i)=>sheet.getCell(start+i,col).text),records.map(r=>r.rows[0].propertyNo));
    const labels:string[]=[];sheet.eachRow(row=>row.eachCell(cell=>{if(cell.type!==ExcelJS.ValueType.Merge&&cell.value!==null)labels.push(cell.text);}));
    assert.equal(labels.filter(v=>v.startsWith((id==="par"?"Received by: ":id==="ptr"?"Reason for Transfer:":id==="itr"?"Reason/s for Transfer:":"Certified Correct by:"))).length,1);
  }
});

test("invalid corrections cannot recreate a deleted body row",async()=>{
  const r=record(0);
  await assert.rejects(createReportWorkbook([{templateId:"par",records:[r]}],{correction:{templateId:"par",recordId:r.id,page:1,changes:[{fieldId:"0:27:3",value:"Phantom row"}]}}),/selected|unused|available|item/i);
});

test("original references keep their full tables while drawings survive compact output",async()=>{
  const original=await createReferenceWorkbook(["par"]);assert.equal((await open(original.data)).worksheets[0].rowCount,38);
  const output=await createReportWorkbook([{templateId:"ptr",records:[record(0,"PPE","transfer")]}]),zip=await JSZip.loadAsync(output.data),source=await JSZip.loadAsync(await readFile("resources/workbook-templates/ptr.xlsx"));
  assert.deepEqual(await zip.file("xl/template-parts/sheet1/xl/drawings/drawing1.xml")!.async("nodebuffer"),await source.file("xl/drawings/drawing1.xml")!.async("nodebuffer"));
  assert.ok((await open(output.data)).worksheets[0].rowCount<51);
});

test("signed layout rebases ranges, footer references and original ICS copies",()=>{
  const par=createReportLayout([{start:9,end:27}],2);
  assert.equal(par.retainedRow(27),undefined);assert.equal(par.requiredRow(31),14);
  assert.equal(par.formula('SUM(A9:A27)+$B$31+IF(A9="A31",1,0)'), 'SUM(A9:A10)+$B$14+IF(A9="A31",1,0)');
  assert.equal(createReportLayout([{start:9,end:27}],25).formula("SUM(F9:F27)"),"SUM(F9:F33)");
  const ics=createReportLayout([{start:11,end:17},{start:39,end:45}],2);
  assert.equal(ics.requiredRow(39),34);assert.equal(ics.requiredRow(49),39);
  assert.equal(ics.referenceRow(45),35);assert.equal(ics.formula("SUM(D39:D45)"),"SUM(D34:D35)");
});

test("native drawing anchors below and inside removed rows are rebased without negative coordinates",async()=>{
  const source=await JSZip.loadAsync(await readFile("resources/workbook-templates/ptr.xlsx"));
  source.file("xl/drawings/drawing1.xml",(await source.file("xl/drawings/drawing1.xml")!.async("string")).replace(/<xdr:row>\d+<\/xdr:row>/g,"<xdr:row>46</xdr:row>"));
  const workbook=new ExcelJS.Workbook();workbook.addWorksheet("PTR").getCell("A1").value="Header";
  const plan=createReportLayout([{start:18,end:37}],1),bytes=Buffer.from(await workbook.xlsx.writeBuffer());
  const result=await preserveTemplateParts(bytes,[{source:await source.generateAsync({type:"nodebuffer"}),sourceSheet:1,targetSheet:1,maps:[row=>plan.referenceRow(row)]}]);
  const zip=await JSZip.loadAsync(result),drawing=await zip.file("xl/template-parts/sheet1/xl/drawings/drawing1.xml")!.async("string");
  assert.match(drawing,/<xdr:row>27<\/xdr:row>/);assert.ok(!drawing.includes("<xdr:row>46</xdr:row>"));
  assert.equal(plan.referenceRow(30),18);
});

test("count preview and print bounds exclude the source workbook's unused styled tail",async()=>{
  const output=await createReportWorkbook([{templateId:"rpcsp",records:[record(0,"SEMI_EXPENDABLE","physical-count")]}]),sheet=(await open(output.data)).worksheets[0];
  assert.equal(sheet.rowCount,30);assert.equal(sheet.pageSetup.printArea,"A1:J30");
  assert.equal(sheet.getCell("B14").text,"Actual description 0");
});
