import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

function fixture() {
  const actor = { id: "staff", role: "STAFF", unitId: "office", isActive: true };
  const asset = { id: "asset", unitId: "office", status: "IN_STORAGE", condition: "EXCELLENT", isDeleted: false, unit: { code: "AMO" } };
  type Report = { id: string; assetId: string; status: string; resolvedAt?: Date | null; [key: string]: unknown };
  const reports: Report[] = [];
  const events: { action: string; entityId: string; beforeState?: Record<string, unknown>; [key: string]: unknown }[] = [];
  const tx = {
    $queryRaw: async () => [],
    asset: { findUnique: async () => ({ ...asset }), update: async ({ data }: { data: object }) => Object.assign(asset, data) },
    missingReport: {
      findFirst: async () => reports.find(r => ["REPORTED", "UNDER_INVESTIGATION"].includes(r.status)) ?? null,
      create: async ({ data }: { data: Omit<Report, "id"> }) => { const r = { id: `report-${reports.length}`, ...data } as Report; reports.push(r); return r; },
      findUnique: async ({ where }: { where: { id: string } }) => { const r = reports.find(r => r.id === where.id); return r ? { ...r, asset: { ...asset } } : null; },
      update: async ({ where, data }: { where: { id: string }; data: object }) => Object.assign(reports.find(r => r.id === where.id)!, data),
    },
    auditLog: { findFirst: async ({ where }: { where: { entityId: string } }) => events.find(e => e.entityId === where.entityId && e.action === "REPORT_MISSING") ?? null },
  };
  const db = { $transaction: async (cb: (client: typeof tx) => unknown) => cb(tx) };
  const exports: Record<string, (...args: unknown[]) => Promise<{ error?: string; success?: boolean }>> = {};
  const source = fs.readFileSync("src/actions/missing-actions.ts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const modules: Record<string, unknown> = {
    "@/lib/db": { prisma: db }, "@/lib/auth": { getSession: async () => actor }, "next/cache": { revalidatePath: () => {} },
    "@/lib/audited-transaction": { operationFromForm: () => ({}), auditedTransaction: async (_db: unknown, _id: string, _op: unknown, cb: (client: typeof tx) => unknown) => cb(tx) },
    "@/lib/audit-log-write": {
      requireAuditActor: async (_tx: unknown, _id: string, roles: string[]) => { if (!roles.includes(actor.role)) throw Error("Forbidden"); return actor; },
      updateAuditedAsset: async (_tx: unknown, _id: string, input: { data: object }) => Object.assign(asset, input.data),
      writeAuditEvent: async (_tx: unknown, { data }: { data: typeof events[number] }) => events.push(data),
    },
  };
  vm.runInNewContext(compiled, { exports, require: (name: string) => { if (!(name in modules)) throw Error(`Unexpected dependency: ${name}`); return modules[name]; }, Date, URL });
  const form = () => { const f = new FormData(); for (const [k, v] of Object.entries({ assetId: "asset", locationLastSeen: "Office", lastSeenDate: "2026-10-30", circumstances: "Not found during count" })) f.set(k, v); return f; };
  const file = (f = form()) => exports.fileMissingIncidentAction(f);
  const stage = (status: string) => exports.updateMissingReportStatusAction("report-0", status);
  return { actor, asset, reports, events, form, file, stage };
}

test("filing preserves the physical condition", async () => { const f = fixture(); assert.ok((await f.file()).success); assert.equal(f.asset.condition, "EXCELLENT"); });
test("a second active incident is rejected", async () => { const f = fixture(); await f.file(); assert.ok((await f.file()).error); assert.equal(f.reports.length, 1); });
test("disposed assets cannot be reported missing", async () => { const f = fixture(); f.asset.status = "DISPOSED"; assert.ok((await f.file()).error); assert.equal(f.reports.length, 0); });
test("recovery restores storage status", async () => { const f = fixture(); await f.file(); await f.stage("UNDER_INVESTIGATION"); assert.ok((await f.stage("FOUND")).success); assert.equal(f.asset.status, "IN_STORAGE"); });
test("resolved incidents cannot reopen", async () => { const f = fixture(); await f.file(); await f.stage("UNDER_INVESTIGATION"); await f.stage("FOUND"); assert.ok((await f.stage("REPORTED")).error); assert.equal(f.reports[0].status, "FOUND"); });
test("invalid and future last-seen dates are rejected", async () => { for (const date of ["invalid", "2099-01-01", "2026-02-30", ""]) { const f = fixture(); const form = f.form(); form.set("lastSeenDate", date); assert.ok((await f.file(form)).error, date); } });
test("custodians cannot file incidents for another office", async () => { const f = fixture(); f.actor.role = "CUSTODIAN"; f.actor.unitId = "other"; assert.ok((await f.file()).error); });
test("auditors cannot file or update incidents", async () => { const f = fixture(); await f.file(); f.actor.role = "AUDITOR"; assert.ok((await f.file()).error); assert.ok((await f.stage("UNDER_INVESTIGATION")).error); });
test("write-off marks the asset for disposal", async () => { const f = fixture(); await f.file(); await f.stage("UNDER_INVESTIGATION"); assert.ok((await f.stage("WRITTEN_OFF")).success); assert.equal(f.asset.status, "FOR_DISPOSAL"); assert.ok(f.reports[0].resolvedAt); });

