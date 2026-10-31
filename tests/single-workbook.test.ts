import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { createReportWorkbook } from "../src/lib/report-workbook";
import type { AutofillRecord } from "../src/lib/form-autofill-mapping";

function record(i:number,classification="PPE"):AutofillRecord{return {id:`receipt-${i}`,groupKey:"same-person",label:`Product ${i}`,kind:"acknowledgment",date:"2026-10-30",status:"RECEIVED",toName:"Actual Receiver",toPosition:"Officer",identitySource:"receipt-snapshot",rows:[{assetId:`asset-${i}`,propertyNo:`PROPERTY-${i}`,name:`Product ${i}`,description:`Description ${i}`,classification,cost:1000+i,acquired:"2026-01-01",category:"Equipment",condition:"GOOD",unitName:"College of Science",usefulLife:5}]};}
async function open(data:Buffer){const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(new Uint8Array(data).buffer);return workbook;}

test("both classifications populate only the supplied template sheets in one workbook",async()=>{
  const output=await createReportWorkbook([{templateId:"par",records:[record(1),record(2)]},{templateId:"ics",records:[record(3,"SEMI_EXPENDABLE"),record(4,"SEMI_EXPENDABLE")]}]);
  const zip=await JSZip.loadAsync(output.data);assert.ok(zip.file("xl/workbook.xml"));
  assert.ok(!Object.keys(zip.files).some(name=>/\.(xlsx|xls|docx)$/.test(name)),"No nested per-product documents");
  const workbook=await open(output.data);
  assert.deepEqual(workbook.worksheets.map(s=>s.name),["PAR","Sheet26"]);assert.equal(output.rowCount,4);
  assert.equal(workbook.getWorksheet("PAR")!.getCell("D10").text,"PROPERTY-2");
  const ics=workbook.getWorksheet("Sheet26")!;assert.equal(ics.getCell("G12").text,"PROPERTY-4");
  assert.equal(ics.getCell("G35").text,"PROPERTY-4","Both original ICS copies contain the same second product");
});

test("more than the old PAR capacity fills consecutive rows without extra files or per-product sheets",async()=>{
  const records=Array.from({length:45},(_,i)=>record(i));
  const output=await createReportWorkbook([{templateId:"par",records}]),workbook=await open(output.data);
  assert.equal(workbook.worksheets.length,1);assert.equal(output.rowCount,45);
  assert.equal(workbook.getWorksheet("PAR")!.getCell("D53").text,"PROPERTY-44");
});

test("different recipients and dates fill consecutive rows without repeated forms",async()=>{
  const output=await createReportWorkbook([{templateId:"par",records:[record(1),{...record(2),groupKey:"other-person",toName:"Other Receiver",date:"2026-10-31"}]}]);
  const sheet=(await open(output.data)).worksheets[0];
  assert.equal(sheet.rowCount,21);assert.equal(sheet.getCell("D9").text,"PROPERTY-1");assert.equal(sheet.getCell("D10").text,"PROPERTY-2");
  assert.equal(sheet.getCell("C9").text,"Description 1");assert.equal(sheet.getCell("C10").text,"Description 2");
  assert.equal(sheet.getCell("A14").text,"");assert.equal(sheet.getCell("A18").text,"");
});

test("complete history fills the supplied Word form without a replacement spreadsheet",async()=>{
  const records=Array.from({length:120},(_,i)=>({...record(i),kind:"information" as const,summary:`Complete recorded transaction ${i} `+"Long remarks ".repeat(30)}));
  const output=await createReportWorkbook([{templateId:"information",records}]);
  assert.match(output.filename,/\.docx$/);assert.equal(output.rowCount,120);
  const actual=await JSZip.loadAsync(output.data),original=await JSZip.loadAsync(await readFile("resources/export-templates/Request for Documented Information.docx"));
  assert.ok(!actual.file("xl/workbook.xml"));
  const xml=await actual.file("word/document.xml")!.async("string");
  assert.ok(xml.includes("Complete recorded transaction 0"));assert.ok(xml.includes("Complete recorded transaction 119"));
  for(const name of Object.keys(original.files).filter(name=>!original.files[name].dir&&name!=="word/document.xml"))assert.deepEqual(await actual.file(name)!.async("nodebuffer"),await original.file(name)!.async("nodebuffer"));
});

