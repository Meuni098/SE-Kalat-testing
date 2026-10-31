import test from "node:test";
import assert from "node:assert/strict";
import { mapAutofill, applyAutomaticExclusions, type AutofillRecord } from "../src/lib/form-autofill-mapping";
import { loadFormTemplate,generateFormExport } from "../src/lib/form-template-engine";
import { readBiff } from "../src/lib/biff-template";
import JSZip from "jszip";
import { FORM_TEMPLATES,formClassification,formPurpose } from "../src/lib/form-templates";

const record:AutofillRecord={id:"transfer-one",label:"Transfer",kind:"transfer",date:"2026-10-30",status:"APPROVED",fromName:"Original Custodian",fromPosition:"Professor",fromUnit:"CAFA",toName:"New Custodian",toPosition:"Dean",toUnit:"CIT",approvedBy:"Approver",remarks:"Transfer to another office",rows:[{assetId:"asset-one",propertyNo:"PROP-01",name:"Computer",description:"Desktop workstation",classification:"PPE",cost:65000,acquired:"2025-01-01",category:"ICT",condition:"GOOD",unitName:"CIT",accountableName:"New Custodian",accountablePosition:"Dean"}]};
const values=(plan:ReturnType<typeof mapAutofill>)=>Object.fromEntries(plan.changes.map(c=>[c.fieldId,c.value]));
for(const template of FORM_TEMPLATES)test(`${template.id}: all automatic mappings exist in the actual supplied file`,async()=>{
  const {description}=await loadFormTemplate(template.id);
  const input={...record,kind:formPurpose(template.id).id,summary:"Recorded transfer of PROP-01",rows:[{...record.rows[0],classification:formClassification(template.id)??"PPE",onHand:1}]};
  const plan=mapAutofill(description,input,1);assert.ok(plan.changes.length>0);
  const result=await generateFormExport(template.id,description.version,[],plan.changes);assert.ok(result.data.length>0);
});
test("transfer maps recorded parties and asset to PTR, with no physical-count or invented document number",async()=>{
  const {description}=await loadFormTemplate("ptr");const p=mapAutofill(description,record,1);const v=values(p);
  assert.equal(v["0:18:2"],"PROP-01");assert.equal(v["0:18:8"],"65000");assert.equal(v["0:46:6"],"Original Custodian");assert.equal(v["0:46:8"],"New Custodian");assert.equal(v["0:46:2"],"Approver");assert.ok(!v["0:8:8"]);
  assert.throws(()=>mapAutofill(description,{...record,kind:"return"},1),/match/);
});
test("wrong classification cannot be filled into an incompatible form",async()=>{
  const {description}=await loadFormTemplate("itr");assert.throws(()=>mapAutofill(description,record,1),/classification/);
});
test("return chooses the correct sheet and does not mix above and below 50K",async()=>{
  const {description}=await loadFormTemplate("return");
  const p=mapAutofill(description,{...record,kind:"return",fromName:"Returner",rows:[{...record.rows[0],classification:"SEMI_EXPENDABLE",cost:1000}]},1);
  const v=values(p);assert.equal(v["1:A8"],"Desktop workstation");assert.equal(v["1:D8"],"Returner");assert.ok(!p.changes.some(c=>c.fieldId.startsWith("0:")));
});
test("count pages never lose overflow rows or duplicate repeated scans",async()=>{
  const {description}=await loadFormTemplate("rpcppe");const rows=Array.from({length:21},(_,i)=>({...record.rows[0],assetId:`a${i}`,propertyNo:`P${i}`,onHand:i===0?0:1}));
  const r={...record,kind:"physical-count" as const,rows};
  const first=mapAutofill(description,r,1),second=mapAutofill(description,r,2);
  assert.equal(first.pageCount,2);assert.equal(first.rowCount,20);assert.equal(second.rowCount,1);
  assert.equal(values(first)["0:15:10"],"1");assert.equal(values(second)["0:15:5"],"P20");
  assert.throws(()=>mapAutofill(description,r,3),/page/);
  const rescanned=mapAutofill(description,{...r,rows:[rows[0],{...rows[0],onHand:1}]},1);
  assert.equal(rescanned.rowCount,1);assert.equal(values(rescanned)["0:15:9"],"1");
});
test("ICS fills both copies, preserves formulas, updates cached totals, and clears sample identities",async()=>{
  const {description}=await loadFormTemplate("ics");const row={...record.rows[0],classification:"SEMI_EXPENDABLE",cost:1200,accountableName:"Actual Receiver"};
  const plan=mapAutofill(description,{...record,kind:"acknowledgment",rows:[row],toName:"Actual Receiver",toPosition:"Professor"},1);
  const {data}=await generateFormExport("ics",description.version,[],plan.changes);
  const zip=await JSZip.loadAsync(data),xml=await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.match(xml,/<c r="A11"[^>]*><v>1<\/v>/);assert.match(xml,/<f>C11\*A11<\/f><v>1200<\/v>/);
  assert.match(xml,/<f>C39<\/f><v>1200<\/v>/);assert.ok(xml.includes("Actual Receiver"));
  assert.equal(values(plan)["0:F21"],"Actual Receiver");assert.equal(values(plan)["0:F49"],"Actual Receiver");assert.equal(values(plan)["0:A21"],"");
  assert.equal(values(plan)["0:F25"],"");assert.equal(values(plan)["0:F26"],"Date: 2026-10-30");assert.equal(values(plan)["0:F54"],"Date: 2026-10-30");
});
test("autofilled XLS amount is numeric and unrelated style and merges survive",async()=>{
  const {source,description}=await loadFormTemplate("ptr");const plan=mapAutofill(description,record,1);
  const {data}=await generateFormExport("ptr",description.version,[],plan.changes);
  const before=readBiff(source),after=readBiff(data);
  assert.equal(after.sheets[0].cells.get("18:8")?.text,"65000");assert.deepEqual(after.sheets[0].merges,before.sheets[0].merges);
  assert.ok(after.entries.some(r=>r.type===0x203&&r.data.readUInt16LE(0)===17&&r.data.readUInt16LE(2)===7));
});
test("documented information populates both form copies without inventing a request number or approver",async()=>{
  const {description}=await loadFormTemplate("information");
  const plan=mapAutofill(description,{...record,kind:"information",summary:"Transfer PROP-01 on 2026-10-30"},1);const v=values(plan);
  assert.equal(v["0:8:1"],"Transfer PROP-01 on 2026-10-30");assert.equal(v["3:8:1"],v["0:8:1"]);assert.ok(!v["0:5:0"]);assert.ok(!v["0:0:6"]);assert.ok(!v["0:12:2"]);
});
test("long documented history is split into additional original forms without truncating Unicode",async()=>{
  const {description}=await loadFormTemplate("information");const summary="History 📝 ".repeat(120);const r={...record,kind:"information" as const,summary};
  const first=mapAutofill(description,r,1);let reconstructed="";
  for(let page=1;page<=first.pageCount;page++){const p=mapAutofill(description,r,page);const v=values(p)["0:8:1"];assert.ok(v.length<=70);assert.ok(!/[\uD800-\uDBFF]$/.test(v));reconstructed+=v;}
  assert.equal(reconstructed,summary);assert.ok(first.pageCount>1);
});
test("PAR acknowledgment and RPCSP count map into their own original forms",async()=>{
  const par=await loadFormTemplate("par");const p=values(mapAutofill(par.description,{...record,kind:"acknowledgment"},1));
  assert.equal(p["0:9:4"],"PROP-01");assert.equal(p["0:31:1"],"New Custodian");assert.equal(p["0:31:4"],"");
  const semi=await loadFormTemplate("rpcsp");const r=mapAutofill(semi.description,{...record,kind:"physical-count",rows:[{...record.rows[0],classification:"SEMI_EXPENDABLE",onHand:0,cost:500}]},1);
  assert.equal(values(r)["0:C14"],"PROP-01");assert.equal(values(r)["0:I14"],"500");
  const {data}=await generateFormExport("rpcsp",semi.description.version,[],r.changes);assert.ok(data.length>0);
});
test("only approved/completed transactions get approver data from the source",async()=>{
  const {description}=await loadFormTemplate("ptr");const v=values(mapAutofill(description,{...record,status:"PENDING"},1));
  assert.equal(v["0:46:2"],"");assert.equal(v["0:48:2"],"");
});

