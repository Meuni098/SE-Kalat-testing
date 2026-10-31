import { NextRequest,NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { POST as exportForm } from "../forms/route";
export const dynamic="force-dynamic";
export const runtime="nodejs";
/** The former generated-layout endpoint now requires a supplied original form. */
export async function POST(req:NextRequest) {
  if(!await getSession())return NextResponse.json({error:"Please sign in to export documents."},{status:401});
  const raw=await req.text();
  if(raw.length>300000)return NextResponse.json({error:"Export request is too large."},{status:400});
  let body;
  try{body=JSON.parse(raw);}catch{return NextResponse.json({error:"Invalid export request."},{status:400});}
  if(!body||typeof body!=="object"||!body.templateId)return NextResponse.json({error:"Choose a supplied original form and the fields to populate in Official document exports.",code:"OFFICIAL_FORM_REQUIRED",exportUrl:"/reports/category-history"},{status:422,headers:{"Cache-Control":"private, no-store"}});
  return exportForm(new NextRequest(new URL("/api/export/forms",req.url),{method:"POST",headers:{cookie:req.headers.get("cookie")??"","Content-Type":"application/json"},body:JSON.stringify({...body,action:"download"})}));
}
export async function GET(req:NextRequest) {
  if(!await getSession())return NextResponse.json({error:"Please sign in to export documents."},{status:401});
  const url=new URL("/reports/category-history",req.url);
  for(const key of ["categoryId","unitId","classification"]){const value=req.nextUrl.searchParams.get(key);if(value)url.searchParams.set(key,value);}
  return NextResponse.redirect(url,303);
}