test("formula cells in both ICS copies calculate each item's quantity and unit cost",async()=>{
  const output=await createReportWorkbook([{templateId:"ics",records:[record(1,"SEMI_EXPENDABLE"),record(2,"SEMI_EXPENDABLE")]}]);
  const workbook=await open(output.data),sheet=workbook.getWorksheet("Sheet26")!;
  assert.equal(sheet.getCell("D12").formula,"A12*C12");assert.equal(sheet.getCell("D12").result,1002);
  assert.equal(sheet.getCell("D35").formula,"A35*C35");assert.equal(sheet.getCell("D35").result,1002);
});

test("return classifications stay in one workbook with their correct template sheets",async()=>{
  const records=[{...record(1),kind:"return" as const,status:"APPROVED",fromName:"Returner",remarks:"Reason one"},{...record(2,"SEMI_EXPENDABLE"),kind:"return" as const,status:"APPROVED",fromName:"Returner",remarks:"Reason two"}];
  const output=await createReportWorkbook([{templateId:"return",records}]),workbook=await open(output.data);
  assert.equal(workbook.worksheets.length,2);assert.equal(workbook.getWorksheet("Above 50k")!.getImages().length,1);assert.ok(workbook.getWorksheet("Below 50k"));assert.equal(output.rowCount,2);
});

test("source strings are literal text and zero amounts remain numeric",async()=>{
  const source=record(1);source.rows[0]={...source.rows[0],description:'=HYPERLINK("https://example.test")',cost:0};
  const output=await createReportWorkbook([{templateId:"par",records:[source]}]),workbook=await open(output.data);
  assert.equal(workbook.getWorksheet("PAR")!.getCell("C9").type,ExcelJS.ValueType.String);
  assert.equal(workbook.getWorksheet("PAR")!.getCell("F9").value,0);
});


test("manual corrections on preview page two affect only the matching item in the complete workbook",async()=>{
  const records=Array.from({length:25},(_,i)=>record(i));
  const output=await createReportWorkbook([{templateId:"par",records}],{correction:{templateId:"par",recordId:records[0].id,page:2,changes:[{fieldId:"0:9:3",value:"Reviewed description"}]}});
  const w=await open(output.data),sheet=w.getWorksheet("PAR")!;
  assert.equal(sheet.getCell("C28").text,"Reviewed description");
  assert.match(sheet.getCell("C9").text,/Description 0/);
  assert.equal(output.rowCount,25);
});


test("transfer and physical count templates expand within the same workbook",async()=>{
  for(const [id,start,propertyCol,kind] of [["ptr",18,2,"transfer"],["itr",12,2,"transfer"],["rpcppe",15,5,"physical-count"],["rpcsp",14,3,"physical-count"]] as const){
    const classification=["itr","rpcsp"].includes(id)?"SEMI_EXPENDABLE":"PPE";
    const records=Array.from({length:35},(_,i)=>({...record(i,classification),kind,fromName:"Source Officer",fromUnit:"Science",toName:"Target Officer",toUnit:"Education",rows:[{...record(i,classification).rows[0],onHand:1}]}));
    const output=await createReportWorkbook([{templateId:id,records}]),w=await open(output.data);
    assert.equal(w.worksheets.length,1);assert.equal(output.rowCount,35);
    assert.equal(w.worksheets[0]!.getCell(start+34,propertyCol).text,"PROPERTY-34");
  }
});


test("short reports remove unused rows while preserving footer labels, widths and fonts",async()=>{
  const output=await createReportWorkbook([{templateId:"par",records:[record(1)]}]),actual=(await open(output.data)).worksheets[0];
  const original=new ExcelJS.Workbook();await original.xlsx.readFile("resources/workbook-templates/par.xlsx");
  const source=original.worksheets[0];
  assert.equal(actual.rowCount,source.rowCount-18);assert.equal(actual.getCell("A2").text,source.getCell("A2").text);
  assert.equal(actual.getCell("A11").text,source.getCell("A29").text);
  assert.equal(actual.getCell("A13").text,"Actual Receiver");
  assert.deepEqual(actual.getCell("C9").font,source.getCell("C9").font);
  assert.deepEqual(actual.columns.map(c=>c.width),source.columns.map(c=>c.width));
});


test("original transfer checkbox drawings and printer settings survive template population",async()=>{
  const r={...record(1),kind:"transfer" as const,fromName:"Source",toName:"Receiver"};
  const output=await createReportWorkbook([{templateId:"ptr",records:[r]}]);
  const result=await JSZip.loadAsync(output.data),original=await JSZip.loadAsync(await readFile("resources/workbook-templates/ptr.xlsx"));
  for(const name of ["xl/drawings/drawing1.xml","xl/printerSettings/printerSettings1.bin"])assert.deepEqual(await result.file(`xl/template-parts/sheet1/${name}`)!.async("nodebuffer"),await original.file(name)!.async("nodebuffer"));
  const xml=await result.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.ok(xml.includes('<drawing r:id="rId2"/>'));
});


