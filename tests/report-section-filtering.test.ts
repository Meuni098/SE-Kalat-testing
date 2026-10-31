import test, {type TestContext} from "node:test";
import assert from "node:assert/strict";
import { compatibleTemplates, validateReportScope, reportSection, reportHref } from "../src/lib/report-sections";
import { prisma } from "../src/lib/db";
import { getAutofillRecords } from "../src/lib/form-autofill-source";
import { getFormHistory } from "../src/lib/form-history";

function stub(t:TestContext,target:object,method:string,implementation:()=>Promise<unknown>){
  // Prisma delegates are proxies, so Node's descriptor-based mock.method cannot patch them.
  const original=Reflect.get(target,method);
  const fn=t.mock.fn(async (args:{where:Record<string,unknown>})=>{void args;return implementation();});
  Reflect.set(target,method,fn);t.after(()=>{Reflect.set(target,method,original);});
  return fn;
}
const asset={id:"a",propertyNo:"PROP-1",name:"Laptop",description:null,classification:"PPE",acquisitionCost:65000,acquisitionDate:new Date("2026-01-01T17:00:00Z"),category:{name:"ICT",usefulLifeYears:5},unitId:"u",unit:{name:"Office",code:"OFF"},accountablePersonId:"current",accountablePerson:{fullName:"Current Person",position:"Staff"}};

test("sections offer only compatible original forms", () => {
  assert.deepEqual(compatibleTemplates("transfers").map(t=>t.id), ["itr", "ptr"]);
  assert.deepEqual(compatibleTemplates("accountable-person").map(t=>t.id), ["ics", "par"]);
  assert.deepEqual(compatibleTemplates("physical-inventory", "SEMI_EXPENDABLE").map(t=>t.id), ["rpcsp"]);
  assert.equal(compatibleTemplates("category-history").length, 7);
  assert.equal(compatibleTemplates("requests-returns").length, 2);
});

test("explicit incompatible selections and irrelevant filters fail closed", () => {
  assert.throws(()=>validateReportScope({reportSection:"transfers"}, "ics"), /compatible/);
  assert.throws(()=>validateReportScope({reportSection:"transfers",classification:"SEMI_EXPENDABLE"}, "ptr"), /classification/);
  assert.throws(()=>validateReportScope({reportSection:"transfers",personId:"p"}, "ptr"), /Person/);
  assert.throws(()=>validateReportScope({reportSection:"transfers",sessionId:"s"}, "ptr"), /session/);
  assert.throws(()=>validateReportScope({reportSection:"requests-returns",status:"COMPLETED"}, "return"), /status/);
  assert.throws(()=>reportSection("unknown"), /section/);
});

test("accountable-person requires identity only for populated requests", () => {
  assert.doesNotThrow(()=>validateReportScope({reportSection:"accountable-person"}, "par"));
  assert.throws(()=>validateReportScope({reportSection:"accountable-person"}, "par", true), /person/);
  assert.doesNotThrow(()=>validateReportScope({reportSection:"accountable-person",personId:"p"}, "par", true));
  assert.doesNotThrow(()=>validateReportScope({}, "ptr", true));
});

test("report links preserve relevant filters without forcing PPE", () => {
  const href=reportHref("physical-inventory", {unitId:"u",classification:"SEMI_EXPENDABLE",sessionId:"s"});
  assert.ok(href.includes("reportSection=physical-inventory"));
  assert.ok(href.includes("sessionId=s"));
  assert.ok(!href.includes("rpcppe"));
});

