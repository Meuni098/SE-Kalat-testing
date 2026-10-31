import { NextResponse } from "next/server";
import { renderDocumentPreview } from "./document-preview";

export async function documentPreviewResponse(output:{data:Buffer;filename:string}){
  return NextResponse.json(await renderDocumentPreview(output.data,output.filename),{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
