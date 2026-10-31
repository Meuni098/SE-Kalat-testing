import { sessionSigningKey } from "../src/lib/session-secret";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { SignJWT } from "jose";
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/db";
import { getAutofillRecords } from "../src/lib/form-autofill-source";
import type { AutofillOption,AutofillPreview,FormDescription } from "../src/lib/form-templates";

loadEnvConfig(process.cwd());
const base=new URL(process.env.REPORT_TEST_BASE_URL??"http://localhost:3001");
assert.ok(["localhost","127.0.0.1"].includes(base.hostname));

async function main(){
  const admin=await prisma.user.findFirst({where:{isActive:true,role:"ADMIN"},select:{id:true}});
  assert.ok(admin,"An existing active local admin is required.");
  const token=await new SignJWT({id:admin.id,role:"ADMIN"}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("5m").sign(sessionSigningKey());
  const headers={"Content-Type":"application/json",Cookie:`custodia_session=${token}`};
  const post=(body:object)=>fetch(new URL("/api/export/forms",base),{method:"POST",headers,body:JSON.stringify(body)});
  const scope={templateId:"par",reportSection:"accountable-person",categoryId:"ALL",selection:"all"};
  const options=await post({...scope,action:"autofill-options"});assert.equal(options.status,200);
  const data:{records:AutofillOption[]}=await options.json();assert.ok(data.records.length>1,"Multiple existing records are required.");
  const preview=await post({...scope,action:"autofill",page:1});assert.equal(preview.status,200);
  const plan:AutofillPreview=await preview.json();
  assert.equal(plan.selection,"all");assert.equal(plan.recordCount,data.records.length);
  assert.equal(plan.totalRowCount,data.records.reduce((n,r)=>n+r.rowCount,0));
  const description:FormDescription=await (await fetch(new URL("/api/export/forms?templateId=par&reportSection=accountable-person",base),{headers})).json();
  const download=await post({...scope,action:"download",version:description.version,changes:[],bundle:true,autofill:{selection:"all",page:1,sourceVersion:plan.sourceVersion}});
  assert.equal(download.status,200);
  const bytes=Buffer.from(await download.arrayBuffer());
  assert.match(download.headers.get("content-type")??"",/spreadsheetml/);
  assert.match(download.headers.get("content-disposition")??"",/category-report.xlsx/);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(new Uint8Array(bytes).buffer);
  assert.deepEqual(workbook.worksheets.map(s=>s.name),["PAR"]);
  const source=await getAutofillRecords("par",{reportSection:"accountable-person",categoryId:"ALL"},true);
  const expected=source.flatMap(r=>r.rows.map(a=>a.propertyNo)),actual:string[]=[];
  workbook.getWorksheet("PAR")!.eachRow(row=>{const value=row.getCell(4).text;if(expected.includes(value))actual.push(value);});
  assert.deepEqual(actual.sort(),source.flatMap(r=>r.rows.map(a=>a.propertyNo)).sort(),"The single workbook includes every selected product exactly once.");
  assert.deepEqual(Array.from({length:expected.length},(_,i)=>workbook.getWorksheet("PAR")!.getCell(i+9,4).text),source.flatMap(record=>record.rows.map(row=>row.propertyNo)),"Different recipients still fill consecutive rows.");
  assert.equal(workbook.getWorksheet("PAR")!.rowCount,38+expected.length-19,"Unused PAR item rows are removed, with the original form appearing once.");
  const stale=await post({...scope,action:"download",version:description.version,changes:[],bundle:true,autofill:{selection:"all",page:1,sourceVersion:"stale"}});assert.equal(stale.status,409);
  const wrongPage=await post({...scope,action:"autofill",page:plan.pageCount+1});assert.equal(wrongPage.status,400);
  const invalidMode=await post({...scope,action:"autofill",selection:"unknown"});assert.equal(invalidMode.status,400);
  const documentRequests=await post({templateId:"information",reportSection:"requests-returns",categoryId:"ALL",action:"autofill-options"});
  assert.equal(documentRequests.status,200);assert.deepEqual((await documentRequests.json()).records,[]);
  const custodian=await prisma.user.findFirst({where:{isActive:true,role:"CUSTODIAN",unitId:{not:null}},select:{id:true,unitId:true}});
  if(custodian){
    const token=await new SignJWT({id:custodian.id,role:"ADMIN",unitId:"forged"}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("5m").sign(sessionSigningKey());
    const response=await fetch(new URL("/api/export/forms",base),{method:"POST",headers:{"Content-Type":"application/json",Cookie:`custodia_session=${token}`},body:JSON.stringify({...scope,action:"autofill-options",unitId:"forged"})});
    assert.equal(response.status,200);const data:{records:AutofillOption[]}=await response.json();
    const expected=await getAutofillRecords("par",{reportSection:"accountable-person",categoryId:"ALL",unitId:custodian.unitId!},true);
    assert.deepEqual(data.records.map(r=>r.id).sort(),expected.map(r=>r.id).sort());
  }
  console.log(`Batch integration passed: ${data.records.length} records, ${plan.totalRowCount} products, ${plan.pageCount} preview sections; single workbook download, manual document requests, conflicts, invalid pages and custodian scope verified.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
