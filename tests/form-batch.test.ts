import test from "node:test";
import assert from "node:assert/strict";
import { buildAutofillBatch, mapAutofillBatchPage } from "../src/lib/form-autofill-batch";
import { mapAutofill, type AutofillRecord } from "../src/lib/form-autofill-mapping";
import { loadFormTemplate, generateFormExport } from "../src/lib/form-template-engine";
import { readBiff } from "../src/lib/biff-template";
import JSZip from "jszip";

function record(i:number,kind:AutofillRecord["kind"]="acknowledgment",group="person-1"):AutofillRecord {
  return {id:`record-${i}`,groupKey:group,label:`Record ${i}`,kind,date:"2026-10-30",status:kind==="transfer"?"PENDING":"RECEIVED",toName:"Receiver",toUnit:"College of Science",fromName:"Sender",fromUnit:"AMO",rows:[{assetId:`a-${i}`,propertyNo:`PROP-${i}`,name:`Product ${i}`,description:`Description ${i}`,classification:"PPE",cost:1000+i,acquired:"2026-01-01",category:"Equipment",condition:"GOOD",unitName:"College of Science"}]};
}
const values=(p:ReturnType<typeof mapAutofill>)=>Object.fromEntries(p.changes.map(c=>[c.fieldId,c.value]));

test("all compatible PAR records populate different item rows in one document",async()=>{
  const batch=buildAutofillBatch("par",[record(1),record(2),record(3)]);
  assert.equal(batch.pages.length,1);assert.equal(batch.recordCount,3);
  const {description}=await loadFormTemplate("par");
  const p=mapAutofillBatchPage(description,batch,1),v=values(p);
  assert.equal(v["0:9:4"],"PROP-1");assert.equal(v["0:10:4"],"PROP-2");assert.equal(v["0:11:4"],"PROP-3");
  assert.equal(p.totalRowCount,3);assert.equal(p.rowCount,3);
  const output=await generateFormExport("par",description.version,[],p.changes);
  assert.equal(readBiff(output.data).sheets[0].cells.get("11:4")?.text,"PROP-3");
});

test("PTR and ITR fill multiple products and overflow without dropping transactions",async()=>{
  for(const [id,capacity,start,classification] of [["ptr",20,18,"PPE"],["itr",17,12,"SEMI_EXPENDABLE"]] as const){
    const records=Array.from({length:capacity+1},(_,i)=>({...record(i,"transfer"),rows:[{...record(i).rows[0],classification}]}));
    const batch=buildAutofillBatch(id,records),{description}=await loadFormTemplate(id);
    assert.equal(batch.pages.length,2);
    const first=mapAutofillBatchPage(description,batch,1),last=mapAutofillBatchPage(description,batch,2);
    assert.equal(first.rowCount,capacity);assert.equal(last.rowCount,1);
    assert.equal(values(first)[`0:${start+1}:2`],"PROP-1");assert.equal(values(last)[`0:${start}:2`],`PROP-${capacity}`);
    await generateFormExport(id,description.version,[],first.changes);
  }
});

test("incompatible recipients, statuses, dates and classifications stay in separate forms",()=>{
  const records=[record(1),record(2,"acknowledgment","another-person-id"),{...record(3),date:"2026-10-29"},{...record(4),status:"DIFFERENT"}];
  assert.equal(buildAutofillBatch("par",records).groups.length,4);
  const returns=[{...record(1,"return"),status:"APPROVED"},{...record(2,"return"),status:"APPROVED",rows:[{...record(2).rows[0],classification:"SEMI_EXPENDABLE"}]}];
  assert.equal(buildAutofillBatch("return",returns).groups.length,2);
});

test("separate transactions involving the same asset are not collapsed",()=>{
  const first=record(1,"transfer"),second={...record(2,"transfer"),rows:first.rows};
  const batch=buildAutofillBatch("ptr",[first,second]);
  assert.equal(batch.rowCount,2);assert.equal(batch.groups[0].rows.length,2);
});

test("batch version covers every record, including records outside the current page",()=>{
  const records=Array.from({length:21},(_,i)=>record(i,"transfer"));
  const before=buildAutofillBatch("ptr",records);
  const changed=records.map((r,i)=>i===20?{...r,rows:[{...r.rows[0],cost:42}]}:r);
  assert.notEqual(before.sourceVersion,buildAutofillBatch("ptr",changed).sourceVersion);
  assert.notEqual(before.sourceVersion,buildAutofillBatch("ptr",records.slice(0,-1)).sourceVersion);
  assert.equal(before.sourceVersion,buildAutofillBatch("ptr",records.toReversed()).sourceVersion);
});

test("both return classifications use multiple rows and preserve the other sheet",async()=>{
  const {description}=await loadFormTemplate("return");
  for(const [classification,sheet,start] of [["PPE",0,10],["SEMI_EXPENDABLE",1,8]] as const){
    const records=[1,2].map(i=>({...record(i,"return"),status:"APPROVED",remarks:`Reason ${i}`,rows:[{...record(i).rows[0],classification}]}));
    const p=mapAutofillBatchPage(description,buildAutofillBatch("return",records),1);
    assert.equal(p.rowCount,2);assert.ok(p.changes.every(c=>c.fieldId.startsWith(`${sheet}:`)));
    assert.match(values(p)[`${sheet}:${sheet===0?"B":"A"}${start+1}`],/Description 2/);
    assert.equal(values(p)[`${sheet}:${sheet===0?"F":"E"}${start+1}`],"Reason 2");
    await generateFormExport("return",description.version,[],p.changes);
  }
});

test("ICS batches include every product on original-form pages and both copies agree",async()=>{
  const records=[1,2].map(i=>({...record(i),rows:[{...record(i).rows[0],classification:"SEMI_EXPENDABLE"}]}));
  const batch=buildAutofillBatch("ics",records),{description}=await loadFormTemplate("ics");
  assert.equal(batch.pages.length,2);
  const p=mapAutofillBatchPage(description,batch,2);
  assert.equal(values(p)["0:G11"],"PROP-2");assert.equal(values(p)["0:G39"],"PROP-2");
  const output=await generateFormExport("ics",description.version,[],p.changes);
  assert.ok((await JSZip.loadAsync(output.data)).file("xl/worksheets/sheet1.xml"));
});

test("empty, oversized and duplicate batches fail explicitly",()=>{
  assert.throws(()=>buildAutofillBatch("par",[]),/No matching/);
  assert.throws(()=>buildAutofillBatch("par",[record(1),record(1)]),/Duplicate/);
  assert.equal(buildAutofillBatch("par",Array.from({length:101},(_,i)=>record(i,"acknowledgment",`person-${i}`))).recordCount,101);
  assert.throws(()=>buildAutofillBatch("par",[{...record(1),rows:Array(100001).fill(record(1).rows[0])}]),/100,000/);
});


test("history previews allow both classifications in the same selection",async()=>{
  const records=[{...record(1,"information"),summary:"PPE history"},{...record(2,"information"),summary:"Semi history",rows:[{...record(2).rows[0],classification:"SEMI_EXPENDABLE"}]}];
  const batch=buildAutofillBatch("information",records),{description}=await loadFormTemplate("information");
  assert.equal(mapAutofillBatchPage(description,batch,1).recordCount,2);
});
