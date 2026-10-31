import { FormExportError } from "./form-templates";

export interface ItemRegion {start:number;end:number}
export function templateItemRegions(id:string,sheet=0):ItemRegion[]{
  switch(id){
    case "par":return [{start:9,end:27}];
    case "ptr":return [{start:18,end:37}];
    case "itr":return [{start:12,end:28}];
    case "rpcppe":return [{start:15,end:34}];
    case "rpcsp":return [{start:14,end:28}];
    case "ics":return [{start:11,end:17},{start:39,end:45}];
    case "return":return sheet===0?[{start:10,end:31}]:[{start:8,end:30}];
    default:return [];
  }
}

/** One coordinate plan for cells, retained rows, formulas and drawing anchors. */
export function createReportLayout(body:ItemRegion[],count:number,offset=0){
  if(!Number.isInteger(count)||count<0||body.length&&count===0)throw new FormExportError("No selected item rows are available.","NO_MATCHING_DATA",422);
  let shift=offset;
  const regions=body.map(region=>{
    const start=region.start+shift,delta=count-(region.end-region.start+1);
    shift+=delta;
    return {...region,count,delta,outputStart:start,outputEnd:start+count-1};
  });
  const regionAt=(row:number)=>regions.find(region=>row>=region.start&&row<=region.end);
  function retainedRow(row:number):number|undefined {
    const region=regionAt(row);
    if(region)return row-region.start<count?region.outputStart+row-region.start:undefined;
    return offset+row+regions.reduce((sum,region)=>sum+(row>region.end?region.delta:0),0);
  }
  function referenceRow(row:number,endOfRange=false){
    const region=regionAt(row);
    if(region&&endOfRange&&row===region.end)return region.outputEnd;
    return retainedRow(row)??region!.outputEnd;
  }
  function requiredRow(row:number){
    const mapped=retainedRow(row);
    if(mapped===undefined)throw new FormExportError("This field belongs to an unused item row.");
    return mapped;
  }
  function formula(value:string){
    // Keep quoted Excel literals untouched; remap local A1 cells and ranges only.
    return value.split(/("(?:[^"]|"")*")/g).map((part,index)=>index%2?part:part.replace(/((?:'[^']+'|[A-Za-z_][\w.]*)!)?(\$?[A-Z]{1,3}\$?)(\d+)(?::(\$?[A-Z]{1,3}\$?)(\d+))?/g,(all,sheet:string|undefined,col:string,row:string,endCol:string|undefined,endRow:string|undefined)=>{
      if(sheet)return all;
      return `${col}${referenceRow(Number(row))}${endCol?`:${endCol}${referenceRow(Number(endRow),true)}`:""}`;
    })).join("");
  }
  return {regions,retainedRow,requiredRow,referenceRow,formula};
}
