import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getFormHistory } from "./form-history";
import { FORM_TEMPLATES,FormExportError,formClassification,formPurpose } from "./form-templates";
import { validateReportScope, type ReportScope } from "./report-sections";
import type { AutofillRecord,AutofillRow } from "./form-autofill-mapping";

const include={category:true,unit:true,accountablePerson:true} satisfies Prisma.AssetInclude;
type Asset=Prisma.AssetGetPayload<{include:typeof include}>;
export interface AutofillScope extends ReportScope {categoryId:string}
const date=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
function row(a:Asset):AutofillRow{return {assetId:a.id,propertyNo:a.propertyNo,name:a.name,description:a.description,classification:a.classification,cost:a.acquisitionCost,acquired:date(a.acquisitionDate),category:a.category.name,condition:a.condition,unitName:a.unit.name,accountableName:a.accountablePerson?.fullName,accountablePosition:a.accountablePerson?.position,usefulLife:a.category.usefulLifeYears};}
function limit<T>(rows:T[],max=5000):T[]{if(rows.length>max)throw new FormExportError("Choose a narrower category or operating unit before filling documents.","SCOPE_TOO_LARGE",422);return rows;}

/** Every option is built from an authorized source query; client record IDs are never trusted as paths or database scopes. */
async function queryAutofillRecords(templateId:string,scope:AutofillScope):Promise<AutofillRecord[]> {
  if(!FORM_TEMPLATES.some(t=>t.id===templateId))throw new FormExportError("Unknown form.","NOT_FOUND",404);
  const required=formClassification(templateId);
  if(required&&scope.classification&&scope.classification!=="ALL"&&scope.classification!==required)return [];
  const classification=required||(scope.classification!=="ALL"?scope.classification:undefined);
  const assetBase:Prisma.AssetWhereInput={isDeleted:false,...(scope.categoryId!=="ALL"?{categoryId:scope.categoryId}:{}),...(classification?{classification}:{})};
  const assetWhere:Prisma.AssetWhereInput={...assetBase,...(scope.unitId?{unitId:scope.unitId}:{})};
  const purpose=formPurpose(templateId).id;
  if(purpose==="transfer"){
    const transfers=limit(await prisma.transferRequest.findMany({where:{asset:assetBase,status:scope.status??{in:["PENDING","APPROVED","COMPLETED"]},...(scope.unitId?{OR:[{fromUnitId:scope.unitId},{toUnitId:scope.unitId}]}:{})},include:{asset:{include},fromUnit:true,toUnit:true,fromPerson:true,toPerson:true,decidedBy:true},orderBy:[{requestedAt:"desc"},{id:"asc"}],take:5001}));
    return transfers.map(t=>({id:t.id,groupKey:JSON.stringify([t.fromUnitId,t.toUnitId,t.fromPersonId,t.toPersonId,t.decidedById]),label:`${date(t.requestedAt)} · ${t.asset.propertyNo} · ${t.fromUnit.code} → ${t.toUnit.code} · ${t.status}`,kind:"transfer",date:date(t.decidedAt??t.requestedAt),status:t.status,requestedDate:date(t.requestedAt),decisionDate:t.decidedAt?date(t.decidedAt):undefined,rows:[row(t.asset)],remarks:t.remarks,fromName:t.fromPerson?.fullName,fromPosition:t.fromPerson?.position,fromUnit:t.fromUnit.name,toName:t.toPerson?.fullName,toPosition:t.toPerson?.position,toUnit:t.toUnit.name,...(["APPROVED","COMPLETED"].includes(t.status)&&t.decidedAt?{approvedBy:t.decidedBy?.name,approvedDate:date(t.decidedAt)}:{})}));
  }
  if(purpose==="return"){
    const returns=limit(await prisma.returnRequest.findMany({where:{asset:assetWhere,status:scope.status??{in:["PENDING","APPROVED"]}},include:{asset:{include}},orderBy:[{requestedAt:"desc"},{id:"asc"}],take:5001}));
    return returns.map(r=>({id:r.id,groupKey:JSON.stringify([r.asset.unitId,r.returnedBy]),label:`${date(r.requestedAt)} · ${r.asset.propertyNo} · ${r.returnedBy} · ${r.status} · ${r.asset.classification}`,kind:"return",date:date(r.decidedAt??r.requestedAt),status:r.status,requestedDate:date(r.requestedAt),decisionDate:r.decidedAt?date(r.decidedAt):undefined,fromName:r.returnedBy,remarks:r.reason,rows:[row(r.asset)]}));
  }
  if(purpose==="physical-count"){
    const entries=limit(await prisma.physicalCountEntry.findMany({where:{asset:assetWhere,...(scope.sessionId?{sessionId:scope.sessionId}:{})},include:{asset:{include},session:true},orderBy:[{countedAt:"asc"},{id:"asc"}],take:10001}),10000);
    const groups=new Map<string,{record:AutofillRecord;rows:Map<string,AutofillRow>}>();
    for(const entry of entries){
      const a=entry.asset,key=`${entry.sessionId}:${a.unitId}:${a.accountablePersonId??"unassigned"}`;
      let group=groups.get(key);
      if(!group){group={record:{id:key,label:`${entry.session.title} · ${a.unit.code} · ${a.accountablePerson?.fullName??"No accountable person recorded"}`,kind:"physical-count",date:date(entry.countedAt),status:entry.session.status,rows:[]},rows:new Map()};groups.set(key,group);}
      const onHand=["VERIFIED_IN_PLACE","RELOCATED"].includes(entry.foundStatus)?1:entry.foundStatus==="UNACCOUNTED"?0:undefined;
      group.rows.set(a.id,{...row(a),onHand,remarks:entry.remarks});group.record.date=date(entry.countedAt);
    }
    return Array.from(groups.values()).map(g=>({...g.record,rows:Array.from(g.rows.values()).sort((a,b)=>a.propertyNo.localeCompare(b.propertyNo))})).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  }
  if(purpose==="acknowledgment"){
    const receipts=limit(await prisma.itemReceipt.findMany({where:{asset:assetBase,...(scope.unitId?{unitId:scope.unitId}:{}),...(scope.personId?{receivedByPersonId:scope.personId}:{})},include:{asset:{include}},orderBy:[{receivedAt:"desc"},{id:"asc"}],take:5001}));
    const records:AutofillRecord[]=receipts.map(r=>({id:`receipt:${r.id}`,groupKey:JSON.stringify([r.unitId,r.receivedByPersonId,r.recordedById]),label:`${date(r.receivedAt)} · ${r.propertyNo} · ${r.receiverName} · Item receipt`,kind:"acknowledgment",date:date(r.receivedAt),status:"RECEIVED",identitySource:"receipt-snapshot",toName:r.receiverName,toPosition:r.receiverPosition,remarks:r.remarks,rows:[{...row(r.asset),propertyNo:r.propertyNo,name:r.assetName,accountableName:r.receiverName,accountablePosition:r.receiverPosition}]}));
    const withReceipt=new Set(receipts.map(r=>r.assetId));
    const assets=limit(await prisma.asset.findMany({where:{...assetWhere,itemReceipts:{none:{}},...(scope.personId?{accountablePersonId:scope.personId}:{})},include,orderBy:{propertyNo:"asc"},take:5001}));
    for(const a of assets)if(!withReceipt.has(a.id))records.push({id:`asset:${a.id}`,groupKey:JSON.stringify([a.unitId,a.accountablePersonId]),label:`${a.propertyNo} · ${a.accountablePerson?.fullName??"No accountable person recorded"} · Current accountability`,kind:"acknowledgment",date:"",status:a.status,toName:a.accountablePerson?.fullName,toPosition:a.accountablePerson?.position,rows:[row(a)]});
    return limit(records);
  }
  const history=await getFormHistory({...scope,classification:classification??"ALL"});
  return history.slice().reverse().map(e=>({id:e.eventId,label:`${e.date} · ${e.propertyNo} · ${e.eventType}`,kind:"information",date:e.date,status:e.status,eventType:e.eventType,financialImpact:e.financialImpact,responsibleOfficer:e.responsibleOfficer,referenceDocument:e.referenceDocument,fromUnit:e.fromEntity??undefined,toUnit:e.toEntity??undefined,summary:[`${e.assetName} (${e.propertyNo})`,`${e.date}: ${e.eventType.replaceAll("_"," ")} — ${e.status}`,e.fromEntity?`From: ${e.fromEntity}`:null,e.toEntity?`To: ${e.toEntity}`:null,e.remarks].filter(Boolean).join("\n"),rows:[{assetId:e.eventId,propertyNo:e.propertyNo,name:e.assetName,classification:e.classification??classification??"",cost:0,acquired:"",category:e.categoryName??"",condition:"",unitName:e.unitName??""}]}));
}

