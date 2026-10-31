import { classificationWhere } from "./classification-filter";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { FormExportError, type FormHistoryEvent } from "./form-templates";

/** History for official forms: no generated IDs, inferred signatories, or fallback remarks. */
export async function getFormHistory(filter: {categoryId:string;unitId?:string;classification?:string;eventType?:string;purpose?:"internal"|"official"}): Promise<FormHistoryEvent[]> {
  const where:Prisma.AssetWhereInput = {isDeleted:false,...(filter.categoryId!=="ALL"?{categoryId:filter.categoryId}:{}),...(filter.unitId?{OR:[{unitId:filter.unitId},{transferRequests:{some:{OR:[{fromUnitId:filter.unitId},{toUnitId:filter.unitId}]}}},{itemReceipts:{some:{unitId:filter.unitId}}}]}:{}),...classificationWhere(filter.classification)};
  if (await prisma.asset.count({where})>5000) throw new FormExportError("Choose a category or operating unit to load fewer than 5,001 assets.","SCOPE_TOO_LARGE",422);
  const assets=await prisma.asset.findMany({where,include:{
    category:true,unit:true,intakeItems:{include:{intakeRecord:true}},inspections:{include:{inspector:true}},
    transferRequests:{include:{fromUnit:true,toUnit:true,fromPerson:true,toPerson:true,requestedBy:true,decidedBy:true}},
    returnRequests:true,physicalCountEntries:{include:{session:true}},missingReports:{include:{reportedBy:true}},disposals:true,itemReceipts:true,
  },orderBy:{propertyNo:"asc"}});
  const result:FormHistoryEvent[]=[];
  for(const a of assets){
    const add=(id:string,date:Date,type:string,status:string,values:Partial<FormHistoryEvent>={})=>result.push({eventId:id,date:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(date),timestamp:date.toISOString(),propertyNo:a.propertyNo,assetName:a.name,classification:a.classification,categoryName:a.category?.name,unitName:a.unit.name,eventType:type,status,responsibleOfficer:"",fromEntity:null,toEntity:null,remarks:null,referenceDocument:null,financialImpact:null,...values});
    const currentScope=!filter.unitId||a.unitId===filter.unitId;
    if(currentScope)add(`asset-${a.id}`,a.acquisitionDate,"ASSET_ACQUISITION",a.status,{financialImpact:a.acquisitionCost});
    for(const r of a.itemReceipts.filter(r=>!filter.unitId||r.unitId===filter.unitId)) add(`receipt-${r.id}`,r.receivedAt,"ITEM_RECEIPT","RECEIVED",{propertyNo:r.propertyNo,assetName:r.assetName,responsibleOfficer:r.receiverName,toEntity:r.unitCode,remarks:r.remarks,source:{templateIds:[a.classification==="PPE"?"par":"ics"],recordId:`receipt:${r.id}`}});
    for(const item of (currentScope?a.intakeItems:[])){const r=item.intakeRecord;add(`intake-${item.id}`,r.deliveryDate,"PROCUREMENT_INTAKE","DELIVERED",{fromEntity:r.supplierName,remarks:r.remarks,referenceDocument:r.deliveryReceiptNo||r.poNumber,financialImpact:a.acquisitionCost});}
    for(const r of (currentScope?a.inspections:[])) add(`inspection-${r.id}`,r.inspectedAt,"INSPECTION_ACCEPTANCE",r.result,{responsibleOfficer:r.inspector?.name??"",remarks:r.remarks});
    for(const r of a.transferRequests.filter(r=>!filter.unitId||r.fromUnitId===filter.unitId||r.toUnitId===filter.unitId)) add(`transfer-${r.id}`,r.decidedAt??r.requestedAt,"CUSTODIAL_TRANSFER",r.status,{responsibleOfficer:["APPROVED","COMPLETED"].includes(r.status)?r.decidedBy?.name??"":"",fromEntity:[r.fromUnit.code,r.fromPerson?.fullName].filter(Boolean).join(" / "),toEntity:[r.toUnit.code,r.toPerson?.fullName].filter(Boolean).join(" / "),remarks:r.remarks,...(["PENDING","APPROVED","COMPLETED"].includes(r.status)?{source:{templateIds:[a.classification==="PPE"?"ptr":"itr"],recordId:r.id}}:{})});
    for(const r of (currentScope?a.returnRequests:[])) add(`return-${r.id}`,r.decidedAt??r.requestedAt,"RETURN_SURRENDER",r.status,{responsibleOfficer:r.returnedBy,remarks:r.reason,...(["PENDING","APPROVED"].includes(r.status)?{source:{templateIds:["return"],recordId:r.id}}:{})});
    for(const r of (currentScope?a.physicalCountEntries:[])) add(`count-${r.id}`,r.countedAt,"PHYSICAL_COUNT_VERIFICATION",r.foundStatus,{toEntity:r.scannedLocation,remarks:r.remarks,referenceDocument:r.session.title,source:{templateIds:[a.classification==="PPE"?"rpcppe":"rpcsp"],recordId:`${r.sessionId}:${a.unitId}:${a.accountablePersonId??"unassigned"}`}});
    for(const r of (currentScope?a.missingReports:[])) add(`missing-${r.id}`,r.reportedAt,"MISSING_INCIDENT",r.status,{responsibleOfficer:r.reportedBy?.name??"",fromEntity:r.locationLastSeen,remarks:r.circumstances,referenceDocument:r.policeBlotterUrl});
    for(const r of (currentScope?a.disposals:[])) add(`disposal-${r.id}`,r.approvedAt??r.proposedAt,"DISPOSAL_CONDEMNATION",r.status,{toEntity:r.method,remarks:r.reason,referenceDocument:r.docketNo,financialImpact:r.appraisedScrapValue});
  }
  if(filter.purpose === "internal") {
  const audit=await prisma.auditLog.findMany({where:{entityId:{in:assets.filter(a=>!filter.unitId||a.unitId===filter.unitId).map(a=>a.id)}},include:{actor:true},orderBy:{createdAt:"asc"}});
  const assetMap=new Map(assets.map(a=>[a.id,a]));
  for(const r of audit){const a=assetMap.get(r.entityId);if(a)result.push({eventId:`audit-${r.id}`,date:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(r.createdAt),timestamp:r.createdAt.toISOString(),propertyNo:a.propertyNo,assetName:a.name,classification:a.classification,categoryName:a.category?.name,unitName:a.unit.name,eventType:"SYSTEM_AUDIT",status:r.action,responsibleOfficer:r.actor?.name??"",fromEntity:null,toEntity:null,remarks:null,referenceDocument:null,financialImpact:null});}
  }
  if(result.length>20000) throw new FormExportError("Choose a narrower category or operating unit to load fewer history events.","SCOPE_TOO_LARGE",422);
  return result.filter(e=>!filter.eventType||e.eventType===filter.eventType).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.eventId.localeCompare(b.eventId));
}
