import assert from "node:assert/strict";
import { readFile,writeFile,mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { FORM_TEMPLATES } from "../src/lib/form-templates";
import { createDocumentPrintPreview } from "../src/lib/document-print-preview";
import { createReportWorkbook } from "../src/lib/report-workbook";
import type { AutofillRecord } from "../src/lib/form-autofill-mapping";

const hash=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
async function main(){
  assert.equal(process.platform,"win32","Native checks require Windows with Excel and Word installed.");
  const directory=path.join(process.cwd(),".qa","print-preview-native");await mkdir(directory,{recursive:true});
  for(const form of FORM_TEMPLATES){
    const source=path.join("resources","export-templates",form.filename),data=await readFile(source),before=hash(data);
    const preview=await createDocumentPrintPreview({data,filename:form.filename});
    assert.equal(hash(data),before);assert.equal(hash(await readFile(source)),before);
    await writeFile(path.join(directory,`${form.id}.pdf`),Buffer.from(preview.pdfBase64,"base64"));
    console.log(`PASS native print preview and unchanged source: ${form.id}`);
  }
  const record=(id:string,classification:string):AutofillRecord=>({id,label:id,kind:"acknowledgment",date:"2026-11-01",status:"RECEIVED",toName:"Test Receiver",rows:[{assetId:id,propertyNo:id,name:"Product",description:"Long description for print review: Intel Core i5, 16GB RAM, solid state storage and a full set of accessories.",classification,cost:classification==="PPE"?84500:38000,acquired:"2026-01-01",category:"Equipment",condition:"GOOD",unitName:"Science"}]});
  const output=await createReportWorkbook([{templateId:"par",records:[record("PRINT-PPE-1","PPE")]},{templateId:"ics",records:[record("PRINT-SEMI-1","SEMI_EXPENDABLE"),record("PRINT-SEMI-2","SEMI_EXPENDABLE"),record("PRINT-SEMI-3","SEMI_EXPENDABLE")]}]);
  const before=hash(output.data),preview=await createDocumentPrintPreview(output);
  assert.equal(hash(output.data),before);
  await writeFile(path.join(directory,"filled-combined.pdf"),Buffer.from(preview.pdfBase64,"base64"));
  console.log("PASS filled combined PAR/ICS print preview and unchanged export buffer");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
