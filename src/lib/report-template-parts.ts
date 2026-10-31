import JSZip from "jszip";
import path from "node:path";

export interface TemplateSheetParts {
  source:Buffer;sourceSheet:number;targetSheet:number;maps:((row:number)=>number)[];
}

/** ExcelJS omits legacy shapes. Copy their original package graph rather than redraw them. */
export async function preserveTemplateParts(bytes:Buffer,sheets:TemplateSheetParts[]){
  const output=await JSZip.loadAsync(bytes);
  let contentTypes=await output.file("[Content_Types].xml")!.async("string");
  for(const sheet of sheets){
    const source=await JSZip.loadAsync(sheet.source),sourceTypes=await source.file("[Content_Types].xml")!.async("string");
    const sourcePart=`xl/worksheets/sheet${sheet.sourceSheet}.xml`,targetPart=`xl/worksheets/sheet${sheet.targetSheet}.xml`;
    const original=await source.file(sourcePart)!.async("string");
    const originalRels=source.file(`xl/worksheets/_rels/sheet${sheet.sourceSheet}.xml.rels`);
    if(!originalRels)continue;
    const prefix=`xl/template-parts/sheet${sheet.targetSheet}/`,copied=new Set<string>();
    const attributes=(xml:string)=>Object.fromEntries(Array.from(xml.matchAll(/([\w:]+)="([^"]*)"/g),match=>[match[1],match[2]]));
    async function clonePart(name:string):Promise<string>{
      const destination=prefix+name;
      if(copied.has(name))return destination;
      copied.add(name);
      const file=source.file(name);
      if(!file)throw new Error(`Missing template package part: ${name}`);
      let data=await file.async("nodebuffer");
      if(/\/drawings\/drawing\d+\.xml$/.test(name)){
        const xml=data.toString("utf8"),anchors=xml.match(/<xdr:(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)>/g)??[];
        if(anchors.length){
          let shapeId=0;
          const repeated=sheet.maps.flatMap(map=>anchors.map(anchor=>anchor.replace(/<xdr:row>(\d+)<\/xdr:row>/g,(_match,row:string)=>`<xdr:row>${map(Number(row)+1)-1}</xdr:row>`).replace(/(<xdr:cNvPr\b[^>]*\bid=")\d+("[^>]*\bname=")([^"]*)/g,(_match,start:string,middle:string,name:string)=>sheet.maps.length===1?_match:`${start}${++shapeId}${middle}${name} ${shapeId}`))).join("");
          data=Buffer.from(xml.replace(/<xdr:(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*<\/xdr:(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)>/,repeated));
        }
      }
      output.file(destination,data);
      const typeEntries=Array.from(sourceTypes.matchAll(/<(?:Override|Default)\b[^>]*\/>/g)).map(match=>attributes(match[0]));
      const type=typeEntries.find(entry=>entry.PartName===`/${name}`)?.ContentType??typeEntries.find(entry=>entry.Extension===path.posix.extname(name).slice(1))?.ContentType;
      if(type)contentTypes=contentTypes.replace("</Types>",`<Override PartName="/${destination}" ContentType="${type}"/></Types>`);
      const relName=path.posix.join(path.posix.dirname(name),"_rels",path.posix.basename(name)+".rels");
      const relFile=source.file(relName);
      if(relFile){const rewritten=await rewriteRelations(await relFile.async("string"),name,destination);output.file(path.posix.join(path.posix.dirname(destination),"_rels",path.posix.basename(destination)+".rels"),rewritten);}
      return destination;
    }
    async function rewriteRelations(xml:string,from:string,to:string){
      for(const match of Array.from(xml.matchAll(/<Relationship\b[^>]*\/>/g))){
        const rel=attributes(match[0]);if(rel.TargetMode==="External")continue;
        const name=rel.Target.startsWith("/")?rel.Target.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(from),rel.Target));
        const destination=await clonePart(name),target=path.posix.relative(path.posix.dirname(to),destination);
        xml=xml.replace(match[0],match[0].replace(/\bTarget="[^"]*"/,`Target="${target}"`));
      }
      return xml;
    }
    const rels=await rewriteRelations(await originalRels.async("string"),sourcePart,targetPart);
    output.file(`xl/worksheets/_rels/sheet${sheet.targetSheet}.xml.rels`,rels);
    let xml=await output.file(targetPart)!.async("string");
    for(const tag of ["printOptions","pageMargins","pageSetup","headerFooter","drawing","legacyDrawing","legacyDrawingHF","picture"]){
      const pattern=new RegExp(`<${tag}\\b[^>]*(?:/>|>[\\s\\S]*?</${tag}>)`);
      const value=original.match(pattern)?.[0];if(!value)continue;
      if(pattern.test(xml))xml=xml.replace(pattern,value);
      else xml=xml.replace("</worksheet>",`${value}</worksheet>`);
    }
    output.file(targetPart,xml);
  }
  output.file("[Content_Types].xml",contentTypes);
  return output.generateAsync({type:"nodebuffer",compression:"DEFLATE"});
}
