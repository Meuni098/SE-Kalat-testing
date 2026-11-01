import type { DocumentLayoutPreview } from "./document-preview";

export const PREVIEW_ZOOMS = [50, 75, 100, 125, 150] as const;
type Sheet = DocumentLayoutPreview["sheets"][number];

/** Bounds come from the renderer, so the iframe keeps its opaque sandbox origin. */
export function previewScale(sheets:Sheet[],selected:string,containerWidth:number,zoom:string){
  if(zoom!=="fit-width")return PREVIEW_ZOOMS.some(value=>String(value)===zoom)?Number(zoom)/100:1;
  const visible=sheets.some(sheet=>sheet.id===selected)?sheets.filter(sheet=>sheet.id===selected):sheets;
  const width=Math.max(1,...visible.map(sheet=>sheet.width&&Number.isFinite(sheet.width)&&sheet.width>0?sheet.width:816));
  // Reserve room for body margins and a vertical scrollbar at every scale.
  return Math.min(1,Math.max(1,Number.isFinite(containerWidth)?containerWidth-52:1)/width);
}

export function previewViewHtml(html:string,sheets:Sheet[],selected:string,scale:number){
  const index=sheets.findIndex(sheet=>sheet.id===selected);
  const safeScale=Number.isFinite(scale)&&scale>0&&scale<=1.5?scale:1;
  // Select by trusted ordinal, never interpolate an ID into CSS.
  const selection=index<0?"":`body>section[data-preview-sheet]:not(:nth-of-type(${index+1})){display:none}`;
  return html.replace("</head>",`<style>body{zoom:${safeScale}}${selection}</style></head>`);
}
