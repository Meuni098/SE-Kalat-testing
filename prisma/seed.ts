import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

loadEnvConfig(process.cwd());
const prisma=new PrismaClient();

/** Optional first administrator bootstrap. Never resets data or publishes demo people. */
async function main(){
  const email=process.env.SEED_ADMIN_EMAIL?.trim(),password=process.env.SEED_ADMIN_PASSWORD,name=process.env.SEED_ADMIN_NAME?.trim()||"Administrator";
  if(!email||!/^\S+@\S+\.\S+$/.test(email)||!password||password.length<12)throw new Error("Set SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least 12 characters before bootstrapping.");
  if(await prisma.user.count())throw new Error("Bootstrap refused: users already exist. No existing accounts or data were changed.");
  const passwordHash=await bcrypt.hash(password,12);
  await prisma.$transaction(async tx=>{
    const unit=await tx.unit.upsert({where:{code:"AMO"},update:{},create:{code:"AMO",name:"Asset Management Office",unitType:"ADMINISTRATIVE"}});
    await tx.user.create({data:{email,name,passwordHash,role:"ADMIN",unitId:unit.id}});
  });
  console.log("Initial administrator created. No sample people, assets or transaction history were inserted.");
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Bootstrap failed.");process.exitCode=1;}).finally(()=>prisma.$disconnect());
