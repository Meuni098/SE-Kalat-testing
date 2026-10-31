import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
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