test("interleaved preview groups correct the intended row in the continuous table",async()=>{
  const a=record(1),b={...record(2),groupKey:"other",toName:"Other"},c=record(3);
  const output=await createReportWorkbook([{templateId:"par",records:[a,b,c]}],{correction:{templateId:"par",recordId:a.id,page:1,changes:[{fieldId:"0:10:3",value:"Correct third product"}]}});
  const sheet=(await open(output.data)).worksheets[0];
  assert.equal(sheet.getCell("C11").text,"Correct third product");assert.match(sheet.getCell("C10").text,/Description 2/);
});

test("mixed transfers keep every request row, including repeated assets, and one set of checkboxes",async()=>{
  const records=[1,2,3].map(i=>({...record(i),id:`transfer-${i}`,groupKey:`party-${i}`,kind:"transfer" as const,date:`2026-10-${28+i}`,fromName:`Source ${i}`,toName:`Receiver ${i}`,remarks:`Reason ${i}`,rows:[record(1).rows[0]]}));
  const output=await createReportWorkbook([{templateId:"ptr",records}]),sheet=(await open(output.data)).worksheets[0];
  assert.deepEqual([18,19,20].map(row=>sheet.getCell(row,2).text),["PROPERTY-1","PROPERTY-1","PROPERTY-1"]);
  for(let i=1;i<=3;i++)assert.equal(sheet.getCell(i+17,4).text,"Description 1");
  assert.equal(sheet.rowCount,34);
  const zip=await JSZip.loadAsync(output.data),drawing=await zip.file("xl/template-parts/sheet1/xl/drawings/drawing1.xml")!.async("string");
  assert.equal((drawing.match(/<xdr:twoCellAnchor>/g)??[]).length,4);
});


test("mixed ICS, return and count records share one template table with row-specific context",async()=>{
  for(const id of ["ics","return","rpcsp"]){
    const kind=id==="ics"?"acknowledgment":id==="return"?"return":"physical-count";
    const records=[1,2,3].map(i=>({...record(i,"SEMI_EXPENDABLE"),kind:kind as AutofillRecord["kind"],groupKey:`party-${i}`,date:`2026-10-${28+i}`,fromName:`Returner ${i}`,toName:`Officer ${i}`,label:`Count session ${i}`,rows:[{...record(i,"SEMI_EXPENDABLE").rows[0],onHand:1}]}));
    const output=await createReportWorkbook([{templateId:id,records}]),sheet=(await open(output.data)).worksheets[0];
    assert.equal((await open(output.data)).worksheets.length,1);
    if(id==="ics"){
      assert.deepEqual([11,12,13].map(row=>sheet.getCell(row,7).text),["PROPERTY-1","PROPERTY-2","PROPERTY-3"]);
      assert.deepEqual([35,36,37].map(row=>sheet.getCell(row,7).text),["PROPERTY-1","PROPERTY-2","PROPERTY-3"]);
      assert.equal(sheet.getCell("E12").text,"Description 2");assert.equal(sheet.getCell("F17").text,"");
    }else if(id==="return"){
      assert.deepEqual([8,9,10].map(row=>sheet.getCell(row,4).text),["Returner 1","Returner 2","Returner 3"]);
      assert.equal(sheet.getCell("A15").text,"");
    }else{
      assert.deepEqual([14,15,16].map(row=>sheet.getCell(row,3).text),["PROPERTY-1","PROPERTY-2","PROPERTY-3"]);
      assert.equal(sheet.getCell("J15").text,"");
    }
  }
});


test("long automatic descriptions wrap inside the supplied columns instead of overlapping identifiers",async()=>{
  const r=record(1);r.rows[0].description="Detailed equipment specification ".repeat(8);
  const output=await createReportWorkbook([{templateId:"par",records:[r]}]),sheet=(await open(output.data)).worksheets[0];
  assert.equal(sheet.getCell("C9").alignment.wrapText,true);assert.ok(sheet.getRow(9).height!>18);
  assert.equal(sheet.getCell("D9").text,"PROPERTY-1");assert.equal(sheet.getColumn(3).width,40.5546875);
});