test("deselecting an automatic receiver clears it without restoring sample data",async()=>{
  const {description}=await loadFormTemplate("ics");
  const p=mapAutofill(description,{...record,kind:"acknowledgment",rows:[{...record.rows[0],classification:"SEMI_EXPENDABLE"}]},1);
  const safe=applyAutomaticExclusions("ics",p,["0:F21"]);
  assert.equal(safe.find(c=>c.fieldId==="0:F21")?.value,"");
  const {data}=await generateFormExport("ics",description.version,[],safe);
  const xml=await (await JSZip.loadAsync(data)).file("xl/worksheets/sheet1.xml")!.async("string");
  assert.match(xml,/<c r="F21"[^>]*>.*?<t xml:space="preserve"><\/t>/);
  assert.throws(()=>applyAutomaticExclusions("ics",p,["0:D11"]),/excluded/);
  assert.throws(()=>applyAutomaticExclusions("ics",p,["not-a-field"]),/excluded/);
  assert.throws(()=>applyAutomaticExclusions("ics",p,["0:F21","0:F21"]),/excluded/);
});

test("review metadata distinguishes snapshots, live values and missing information",async()=>{
  const {description}=await loadFormTemplate("par");
  const p=mapAutofill(description,{...record,kind:"acknowledgment",identitySource:"receipt-snapshot"},1);
  assert.equal(p.fieldReview?.find(f=>f.fieldId==="0:31:1")?.source,"receipt-snapshot");
  assert.equal(p.fieldReview?.find(f=>f.fieldId==="0:9:6")?.source,"current-inventory");
  assert.equal(p.fieldReview?.find(f=>f.fieldId==="0:31:4")?.state,"missing");
  const zero=mapAutofill(description,{...record,kind:"acknowledgment",rows:[{...record.rows[0],cost:0}]},1);
  assert.equal(values(zero)["0:9:6"],"0");
  assert.equal(zero.fieldReview?.find(f=>f.fieldId==="0:9:6")?.state,"automatic");
});