/** Validate all additional filters before querying. Authorization is supplied by formUnitScope. */
export async function getAutofillRecords(templateId:string,scope:AutofillScope,allMatching=false):Promise<AutofillRecord[]> {
  validateReportScope(scope,templateId,!allMatching);
  if(templateId==="information")return []; // Document-copy requests are entered manually, never generated from asset history.
  if(scope.personId){
    const person=await prisma.person.findFirst({where:{id:scope.personId,...(scope.unitId?{OR:[{unitId:scope.unitId},{itemReceipts:{some:{unitId:scope.unitId}}},{assets:{some:{unitId:scope.unitId,isDeleted:false}}}]}:{})},select:{id:true}});
    if(!person)throw new FormExportError("This person is unavailable in your authorized scope.","FORBIDDEN",403);
  }
  if(scope.sessionId && !await prisma.physicalCountSession.findFirst({where:{id:scope.sessionId,...(scope.unitId?{entries:{some:{asset:{unitId:scope.unitId,isDeleted:false}}}}:{})},select:{id:true}}))throw new FormExportError("This count session is unavailable in your authorized scope.","FORBIDDEN",403);
  const records=await queryAutofillRecords(templateId,scope);
  if(!scope.eventId)return records;
  // Only a real authorized event may restrict the selection to its recorded source.
  const events=await getFormHistory({categoryId:scope.categoryId,unitId:scope.unitId,classification:scope.classification,eventType:scope.eventType});
  const event=events.find(e=>e.eventId===scope.eventId);
  if(!event)throw new FormExportError("This history event is unavailable in your scope.","RECORD_UNAVAILABLE",403);
  if(templateId==="information")return records.filter(r=>r.id===event.eventId);
  if(!event.source?.templateIds.includes(templateId))throw new FormExportError("This history event has no compatible recorded source for this form.","INCOMPATIBLE_TEMPLATE");
  return records.filter(r=>r.id===event.source!.recordId);
}
