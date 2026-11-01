import test from "node:test";
import assert from "node:assert/strict";
import { readFile,writeFile,access } from "node:fs/promises";
import { dirname } from "node:path";
import { createDocumentPrintPreview } from "../src/lib/document-print-preview";

test("print preview converts a private temporary copy and deletes it without changing source bytes",async()=>{
  const data=Buffer.from("original-office-file"),before=Buffer.from(data);
  let directory="";
  const preview=await createDocumentPrintPreview({data,filename:"../../ICS.xlsx"},async(input,output)=>{
    directory=dirname(input);
    assert.ok(input.endsWith("source.xlsx"));
    assert.deepEqual(await readFile(input),data);
    await writeFile(output,"%PDF-1.7\npreview-copy\n%%EOF");
  });
  assert.equal(preview.kind,"pdf");assert.equal(preview.renderer,"Microsoft Office");
  assert.ok(Buffer.from(preview.pdfBase64,"base64").toString().startsWith("%PDF-"));
  assert.deepEqual(data,before);
  await assert.rejects(access(directory));
});

test("conversion failure cleans temporary files and never silently substitutes HTML",async()=>{
  let directory="";
  await assert.rejects(createDocumentPrintPreview({data:Buffer.from("source"),filename:"PAR.xls"},async(input)=>{
    directory=dirname(input);throw new Error("private converter detail");
  }),error=>error instanceof Error&&!error.message.includes("private converter detail")&&/print preview/i.test(error.message));
  await assert.rejects(access(directory));
});

test("invalid output, excessive source size and unsupported formats fail explicitly",async()=>{
  await assert.rejects(createDocumentPrintPreview({data:Buffer.from("x"),filename:"x.xlsx"},async(_,output)=>{await writeFile(output,"not-pdf");}),/print preview/i);
  await assert.rejects(createDocumentPrintPreview({data:Buffer.alloc(20000001),filename:"x.xlsx"}),/narrower scope/i);
  await assert.rejects(createDocumentPrintPreview({data:Buffer.from("x"),filename:"x.exe"}),/format/i);
});

test("busy converter rejects a second request instead of starting concurrent Office automation",async()=>{
  let release:()=>void=()=>{};
  const waiting=new Promise<void>(resolve=>{release=resolve;});
  let started:()=>void=()=>{};const ready=new Promise<void>(resolve=>{started=resolve;});
  const first=createDocumentPrintPreview({data:Buffer.from("x"),filename:"x.xlsx"},async(_,output)=>{
    started();await waiting;await writeFile(output,"%PDF-1.7\n%%EOF");
  });
  await ready;
  try{await assert.rejects(createDocumentPrintPreview({data:Buffer.from("x"),filename:"y.xlsx"}),/busy/i);}
  finally{release();await first;}
});
