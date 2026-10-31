import * as CFB from "cfb";
import { FormExportError } from "./form-templates";

interface RecordEntry { type: number; data: Buffer; offset: number }
export interface BiffCell { row: number; col: number; style: number; text: string; formula?: boolean }
export interface BiffSheet { name: string; offset: number; cells: Map<string, BiffCell>; merges: number[][] }

function records(buffer: Buffer): RecordEntry[] {
  const result: RecordEntry[] = [];
  for (let p = 0; p + 4 <= buffer.length;) {
    const type = buffer.readUInt16LE(p), length = buffer.readUInt16LE(p + 2);
    if (!type && !length) break; // OLE stream padding
    if (p + 4 + length > buffer.length) throw new FormExportError("Invalid XLS record.", "UNSUPPORTED_TEMPLATE", 422);
    result.push({ type, data: buffer.subarray(p + 4, p + 4 + length), offset: p });
    p += 4 + length;
  }
  return result;
}
function record(type: number, data: Buffer): Buffer {
  const header = Buffer.alloc(4); header.writeUInt16LE(type); header.writeUInt16LE(data.length, 2);
  return Buffer.concat([header, data]);
}
function sharedStrings(entries: RecordEntry[]): string[] {
  const sst = entries.find(r => r.type === 0xfc)?.data;
  if (!sst) return [];
  // These checked-in templates each have a single, complete SST record.
  // Fail closed if a future replacement needs continuation decoding.
  const result: string[] = []; let p = 8;
  for (let i = 0; i < sst.readUInt32LE(4); i++) {
    if (p + 3 > sst.length) throw new FormExportError("Unsupported continued XLS strings.", "UNSUPPORTED_TEMPLATE", 422);
    const length = sst.readUInt16LE(p); p += 2;
    const flags = sst[p++]; let runs = 0, extra = 0;
    if (flags & 8) { runs = sst.readUInt16LE(p); p += 2; }
    if (flags & 4) { extra = sst.readUInt32LE(p); p += 4; }
    const end = p + length * (flags & 1 ? 2 : 1);
    if (end + runs * 4 + extra > sst.length) throw new FormExportError("Unsupported continued XLS strings.", "UNSUPPORTED_TEMPLATE", 422);
    result.push(sst.toString(flags & 1 ? "utf16le" : "latin1", p, end));
    p = end + runs * 4 + extra;
  }
  return result;
}
export function readBiff(source: Buffer) {
  const container = CFB.read(source, { type: "buffer" });
  const stream = CFB.find(container, "Workbook");
  if (!stream) throw new FormExportError("Workbook stream missing.", "UNSUPPORTED_TEMPLATE", 422);
  const entries = records(Buffer.from(stream.content));
  const strings = sharedStrings(entries);
  const sheets: BiffSheet[] = entries.filter(r => r.type === 0x85).map(({ data }) => ({
    name: data.toString(data[7] & 1 ? "utf16le" : "latin1", 8, 8 + data[6] * (data[7] & 1 ? 2 : 1)),
    offset: data.readUInt32LE(0), cells: new Map(), merges: [],
  }));
  for (const sheet of sheets) {
    const next = Math.min(...sheets.filter(s => s.offset > sheet.offset).map(s => s.offset), Infinity);
    for (const { type, data: d, offset } of entries) {
      if (offset < sheet.offset || offset >= next) continue;
      if (type === 0xe5) for (let p = 2; p + 8 <= d.length; p += 8) sheet.merges.push([d.readUInt16LE(p)+1, d.readUInt16LE(p+2)+1, d.readUInt16LE(p+4)+1, d.readUInt16LE(p+6)+1]);
      if ([0x201, 0xfd, 0x203, 0x204, 0x6, 0x27e].includes(type)) {
        const row = d.readUInt16LE(0)+1, col = d.readUInt16LE(2)+1, style = d.readUInt16LE(4);
        let text = "";
        if (type === 0xfd) text = strings[d.readUInt32LE(6)] ?? "";
        if (type === 0x203) text = String(d.readDoubleLE(6));
        if (type === 0x204) text = d.toString(d[8] & 1 ? "utf16le" : "latin1", 9, 9+d.readUInt16LE(6)*(d[8]&1?2:1));
        if (type === 0x27e) {
          const rk = d.readInt32LE(6); const raw = Buffer.alloc(8); raw.writeInt32LE(rk & ~3, 4);
          text = String((rk & 2 ? rk >> 2 : raw.readDoubleLE()) / (rk & 1 ? 100 : 1));
        }
        sheet.cells.set(`${row}:${col}`, { row, col, style, text, formula: type === 0x6 });
      }
      if (type === 0xbe) {
        const row = d.readUInt16LE(0)+1, first = d.readUInt16LE(2)+1, last = d.readUInt16LE(d.length-2)+1;
        for (let col = first; col <= last; col++) sheet.cells.set(`${row}:${col}`, { row, col, style: d.readUInt16LE(4+(col-first)*2), text: "", formula: false });
      }
    }
  }
  return { container, stream, entries, sheets };
}

