import test from "node:test";
import assert from "node:assert/strict";
import { previewScale, previewViewHtml } from "../src/lib/document-preview-view";

test("fit width uses the widest visible sheet, reserves scrollbar space and never enlarges",()=>{
  const sheets=[{id:"sheet-0",name:"Narrow",width:400},{id:"sheet-1",name:"Wide",width:1200}];
  assert.equal(previewScale(sheets,"all",600,"fit-width"),548/1200);
  assert.equal(previewScale(sheets,"sheet-0",600,"fit-width"),1);
  assert.equal(previewScale(sheets,"missing",600,"fit-width"),548/1200);
  assert.equal(previewScale(sheets,"all",600,"150"),1.5);
  assert.equal(previewScale(sheets,"all",300,"100"),1);
  assert.equal(previewScale(sheets,"all",600,"bad-css"),1);
  assert.ok(Number.isFinite(previewScale([],"all",0,"fit-width")));
});

test("sheet selection is ordinal, cannot inject selectors, and keeps the artifact intact",()=>{
  const html="<html><head></head><body><section data-preview-sheet=\"x\">A</section><section data-preview-sheet=\"y\">B</section></body></html>";
  const sheets=[{id:'bad\"]{color:red}',name:"A"},{id:"y",name:"B"}];
  const result=previewViewHtml(html,sheets,sheets[0].id,0.5);
  assert.match(result,/nth-of-type\(1\)/);
  assert.ok(!result.includes(sheets[0].id));
  assert.match(result,/zoom:0.5/);
  assert.match(result,/>A<\/section>/);
  assert.match(result,/>B<\/section>/);
  assert.ok(!previewViewHtml(html,sheets,"missing",Infinity).includes("Infinity"));
  assert.equal(html.includes("<style>"),false);
});