test("automatic description fields contain only the exact saved description across spreadsheet purposes",async()=>{
  const fields:Record<string,string>={rpcppe:"0:15:4",rpcsp:"0:B14",return:"0:B10",itr:"0:12:4",ics:"0:E11",par:"0:9:3",ptr:"0:18:4"};
  const saved="Receiver cabinet for College of Science\nManufactured 2024 — LED illumination";
  for(const [id,field] of Object.entries(fields)){
    const {description}=await loadFormTemplate(id);
    const r={...record,kind:formPurpose(id).id,rows:[{...record.rows[0],classification:formClassification(id)??"PPE",description:saved,onHand:1}]};
    assert.equal(values(mapAutofill(description,r,1,true))[field],saved,id);
  }
});

test("missing and whitespace-only descriptions stay blank without substituting the name",async()=>{
  const {description}=await loadFormTemplate("par");
  for(const actual of [undefined,null,""," \n\t "]){
    const p=mapAutofill(description,{...record,kind:"acknowledgment",rows:[{...record.rows[0],description:actual,cost:0}]},1);
    assert.equal(values(p)["0:9:3"],"");assert.equal(values(p)["0:9:6"],"0");
  }
});

test("field review excludes unused item rows and ICS acquired-date sample cells",async()=>{
  const par=await loadFormTemplate("par");
  const p=mapAutofill(par.description,{...record,kind:"acknowledgment"},1);
  assert.ok(p.fieldReview?.some(f=>f.fieldId==="0:9:3"));assert.ok(!p.fieldReview?.some(f=>f.fieldId==="0:10:3"));
  const ics=await loadFormTemplate("ics"),plan=mapAutofill(ics.description,{...record,kind:"acknowledgment",rows:[{...record.rows[0],classification:"SEMI_EXPENDABLE"}]},1);
  assert.equal(values(plan)["0:E11"],"Desktop workstation");assert.equal(values(plan)["0:E39"],"Desktop workstation");
  assert.ok(!plan.fieldReview?.some(f=>["0:E15","0:E43"].includes(f.fieldId)));
  assert.ok(!plan.changes.some(c=>["0:E15","0:E43"].includes(c.fieldId)&&c.value));
});
