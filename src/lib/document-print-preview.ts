import { execFile } from "node:child_process";
import { mkdtemp,readFile,writeFile,rm,stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { FormExportError } from "./form-templates";
import type { DocumentPrintPreview } from "./document-print-preview-types";

const run=promisify(execFile);
const MAX_BYTES=20000000;
let active=false;
type Converter=(input:string,output:string)=>Promise<void>;

async function convertWithOffice(input:string,output:string){
  if(process.platform!=="win32")throw new FormExportError("Print preview requires Microsoft Excel and Word on the Windows app server. The original download remains available.","PRINT_PREVIEW_UNAVAILABLE",503);
  const script=path.join(process.cwd(),"scripts","office-print-preview.ps1");
  const args=["-NoLogo","-NoProfile","-NonInteractive","-File",script,"-JobDirectory",path.dirname(input)];
  try{
    if(path.extname(input)===".docx"){
      await run("cscript.exe",["//B","//NoLogo",path.join(process.cwd(),"scripts","word-print-preview.vbs"),input,output,path.join(path.dirname(input),"office-process.json")],{windowsHide:true,timeout:60000,maxBuffer:65536});
    }else await run("powershell.exe",args,{windowsHide:true,timeout:60000,maxBuffer:65536});
  }finally{
    // A timed-out COM call can outlive its PowerShell worker. Cleanup checks both
    // the private process ID and start time; it never stops an existing user session.
    await run("powershell.exe",[...args,"-CleanupOnly"],{windowsHide:true,timeout:10000,maxBuffer:65536});
  }
}

export async function createDocumentPrintPreview(output:{data:Buffer;filename:string},convert:Converter=convertWithOffice):Promise<DocumentPrintPreview>{
  const extension=path.extname(output.filename).toLowerCase();
  if(![".xls",".xlsx",".docx"].includes(extension))throw new FormExportError("This document format does not support print preview.","PRINT_PREVIEW_UNSUPPORTED",422);
  if(output.data.length>MAX_BYTES)throw new FormExportError("Choose a narrower scope for print preview. The complete download remains available.","PREVIEW_TOO_LARGE",422);
  if(active)throw new FormExportError("The print preview renderer is busy. Please retry shortly. Downloads remain available.","PRINT_PREVIEW_BUSY",503);
  active=true;
  let directory:string|undefined;
  try{
    directory=await mkdtemp(path.join(tmpdir(),"custodia-print-"));
    const source=path.join(directory,`source${extension}`),pdf=path.join(directory,"preview.pdf");
    await writeFile(source,output.data,{mode:0o600});
    await convert(source,pdf);
    const size=(await stat(pdf)).size;
    if(size>MAX_BYTES)throw new FormExportError("Choose a narrower scope for print preview. The complete download remains available.","PREVIEW_TOO_LARGE",422);
    const bytes=await readFile(pdf);
    if(!bytes.subarray(0,5).equals(Buffer.from("%PDF-")))throw new Error("Invalid renderer output");
    return {kind:"pdf",filename:output.filename,pdfBase64:bytes.toString("base64"),renderer:"Microsoft Office",notice:"Print preview from a temporary copy, using the document’s saved print settings. Your original file is unchanged. Printing with different printer settings can change pagination."};
  }catch(error){
    if(error instanceof FormExportError)throw error;
    throw new FormExportError("Print preview could not be prepared. Please retry. If it continues, check that Excel and Word are available on the app server. The original download remains available.","PRINT_PREVIEW_FAILED",503);
  }finally{
    try{
      if(directory&&path.dirname(directory)===path.resolve(tmpdir())&&path.basename(directory).startsWith("custodia-print-"))await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:200});
    }
    finally{active=false;}
  }
}
