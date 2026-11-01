import { sessionSigningKey } from "../src/lib/session-secret";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { SignJWT } from "jose";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { prisma } from "../src/lib/db";
import type { AutofillPreview,FormDescription } from "../src/lib/form-templates";

loadEnvConfig(process.cwd());
const base=new URL(process.env.REPORT_TEST_BASE_URL??"http://localhost:3002");
assert.ok(["localhost","127.0.0.1"].includes(base.hostname));
async function normalizedOfficeParts(bytes:ArrayBuffer){
  const zip=await JSZip.loadAsync(bytes),parts:Record<string,string>={};
  for(const name of Object.keys(zip.files).sort()){
    if(zip.files[name].dir)continue;
    // ZIP entry dates and Office generation timestamps are not document changes.
    parts[name]=name==="docProps/core.xml"?(await zip.files[name].async("string")).replace(/<dcterms:(created|modified)\b[^>]*>[^<]*<\/dcterms:\1>/g,""):await zip.files[name].async("base64");
  }
  return parts;
}
async function printedText(preview:{kind:string;pdfBase64:string}){
  assert.equal(preview.kind,"pdf");
  assert.ok(Buffer.from(preview.pdfBase64,"base64").subarray(0,5).equals(Buffer.from("%PDF-")));
  const library=await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask=library.getDocument({data:new Uint8Array(Buffer.from(preview.pdfBase64,"base64"))});
  const document=await loadingTask.promise;
  try{
    let text="";
    for(let page=1;page<=document.numPages;page++)text+=(await (await document.getPage(page)).getTextContent()).items.map(item=>"str" in item?item.str:"").join(" ");
    return text;
  }finally{await loadingTask.destroy();}
}
async function main(){
  const admin=await prisma.user.findFirst({where:{role:"ADMIN",isActive:true},select:{id:true}});
  assert.ok(admin);
  const token=await new SignJWT({id:admin.id,role:"ADMIN"}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("5m").sign(sessionSigningKey());
  const headers={"Content-Type":"application/json",Cookie:`custodia_session=${token}`};
  const post=(body:object)=>fetch(new URL("/api/export/forms",base),{method:"POST",headers,body:JSON.stringify(body)});
  const scope={templateId:"all-acknowledgment",reportSection:"inventory",classification:"ALL",unitId:"ALL",categoryId:"ALL",selection:"all"};
  const metadata:FormDescription=await (await fetch(new URL("/api/export/forms?templateId=all-acknowledgment&reportSection=inventory",base),{headers})).json();
  const plan:AutofillPreview=await (await post({...scope,action:"autofill"})).json();assert.ok(plan.sourceVersion);
  const body={...scope,version:metadata.version,changes:[],autofill:{selection:"all",sourceVersion:plan.sourceVersion,page:plan.pageCount}};
  const beforeDownload=await post({...body,action:"download"});assert.equal(beforeDownload.status,200);
  const beforeParts=await normalizedOfficeParts(await beforeDownload.arrayBuffer());
  const before=await prisma.auditLog.count({where:{actorId:admin.id,action:{startsWith:"EXPORT_"}}});
  const response=await post({...body,action:"preview"});assert.equal(response.status,200,await response.clone().text());
  assert.equal(response.headers.get("cache-control"),"private, no-store");
  const preview=await response.json(),text=await printedText(preview);
  assert.match(text,/PROPERTY ACKNOWLEDGMENT RECEIPT/);assert.match(text,/INVENTORY CUSTODIAN\s+SLIP/);
  assert.equal(await prisma.auditLog.count({where:{actorId:admin.id,action:{startsWith:"EXPORT_"}}}),before,"Preview must not log a download.");
  const download=await post({...body,action:"download"});assert.equal(download.status,200);
  assert.equal(download.headers.get("content-type"),beforeDownload.headers.get("content-type"));
  assert.equal(download.headers.get("content-disposition"),beforeDownload.headers.get("content-disposition"));
  const downloadedBytes=await download.arrayBuffer();
  assert.deepEqual(await normalizedOfficeParts(downloadedBytes),beforeParts,"Preview must not change exported values, styles, formulas, drawings or print settings.");
  assert.equal(await prisma.auditLog.count({where:{actorId:admin.id,action:{startsWith:"EXPORT_"}}}),before+1,"Only the download logs an export.");
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(downloadedBytes);
  for(const sheet of workbook.worksheets)sheet.eachRow(row=>{const property=row.getCell(sheet.name==="PAR"?4:7).text;if(/^BULSU/i.test(property))assert.ok(text.replace(/\s/g,"").includes(property.replace(/\s/g,"")),`Printed PDF is missing ${property}`);});
  const stale=await post({...body,action:"preview",autofill:{...body.autofill,sourceVersion:"stale"}});assert.equal(stale.status,409);
  const badPlacement=await post({action:"preview",templateId:"information",reportSection:"category-history",changes:[]});assert.equal(badPlacement.status,400);
  const request:FormDescription=await (await fetch(new URL("/api/export/forms?templateId=information&reportSection=requests-returns",base),{headers})).json();
  const manual=await post({action:"preview",templateId:"information",reportSection:"requests-returns",version:request.version,changes:[{fieldId:"0:0:1",value:"Actual Requestor"},{fieldId:"0:8:1",value:"Request a copy of my signed PAR"}]});assert.equal(manual.status,200);
  const document=await manual.json(),wordText=await printedText(document);assert.match(wordText,/Actual Requestor/i);assert.match(wordText,/Request a copy of my signed PAR/);assert.match(document.filename,/\.docx$/);
  const original=await post({action:"preview",templateId:"all-acknowledgment",version:metadata.version,reportSection:"inventory",changes:[]});assert.equal(original.status,200);
  const unauth=await fetch(new URL("/api/export/forms",base),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,action:"preview"})});assert.equal(unauth.status,401);
  console.log("Visual preview integration passed: both classifications, download parity, no export audit, original reference, manual Word request, stale source, placement and authentication.");
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
