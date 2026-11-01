import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { renderDocumentPreview } from "../src/lib/document-preview";
import { createReportWorkbook } from "../src/lib/report-workbook";
import type { AutofillRecord } from "../src/lib/form-autofill-mapping";

test("preview uses filled template layout, both classifications and literal untrusted text",async()=>{
  const record=(id:string,classification:string):AutofillRecord=>({id,label:id,kind:"acknowledgment",date:"2026-10-31",status:"RECEIVED",toName:"Receiver",rows:[{assetId:id,propertyNo:id,name:"Product",description:'<img src=x onerror="alert(1)">',classification,cost:1234.5,acquired:"2026-01-01",category:"Equipment",condition:"GOOD",unitName:"Science"}]});
  const output=await createReportWorkbook([{templateId:"par",records:[record("PPE-1","PPE")]},{templateId:"ics",records:[record("SEMI-1","SEMI_EXPENDABLE")]}]);
  const preview=await renderDocumentPreview(output.data,output.filename);
  assert.deepEqual(preview.sheets.map(s=>s.name),["PAR","Sheet26"]);
  assert.match(preview.html,/PROPERTY ACKNOWLEDGMENT RECEIPT/);assert.match(preview.html,/PPE-1/);assert.match(preview.html,/SEMI-1/);
  assert.match(preview.html,/&lt;img/);assert.ok(!preview.html.includes('<img src=x'));
  assert.match(preview.html,/colspan=/);assert.match(preview.html,/font-family:/);
  assert.match(preview.html,/default-src 'none'/);assert.ok(!/<script\b/i.test(preview.html));
});

test("original XLS preview reads the supplied form and retains its title",async()=>{
  const preview=await renderDocumentPreview(await readFile("resources/export-templates/PTR for Above P50K.xls"),"PTR for Above P50K.xls");
  assert.match(preview.html,/PROPERTY TRANSFER REPORT/);assert.equal(preview.sheets.length,1);
});

test("Word request preview displays the actual document tables and labels",async()=>{
  const preview=await renderDocumentPreview(await readFile("resources/export-templates/Request for Documented Information.docx"),"Request for Documented Information.docx");
  assert.match(preview.html,/REQUESTOR/);assert.match(preview.html,/PURPOSE:/);assert.match(preview.html,/<table/);assert.equal(preview.sheets.length,1);
});

test("oversized previews fail explicitly rather than silently drop records",async()=>{
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet("Too large");sheet.getCell("A2501").value="Last record";
  await assert.rejects(renderDocumentPreview(Buffer.from(await workbook.xlsx.writeBuffer()),"large.xlsx"),/narrower|preview/i);
});

test("visible dimensions and empty states preserve workbook bytes and source formatting",async()=>{
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet("Geometry");
  sheet.getColumn(1).width=20;sheet.getColumn(2).width=40;sheet.getColumn(2).hidden=true;
  sheet.getColumn(3).width=30;sheet.getRow(1).height=40;
  sheet.mergeCells("A1:C1");sheet.getCell("A1").value="Long description with source wrapping";
  sheet.getCell("A1").alignment={wrapText:true,vertical:"top"};
  sheet.getCell("A1").border={bottom:{style:"thin"}};
  sheet.getCell("A2").value=1234.5;sheet.getCell("A2").numFmt="#,##0.00";
  workbook.addWorksheet("Empty");
  const bytes=Buffer.from(await workbook.xlsx.writeBuffer()),before=Buffer.from(bytes);
  const first=await renderDocumentPreview(bytes,"geometry.xlsx");
  const second=await renderDocumentPreview(bytes,"geometry.xlsx");
  assert.deepEqual(bytes,before,"Rendering must not mutate the export buffer");
  assert.deepEqual(first,second);
  assert.equal(first.sheets[0].width,(20*7+5)+(30*7+5));
  assert.match(first.html,/height:53\.333333333333336px/);
  assert.match(first.html,/colspan="2"/);
  assert.match(first.html,/white-space:pre-wrap/);
  assert.match(first.html,/vertical-align:top/);
  assert.match(first.html,/1,234.50/);
  assert.match(first.html,/This worksheet has no visible content/);
});

test("original Office artifacts retain identical bytes after preview",async()=>{
  for(const filename of ["PTR for Above P50K.xls","Request for Documented Information.docx"]){
    const bytes=await readFile(`resources/export-templates/${filename}`),before=Buffer.from(bytes);
    const preview=await renderDocumentPreview(bytes,filename);
    assert.deepEqual(bytes,before);
    assert.ok(preview.sheets.every(sheet=>Number.isFinite(sheet.width)));
    assert.match(preview.notice,/Approximate/);
  }
});

test("Word preview respects page geometry and table grids instead of conflicting cell widths",async()=>{
  const zip=new JSZip();
  zip.file("word/document.xml",`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid><w:gridCol w:w="4800"/><w:gridCol w:w="4800"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="7251" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Left</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="7251" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Right</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr><w:pgSz w:w="12000" w:h="16000"/><w:pgMar w:top="720" w:bottom="720" w:left="1200" w:right="1200"/></w:sectPr></w:body></w:document>`);
  const preview=await renderDocumentPreview(await zip.generateAsync({type:"nodebuffer"}),"grid.docx");
  assert.equal(preview.sheets[0].width,800);
  assert.match(preview.html,/<colgroup><col style="width:50%"><col style="width:50%"><\/colgroup>/);
  assert.ok(!preview.html.includes("width:362.55pt"),"Conflicting cell widths must not expand the explicit grid");
});
