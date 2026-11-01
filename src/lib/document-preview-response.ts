import { NextResponse } from "next/server";
import { createDocumentPrintPreview } from "./document-print-preview";

export async function documentPreviewResponse(output:{data:Buffer;filename:string}){
  return NextResponse.json(await createDocumentPrintPreview(output),{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
