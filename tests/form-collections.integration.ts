import { sessionSigningKey } from "../src/lib/session-secret";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { SignJWT } from "jose";
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/db";
import { getAutofillRecords } from "../src/lib/form-autofill-source";
import type { AutofillPreview,AutofillOption,FormDescription } from "../src/lib/form-templates";

loadEnvConfig(process.cwd());
const base=new URL(process.env.REPORT_TEST_BASE_URL??"http://localhost:3001");
assert.ok(["localhost","127.0.0.1"].includes(base.hostname));
async function main(){
  const admin=await prisma.user.findFirst({where:{role:"ADMIN",isActive:true},select:{id:true}});
  const science=await prisma.unit.findUnique({where:{code:"CS"},select:{id:true}});
  assert.ok(admin&&science,"Existing local admin and College of Science are required.");
  const token=await new SignJWT({id:admin.id,role:"ADMIN"}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("5m").sign(sessionSigningKey());
  const headers={"Content-Type":"application/json",Cookie:`custodia_session=${token}`};
  const post=(body:object)=>fetch(new URL("/api/export/forms",base),{method:"POST",headers,body:JSON.stringify(body)});
  const scope={templateId:"all-acknowledgment",reportSection:"inventory",categoryId:"ALL",unitId:science.id,classification:"ALL",selection:"all"};
  const metadata=await fetch(new URL("/api/export/forms?templateId=all-acknowledgment&reportSection=inventory",base),{headers});assert.equal(metadata.status,200);
  const description:FormDescription=await metadata.json();
  const options=await post({...scope,action:"autofill-options"});assert.equal(options.status,200);
  const data:{records:AutofillOption[]}=await options.json();
  const preview=await post({...scope,action:"autofill"});assert.equal(preview.status,200);
  const plan:AutofillPreview=await preview.json();
  assert.equal(plan.recordCount,data.records.length);assert.equal(plan.variants?.length,2);
  assert.ok(plan.variants?.every(v=>v.recordCount>0),"College of Science should include both stored classifications.");
  const lastResponse=await post({...scope,action:"autofill",page:plan.pageCount});assert.equal(lastResponse.status,200);
  const last:AutofillPreview=await lastResponse.json();assert.equal(last.form?.templateId,"ics");
  const download=await post({...scope,action:"download",version:description.version,changes:[],bundle:true,autofill:{selection:"all",page:1,sourceVersion:plan.sourceVersion}});
  assert.equal(download.status,200);assert.match(download.headers.get("content-type")??"",/spreadsheetml/);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await download.arrayBuffer());
  assert.deepEqual(workbook.worksheets.map(s=>s.name),["PAR","Sheet26"]);
  const source=(await Promise.all(["par","ics"].map(id=>getAutofillRecords(id,{reportSection:"inventory",categoryId:"ALL",unitId:science.id,classification:"ALL"},true)))).flat();
  const products=source.flatMap(record=>record.rows.map(row=>row.propertyNo));
  function propertyValues(w:ExcelJS.Workbook){const result:string[]=[];for(const sheet of w.worksheets)sheet.eachRow(row=>{const value=row.getCell(sheet.name==="PAR"?4:7).text;if(products.includes(value))result.push(value);});return result.sort();}
  const expected=source.flatMap(record=>record.rows.flatMap(row=>Array(row.classification==="PPE"?1:2).fill(row.propertyNo))).sort();
  assert.deepEqual(propertyValues(workbook),expected,"Every item appears in its supplied template, including both ICS copies.");
  // The current preview section and the obsolete bundle flag cannot split delivery.
  const complete=await post({...scope,action:"download",version:description.version,changes:[],autofill:{selection:"all",page:plan.pageCount,sourceVersion:plan.sourceVersion}});
  assert.equal(complete.status,200);
  const completeWorkbook=new ExcelJS.Workbook();await completeWorkbook.xlsx.load(await complete.arrayBuffer());
  assert.deepEqual(propertyValues(completeWorkbook),expected);
  const original=await post({...scope,action:"download",version:description.version,changes:[]});assert.equal(original.status,200);
  const reference=new ExcelJS.Workbook();await reference.xlsx.load(await original.arrayBuffer());
  assert.deepEqual(reference.worksheets.map(s=>s.name),["PAR","Sheet26"]);
  const stale=await post({...scope,action:"download",version:description.version,changes:[],bundle:true,autofill:{selection:"all",page:1,sourceVersion:"stale"}});assert.equal(stale.status,409);
  const invalid=await post({...scope,action:"autofill",classification:"PPE"});assert.equal(invalid.status,400);
  const singleOption=data.records.find(r=>r.id.startsWith("ics::"));assert.ok(singleOption);
  const single=await post({...scope,action:"autofill",selection:"single",recordId:singleOption.id});assert.equal(single.status,200);assert.equal((await single.json()).form.templateId,"ics");
  const inventory=await fetch(new URL("/inventory?classification=ALL",base),{headers});assert.equal(inventory.status,200);const inventoryHtml=await inventory.text();assert.ok(products.every(p=>inventoryHtml.includes(p)));
  console.log(`All-classification integration passed: College of Science includes ${plan.recordCount} records across PAR + ICS, one workbook matches both source sets, reference sheets are included, and single-record/inventory ALL paths work.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
