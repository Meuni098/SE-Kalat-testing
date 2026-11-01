"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { REPORT_SECTIONS,compatibleExportTemplates,reportSection,type ReportSection } from "@/lib/report-sections";
import { exportPurpose,resolveExportTemplate,formCollection } from "@/lib/form-collections";
import { DocumentLayoutPreviewPanel } from "./document-layout-preview";
import type { DocumentPrintPreview } from "@/lib/document-print-preview-types";
import { Button } from "@/components/ui/button";
import { FORM_PURPOSES,formClassification,type FormDescription,type AutofillPreview,type AutofillOption } from "@/lib/form-templates";

type SelectionMode="all"|"single";
interface Options {categories:{id:string;name:string}[];units:{id:string;code:string;name?:string}[];unitId:string;unitLocked:boolean;persons:{id:string;fullName:string;employeeNo:string;unit:{code:string}}[];sessions:{id:string;title:string;status:string}[]}
interface Scope {categoryId:string;unitId:string;classification:string;reportSection?:ReportSection;personId?:string;sessionId?:string;status?:string;eventType?:string;eventId?:string}
interface Props {defaultCategoryId?:string;defaultUnitId?:string;defaultClassification?:string;label?:string;reportSection?:ReportSection;defaultTemplateId?:string;defaultRecordId?:string;defaultEventId?:string}
const valueMap=(plan:AutofillPreview|null)=>Object.fromEntries(plan?.changes.map(c=>[c.fieldId,c.value])??[]);
export function ReferenceFormExport({defaultCategoryId,defaultUnitId,defaultClassification,reportSection:sectionProp,defaultTemplateId,defaultRecordId,defaultEventId,label="Export official document"}:Props={}) {
  const router=useRouter();
  const [layoutPreview,setLayoutPreview]=React.useState<{key:string;document:DocumentPrintPreview;original:boolean}|null>(null);
  const sourceScopeChanged=React.useRef(false);
  const [open,setOpen]=React.useState(false),[id,setId]=React.useState<string>("");
  const [selectionMode,setSelectionMode]=React.useState<SelectionMode>("all");
  const [purposeId,setPurposeId]=React.useState<string>("acknowledgment");
  const [referenceVersion,setReferenceVersion]=React.useState("");
  const [form,setForm]=React.useState<FormDescription|null>(null),[options,setOptions]=React.useState<Options|null>(null);
  const [scope,setScope]=React.useState<Scope>({categoryId:"ALL",unitId:"ALL",classification:"ALL"});
  const [records,setRecords]=React.useState<AutofillOption[]>([]),[recordQuery,setRecordQuery]=React.useState("");
  const [plan,setPlan]=React.useState<AutofillPreview|null>(null);
  const [draft,setDraft]=React.useState<Record<string,string>>({}),[applied,setApplied]=React.useState<Record<string,string>>({});
  const [section,setSection]=React.useState(""),[busy,setBusy]=React.useState(false);
  const [recovery,setRecovery]=React.useState<{version:string;values:Record<string,string>}|null>(null);
  const [stale,setStale]=React.useState(false);
  const [error,setError]=React.useState(""),[status,setStatus]=React.useState("");
  const [discardPrompt,setDiscardPrompt]=React.useState(false);
  const pendingSelection=React.useRef<(()=>void)|null>(null),discardApproved=React.useRef(false),keepEditing=React.useRef<HTMLButtonElement>(null);
  const generation=React.useRef(0),dialog=React.useRef<HTMLDialogElement>(null),trigger=React.useRef<HTMLSpanElement>(null);
  const retry=React.useRef<(()=>void)|null>(null);
  React.useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  function clearValues(){setLayoutPreview(null);setStale(false);setPlan(null);setDraft({});setApplied({});setError("");setStatus("");}
  React.useEffect(()=>{if(discardPrompt)keepEditing.current?.focus();},[discardPrompt]);
  function mayDiscard(next:()=>void){
    if(discardApproved.current){discardApproved.current=false;return true;}
    if(JSON.stringify(draft)===JSON.stringify(applied)&&JSON.stringify(applied)===JSON.stringify(valueMap(plan)))return true;
    pendingSelection.current=next;setDiscardPrompt(true);return false;
  }
  function close(){if(!mayDiscard(close))return;setDiscardPrompt(false);pendingSelection.current=null;setRecovery(null);generation.current++;setOpen(false);clearValues();setRecords([]);setBusy(false);trigger.current?.querySelector("button")?.focus();if(sourceScopeChanged.current){sourceScopeChanged.current=false;router.refresh();}}
  async function json(response:Response){const data=await response.json();if(!response.ok){if(response.status===409){setStale(true);
      const auto=valueMap(plan),values=Object.fromEntries(Object.entries(draft).filter(([key,value])=>value!==auto[key]));
      for(const key of Object.keys(auto))if(!Object.hasOwn(draft,key))values[key]="";
      if(Object.keys(values).length)setRecovery({version:form?.version??"",values});
      retry.current=()=>void load(id);
    }
    if(response.status===401||response.status===403){setLayoutPreview(null);setPlan(null);setDraft({});setApplied({});}throw new Error(data.error||"The form could not be prepared. Please retry.");}return data;}
  async function post(body:object){return json(await fetch("/api/export/forms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));}
  async function populate(templateId:string,recordId:string,page:number,currentScope:Scope,request:number,mode:SelectionMode=selectionMode){
    const next:AutofillPreview=await post({action:"autofill",templateId,selection:mode,...(mode==="single"?{recordId}:{}),page,...currentScope});
    if(request!==generation.current)return;
    if(next.form){setForm(next.form);setSection(next.form.fields[0]?.section??"");}
    if(next.referenceVersion)setReferenceVersion(next.referenceVersion);
    setPlan(next);setDraft(valueMap(next));setApplied(valueMap(next));setStatus(mode==="all"?`Automatically included all ${next.recordCount} matching records (${next.totalRowCount} items) in the supplied template. Review before downloading.`:`Automatically populated ${next.rowCount} item${next.rowCount===1?"":"s"} on page ${next.page} of ${next.pageCount}. Review the values before downloading.`);
  }
  React.useEffect(()=>{
    const restore=()=>{generation.current++;setOpen(false);setPlan(null);setDraft({});setApplied({});setRecords([]);setBusy(false);setDiscardPrompt(false);pendingSelection.current=null;};
    window.addEventListener("popstate",restore);return ()=>window.removeEventListener("popstate",restore);
  },[]);
  function remember(templateId:string,current:Scope,recordId?:string,mode:SelectionMode=selectionMode){
    const params=new URLSearchParams(window.location.search);
    if((["categoryId","unitId","classification","personId"] as const).some(key=>(params.get(key)||"ALL")!==(current[key]||"ALL")))sourceScopeChanged.current=true;
    for(const key of ["categoryId","unitId","classification","reportSection","personId","sessionId","status","eventType","eventId","recordId","templateId","selection"])params.delete(key);
    for(const [key,value] of Object.entries(current))if(value&&value!=="ALL")params.set(key,value);
    if(templateId)params.set("templateId",templateId);
    params.set("selection",mode);
    if(recordId&&mode==="single")params.set("recordId",recordId);
    window.history.replaceState(null,"",`${window.location.pathname}?${params}`);
  }
  async function load(templateId:string,initial=false,nextScope?:Scope,nextPurpose?:string,nextMode?:SelectionMode){
    if(!initial&&!mayDiscard(()=>void load(templateId,initial,nextScope,nextPurpose,nextMode)))return;
    retry.current=()=>void load(templateId,initial,nextScope,nextPurpose,nextMode);
    const request=++generation.current;setBusy(true);setId(templateId);setForm(null);setRecords([]);setRecordQuery("");clearValues();
    try{
      let current=nextScope??scope;
      const params=new URLSearchParams(window.location.search);
      const mode=nextMode??(initial?(defaultRecordId||params.get("recordId")||defaultEventId||params.get("eventId")||params.get("selection")==="single"?"single":"all"):nextScope?"all":selectionMode);
      setSelectionMode(mode);
      if(initial){
        current={categoryId:params.get("categoryId")||defaultCategoryId||"ALL",unitId:params.get("unitId")||defaultUnitId||"ALL",classification:params.get("classification")||defaultClassification||"ALL",reportSection:sectionProp||reportSection(params.get("reportSection")),personId:params.get("personId")||undefined,sessionId:params.get("sessionId")||undefined,status:params.get("status")||undefined,eventType:params.get("eventType")||undefined,eventId:defaultEventId||params.get("eventId")||undefined};
      }
      const metadata=new URLSearchParams();
      if(current.reportSection)metadata.set("reportSection",current.reportSection);
      metadata.set("unitId",current.unitId);
      const opts:Options=await json(await fetch(`/api/export/forms?${metadata}`,{cache:"no-store"}));
      if(request!==generation.current)return;
      setOptions(opts);if(opts.unitLocked)current={...current,unitId:opts.unitId};
      const desiredPurpose=nextPurpose??(initial?(templateId?exportPurpose(templateId):REPORT_SECTIONS.find(s=>s.id===current.reportSection)?.defaultPurpose):purposeId)??"acknowledgment";
      setPurposeId(desiredPurpose);
      if(mode==="single"&&templateId&&!formCollection(templateId)&&formClassification(templateId)&&current.classification==="ALL")current={...current,classification:formClassification(templateId)!};
      templateId=resolveExportTemplate(templateId,desiredPurpose,current.classification);
      const allowed=compatibleExportTemplates(current.reportSection,current.classification).filter(t=>exportPurpose(t.id)===desiredPurpose);
      if(!templateId&&allowed.length===1)templateId=allowed[0].id;
      setScope(current);setId(templateId);
      if(!templateId){setStatus("Choose a document form to continue.");remember("",current,undefined,mode);return;}
      const description:FormDescription=await json(await fetch(`/api/export/forms?templateId=${encodeURIComponent(templateId)}&${metadata}&classification=${encodeURIComponent(current.classification)}`,{cache:"no-store"}));
      if(request!==generation.current)return;setForm(description);setReferenceVersion(description.version);setSection(description.fields[0]?.section??"");
      if(templateId==="information"){setStatus("Document Requests: fill the requestor, document details and purpose in the fields below. Asset history is not inserted into this form.");remember(templateId,current,undefined,mode);return;}
      const data:{records:AutofillOption[]}=await post({action:"autofill-options",templateId,selection:mode,...current});
      if(request!==generation.current)return;setRecords(data.records);
      const requestedRecord=initial&&mode==="single"?(defaultRecordId||params.get("recordId")):undefined;
      if(requestedRecord&&!data.records.some(r=>r.id===requestedRecord))throw new Error("The linked record is unavailable in this report scope. Choose a matching record.");
      const selected=requestedRecord||(data.records.length===1?data.records[0].id:undefined);
      remember(templateId,current,selected,mode);
      if(mode==="all"&&data.records.length)await populate(templateId,"",1,current,request,mode);
      else if(selected)await populate(templateId,selected,1,current,request,mode);
    }catch(e){if(request===generation.current)setError(e instanceof Error?e.message:"Could not load the matching form.");}
    finally{if(request===generation.current)setBusy(false);}
  }
  async function selectRecord(recordId:string,page=1){
    if(!mayDiscard(()=>void selectRecord(recordId,page)))return;
    retry.current=()=>void selectRecord(recordId,page);
    const request=++generation.current;clearValues();if(!recordId)return;setBusy(true);
    try{await populate(id,recordId,page,scope,request);if(request===generation.current)remember(id,scope,recordId);}catch(e){if(request===generation.current)setError(e instanceof Error?e.message:"Could not populate the form.");}
    finally{if(request===generation.current)setBusy(false);}
  }
  function apply(){
    if(!form)return;
    for(const f of form.fields){const value=draft[f.id];if(value!==undefined&&value.length>f.maxLength){setError(`${f.label} exceeds ${f.maxLength} characters.`);return;}}
    setApplied({...draft});setError("");setStatus("Manual changes applied to the populated form.");
  }
  const automatic=valueMap(plan);
  const overrides=Object.entries(applied).filter(([fieldId,value])=>automatic[fieldId]!==value).map(([fieldId,value])=>({fieldId,value}));
  const excluded=plan?.changes.filter(c=>!Object.hasOwn(applied,c.fieldId)).map(c=>c.fieldId)??[];
  const pending=JSON.stringify(draft)!==JSON.stringify(applied);
  const manualRequest=form?.templateId==="information";
  const previewKey=JSON.stringify({id,referenceVersion,scope,plan,applied});
  async function previewDocument(original=false){
    retry.current=()=>void previewDocument(original);
    if(!form)return;const request=generation.current,key=previewKey;
    setBusy(true);setError("");setLayoutPreview(null);setStatus("Preparing document preview…");
    try{
      const document:DocumentPrintPreview=await post({action:"preview",templateId:id,version:referenceVersion||form.version,...scope,changes:original?[]:overrides,...(!original&&plan?{autofill:{selection:plan.selection??"single",...(plan.selection==="all"?{}:{recordId:plan.recordId}),sourceVersion:plan.sourceVersion,page:plan.page},excludedFields:excluded}:{})});
      if(request===generation.current){setLayoutPreview({key,document,original});setStatus(original?"Original reference layout ready.":"Complete filled document preview ready.");}
    }catch(error){if(request===generation.current){setStatus("");setError(error instanceof Error?error.message:"Could not preview the document.");}}
    finally{if(request===generation.current)setBusy(false);}
  }
  async function download(original=false){
    retry.current=()=>void download(original);
    if(!form)return;const request=generation.current;setBusy(true);setError("");setStatus("");
    try{
      const payload={action:"download",templateId:id,version:referenceVersion||form.version,...scope,changes:original?[]:overrides,...(!original&&plan?{autofill:{selection:plan.selection??"single",...(plan.selection==="all"?{}:{recordId:plan.recordId}),sourceVersion:plan.sourceVersion,page:plan.page},excludedFields:excluded}:{})};
      const response=await fetch("/api/export/forms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(!response.ok){await json(response);return;}
      const blob=await response.blob();if(request!==generation.current)return;
      const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;
      link.download=response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]??form.filename;
      document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setStatus(original?"Reference downloaded.":"Complete selection filled into the supplied template.");
    }catch(e){if(request===generation.current)setError(e instanceof Error?e.message:"Download failed. Please retry.");}
    finally{if(request===generation.current)setBusy(false);}
  }
  const purpose=FORM_PURPOSES.find(p=>p.id===purposeId)!;
  const available=compatibleExportTemplates(scope.reportSection,scope.classification);
  const purposes=FORM_PURPOSES.filter(p=>available.some(t=>exportPurpose(t.id)===p.id));
  function purposeScope(next:string):Scope{return {...scope,personId:next==="acknowledgment"?scope.personId:undefined,sessionId:next==="physical-count"?scope.sessionId:undefined,status:["transfer","return"].includes(next)?(next==="return"&&scope.status==="COMPLETED"?undefined:scope.status):undefined,eventType:next==="information"?scope.eventType:undefined,eventId:undefined};}
  const missing=plan?.fieldReview?.filter(f=>f.state==="missing")??[];
  const matches=records.filter(r=>r.label.toLowerCase().includes(recordQuery.toLowerCase()));
  const visible=matches.slice(0,300);
  if(plan&&!visible.some(r=>r.id===plan.recordId)){const selected=records.find(r=>r.id===plan.recordId);if(selected)visible.unshift(selected);}
  const fields=new Map(form?.fields.map(f=>[f.id,f])??[]);
  const activeFields=new Set(plan?.fieldReview?.map(field=>field.fieldId)??[]);
  return <>
    <span ref={trigger} className="print:hidden"><Button variant="primary" size="md" onClick={()=>{
      setOpen(true);const params=new URLSearchParams(window.location.search);const requested=defaultTemplateId||params.get("templateId")||"";
      void load(requested,true);
    }}>{label}</Button></span>
    <dialog ref={dialog} aria-labelledby="form-export-title" onCancel={e=>{e.preventDefault();close();}} onClose={()=>{if(open)close();}} className="fixed inset-0 m-auto w-[min(1100px,95vw)] max-h-[90vh] overflow-auto rounded-lg border border-border bg-white p-0 text-[#3B0A0F] shadow-xl backdrop:bg-[#3B0A0F] print:hidden">
      <div className="p-5 space-y-4">
        <fieldset disabled={discardPrompt} className="space-y-4 min-w-0">
        <div className="flex justify-between items-start gap-3"><div><h2 id="form-export-title" className="font-bold text-lg">Prepare an official document</h2></div><Button variant="secondary" size="sm" onClick={close}>Close</Button></div>
        {!manualRequest&&<label className="block text-sm font-bold">Export coverage<select aria-label="Export coverage" className="block border rounded p-2 w-full mt-1" value={selectionMode} disabled={busy} onChange={e=>void load(id,false,{...scope,eventId:undefined},undefined,e.target.value==="single"?"single":"all")}><option value="all">All matching records (automatic)</option><option value="single">One transaction / session</option></select></label>}
        <div className="grid sm:grid-cols-2 gap-3">
          {purposes.length>1&&<label className="text-sm font-bold">Document purpose<select aria-label="Document purpose" className="block border rounded p-2 w-full mt-1" value={purposeId} disabled={busy} onChange={e=>void load("",false,purposeScope(e.target.value),e.target.value)}>{purposes.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
          <label className="text-sm font-bold">Original form<select aria-label="Original form" className="block border rounded p-2 w-full mt-1" value={id} disabled={busy} onChange={e=>void load(e.target.value,false,{...scope,classification:formClassification(e.target.value)??"ALL",eventId:undefined})}><option value="">Choose a document form</option>{available.filter(t=>exportPurpose(t.id)===purpose.id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        </div>
        {!manualRequest&&<div className="grid sm:grid-cols-3 gap-3 text-sm">
          <label>Product category<select aria-label="Category scope" className="block border rounded p-2 w-full mt-1" value={scope.categoryId} disabled={busy} onChange={e=>void load(id,false,{...scope,categoryId:e.target.value,eventId:undefined})}><option value="ALL">All categories</option>{options?.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>College / operating unit<select aria-label="Operating unit scope" className="block border rounded p-2 w-full mt-1" value={scope.unitId} disabled={busy||options?.unitLocked} onChange={e=>void load(id,false,{...scope,unitId:e.target.value,personId:undefined,sessionId:undefined,eventId:undefined})}>{!options?.unitLocked&&<option value="ALL">All authorized units</option>}{options?.units.map(u=><option key={u.id} value={u.id}>{u.code}{u.name?` — ${u.name}`:""}</option>)}</select></label>
          <label>Classification<select aria-label="Classification scope" className="block border rounded p-2 w-full mt-1" value={scope.classification} disabled={busy} onChange={e=>void load("",false,{...scope,classification:e.target.value,eventId:undefined})}><option value="ALL">All classifications</option><option value="PPE">PPE</option><option value="SEMI_EXPENDABLE">Semi-expendable</option></select></label>
        </div>}
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {purposeId==="acknowledgment"&&scope.reportSection&&<label>Accountable person{scope.reportSection==="accountable-person"&&selectionMode==="single"?" (required)":" (optional)"}<select aria-label="Accountable person" className="block border rounded p-2 w-full" value={scope.personId??""} disabled={busy} onChange={e=>void load(id,false,{...scope,personId:e.target.value||undefined,eventId:undefined})}><option value="">{scope.reportSection==="accountable-person"&&selectionMode==="single"?"Choose a person":"All authorized people"}</option>{options?.persons.map(p=><option key={p.id} value={p.id}>{p.fullName} · {p.employeeNo} · {p.unit.code}</option>)}</select></label>}
          {purposeId==="physical-count"&&scope.reportSection&&<label>Count session<select aria-label="Count session" className="block border rounded p-2 w-full" value={scope.sessionId??""} disabled={busy} onChange={e=>void load(id,false,{...scope,sessionId:e.target.value||undefined,eventId:undefined})}><option value="">All authorized sessions</option>{options?.sessions.map(s=><option key={s.id} value={s.id}>{s.title} · {s.status}</option>)}</select></label>}
          {["transfer","return"].includes(purposeId)&&<label>Transaction status<select aria-label="Transaction status" className="block border rounded p-2 w-full" value={scope.status??""} disabled={busy} onChange={e=>void load(id,false,{...scope,status:e.target.value||undefined,eventId:undefined})}><option value="">All supported statuses</option>{(purposeId==="transfer"?["PENDING","APPROVED","COMPLETED"]:["PENDING","APPROVED"]).map(s=><option key={s}>{s}</option>)}</select></label>}

        </div>
        {busy&&<p role="status">{status==="Preparing document preview…"?status:"Loading matching records and filling the document…"}</p>}
        {error&&<p role="alert" className="text-red-700">{error} <button type="button" className="underline" disabled={busy} onClick={()=>retry.current?.()}>Retry</button></p>}
        {status&&!busy&&<p role="status" className="text-sm">{status}</p>}
        {recovery&&<details className="border rounded p-3 text-sm"><summary>Saved manual corrections from the stale preview</summary>
          <p>Review these against the refreshed source. If the reference format changed, copy corrections into the new matching fields individually.</p>
          <ul>{Object.entries(recovery.values).map(([key,value])=><li key={key}>{fields.get(key)?.label??"Previous field"}: {value||"(blank)"}</li>)}</ul>
          <Button variant="secondary" size="sm" disabled={busy||stale||!plan||recovery.version!==form?.version} onClick={()=>{
            const next={...valueMap(plan),...recovery.values};setDraft(next);setApplied(next);setRecovery(null);setStatus("Saved manual corrections reapplied. Review before downloading.");
          }}>Reapply saved corrections</Button>
        </details>}
        {form&&<>
          <div className="flex flex-wrap gap-2 items-center"><span className="text-xs break-all">{form.filename}</span><Button variant="secondary" size="sm" disabled={busy||pending} onClick={()=>void previewDocument(true)}>Preview original</Button><Button variant="secondary" size="sm" disabled={busy} onClick={()=>void download(true)}>Download original</Button></div>
          {!manualRequest&&selectionMode==="all"&&records.length>0&&<section className="bg-cream border rounded p-3 space-y-2" aria-label="Included records">
            <p className="font-bold">All {records.length} matching records are included automatically.</p>
            <details className="text-sm"><summary className="cursor-pointer">How matching records are filled</summary><p className="mt-2">Includes every record matching this college, product category, classification, purpose and other filters. Products fill one continuous table per supplied worksheet. Descriptions contain only saved product descriptions. Unused item rows are removed, and conflicting shared receiver/date fields stay blank.</p></details>
            {plan&&<p className="text-sm">{plan.totalRowCount} items · {plan.groupCount} compatible groups · {plan.pageCount} preview sections. This section contains {plan.rowCount} items.</p>}
            <details><summary className="cursor-pointer text-sm">Review included records</summary><ul className="list-disc pl-5 text-sm">{records.slice(0,300).map(r=><li key={r.id}>{r.label}</li>)}</ul>{records.length>300&&<p className="text-xs">Showing the first 300 labels; all {records.length} records are included.</p>}</details>
            <Button variant="secondary" size="sm" disabled={busy} onClick={()=>void load(id)}>Refresh all matching records</Button>
          </section>}
          {!manualRequest&&(selectionMode==="single"&&records.length>0?<section className="bg-cream border rounded p-3 space-y-2">
            {records.length>20&&<label className="text-sm block">Find a record<input aria-label="Find a matching record" className="block border rounded p-2 w-full bg-white" value={recordQuery} onChange={e=>setRecordQuery(e.target.value)}/></label>}
            <label className="text-sm font-bold block">Matching transaction / session<select aria-label="Matching transaction or session" className="block border rounded p-2 w-full bg-white mt-1" value={plan?.recordId??""} disabled={busy} onChange={e=>void selectRecord(e.target.value)}><option value="">Choose a matching record ({matches.length})</option>{visible.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
            {matches.length>300&&<p className="text-xs">Showing the first 300 matches. Search to find another record.</p>}
            <Button variant="secondary" size="sm" disabled={busy} onClick={()=>void load(id)}>Refresh matching records</Button>
          </section>:!busy&&!records.length&&<p role="status">{scope.reportSection==="accountable-person"&&!scope.personId&&selectionMode==="single"?"Choose an accountable person to find matching records.":"No matching recorded history is available for this purpose and scope."} Choose another form or scope. Missing data will not be invented. <a className="underline" href={purposeId==="physical-count"?"/physical-inventory":purposeId==="transfer"?"/inventory/transfers":purposeId==="return"?"/inventory/returns":"/people/item-receipts"}>View source records</a></p>)}
          {plan&&<>
            <section className="space-y-2" aria-label="Automatically populated fields">
              <h3 className="font-bold">Automatically populated values</h3>
              {plan.variants&&<section aria-label="Classification coverage" className="text-sm bg-cream p-3 rounded space-y-1"><p className="font-bold">{plan.selection==="all"?"Included":"Available"} classification forms</p>{plan.variants.map(v=><p key={v.templateId}>{v.filename}: {v.recordCount} matching records · {v.rowCount} items{v.recordCount===0?" — no matching data":""}</p>)}<p>Current preview: {form.filename}. The complete download includes both populated classification sections in one workbook.</p></section>}<p className="text-sm">Draft for review · {missing.length} fields may need manual information. Names are not signatures.</p>
              {plan.pageCount>1&&<div className="flex gap-2 items-center text-sm"><Button size="sm" variant="secondary" disabled={busy||plan.page===1} onClick={()=>void selectRecord(plan.recordId,plan.page-1)}>Previous preview</Button><span>Preview section {plan.page} of {plan.pageCount}</span><Button size="sm" variant="secondary" disabled={busy||plan.page===plan.pageCount} onClick={()=>void selectRecord(plan.recordId,plan.page+1)}>Next preview</Button></div>}
              <details className="text-sm"><summary className="cursor-pointer">About these populated values</summary><p className="mt-2">Preview of field values. The download uses a compact supplied template: only selected item rows remain, with saved descriptions only. Asset descriptions, costs and condition use current inventory data; transaction dates and parties use matching recorded data for the current form group.</p></details>
              <div className="max-h-72 overflow-auto border rounded"><table className="w-full text-sm text-left"><thead><tr className="bg-cream"><th className="p-2">Field</th><th className="p-2">Populated value</th><th className="p-2">Source / state</th></tr></thead><tbody>{plan.changes.filter(c=>c.value!=="").map(c=><tr key={c.fieldId}><td className="p-2 border-t">{fields.get(c.fieldId)?.section} {fields.get(c.fieldId)?.label??({"0:A11":"Quantity (copy 1)","0:C11":"Unit cost (copy 1)","0:D11":"Total cost (copy 1)","0:C39":"Unit cost (copy 2)","0:D39":"Total cost (copy 2)","0:F26":"Received date (copy 1)","0:F54":"Received date (copy 2)"}[c.fieldId]??"Additional recorded value")}</td><td className="p-2 border-t whitespace-pre-wrap break-words">{applied[c.fieldId]??""}</td><td className="p-2 border-t">{applied[c.fieldId]!==automatic[c.fieldId]?"Manual correction":plan.fieldReview?.find(f=>f.fieldId===c.fieldId)?.source.replaceAll("-"," ")??"Recorded value"}</td></tr>)}</tbody></table></div>
              <details className="text-xs"><summary className="cursor-pointer">Fields requiring review</summary><ul className="list-disc pl-5 mt-2 space-y-1">{missing.map(f=><li key={f.fieldId}>{fields.get(f.fieldId)?.section} {fields.get(f.fieldId)?.label??f.fieldId}: missing / requires review</li>)}{plan.warnings.map(w=><li key={w}>{w}</li>)}</ul></details>
            </section>
          </>}
          <details open={manualRequest||undefined} className="border rounded p-3"><summary className="cursor-pointer text-sm font-bold">{manualRequest?"Fill document request fields":"Review or edit individual fields"}</summary>
            {manualRequest&&<p className="text-sm">Enter the copy request, apply edits, then preview. This form does not imply asset history or approval.</p>}
            {!manualRequest&&<p className="text-xs mt-2">Apply edits before exporting. Unchecked fields stay blank; formulas and totals cannot be edited.</p>}
            <label className="block text-sm my-2">Sheet / copy<select className="block border rounded p-2 w-full" value={section} onChange={e=>setSection(e.target.value)}>{Array.from(new Set(form.fields.map(f=>f.section))).map(s=><option key={s}>{s}</option>)}</select></label>
            <div className="max-h-80 overflow-auto space-y-2">{form.fields.filter(f=>f.section===section&&(!plan||activeFields.has(f.id))).map(f=>{
              const selected=Object.hasOwn(draft,f.id);
              return <div key={f.id} className="border rounded p-2"><label className="text-sm font-semibold flex gap-2"><input type="checkbox" disabled={busy} checked={selected} onChange={e=>{if(e.target.checked)setDraft(d=>({...d,[f.id]:automatic[f.id]??(plan?"":f.original)}));else{setDraft(d=>{const next={...d};delete next[f.id];return next;});setApplied(d=>{const next={...d};delete next[f.id];return next;});}}}/>{f.label}</label><p className="text-xs break-words">Original: {f.original||"(blank)"}</p>{selected&&<textarea aria-label={`${f.section} ${f.label} new value`} className="block border rounded w-full p-1 mt-1 text-sm" disabled={busy} maxLength={f.maxLength} value={draft[f.id]} onChange={e=>setDraft(d=>({...d,[f.id]:e.target.value}))}/>}</div>;
            })}</div>
            <div className="flex gap-2 flex-wrap mt-3"><Button variant="secondary" size="sm" disabled={busy} onClick={apply}>Apply manual changes</Button><Button variant="secondary" size="sm" disabled={busy} onClick={()=>{setRecovery(null);setDraft(automatic);setApplied(automatic);setError("");setStatus("Manual changes reset to the automatic values.");}}>Reset manual changes</Button></div>
          </details>
          <div className="border-t pt-3 space-y-2">
            {pending&&<p className="text-sm">Unapplied manual edits will not be exported.</p>}
            <div className="flex flex-wrap gap-2"><Button disabled={busy||stale||pending||(!plan&&!manualRequest)} onClick={()=>void previewDocument()}>Preview document</Button><Button variant="secondary" disabled={busy||stale||pending||(!plan&&(!manualRequest||!overrides.length))} onClick={()=>void download()}>Download complete document</Button></div>
            {!pending&&!stale&&layoutPreview?.key===previewKey&&<><p className="text-sm">{layoutPreview.original?"Original reference — no recorded values applied":"Complete document with applied values"}</p><DocumentLayoutPreviewPanel key={layoutPreview.key+String(layoutPreview.original)} preview={layoutPreview.document}/></>}
            <details className="text-sm"><summary className="cursor-pointer">How corrections appear in the download</summary><p className="mt-2">The supplied template contains every matching record. Row corrections follow the previewed records; header corrections apply to the whole worksheet. No additional report sheet is created.</p></details>
          </div>
        </>}
        </fieldset>
        {discardPrompt&&<section role="alertdialog" aria-labelledby="discard-report-title" className="border rounded p-4 bg-cream space-y-3">
          <h3 id="discard-report-title" className="font-bold">Discard manual changes?</h3>
          <p>Changing the selection will discard the manual changes on the current page.</p>
          <div className="flex gap-3 flex-wrap">
            <button ref={keepEditing} className="border rounded px-3 py-2" onClick={()=>{setDiscardPrompt(false);pendingSelection.current=null;}}>Keep editing</button>
            <Button variant="primary" onClick={()=>{const next=pendingSelection.current;pendingSelection.current=null;discardApproved.current=true;setDiscardPrompt(false);next?.();}}>Discard edits and continue</Button>
          </div>
        </section>}
      </div>
    </dialog>
  </>;
}
