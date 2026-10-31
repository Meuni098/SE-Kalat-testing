import { getSession } from "./auth";
import { prisma } from "./db";

/** Report authorization must reflect changed assignments, not an old cookie snapshot. */
export async function getReportSession() {
  const session=await getSession();
  if(!session)return null;
  const user=await prisma.user.findUnique({where:{id:session.id},select:{id:true,role:true,unitId:true,isActive:true}});
  return user?.isActive?user:null;
}