function renderBoard(canManage: boolean, needsFiling = false) {
  const localRequire = createRequire(import.meta.url);
  const exports: Record<string, React.ComponentType<Record<string, unknown>>> = {};
  const source = fs.readFileSync("src/components/missing/missing-board.tsx", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const modules: Record<string, unknown> = {
    "next/link": { default: ({ children }: { children: React.ReactNode }) => children, __esModule: true },
    "@/components/audit/transaction-attribution-button": { TransactionAttributionButton: () => null },
    "@/lib/utils": { formatCurrency: String, formatDate: String },
    "@/actions/missing-actions": { updateMissingReportStatusAction: async () => ({ success: true }) },
    "@/components/missing/incident-filing-modal": { IncidentFilingModal: () => createElement("button", null, "Complete incident report") },
  };
  vm.runInNewContext(compiled, { exports, require: (name: string) => name in modules ? modules[name] : localRequire(name) });
  return renderToStaticMarkup(createElement(exports.MissingBoard, { canManage, canFile: canManage, incidents: [{ id: "report", assetId: "asset", status: "REPORTED", propertyNo: "A-1", policeBlotterUrl: "https://example.com/blotter", cost: 100, circumstances: "Missing during count", needsFiling }] }));
}
test("read-only users have no investigation controls", () => { assert.doesNotMatch(renderBoard(false), /Commence Investigation/); });
test("staff retain investigation controls", () => { assert.match(renderBoard(true), /Commence Investigation/); });
test("attached blotters do not claim verification", () => { assert.doesNotMatch(renderBoard(true), /Police Blotter Verified/); assert.match(renderBoard(true), /View attached blotter/); });

test("stage failures surface errors and release the pending state", async () => {
  for (const throws of [false, true]) {
    const localRequire = createRequire(import.meta.url);
    const states: unknown[] = [];
    const exports: Record<string, (props: unknown) => unknown> = {};
    const compiled = ts.transpileModule(fs.readFileSync("src/components/missing/missing-board.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const modules: Record<string, unknown> = {
      react: { useState: () => [null, (value: unknown) => states.push(value)], useRef: () => ({ current: false }) },
      "next/link": () => null,
      "@/components/missing/incident-filing-modal": { IncidentFilingModal: () => null },
      "@/components/audit/transaction-attribution-button": { TransactionAttributionButton: () => null },
      "@/lib/utils": { formatCurrency: String, formatDate: String },
      "@/actions/missing-actions": { updateMissingReportStatusAction: async () => { if (throws) throw Error("Network failed"); return { error: "Cannot save this incident" }; } },
    };
    vm.runInNewContext(compiled, { exports, require: (name: string) => name in modules ? modules[name] : localRequire(name) });
    type Element = { type?: string; props?: { onClick?: () => Promise<void>; children?: unknown } };
    function findButton(value: unknown): Element | undefined {
      if (Array.isArray(value)) return value.map(findButton).find(Boolean);
      if (!value || typeof value !== "object") return;
      const element = value as Element;
      return element.type === "button" ? element : findButton(element.props?.children);
    }
    const tree = exports.MissingBoard({ canManage: true, incidents: [{ id: "report", status: "REPORTED", cost: 10 }] });
    const button = findButton(tree);
    assert.ok(button?.props?.onClick);
    await button.props.onClick();
    assert.ok(states.some(s => !!s && typeof s === "object" && "message" in s && /could not be updated|Cannot save/.test(String(s.message))));
    assert.equal(states.at(-1), null);
  }
});

test("recovery restores repair status instead of assuming deployment", async () => { const f = fixture(); f.asset.status = "UNDER_REPAIR"; await f.file(); await f.stage("UNDER_INVESTIGATION"); await f.stage("FOUND"); assert.equal(f.asset.status, "UNDER_REPAIR"); });
test("legacy recovery uses storage for AMO assets", async () => { const f = fixture(); await f.file(); f.events.splice(0); await f.stage("UNDER_INVESTIGATION"); await f.stage("FOUND"); assert.equal(f.asset.status, "IN_STORAGE"); });
test("unsafe blotter URLs are rejected", async () => { const f = fixture(); const form = f.form(); form.set("policeBlotterUrl", "javascript:alert(1)"); assert.ok((await f.file(form)).error); assert.equal(f.reports.length, 0); });

test("missing assets without an open report can complete incident filing", async () => { const f = fixture(); f.asset.status = "MISSING"; assert.ok((await f.file()).success); assert.equal(f.reports[0].status, "REPORTED"); });
test("a pending-details card offers filing instead of investigation", () => { const html = renderBoard(true, true); assert.match(html, /Complete incident report/); assert.doesNotMatch(html, /Commence Investigation/); });

test("the desk includes status-only missing assets in Newly Reported", async () => {
  const localRequire = createRequire(import.meta.url);
  const exports: { default?: () => Promise<unknown> } = {};
  const asset = { id: "orphan", propertyNo: "BULSU-AMO-000002", name: "Aircon", status: "MISSING", acquisitionCost: 65000, updatedAt: new Date(), unit: { code: "AMO", name: "Asset Management Office" } };
  const modules: Record<string, unknown> = {
    "@/lib/db": { prisma: { missingReport: { findMany: async () => [] }, asset: { findMany: async () => [asset] } } },
    "@/lib/auth": { getSession: async () => ({ role: "STAFF" }) },
    "@/components/missing/missing-board": { MissingBoard: "missing-board" },
    "@/components/missing/incident-filing-modal": { IncidentFilingModal: "filing-modal" },
    "@/lib/utils": { formatCurrency: String }, "next/navigation": { redirect: () => { throw Error("Unexpected redirect"); } },
  };
  const source = fs.readFileSync("src/app/(dashboard)/missing/page.tsx", "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: (name: string) => name in modules ? modules[name] : localRequire(name) });
  type Element = { type?: string; props?: { children?: unknown; incidents?: { assetId: string; status: string; needsFiling?: boolean }[] } };
  function findBoard(value: unknown): Element | undefined {
    if (Array.isArray(value)) return value.map(findBoard).find(Boolean);
    if (!value || typeof value !== "object") return;
    const e = value as Element; return e.type === "missing-board" ? e : findBoard(e.props?.children);
  }
  const board = findBoard(await exports.default!());
  assert.ok(board?.props?.incidents?.some(i => i.assetId === "orphan" && i.status === "REPORTED" && i.needsFiling));
});

test("the dossier opens incident filing with the selected asset", () => {
  const localRequire = createRequire(import.meta.url);
  const exports: Record<string, React.ComponentType<Record<string, unknown>>> = {};
  const modules: Record<string, unknown> = {
    "@/lib/utils": { formatCurrency: String, formatDate: String },
    "@/config/theme": { getStatusBadgeStyle: () => ({}) },
    "next/link": { default: ({ children }: { children: React.ReactNode }) => children, __esModule: true },
    "./new-transfer-modal": { NewTransferModal: () => null },
    "@/components/ui/button": { Button: "button" },
    "@/components/missing/incident-filing-modal": { IncidentFilingModal: ({ defaultAssetId }: { defaultAssetId: string }) => createElement("button", { "data-asset-id": defaultAssetId }, "File incident") },
  };
  const compiled = ts.transpileModule(fs.readFileSync("src/components/inventory/asset-identity-card.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name: string) => name in modules ? modules[name] : localRequire(name) });
  const props = { asset: { id: "aircon", status: "MISSING", category: { usefulLifeYears: 10 }, unit: { code: "AMO" }, acquisitionCost: 65000, acquisitionDate: new Date() }, canReportMissing: true, hasActiveMissingReport: false, allUnits: [], canTransfer: false };
  assert.match(renderToStaticMarkup(createElement(exports.AssetIdentityCard, props)), /data-asset-id="aircon"/);
  const filed = renderToStaticMarkup(createElement(exports.AssetIdentityCard, { ...props, hasActiveMissingReport: true }));
  assert.match(filed, /View missing incident/);
  assert.doesNotMatch(filed, /File incident/);
});
