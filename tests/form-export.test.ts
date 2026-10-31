import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import * as CFB from "cfb";
import { FORM_TEMPLATES,formUnitScope,validateFormChanges } from "../src/lib/form-templates";
import { loadFormTemplate,generateFormExport } from "../src/lib/form-template-engine";
import { readBiff } from "../src/lib/biff-template";
import { DOMParser } from "@xmldom/xmldom";

for(const template of FORM_TEMPLATES){
  test(`${template.id}: no selected fields returns byte-identical original`,async()=>{
    const {source,description}=await loadFormTemplate(template.id);
    assert.ok(description.fields.length>0);
    const result=await generateFormExport(template.id,description.version,[]);
    assert.deepEqual(result.data,source);
  });
  test(`${template.id}: selected field changes without altering unrelated content`,async()=>{
    const {source,description}=await loadFormTemplate(template.id);
    const field=description.fields.find(f=>!f.original.trim())??description.fields[0];
    const value="History & <record> Ñ 2026";
    const {data}=await generateFormExport(template.id,description.version,[{fieldId:field.id,value}]);
    if(template.filename.endsWith(".xls")){
      const before=readBiff(source),after=readBiff(data);
      const [si,row,col]=field.id.split(":").map(Number);
      assert.equal(after.sheets[si].cells.get(`${row}:${col}`)?.text,value);
      assert.deepEqual(after.sheets.map(s=>s.merges),before.sheets.map(s=>s.merges));
      for(let i=0;i<before.sheets.length;i++)for(const [key,cell]of before.sheets[i].cells){
        if(i===si&&key===`${row}:${col}`)continue;
        assert.deepEqual(after.sheets[i].cells.get(key),cell,`unselected ${key}`);
      }
      // Every opaque record, including all drawing and print records, is unchanged.
      const exempt=new Set([0x201,0xbe,0xfd,0x203,0x204,0x27e,0x85,0x20b,0xd7]);
      assert.deepEqual(after.entries.filter(r=>!exempt.has(r.type)).map(r=>[r.type,r.data]),before.entries.filter(r=>!exempt.has(r.type)).map(r=>[r.type,r.data]));
      for(let i=0;i<before.container.FileIndex.length;i++){
        const entry=before.container.FileIndex[i];if(entry.type!==2||entry.name==="Workbook")continue;
        assert.deepEqual(Buffer.from(CFB.find(after.container,before.container.FullPaths[i])!.content),Buffer.from(entry.content));
      }
    }else{
      const before=await JSZip.loadAsync(source),after=await JSZip.loadAsync(data);
      const part=template.filename.endsWith(".docx")?"word/document.xml":`xl/worksheets/sheet${+field.id.split(":")[0]+1}.xml`;
      assert.deepEqual(Object.keys(after.files),Object.keys(before.files));
      for(const name of Object.keys(before.files))if(name!==part&&!before.files[name].dir)assert.deepEqual(await after.file(name)!.async("nodebuffer"),await before.file(name)!.async("nodebuffer"),name);
      const xml=await after.file(part)!.async("string");
      assert.ok(xml.includes("History &amp; &lt;record&gt; Ñ 2026"));
      const original=await before.file(part)!.async("string");
      if(template.filename.endsWith(".xlsx")){
        const address=field.id.split(":")[1];
        const cell=new RegExp(`<c\\b(?=[^>]*\\br="${address}")[^>]*?(?:\\s*/>|>[\\s\\S]*?</c>)`);
        assert.equal(xml.replace(cell,"SELECTED"),original.replace(cell,"SELECTED"));
      }else{
        // Only a new run is inserted into the chosen empty paragraph.
        assert.equal(xml.replace(/<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:t xml:space="preserve">History &amp; &lt;record&gt; Ñ 2026<\/w:t><\/w:r>/,""),original);
      }
    }
  });
}
test("template version, unknown fields, duplicates, excessive values and invalid control text are rejected",async()=>{
  const {description}=await loadFormTemplate("ics");const field=description.fields[0];
  for(const changes of [[{fieldId:"../path",value:"bad"}],[{fieldId:field.id,value:"a"},{fieldId:field.id,value:"b"}],[{fieldId:field.id,value:"a".repeat(181)}],[{fieldId:field.id,value:"\u0000"}]])assert.throws(()=>validateFormChanges(description,changes));
  await assert.rejects(generateFormExport("ics","stale",[]),/reference changed/);
  await assert.rejects(loadFormTemplate("../../secret"),/Unknown form/);
});
test("ICS formulas, their input cells, and merged continuation cells cannot be edited",async()=>{
  const {description}=await loadFormTemplate("ics");
  for(const fieldId of ["0:D11","0:A11","0:C11","0:F11"]){assert.ok(!description.fields.some(f=>f.id===fieldId));assert.throws(()=>validateFormChanges(description,[{fieldId,value:"x"}]));}
});
test("deselecting excludes a change; explicit empty text clears only that cell",async()=>{
  const {description}=await loadFormTemplate("par");
  assert.deepEqual(validateFormChanges(description,[]),[]);
  const field=description.fields.find(f=>f.original)!;
  const {data}=await generateFormExport("par",description.version,[{fieldId:field.id,value:""}]);
  const [si,row,col]=field.id.split(":").map(Number);
  assert.equal(readBiff(data).sheets[si].cells.get(`${row}:${col}`)?.text,"");
});
test("custodian scope is forced server-side and missing assignments fail closed",()=>{
  assert.equal(formUnitScope({role:"CUSTODIAN",unitId:"own"},"other"),"own");
  assert.throws(()=>formUnitScope({role:"CUSTODIAN"},"ALL"),/No operating unit/);
  assert.equal(formUnitScope({role:"ADMIN"},"chosen"),"chosen");
  assert.throws(()=>formUnitScope({role:"unknown"}),/Access denied/);
});
test("multiple selected fields across sheets and document copies are all applied",async()=>{
  for(const id of ["return","information","ptr"]){
    const {description}=await loadFormTemplate(id);
    const changes=description.fields.map((field,i)=>({fieldId:field.id,value:`Field ${i} & value`}));
    const {data}=await generateFormExport(id,description.version,changes);
    if(id==="ptr"){
      const {sheets}=readBiff(data);
      for(const c of changes){const [si,row,col]=c.fieldId.split(":").map(Number);assert.equal(sheets[si].cells.get(`${row}:${col}`)?.text,c.value);}
    }else{
      const zip=await JSZip.loadAsync(data);
      const ns=id==="information"?"http://schemas.openxmlformats.org/wordprocessingml/2006/main":"http://schemas.openxmlformats.org/spreadsheetml/2006/main";
      if(id==="information"){
        const doc=new DOMParser().parseFromString(await zip.file("word/document.xml")!.async("string"),"application/xml");
        for(const c of changes){const [ti,ri,ci]=c.fieldId.split(":").map(Number);const cell=doc.getElementsByTagNameNS(ns,"tbl")[ti].getElementsByTagNameNS(ns,"tr")[ri].getElementsByTagNameNS(ns,"tc")[ci];assert.equal(Array.from(cell.getElementsByTagNameNS(ns,"t")).map(t=>t.textContent).join(""),c.value);}
      }else for(const si of [0,1]){
        const doc=new DOMParser().parseFromString(await zip.file(`xl/worksheets/sheet${si+1}.xml`)!.async("string"),"application/xml");
        for(const c of changes.filter(c=>+c.fieldId.split(":")[0]===si)){const address=c.fieldId.split(":")[1];const cell=Array.from(doc.getElementsByTagNameNS(ns,"c")).find(c=>c.getAttribute("r")===address)!;assert.equal(cell.textContent,c.value);}
      }
    }
  }
});