/** Retains opaque drawing/printing/style records and all other OLE streams.
 * INDEX/DBCELL are optional acceleration records whose offsets become stale after edits.
 * BOUNDSHEET offsets are rebuilt after replacing selected cell records.
 */
export function patchBiff(source: Buffer, changes: Map<string, string>, numericFields=new Set<string>()): Buffer {
  const { container, stream, entries, sheets } = readBiff(source);
  const outputs: Buffer[] = []; const offsets = new Map<number, number>(); let size = 0;
  let sheetIndex = -1;
  const add = (b: Buffer) => { outputs.push(b); size += b.length; };
  const addLabel = (si:number,row:number,col:number,text:string) => {
    const cell=sheets[si].cells.get(`${row}:${col}`);
    if(!cell||cell.formula) throw new FormExportError("Selected XLS field is not editable.");
    if(numericFields.has(`${si}:${row}:${col}`)){
      const number=Number(text);if(!Number.isFinite(number))throw new FormExportError("Invalid recorded numeric value.");
      const data=Buffer.alloc(14);data.writeUInt16LE(row-1);data.writeUInt16LE(col-1,2);data.writeUInt16LE(cell.style,4);data.writeDoubleLE(number,6);add(record(0x203,data));return;
    }
    const label=Buffer.alloc(9+text.length*2);
    label.writeUInt16LE(row-1);label.writeUInt16LE(col-1,2);label.writeUInt16LE(cell.style,4);
    label.writeUInt16LE(text.length,6);label[8]=1;label.write(text,9,"utf16le");add(record(0x204,label));
  };
  for (const entry of entries) {
    const index = sheets.findIndex(s => s.offset === entry.offset);
    if (index >= 0) { sheetIndex = index; offsets.set(entry.offset, size); }
    const { type, data: d } = entry;
    if (sheetIndex >= 0 && [0x20b, 0xd7].includes(type)) continue;
    if (sheetIndex >= 0 && [0x201, 0xfd, 0x203, 0x204, 0x27e].includes(type)) {
      const key = `${sheetIndex}:${d.readUInt16LE(0)+1}:${d.readUInt16LE(2)+1}`;
      if (changes.has(key)) {addLabel(sheetIndex,d.readUInt16LE(0)+1,d.readUInt16LE(2)+1,changes.get(key)!);continue;}
    }
    if (sheetIndex >= 0 && type === 0xbe) {
      const row = d.readUInt16LE(0)+1, first = d.readUInt16LE(2)+1, last = d.readUInt16LE(d.length-2)+1;
      // Split only a MULBLANK containing a selected cell.
      if (Array.from(changes.keys()).some(k => k.startsWith(`${sheetIndex}:${row}:`) && +k.split(":")[2] >= first && +k.split(":")[2] <= last)) {
        for (let col = first; col <= last; col++) {
          const value=changes.get(`${sheetIndex}:${row}:${col}`);
          if(value!==undefined)addLabel(sheetIndex,row,col,value);
          else {const blank = Buffer.alloc(6); blank.writeUInt16LE(row-1); blank.writeUInt16LE(col-1,2); blank.writeUInt16LE(d.readUInt16LE(4+(col-first)*2),4); add(record(0x201, blank));}
        }
        continue;
      }
    }
    add(record(type,d));
  }
  const workbook = Buffer.concat(outputs);
  for (const entry of records(workbook)) if (entry.type === 0x85) {
    const offset = offsets.get(entry.data.readUInt32LE(0));
    if (offset === undefined) throw new FormExportError("Invalid sheet offset.", "UNSUPPORTED_TEMPLATE", 422);
    workbook.writeUInt32LE(offset,entry.offset+4);
  }
  stream.content = workbook; stream.size = workbook.length;
  return Buffer.from(CFB.write(container, { type: "buffer" }));
}
