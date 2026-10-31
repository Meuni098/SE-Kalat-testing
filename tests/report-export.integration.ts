import { sessionSigningKey } from "../src/lib/session-secret";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { SignJWT } from "jose";
import { prisma } from "../src/lib/db";
import { FORM_TEMPLATES, type AutofillOption, type AutofillPreview, type FormDescription } from "../src/lib/form-templates";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Local integration harness: reads existing records and creates only normal export audit entries.
// Tokens stay in memory; no authentication settings or business records are changed.
loadEnvConfig(process.cwd());
const base=new URL(process.env.REPORT_TEST_BASE_URL??"http://localhost:3001");
assert.ok(["localhost","127.0.0.1"].includes(base.hostname),"Integration tests require a local server.");
const secret=sessionSigningKey();
async function tokenFor(id:string,role:string,unitId?:string|null){
  return new SignJWT({id,role,unitId}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("5m").sign(secret);
}
async function main(){
  const admin=await prisma.user.findFirst({where:{isActive:true,role:"ADMIN"},select:{id:true}});
  assert.ok(admin,"An existing active local admin is required.");
  const token=await tokenFor(admin.id,"ADMIN");
  const headers={"Content-Type":"application/json",Cookie:`custodia_session=${token}`};
  async function post(body:object){return fetch(new URL("/api/export/forms",base),{method:"POST",headers,body:JSON.stringify(body)});}
  const unauthorized=await fetch(new URL("/api/export/forms",base));assert.equal(unauthorized.status,401);
  const incompatible=await post({action:"autofill-options",reportSection:"transfers",templateId:"ics",categoryId:"ALL"});
  assert.equal(incompatible.status,400);
  assert.equal((await incompatible.json()).code,"INCOMPATIBLE_TEMPLATE");
  const missingPerson=await post({action:"autofill",reportSection:"accountable-person",templateId:"par",categoryId:"ALL",recordId:"forged"});
  assert.equal(missingPerson.status,422);
  const unknown=await post({action:"autofill-options",reportSection:"transfers",templateId:"../../outside",categoryId:"ALL"});assert.equal(unknown.status,404);
  const invalidSession=await post({action:"autofill-options",reportSection:"physical-inventory",templateId:"rpcppe",categoryId:"ALL",sessionId:"unknown-session"});assert.equal(invalidSession.status,403);
  const invalidStatus=await post({action:"autofill-options",reportSection:"requests-returns",templateId:"return",categoryId:"ALL",status:"COMPLETED"});assert.equal(invalidStatus.status,400);
  let populated=0;
  for(const template of FORM_TEMPLATES){
    const section=["ptr","itr"].includes(template.id)?"transfers":["par","ics"].includes(template.id)?"inventory":["rpcppe","rpcsp"].includes(template.id)?"physical-inventory":"requests-returns";
    const scope={templateId:template.id,reportSection:section,categoryId:"ALL"};
    const options=await post({...scope,action:"autofill-options"});assert.equal(options.status,200,template.id);
    const data:{records:AutofillOption[]}=await options.json();
    if(!data.records.length)continue;
    const preview=await post({...scope,action:"autofill",recordId:data.records[0].id});assert.equal(preview.status,200,template.id);
    const plan:AutofillPreview=await preview.json();assert.ok(plan.fieldReview?.length);
    const descriptionResponse=await fetch(new URL(`/api/export/forms?templateId=${template.id}&reportSection=${section}`,base),{headers});
    assert.equal(descriptionResponse.status,200);const description:FormDescription=await descriptionResponse.json();
    if(!populated){
      const stale=await post({...scope,action:"download",version:description.version,changes:[],autofill:{recordId:plan.recordId,page:1,sourceVersion:"stale"}});assert.equal(stale.status,409);
      const staleTemplate=await post({...scope,action:"download",version:"stale",changes:[],autofill:{recordId:plan.recordId,page:1,sourceVersion:plan.sourceVersion}});assert.equal(staleTemplate.status,409);
      const download=await post({...scope,action:"download",version:description.version,changes:[],autofill:{recordId:plan.recordId,page:1,sourceVersion:plan.sourceVersion}});
      assert.equal(download.status,200);assert.ok((await download.arrayBuffer()).byteLength>0);
      assert.equal(download.headers.get("cache-control"),"private, no-store");
      const original=await post({...scope,action:"download",version:description.version,changes:[]});assert.equal(original.status,200);
      assert.deepEqual(Buffer.from(await original.arrayBuffer()),await readFile(path.join("resources","export-templates",template.filename)));
    }
    populated++;
  }
  assert.ok(populated>0,"Existing records are required to test populated previews.");
  const custodian=await prisma.user.findFirst({where:{isActive:true,role:"CUSTODIAN"},select:{id:true,unitId:true}});
  if(custodian){
    // A forged ADMIN claim must not override the current database role or unit.
    const cookie=`custodia_session=${await tokenFor(custodian.id,"ADMIN","forged-unit")}`;
    const response=await fetch(new URL("/api/export/forms?reportSection=accountable-person&unitId=forged-unit",base),{headers:{Cookie:cookie}});
    assert.equal(response.status,custodian.unitId?200:403);
    if(custodian.unitId){const data=await response.json();assert.equal(data.unitLocked,true);assert.equal(data.unitId,custodian.unitId);}
  }
  console.log(`Local integration passed: validation, authentication, live previews for ${populated} form types, source/template conflicts, native download and byte-identical original.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
