import test from "node:test";
import assert from "node:assert/strict";
import { resolveExportTemplate,exportTemplateIds,validateCollectionScope } from "../src/lib/form-collections";
import { validateReportScope } from "../src/lib/report-sections";
import { classificationWhere } from "../src/lib/classification-filter";
import { buildFormCollection, mapFormCollectionPage } from "../src/lib/form-collection-engine";
import { loadFormTemplate } from "../src/lib/form-template-engine";
import { generateFormExport } from "../src/lib/form-template-engine";
import type { AutofillRecord } from "../src/lib/form-autofill-mapping";

const record=(id:string,classification:string):AutofillRecord=>({id,groupKey:"person",label:id,kind:"acknowledgment",date:"",status:"IN_USE",toName:"Receiver",rows:[{assetId:id,propertyNo:id,name:id,classification,cost:2000,acquired:"2026-01-01",category:"Equipment",condition:"GOOD",unitName:"College of Science"}]});

test("All classifications resolves both original variants for every paired purpose",()=>{
  assert.equal(resolveExportTemplate("par","acknowledgment","ALL"),"all-acknowledgment");
  assert.equal(resolveExportTemplate("","transfer","ALL"),"all-transfer");
  assert.equal(resolveExportTemplate("rpcsp","physical-count","ALL"),"all-physical-count");
  assert.deepEqual(exportTemplateIds("all-acknowledgment"),["par","ics"]);
  assert.equal(resolveExportTemplate("par","acknowledgment","PPE"),"par");
  assert.throws(()=>validateCollectionScope("all-transfer","PPE"),/All classifications/);
});

test("combined forms retain report compatibility and purpose-specific filters",()=>{
  assert.doesNotThrow(()=>validateReportScope({reportSection:"physical-inventory",sessionId:"s",classification:"ALL"},"all-physical-count"));
  assert.throws(()=>validateReportScope({reportSection:"transfers"},"all-acknowledgment"),/compatible/);
  assert.throws(()=>validateReportScope({reportSection:"transfers",personId:"p"},"all-transfer"),/Person/);
});

test("ALL, empty and omitted classification never produce a literal database filter",()=>{
  for(const value of ["ALL","",undefined,null])assert.deepEqual(classificationWhere(value),{});
  assert.deepEqual(classificationWhere("PPE"),{classification:"PPE"});
  assert.deepEqual(classificationWhere("SEMI_EXPENDABLE"),{classification:"SEMI_EXPENDABLE"});
  assert.throws(()=>classificationWhere("unknown"),/valid classification/);
});

test("combined previews and global pages retain both classifications and original fields",async()=>{
  const par=await loadFormTemplate("par"),ics=await loadFormTemplate("ics");
  const combined=buildFormCollection("all-acknowledgment",[
    {form:par.description,records:[record("ppe","PPE")]},
    {form:ics.description,records:[record("semi-1","SEMI_EXPENDABLE"),record("semi-2","SEMI_EXPENDABLE")]},
  ]);
  assert.equal(combined.recordCount,3);assert.equal(combined.pageCount,3);
  const first=mapFormCollectionPage(combined,1),last=mapFormCollectionPage(combined,3);
  assert.equal(first.form?.templateId,"par");assert.equal(last.form?.templateId,"ics");
  assert.equal(last.changes.find(c=>c.fieldId==="0:G11")?.value,"semi-2");
  assert.equal(last.totalRowCount,3);assert.equal(last.referenceVersion,combined.version);
});

test("an empty classification remains explicit and new records invalidate the whole preview",async()=>{
  const par=await loadFormTemplate("par"),ics=await loadFormTemplate("ics");
  const emptySemi=buildFormCollection("all-acknowledgment",[{form:par.description,records:[record("ppe","PPE")]},{form:ics.description,records:[]}]);
  const addedSemi=buildFormCollection("all-acknowledgment",[{form:par.description,records:[record("ppe","PPE")]},{form:ics.description,records:[record("semi","SEMI_EXPENDABLE")]}]);
  assert.notEqual(emptySemi.sourceVersion,addedSemi.sourceVersion);
  assert.equal(emptySemi.pageCount,1);assert.equal(emptySemi.variants[1].recordCount,0);
  assert.throws(()=>mapFormCollectionPage(addedSemi,3),/available/);
});

test("physical count and transfer collections generate both correct native forms",async()=>{
  for(const [id,ppe,semi,kind] of [["all-transfer","ptr","itr","transfer"],["all-physical-count","rpcppe","rpcsp","physical-count"]] as const){
    const first=await loadFormTemplate(ppe),second=await loadFormTemplate(semi);
    const a={...record("ppe","PPE"),kind},b={...record("semi","SEMI_EXPENDABLE"),kind};
    const combined=buildFormCollection(id,[{form:first.description,records:[a]},{form:second.description,records:[b]}]);
    const p1=mapFormCollectionPage(combined,1),p2=mapFormCollectionPage(combined,2);
    assert.equal(p1.form?.templateId,ppe);assert.equal(p2.form?.templateId,semi);
    for(const plan of [p1,p2])assert.ok((await generateFormExport(plan.form!.templateId,plan.form!.version,[],plan.changes)).data.length>0);
  }
});
