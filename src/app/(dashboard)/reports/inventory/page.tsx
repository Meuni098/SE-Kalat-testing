import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function InventoryReportsPage({searchParams}:{searchParams:Promise<{unit?:string;unitId?:string;categoryId?:string;classification?:string;templateId?:string;personId?:string;sessionId?:string}>}){
  const filters=await searchParams;const params=new URLSearchParams();params.set("reportSection","inventory");
  for(const key of ["unitId","categoryId","templateId","personId","sessionId"] as const)if(filters[key])params.set(key,filters[key]!);
  if(filters.classification&&filters.classification!=="ALL")params.set("classification",filters.classification);
  if(!filters.unitId&&filters.unit&&filters.unit!=="ALL"){
    const unit=await prisma.unit.findUnique({where:{code:filters.unit},select:{id:true}});
    params.set("unitId",unit?.id??"invalid-unit");
  }
  redirect(`/reports?${params}`);
}
