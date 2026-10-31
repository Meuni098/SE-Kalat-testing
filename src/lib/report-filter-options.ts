import { prisma } from "./db";
import { FormExportError } from "./form-templates";
import type { ReportScope } from "./report-sections";

/** Options disclose only people/sessions with an authorized unit relationship. */
export async function getReportFilterOptions(scope:ReportScope) {
  const unitId=scope.unitId;
  const [persons,sessions]=await Promise.all([
    prisma.person.findMany({where:unitId?{OR:[{unitId},{assets:{some:{unitId,isDeleted:false}}},{itemReceipts:{some:{unitId}}}]}:{},select:{id:true,fullName:true,employeeNo:true,unit:{select:{code:true}}},orderBy:[{fullName:"asc"},{id:"asc"}],take:5001}),
    prisma.physicalCountSession.findMany({where:unitId?{entries:{some:{asset:{unitId,isDeleted:false}}}}:{},select:{id:true,title:true,status:true},orderBy:[{startedAt:"desc"},{id:"asc"}],take:5001}),
  ]);
  if(persons.length>5000||sessions.length>5000)throw new FormExportError("Narrow the operating unit to load fewer report filter options.","SCOPE_TOO_LARGE",422);
  return {persons,sessions};
}
