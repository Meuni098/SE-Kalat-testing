import ExcelJS from "exceljs";
import JSZip from "jszip";
import { DOMParser,type Node as XmlNode,type Element as XmlElement } from "@xmldom/xmldom";
import { createReferenceWorkbook } from "./report-workbook";
import { readBiff } from "./biff-template";
import { FORM_TEMPLATES,FormExportError } from "./form-templates";

export interface DocumentLayoutPreview {html:string;filename:string;sheets:{id:string;name:string}[];notice:string}
const escape=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const font=(value:string|undefined)=>escape((value??"Arial").replace(/[^\w ,\-]/g,""));
const limit=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
function color(value:Partial<ExcelJS.Color>|undefined,fallback:string){
  if(value?.argb&&/^[a-f\d]{8}$/i.test(value.argb))return `#${value.argb.slice(2)}`;
  if(value?.theme!==undefined)return ["#ffffff","#000000","#e7e6e6","#44546a","#4472c4","#ed7d31"][value.theme]??fallback;
  return fallback;
}
function border(value:Partial<ExcelJS.Border>|undefined){
  if(!value?.style)return "none";
  const type=value.style.includes("dash")?"dashed":value.style==="dotted"?"dotted":value.style==="double"?"double":"solid";
  return `${value.style==="double"?3:value.style==="medium"?2:1}px ${type} ${color(value.color,"#000000")}`;
}
function address(value:string){const m=/^([A-Z]+)(\d+)$/.exec(value.replace(/\$/g,""))!;return {row:Number(m[2]),col:Array.from(m[1]).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)};}
function cellText(cell:ExcelJS.Cell){
  const value=cell.type===ExcelJS.ValueType.Formula?cell.result:cell.value;
  if(value==null)return "";
  if(value instanceof Date)return value.toLocaleDateString("en-PH",{timeZone:"UTC"});
  if(typeof value==="number"&&/[#0],[#0]|\.0/.test(cell.numFmt??"")){
    const digits=limit((cell.numFmt.match(/\.([0#]+)/)?.[1]??"").length,0,6);
    return value.toLocaleString("en-US",{minimumFractionDigits:digits,maximumFractionDigits:digits});
  }
  return cell.text;
}
async function workbookPreview(data:Buffer,filename:string){
  const workbook=new ExcelJS.Workbook();
  if(filename.endsWith(".xls")){
    const id=FORM_TEMPLATES.find(t=>t.filename===filename)?.id;
    if(!id||!["par","ptr","itr","rpcppe"].includes(id))throw new FormExportError("This original spreadsheet preview is unavailable.");
    await workbook.xlsx.load(new Uint8Array((await createReferenceWorkbook([id])).data).buffer);
    for(const [index,sheet] of readBiff(data).sheets.entries())for(const cell of sheet.cells.values()){const target=workbook.worksheets[index].getCell(cell.row,cell.col);if(target.type!==ExcelJS.ValueType.Merge)target.value=cell.text;}
  }else await workbook.xlsx.load(new Uint8Array(data).buffer);
  if(workbook.worksheets.reduce((sum,s)=>sum+s.rowCount,0)>2500||workbook.worksheets.reduce((sum,s)=>sum+s.rowCount*s.columnCount,0)>50000)throw new FormExportError("Choose a narrower scope to preview this document. The complete download remains available.","PREVIEW_TOO_LARGE",422);
  const sheets=workbook.worksheets.map((s,i)=>({id:`sheet-${i}`,name:s.name}));
  const content=workbook.worksheets.map((sheet,index)=>{
    const widths=Array.from({length:sheet.columnCount},(_,i)=>sheet.getColumn(i+1).hidden?0:(sheet.getColumn(i+1).width??8.43)*7+5);
    const heights=Array.from({length:sheet.rowCount},(_,i)=>sheet.getRow(i+1).hidden?0:(sheet.getRow(i+1).height??sheet.properties.defaultRowHeight??15)*4/3);
    const merges=(sheet.model.merges??[]).map(range=>{const [a,b]=range.split(":");return {a:address(a),b:address(b??a)};});
    let rows="";
    for(let r=1;r<=sheet.rowCount;r++){
      if(!heights[r-1])continue;
      let cells="";
      for(let c=1;c<=sheet.columnCount;c++){
        if(!widths[c-1])continue;
        const cell=sheet.getCell(r,c);if(cell.type===ExcelJS.ValueType.Merge)continue;
        const merged=merges.find(m=>m.a.row===r&&m.a.col===c),style=cell.style,alignment=style.alignment;
        const fill=style.fill?.type==="pattern"&&style.fill.pattern==="solid"?color(style.fill.fgColor,"transparent"):"transparent";
        const css=`font-family:${font(style.font?.name)};font-size:${limit(style.font?.size??11,1,96)}pt;font-weight:${style.font?.bold?"bold":"normal"};font-style:${style.font?.italic?"italic":"normal"};text-decoration:${style.font?.underline?"underline":"none"};color:${color(style.font?.color,"#000000")};background:${fill};text-align:${["left","center","right","justify"].includes(alignment?.horizontal??"")?alignment!.horizontal:typeof cell.value==="number"?"right":"left"};vertical-align:${alignment?.vertical==="middle"?"middle":alignment?.vertical==="top"?"top":"bottom"};white-space:${alignment?.wrapText?"pre-wrap":"pre"};border-top:${border(style.border?.top)};border-bottom:${border(style.border?.bottom)};border-left:${border(style.border?.left)};border-right:${border(style.border?.right)}`;
        cells+=`<td${merged?` colspan="${widths.slice(c-1,merged.b.col).filter(Boolean).length}" rowspan="${heights.slice(r-1,merged.b.row).filter(Boolean).length}"`:""} style="${css}">${escape(cellText(cell))}</td>`;
      }
      rows+=`<tr style="height:${heights[r-1]}px">${cells}</tr>`;
    }
    let images="";
    for(const image of sheet.getImages()){
      const media=workbook.getImage(Number(image.imageId));if(!["png","jpeg","gif"].includes(media.extension))continue;
      const bytes=media.buffer?Buffer.from(media.buffer):media.base64?Buffer.from(media.base64.replace(/^data:[^,]+,/,""),"base64"):null;
      if(!bytes||bytes.length>2000000)continue;
      const position=(values:number[],point:number)=>values.slice(0,Math.floor(point)).reduce((a,b)=>a+b,0)+(values[Math.floor(point)]??0)*(point%1);
      const {tl,br}=image.range;if(!br)continue;
      const left=position(widths,tl.col),top=position(heights,tl.row),width=position(widths,br.col)-left,height=position(heights,br.row)-top;
      images+=`<img alt="Template picture" src="data:image/${media.extension};base64,${bytes.toString("base64")}" style="position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px">`;
    }
    return `<section data-preview-sheet="sheet-${index}"><h2>${escape(sheet.name)}</h2><div class="paper" style="width:${widths.reduce((a,b)=>a+b,0)}px"><table style="width:100%"><colgroup>${widths.filter(Boolean).map(width=>`<col style="width:${width}px">`).join("")}</colgroup>${rows}</table>${images}</div></section>`;
  }).join("");
  return {content,sheets};
}

function wordPreview(xml:string){
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new FormExportError("Unsupported document preview.");
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  const value=(element:XmlElement,name:string,attr="w:val")=>element.getElementsByTagName(name)[0]?.getAttribute(attr)??undefined;
  const wordBorders=(element:XmlElement,name:string)=>{
    const borders=element.getElementsByTagName(name)[0];if(!borders)return "";
    return ["top","right","bottom","left"].map(side=>{
      const item=borders.getElementsByTagName(`w:${side}`)[0];if(!item)return "";
      const kind=item.getAttribute("w:val"),hex=item.getAttribute("w:color"),width=limit(Number(item.getAttribute("w:sz")??4)/8,0.25,6);
      return `border-${side}:${["nil","none"].includes(kind??"")?"none":`${width}pt ${kind==="double"?"double":"solid"} ${hex&&/^[a-f\d]{6}$/i.test(hex)?`#${hex}`:"#000"}`};`;
    }).join("");
  };
  function render(node:XmlNode):string{
    if(node.nodeType!==1)return "";
    const element=node as XmlElement,children=()=>Array.from(element.childNodes).map(render).join("");
    switch(element.nodeName){
      case "w:body":return children();
      case "w:tbl":return `<table class="word-table" style="${wordBorders(element,"w:tblBorders")}">${children()}</table>`;
      case "w:tr":{const height=Number(value(element,"w:trHeight"))/20;return `<tr${height?` style="height:${limit(height,0,1000)}pt"`:""}>${children()}</tr>`;}
      case "w:tc":{
        const span=limit(Number(value(element,"w:gridSpan")??1),1,100),width=Number(value(element,"w:tcW","w:w")),widthType=value(element,"w:tcW","w:type");
        return `<td colspan="${span}" style="${Number.isFinite(width)&&width>0?`width:${widthType==="pct"?width/50:width/20}${widthType==="pct"?"%":"pt"};`:""}vertical-align:${value(element,"w:vAlign")==="center"?"middle":value(element,"w:vAlign")==="bottom"?"bottom":"top"};${wordBorders(element,"w:tcBorders")}">${children()}</td>`;
      }
      case "w:p":{
        const align=value(element,"w:jc"),css=["left","right","center","justify"].includes(align??"")?`text-align:${align}`:"";
        return `<p style="${css}">${children()||"&nbsp;"}</p>`;
      }
      case "w:r":{
        const size=Number(value(element,"w:sz"))/2,hex=value(element,"w:color"),name=value(element,"w:rFonts","w:ascii");
        return `<span style="font-family:${font(name)};${size?`font-size:${limit(size,1,96)}pt;`:""}${element.getElementsByTagName("w:b").length?"font-weight:bold;":""}${element.getElementsByTagName("w:i").length?"font-style:italic;":""}${hex&&/^[a-f\d]{6}$/i.test(hex)?`color:#${hex};`:""}">${children()}</span>`;
      }
      case "w:t":return escape(element.textContent);
      case "w:br":return "<br>";
      case "w:tab":return "&emsp;";
      case "w:sym":return "□";
      default:return ["w:tcPr","w:trPr","w:tblPr","w:pPr","w:rPr","w:sectPr","w:tblGrid"].includes(element.nodeName)?"":children();
    }
  }
  const body=doc.getElementsByTagName("w:body")[0];
  if(!body)throw new FormExportError("This Word document could not be previewed.");
  return {content:`<section data-preview-sheet="sheet-0"><div class="paper word">${render(body)}</div></section>`,sheets:[{id:"sheet-0",name:"Document"}]};
}

export async function renderDocumentPreview(data:Buffer,filename:string):Promise<DocumentLayoutPreview>{
  if(data.length>20000000)throw new FormExportError("Choose a narrower scope to preview this document.","PREVIEW_TOO_LARGE",422);
  const result=filename.endsWith(".docx")?wordPreview(await (await JSZip.loadAsync(data)).file("word/document.xml")!.async("string")):await workbookPreview(data,filename);
  const notice="Layout preview of the generated file. Excel/Word pagination and some drawing controls or typography may differ. Review the downloaded file in Office before printed submission.";
  return {sheets:result.sheets,filename,notice,html:`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(filename)}</title><style>body{margin:16px;background:#eee;color:#111;font:11pt Arial}h2{font:14px Arial;color:#555}section{margin-bottom:24px}.paper{position:relative;background:white;padding:0;box-shadow:0 1px 5px #bbb}table{border-collapse:collapse;table-layout:fixed}td{padding:0 2px;overflow:hidden;overflow-wrap:anywhere;box-sizing:border-box}.word{width:720px;padding:48px}.word-table{width:100%;margin:8px 0}.word-table td{padding:0 3px}.word p{margin:2px 0;white-space:pre-wrap}</style></head><body>${result.content}</body></html>`};
}
