"use client";
import * as React from "react";
import type { PDFDocumentProxy,RenderTask } from "pdfjs-dist";
import type { DocumentPrintPreview } from "@/lib/document-print-preview-types";
import { Button } from "@/components/ui/button";

const ZOOMS=[50,75,100,125,150] as const;
const CSS_UNITS=96/72;

export function DocumentLayoutPreviewPanel({preview}:{preview:DocumentPrintPreview}){
  const [pdf,setPdf]=React.useState<PDFDocumentProxy|null>(null);
  const [page,setPage]=React.useState(1),[zoom,setZoom]=React.useState("fit-page");
  const [expanded,setExpanded]=React.useState(false),[width,setWidth]=React.useState(0);
  const [height,setHeight]=React.useState(0);
  const [rendering,setRendering]=React.useState(true),[error,setError]=React.useState("");
  const [retry,setRetry]=React.useState(0),[pageText,setPageText]=React.useState("");
  const [pdfUrl,setPdfUrl]=React.useState("");
  const viewport=React.useRef<HTMLDivElement>(null),canvas=React.useRef<HTMLCanvasElement>(null);
  const dialog=React.useRef<HTMLDialogElement>(null),expandButton=React.useRef<HTMLButtonElement>(null);
  const titleId=React.useId(),noticeId=React.useId();

  React.useEffect(()=>{
    let cancelled=false,url="";
    let loadingTask:ReturnType<typeof import("pdfjs-dist")["getDocument"]>|undefined;
    async function load(){
      setError("");setRendering(true);setPdf(null);setPdfUrl("");
      try{
        const library=await import("pdfjs-dist");
        if(cancelled)return;
        library.GlobalWorkerOptions.workerSrc="/pdfjs/pdf.worker.min.mjs";
        const data=Uint8Array.from(atob(preview.pdfBase64),c=>c.charCodeAt(0));
        url=URL.createObjectURL(new Blob([data],{type:"application/pdf"}));
        loadingTask=library.getDocument({data,cMapUrl:"/pdfjs/cmaps/",cMapPacked:true,standardFontDataUrl:"/pdfjs/standard_fonts/",wasmUrl:"/pdfjs/wasm/"});
        const document=await loadingTask.promise;
        if(document.numPages>100)throw new Error("Too many pages");
        if(!cancelled){setPdf(document);setPdfUrl(url);setPage(1);}
      }catch{
        if(!cancelled){setError("This print preview could not be displayed. Retry or download the original document.");setRendering(false);}
      }
    }
    void load();
    return ()=>{cancelled=true;if(url)URL.revokeObjectURL(url);if(loadingTask)void loadingTask.destroy().catch(()=>{});};
  },[preview.pdfBase64,retry]);

  React.useEffect(()=>{
    if(expanded)dialog.current?.showModal();
    else if(dialog.current?.open){dialog.current.close();expandButton.current?.focus();}
  },[expanded]);
  React.useEffect(()=>{
    if(!expanded)return;
    const root=document.documentElement,previous=root.style.overflow;
    root.style.overflow="hidden";
    return ()=>{root.style.overflow=previous;};
  },[expanded]);
  React.useEffect(()=>{
    const target=viewport.current;if(!target)return;
    let frame=0;
    const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{setWidth(target.clientWidth);setHeight(target.clientHeight);});};
    const observer=new ResizeObserver(measure);observer.observe(target);measure();
    return ()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[expanded]);

  React.useEffect(()=>{
    if(!pdf||!width)return;
    let cancelled=false,task:RenderTask|undefined;
    async function draw(){
      setRendering(true);setError("");
      try{
        const sourcePage=await pdf!.getPage(page);
        if(cancelled||!canvas.current)return;
        const natural=sourcePage.getViewport({scale:CSS_UNITS});
        const factor=zoom==="fit-page"?Math.min(1,Math.max(1,width-32)/natural.width,Math.max(1,height-32)/natural.height):zoom==="fit-width"?Math.min(1,Math.max(1,width-32)/natural.width):Number(zoom)/100;
        const view=sourcePage.getViewport({scale:CSS_UNITS*factor});
        const pixelRatio=Math.min(window.devicePixelRatio||1,2),target=canvas.current;
        target.width=Math.ceil(view.width*pixelRatio);target.height=Math.ceil(view.height*pixelRatio);
        target.style.width=`${view.width}px`;target.style.height=`${view.height}px`;
        task=sourcePage.render({canvas:target,viewport:view,transform:pixelRatio===1?undefined:[pixelRatio,0,0,pixelRatio,0,0]});
        await task.promise;
        const text=await sourcePage.getTextContent();
        if(!cancelled){setPageText(text.items.map(item=>"str" in item?item.str:"").join(" "));setRendering(false);}
      }catch{
        if(!cancelled){setError("This page could not be displayed. Retry or download the original document.");setRendering(false);}
      }
    }
    void draw();
    return ()=>{cancelled=true;task?.cancel();};
  },[pdf,page,zoom,width,height,expanded]);

  function changePage(next:number){setPage(next);setPageText("");if(viewport.current){viewport.current.scrollTop=0;viewport.current.scrollLeft=0;}}
  function viewer(){return <>
    <div className="flex flex-wrap items-end gap-3 shrink-0">
      <div className="flex flex-wrap items-end gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={!pdf||page===1} onClick={()=>changePage(page-1)}>Previous page</Button>
        <label className="text-sm">Page<select aria-label="Print preview page" className="block border rounded p-2 bg-white" disabled={!pdf} value={page} onChange={event=>changePage(Number(event.target.value))}>
          {Array.from({length:pdf?.numPages??1},(_,index)=><option key={index+1} value={index+1}>{index+1} of {pdf?.numPages??1}</option>)}
        </select></label>
        <Button type="button" variant="secondary" size="sm" disabled={!pdf||page===pdf.numPages} onClick={()=>changePage(page+1)}>Next page</Button>
      </div>
      <label className="text-sm">Zoom<select aria-label="Preview zoom" className="block border rounded p-2 bg-white" value={zoom} onChange={event=>setZoom(event.target.value)}>
        <option value="fit-page">Fit page</option><option value="fit-width">Fit width</option>{ZOOMS.map(value=><option key={value} value={String(value)}>{value===100?"Actual size (100%)":`${value}%`}</option>)}
      </select></label>
      {pdfUrl&&<a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline pb-2">Open print PDF</a>}
    </div>
    <p id={noticeId} className="text-xs shrink-0">{preview.notice}</p>
    <p role="status" className="text-xs shrink-0">{rendering?"Rendering print page…":pdf?`Page ${page} of ${pdf.numPages} · ${zoom==="fit-page"?"Fit page":zoom==="fit-width"?"Fit width":`${zoom}%`}`:"Loading print preview…"}</p>
    {error&&<p role="alert" className="text-sm text-red-700 shrink-0">{error} <button type="button" className="underline" onClick={()=>setRetry(value=>value+1)}>Retry display</button></p>}
    <div ref={viewport} role="region" aria-label="Printed document page" aria-describedby={noticeId} tabIndex={0} className="min-w-0 min-h-0 flex-1 overflow-auto border rounded bg-slate-200 p-3">
      <canvas ref={canvas} role="img" aria-label={`Print preview page ${page}`} style={{visibility:rendering||error?"hidden":"visible"}} className="block bg-white shadow mx-auto"/>
      <p className="sr-only">{pageText}</p>
    </div>
  </>;}

  return <section aria-label="Document print preview" className="min-w-0 border rounded bg-cream p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Document print preview</h3><Button ref={expandButton} type="button" variant="secondary" size="sm" aria-haspopup="dialog" onClick={()=>setExpanded(true)}>Expand preview</Button></div>
    <p className="text-sm break-words">{preview.filename}</p>
    {!expanded&&<div className="flex flex-col gap-3 h-[min(750px,80dvh)] min-h-[320px]">{viewer()}</div>}
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();event.stopPropagation();setExpanded(false);}} onClose={event=>{event.stopPropagation();setExpanded(false);}} className="fixed inset-0 m-auto w-[96vw] max-w-none h-[94dvh] max-h-none overflow-hidden rounded-lg border border-border bg-cream p-3 text-[#3B0A0F] backdrop:bg-[#3B0A0F]/70">
      {expanded&&<div className="flex h-full min-w-0 flex-col gap-3"><div className="flex items-center justify-between gap-3 shrink-0"><h3 id={titleId} className="font-bold">Document print preview</h3><Button type="button" variant="secondary" size="sm" onClick={()=>setExpanded(false)}>Collapse preview</Button></div><p className="text-sm break-words shrink-0">{preview.filename}</p>{viewer()}</div>}
    </dialog>
  </section>;
}