test("receipt filter uses receiver ID while current accountability uses owner ID", async t=>{
  stub(t,prisma.person,"findFirst",async()=>({id:"previous"}));
  const receiptQuery=stub(t,prisma.itemReceipt,"findMany",async()=>[{id:"r",assetId:"a",asset,propertyNo:"SNAP-1",assetName:"Recorded Laptop",receiverName:"Previous Person",receiverPosition:"Officer",receivedAt:new Date("2026-02-01T17:00:00Z"),remarks:"Received"}]);
  const assetQuery=stub(t,prisma.asset,"findMany",async()=>[]);
  const records=await getAutofillRecords("par",{categoryId:"ALL",unitId:"u",personId:"previous",reportSection:"accountable-person"});
  assert.equal(records[0].toName,"Previous Person");
  assert.equal(records[0].rows[0].propertyNo,"SNAP-1");
  assert.equal(records[0].identitySource,"receipt-snapshot");
  assert.equal(records[0].date,"2026-02-02");
  assert.equal(receiptQuery.mock.calls[0].arguments[0].where.receivedByPersonId,"previous");
  assert.equal(assetQuery.mock.calls[0].arguments[0].where.accountablePersonId,"previous");
  assert.deepEqual(assetQuery.mock.calls[0].arguments[0].where.itemReceipts,{none:{}});
});

test("person and count session identifiers outside authorized scope are rejected",async t=>{
  stub(t,prisma.person,"findFirst",async()=>null);
  await assert.rejects(getAutofillRecords("par",{categoryId:"ALL",unitId:"own",personId:"foreign",reportSection:"accountable-person"}),/unavailable/);
  stub(t,prisma.physicalCountSession,"findFirst",async()=>null);
  await assert.rejects(getAutofillRecords("rpcppe",{categoryId:"ALL",unitId:"own",sessionId:"foreign",reportSection:"physical-inventory"}),/unavailable/);
});

test("transfer filtering scopes stored parties and status rather than current asset unit",async t=>{
  const query=stub(t,prisma.transferRequest,"findMany",async()=>[{id:"t",asset,fromUnit:{name:"Old Office",code:"OLD"},toUnit:{name:"New Office",code:"NEW"},fromPerson:{fullName:"Sender"},toPerson:{fullName:"Receiver"},requestedAt:new Date("2026-01-01"),decidedAt:null,status:"PENDING",remarks:"Move",decidedBy:null}]);
  const records=await getAutofillRecords("ptr",{categoryId:"ALL",unitId:"old",status:"PENDING",reportSection:"transfers"});
  const where=query.mock.calls[0].arguments[0].where;
  assert.deepEqual(where.OR,[{fromUnitId:"old"},{toUnitId:"old"}]);
  assert.deepEqual(where.asset,{isDeleted:false,classification:"PPE"});
  assert.equal(where.status,"PENDING");
  assert.equal(records[0].fromName,"Sender");
  assert.equal(records[0].approvedBy,undefined);
});

test("count session filter retains latest scan once per asset",async t=>{
  stub(t,prisma.physicalCountSession,"findFirst",async()=>({id:"s"}));
  const query=stub(t,prisma.physicalCountEntry,"findMany",async()=>[
    {id:"1",asset,sessionId:"s",session:{title:"Annual count",status:"CLOSED"},foundStatus:"UNACCOUNTED",countedAt:new Date("2026-01-01"),remarks:"First"},
    {id:"2",asset,sessionId:"s",session:{title:"Annual count",status:"CLOSED"},foundStatus:"VERIFIED_IN_PLACE",countedAt:new Date("2026-01-02"),remarks:"Latest"},
  ]);
  const records=await getAutofillRecords("rpcppe",{categoryId:"ALL",unitId:"u",sessionId:"s",reportSection:"physical-inventory"});
  assert.equal(query.mock.calls[0].arguments[0].where.sessionId,"s");
  assert.equal(records[0].rows.length,1);
  assert.equal(records[0].rows[0].onHand,1);
  assert.equal(records[0].rows[0].remarks,"Latest");
});

