"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Dialog } from "./receiving-custodian-dialogs";
import { Button } from "@/components/ui/button";
import { getReceivingCustodianUnitAction, searchReceivingCustodianUnitsAction, searchReceivingCustodianCandidatesAction, searchReceiptAssetsAction, recordItemReceiptAction } from "@/actions/receiving-custodian-actions";
import { validateDesignation } from "@/lib/receiving-custodian-validation";
import type { PersonSummary } from "@/types/receiving-custodian";
import type { ItemReceiptInput, ReceiptAssetOption } from "@/types/item-receipt";

const inputClass = "mt-1 w-full rounded border border-border bg-cream px-3 py-2 text-sm focus:outline-2 focus:outline-[#A60212]";

export function ItemReceiptDialog({ initialUnitId, onClose, onComplete }: { initialUnitId: string; onClose: () => void; onComplete: () => void }) {
  const [unitId, setUnitId] = useState(initialUnitId);
  const [units, setUnits] = useState<{ id: string; code: string; name: string }[]>([]);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [assets, setAssets] = useState<ReceiptAssetOption[]>([]);
  const [suggestion, setSuggestion] = useState<PersonSummary | null>(null);
  const [personId, setPersonId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [mode, setMode] = useState<"EXISTING" | "NEW">("NEW");
  const [unitQuery, setUnitQuery] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [personQuery, setPersonQuery] = useState("");
  const [moreUnits, setMoreUnits] = useState(false);
  const [moreAssets, setMoreAssets] = useState(false);
  const [morePeople, setMorePeople] = useState(false);
  const [unitReady, setUnitReady] = useState(false);
  const [loading, setLoading] = useState(!!initialUnitId);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({ employeeNo: "", fullName: "", position: "", email: "" });
  const operation = useRef("");
  const lastInput = useRef<ItemReceiptInput | null>(null);
  const generation = useRef(0);
  const errorPrefix = useId();
  useEffect(() => {
    let active = true;
    searchReceivingCustodianUnitsAction().then(result => { if (active) { if (result.success) { setUnits(result.data.items); setMoreUnits(result.data.hasMore); } else setError(result.error); } }).catch(() => { if (active) setError("Unable to load units. Retry Search Units."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!unitId) return;
    let active = true;
    const request = ++generation.current;
    Promise.all([searchReceiptAssetsAction({ unitId }), getReceivingCustodianUnitAction({ unitId })]).then(([items, unit]) => {
      if (!active || request !== generation.current) return;
      setUnitReady(items.success && unit.success && unit.data.row.unit.isActive);
      if (items.success) { setAssets(items.data.items); setMoreAssets(items.data.hasMore); } else setError(items.error);
      if (unit.success) { setSuggestion(unit.data.row.person); setUnits(old => old.some(u => u.id === unitId) ? old : [unit.data.row.unit, ...old]); } else setError(unit.error);
    }).catch(() => { if (active) setError("Unable to load items and receivers. Reload this unit."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [unitId, reload]);

  useEffect(() => {
    if (!unitId || mode !== "EXISTING") return;
    let active = true;
    searchReceivingCustodianCandidatesAction({ unitId }).then(result => {
      if (!active) return;
      if (result.success) { setPeople(result.data.items); setMorePeople(result.data.hasMore); }
      else setError(result.error);
    }).catch(() => { if (active) setError("Unable to load personnel. Retry Search Personnel or enter receiver details."); });
    return () => { active = false; };
  }, [unitId, mode, reload]);

  function resetUnit(next: string) {
    generation.current++; setSearching(false); setUnitReady(false); setUnitId(next); setAssets([]); setPeople([]); setAssetId(""); setPersonId(""); setSuggestion(null); setLoading(!!next); setError(""); setFields({}); setAssetQuery(""); setPersonQuery(""); operation.current = "";
  }
  async function search(kind: "unit" | "asset" | "person") {
    const request = generation.current;
    setSearching(true); setError("");
    try {
      if (kind === "unit") {
        const result = await searchReceivingCustodianUnitsAction({ query: unitQuery });
        if (result.success) { setUnits(result.data.items); setMoreUnits(result.data.hasMore); } else setError(result.error);
      } else if (kind === "asset") {
        const result = await searchReceiptAssetsAction({ unitId, query: assetQuery });
        if (request !== generation.current) return;
        if (result.success) { setAssets(result.data.items); setMoreAssets(result.data.hasMore); setAssetId(""); operation.current = ""; } else setError(result.error);
      } else {
        const result = await searchReceivingCustodianCandidatesAction({ unitId, query: personQuery });
        if (request !== generation.current) return;
        if (result.success) { setPeople(result.data.items); setMorePeople(result.data.hasMore); setPersonId(""); } else setError(result.error);
      }
    } catch { if (request === generation.current) setError("Search failed. Please retry."); }
    finally { if (request === generation.current) setSearching(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const asset = assets.find(a => a.id === assetId);
    if (!uncertain && (!unitReady || !asset)) { setError("Choose an item first."); return; }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const receiver = mode === "EXISTING" ? { mode, personId } : { mode, person: { fullName: draft.fullName, position: draft.position } };
    const remarks = form.get("remarks")?.toString() ?? "";
    if (!uncertain) {
      const validation = validateDesignation({ ...receiver, unitId, expectedRevision: 0, reason: remarks });
      if (validation.reason) { validation.remarks = validation.reason; delete validation.reason; }
      setFields(validation);
      if (Object.keys(validation).length) { setError("Please correct the highlighted fields."); requestAnimationFrame(() => formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    }
    if (!operation.current) operation.current = crypto.randomUUID();
    const payload = uncertain ? lastInput.current : { operationId: operation.current, unitId, assetId, expectedAssetUpdatedAt: asset!.updatedAt, remarks, receiver };
    if (!payload) return;
    lastInput.current = payload;
    setSaving(true); setError("");
    try {
      const result = await recordItemReceiptAction(payload);
      if (result.success) onComplete();
      else { setError(result.error); setFields(result.fieldErrors ?? {}); requestAnimationFrame(() => formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); setUncertain(false); if (["CONFLICT", "NOT_FOUND", "UNIT_INACTIVE"].includes(result.code)) setAssetId(""); }
    } catch { setError("The response could not be confirmed. Retry the same receipt to check safely; it will not be duplicated."); setUncertain(true); }
    finally { setSaving(false); }
  }
  function fieldError(name: string) { return fields[name] ? <span id={`${errorPrefix}-${name}`} className="mt-1 block text-xs text-[#A60212]">{fields[name]}</span> : null; }
  const selectedAsset = assets.find(a => a.id === assetId);
  const chosenPerson = people.find(p => p.id === personId);
  return <Dialog title="Record Item Receipt" busy={saving} onClose={onClose}><form onSubmit={submit} onInvalid={event => { const form = event.currentTarget; if (event.target === form.querySelector(":invalid")) (event.target as HTMLElement).focus(); }} className="space-y-4">
    <p className="text-sm">Enter the details of the person who received this item.</p>
    {error && <p role="alert" className="rounded border border-[#A60212] bg-cream p-3 text-sm text-[#A60212]">{error}</p>}
    <fieldset disabled={saving || uncertain} className="space-y-4">
      {mode === "NEW" && <label className="block text-xs font-bold">Name *<input className={inputClass} required minLength={2} maxLength={150} value={draft.fullName} onChange={e => setDraft(old => ({ ...old, fullName: e.target.value }))} aria-invalid={!!fields.fullName} />{fieldError("fullName")}</label>}
      <div className="flex items-end gap-2"><label className="flex-1 text-xs font-bold">Find office / college<input className={inputClass} value={unitQuery} maxLength={100} onChange={e => setUnitQuery(e.target.value)} /></label><Button type="button" size="sm" variant="secondary" disabled={searching} onClick={() => search("unit")}>Search Units</Button></div>
      {moreUnits && <p className="text-xs">Showing 20 matching units. Refine your search.</p>}
      <label className="block text-xs font-bold">College *<select className={inputClass} value={unitId} required disabled={searching} onChange={e => resetUnit(e.target.value)}><option value="">Choose receiving unit</option>{unitId && !units.some(u => u.id === unitId) && <option value={unitId}>Current selected unit</option>}{units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}</select></label>
      {mode === "NEW" && <label className="block text-xs font-bold">Position *<input className={inputClass} required minLength={2} maxLength={150} value={draft.position} onChange={e => setDraft(old => ({ ...old, position: e.target.value }))} aria-invalid={!!fields.position} />{fieldError("position")}</label>}
      {loading && <p role="status">Loading this unit’s items…</p>}
      {unitId && <Button type="button" size="sm" variant="secondary" disabled={loading || searching} onClick={() => { setUnitReady(false); setLoading(true); setAssets([]); setAssetId(""); setPersonId(""); setError(""); setReload(n => n + 1); }}>Reload unit</Button>}
      {unitId && !loading && <>
        <div className="flex items-end gap-2"><label className="flex-1 text-xs font-bold">Find item<input className={inputClass} value={assetQuery} maxLength={100} onChange={e => setAssetQuery(e.target.value)} placeholder="Property number or item name" /></label><Button type="button" size="sm" variant="secondary" disabled={searching} onClick={() => search("asset")}>Search Items</Button></div>
        <label className="block text-xs font-bold">Item being received *<select className={inputClass} required value={assetId} disabled={searching} onChange={e => { setAssetId(e.target.value); operation.current = ""; }}><option value="">Choose a specific property-tagged item</option>{assets.map(a => <option key={a.id} value={a.id}>{a.propertyNo} — {a.name}</option>)}</select></label>
        {!assets.length && <p className="text-sm">No available items found in this unit. Register the item or complete its transfer into this unit before recording receipt.</p>}{moreAssets && <p className="text-xs">Showing 20 matches. Search by property number to find another item.</p>}
        {suggestion && <div className="rounded bg-cream p-3 text-sm">Suggested office contact: <strong>{suggestion.fullName}</strong>. You may choose someone else.<Button type="button" className="mt-2" size="sm" variant="outline" onClick={() => { setMode("EXISTING"); setPeople(old => old.some(p => p.id === suggestion.id) ? old : [suggestion, ...old]); setPersonId(suggestion.id); }}>Use suggested contact</Button></div>}
        <fieldset className="flex flex-wrap gap-4 text-sm"><legend className="mb-2 text-xs font-bold">Actual receiver</legend><label><input name="receiverMode" type="radio" checked={mode === "NEW"} onChange={() => { setMode("NEW"); setFields({}); setError(""); }} /> Enter receiver details</label><label><input name="receiverMode" type="radio" checked={mode === "EXISTING"} onChange={() => { setMode("EXISTING"); setFields({}); setError(""); }} /> Use a registered person</label></fieldset>
        {mode === "EXISTING" ? <><div className="flex items-end gap-2"><label className="flex-1 text-xs font-bold">Find receiver<input className={inputClass} value={personQuery} maxLength={100} onChange={e => setPersonQuery(e.target.value)} placeholder="Employee name or number" /></label><Button type="button" size="sm" variant="secondary" disabled={searching} onClick={() => search("person")}>Search Personnel</Button></div><label className="block text-xs font-bold">Received by *<select className={inputClass} value={personId} required disabled={searching} onChange={e => setPersonId(e.target.value)} aria-invalid={!!fields.personId} aria-describedby={fields.personId ? `${errorPrefix}-personId` : undefined}><option value="">Choose actual receiver</option>{people.map(p => <option key={p.id} value={p.id}>{p.fullName} · {p.employeeNo} · {p.position}</option>)}</select>{fieldError("personId")}</label>{!people.length && <p className="text-sm">No matching personnel. Enter receiver details if they are not yet in People.</p>}{morePeople && <p className="text-xs">Showing 20 matches. Refine your personnel search.</p>}</> : null}
        {selectedAsset && <p className="rounded border border-border p-3 text-sm">Record receipt of <strong>{selectedAsset.propertyNo}</strong> by <strong>{mode === "NEW" ? draft.fullName || "the new receiver" : chosenPerson?.fullName || "the selected receiver"}</strong>.</p>}
      </>}

      <p className="text-xs text-[#6E2B32]">Saving timestamps this receipt and preserves previous receipts.</p>
    </fieldset>
    {saving && <p role="status">Saving receipt…</p>}
    <div className="flex justify-end gap-3 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || (!uncertain && (loading || searching || !unitReady || !selectedAsset))}>{saving ? "Saving…" : uncertain ? "Retry same receipt" : "Record Receipt"}</Button></div>
  </form></Dialog>;
}