test("college history includes outgoing transfers and recorded receipts after an asset moves",async t=>{
  stub(t,prisma.asset,"count",async()=>1);
  const moved={...asset,unitId:"new-college",status:"IN_USE",intakeItems:[],inspections:[],returnRequests:[],physicalCountEntries:[],missingReports:[],disposals:[],
    transferRequests:[{id:"outgoing",fromUnitId:"science",toUnitId:"new-college",fromUnit:{code:"CS"},toUnit:{code:"NEW"},status:"COMPLETED",requestedAt:new Date("2026-01-02"),decidedAt:null},
      {id:"unrelated",fromUnitId:"another",toUnitId:"new-college",fromUnit:{code:"OTHER"},toUnit:{code:"NEW"},status:"COMPLETED",requestedAt:new Date("2026-01-03"),decidedAt:null}],
    itemReceipts:[{id:"receipt",unitId:"science",propertyNo:"PROP-1",assetName:"Laptop",receiverName:"Receiver",unitCode:"CS",remarks:"Received",receivedAt:new Date("2026-01-01")}],
  };
  stub(t,prisma.asset,"findMany",async()=>[moved]);
  const audits=stub(t,prisma.auditLog,"findMany",async()=>[]);
  const events=await getFormHistory({categoryId:"ALL",unitId:"science"});
  assert.deepEqual(events.map(e=>e.eventId),["receipt-receipt","transfer-outgoing"]);
  assert.equal(audits.mock.calls.length, 0, "Official history must not query system audit entries");
});

test("all-record accountability can span people while the legacy single-person requirement stays",async t=>{
  stub(t,prisma.itemReceipt,"findMany",async()=>[]);
  stub(t,prisma.asset,"findMany",async()=>[asset,{...asset,id:"b",accountablePersonId:"other",accountablePerson:{fullName:"Other Person",position:"Staff"}}]);
  const records=await getAutofillRecords("par",{categoryId:"ALL",unitId:"u",reportSection:"accountable-person"},true);
  assert.equal(records.length,2);assert.notEqual(records[0].groupKey,records[1].groupKey);
  await assert.rejects(getAutofillRecords("par",{categoryId:"ALL",unitId:"u",reportSection:"accountable-person"}),/person/);
});

test("document copy requests are not asset-history forms",()=>{assert.throws(()=>validateReportScope({reportSection:"category-history"},"information"),/compatible/);assert.ok(compatibleTemplates("requests-returns").some(t=>t.id==="information"));});

test("document requests do not query or insert asset history",async()=>{assert.deepEqual(await getAutofillRecords("information",{categoryId:"ALL",reportSection:"requests-returns"},true),[]);});


test("official history excludes encoder audit entries while internal history retains them", async t => {
  stub(t, prisma.asset, "count", async () => 1);
  stub(t, prisma.asset, "findMany", async () => [{ ...asset, intakeItems: [], inspections: [], transferRequests: [], returnRequests: [], physicalCountEntries: [], missingReports: [], disposals: [], itemReceipts: [] }]);
  const audits = stub(t, prisma.auditLog, "findMany", async () => [{ id: "audit", entityId: asset.id, createdAt: new Date(), action: "UPDATE_STATUS", actor: { name: "Encoder only" } }]);
  const official = await getFormHistory({ categoryId: "ALL" });
  assert.ok(!official.some(e => e.eventType === "SYSTEM_AUDIT" || e.responsibleOfficer === "Encoder only"));
  assert.equal(audits.mock.calls.length, 0);
  const internal = await getFormHistory({ categoryId: "ALL", purpose: "internal" });
  assert.ok(internal.some(e => e.eventType === "SYSTEM_AUDIT" && e.responsibleOfficer === "Encoder only"));
});


test("official pending transfer history does not use the encoder as responsible officer", async t => {
  stub(t, prisma.asset, "count", async () => 1);
  stub(t, prisma.asset, "findMany", async () => [{ ...asset, intakeItems: [], inspections: [], returnRequests: [], physicalCountEntries: [], missingReports: [], disposals: [], itemReceipts: [], transferRequests: [{ id: "pending", fromUnitId: "u", toUnitId: "v", fromUnit: { code: "FROM" }, toUnit: { code: "TO" }, requestedBy: { name: "Encoder only" }, requestedAt: new Date(), decidedAt: null, status: "PENDING" }] }]);
  const events = await getFormHistory({ categoryId: "ALL" });
  assert.equal(events.find(event => event.eventType === "CUSTODIAL_TRANSFER")?.responsibleOfficer, "");
});
