"use client";

import { useEffect, useRef, useState, useId } from "react";
import type { ReactNode, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { assignReceivingCustodianAction, removeReceivingCustodianAction, getReceivingCustodianUnitAction, searchReceivingCustodianUnitsAction, searchReceivingCustodianCandidatesAction, getReceivingCustodianHistoryAction } from "@/actions/receiving-custodian-actions";
import { validateDesignation } from "@/lib/receiving-custodian-validation";
import type { AssignInput, PersonSummary, ReceivingCustodianRow, ReceivingCustodianHistoryEntry } from "@/types/receiving-custodian";

const inputClass = "mt-1 w-full rounded border border-border bg-cream px-3 py-2 text-sm focus:outline-2 focus:outline-[#A60212]";
function date(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)) + " PHT"; }

export function Dialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); opener?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg border-2 border-[#A60212] bg-white p-6 text-[#3B0A0F] shadow-2xl backdrop:bg-[#3B0A0F]">
    <div className="mb-4 flex items-start justify-between gap-4 border-b border-border pb-3"><h2 id={titleId} className="text-xl font-extrabold">{title}</h2><Button size="icon" variant="secondary" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</Button></div>
    {children}
  </dialog>;
}

export function ReceivingDesignationDialog({ initialRow, remove, onClose, onComplete }: { initialRow?: ReceivingCustodianRow; remove: boolean; onClose: () => void; onComplete: (message: string) => void }) {
  const router = useRouter();
  const [unitId, setUnitId] = useState(initialRow?.unit.id ?? "");
  const [current, setCurrent] = useState<ReceivingCustodianRow | null>(null);
  const [unitOptions, setUnitOptions] = useState<{ id: string; code: string; name: string }[]>(initialRow ? [initialRow.unit] : []);
  const [unitQuery, setUnitQuery] = useState("");
  const [unitMore, setUnitMore] = useState(false);
  const [unitBusy, setUnitBusy] = useState(false);
  const [mode, setMode] = useState<"EXISTING" | "NEW">("NEW");
  const [candidates, setCandidates] = useState<PersonSummary[]>([]);
  const [personId, setPersonId] = useState("");
  const [personQuery, setPersonQuery] = useState("");
  const [personMore, setPersonMore] = useState(false);
  const [personBusy, setPersonBusy] = useState(false);
  const [loading, setLoading] = useState(!!initialRow);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [stale, setStale] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newPerson, setNewPerson] = useState<Record<string, string>>({ employeeNo: "", fullName: "", position: "", email: "" });
  const personRequest = useRef(0);
  const unitRequest = useRef(0);
  const fieldPrefix = useId();

  useEffect(() => {
    if (initialRow) return;
    let active = true;
    searchReceivingCustodianUnitsAction().then(result => {
      if (!active) return;
      if (result.success) { setUnitOptions(result.data.items); setUnitMore(result.data.hasMore); }
      else setError(result.error);
    }).catch(() => { if (active) setError("Unable to load offices or colleges. Retry the unit search."); });
    return () => { active = false; };
  }, [initialRow]);

  useEffect(() => {
    if (!unitId) return;
    let active = true;
    getReceivingCustodianUnitAction({ unitId }).then(unit => {
      if (!active) return;
      if (unit.success) { setCurrent(unit.data.row); setStale(false); } else { setError(unit.error); if (unit.code === "UNAUTHENTICATED") router.push("/login"); }
    }).catch(() => { if (active) setError("Unable to load the designation. Please reload it."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [unitId, refreshKey, remove, router]);

  useEffect(() => {
    if (!unitId || remove || mode !== "EXISTING") return;
    let active = true;
    const request = ++personRequest.current;
    searchReceivingCustodianCandidatesAction({ unitId }).then(result => {
      if (!active || request !== personRequest.current) return;
      if (result.success) { setCandidates(result.data.items); setPersonMore(result.data.hasMore); }
      else setError(result.error);
    }).catch(() => { if (active) setError("Unable to load personnel. Retry Search Personnel or enter custodian details."); });
    return () => { active = false; };
  }, [unitId, remove, mode, refreshKey]);

  async function searchUnits() {
    const request = ++unitRequest.current;
    setUnitBusy(true); setError("");
    try {
      const result = await searchReceivingCustodianUnitsAction({ query: unitQuery });
      if (request !== unitRequest.current) return;
      if (result.success) { setUnitOptions(result.data.items); setUnitMore(result.data.hasMore); }
      else setError(result.error);
    } catch { setError("Unable to search offices or colleges. Try again."); }
    finally { if (request === unitRequest.current) setUnitBusy(false); }
  }
  async function searchPeople() {
    const request = ++personRequest.current;
    setPersonBusy(true); setError(""); setPersonId("");
    try {
      const result = await searchReceivingCustodianCandidatesAction({ unitId, query: personQuery });
      if (request !== personRequest.current) return;
      if (result.success) { setCandidates(result.data.items); setPersonMore(result.data.hasMore); }
      else setError(result.error);
    } catch { setError("Unable to search personnel. Please retry."); }
    finally { if (request === personRequest.current) setPersonBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current || stale || saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const base = { unitId: current.unit.id, expectedRevision: current.revision, reason: form.get("reason")?.toString() ?? "" };
    const assignment: AssignInput = mode === "EXISTING" ? { ...base, mode, personId } : { ...base, mode, person: { fullName: form.get("fullName")?.toString() ?? "", position: form.get("position")?.toString() ?? "" } };
    const validation = validateDesignation(remove ? base : assignment, remove);
    setFields(validation);
    if (Object.keys(validation).length) { setError("Please correct the highlighted fields."); requestAnimationFrame(() => formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    setSaving(true); setError("");
    try {
      const result = remove ? await removeReceivingCustodianAction(base) : await assignReceivingCustodianAction(assignment);
      if (!result.success) {
        setError(result.error); setFields(result.fieldErrors ?? {});
        requestAnimationFrame(() => formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
        if (["CONFLICT", "ALREADY_ASSIGNED", "NOT_ASSIGNED", "UNIT_INACTIVE"].includes(result.code)) setStale(true);
        if (result.code === "PERSON_UNIT_MISMATCH" || result.code === "NOT_FOUND") { setPersonId(""); setStale(true); }
        if (result.code === "FORBIDDEN") { setStale(true); router.refresh(); }
        if (result.code === "UNAUTHENTICATED") router.push("/login");
      } else onComplete(remove ? "Receiving custodian removed." : current.person ? "Receiving custodian replaced." : "Receiving custodian assigned.");
    } catch { setError("The response could not be confirmed. Reload the designation before trying again."); setStale(true); }
    finally { setSaving(false); }
  }
  const title = remove ? "Remove Receiving Custodian" : current?.person ? "Replace Receiving Custodian" : "Assign Receiving Custodian";
  function fieldError(name: string) { return fields[name] ? <span id={`${fieldPrefix}-${name}-error`} className="mt-1 block text-xs text-[#A60212]">{fields[name]}</span> : null; }
  const selectedPerson = candidates.find(p => p.id === personId);
  const proposedName = mode === "NEW" ? newPerson.fullName.trim() : selectedPerson?.fullName;
  return <Dialog title={title} busy={saving} onClose={onClose}>
    <form onSubmit={submit} onInvalid={event => { const form = event.currentTarget; if (event.target === form.querySelector(":invalid")) (event.target as HTMLElement).focus(); }} className="space-y-4">
      {error && <p role="alert" className="rounded border border-[#A60212] bg-cream p-3 text-sm text-[#A60212]">{error}</p>}
      <fieldset disabled={saving} className="space-y-4">
        {!remove && mode === "NEW" && <label className="block text-xs font-bold">Name *<input className={inputClass} name="fullName" required minLength={2} maxLength={150} value={newPerson.fullName} onChange={e => setNewPerson(old => ({ ...old, fullName: e.target.value }))} aria-invalid={!!fields.fullName} />{fieldError("fullName")}</label>}
        {!initialRow && <div className="space-y-2"><label className="block text-xs font-bold">Find office or college<input className={inputClass} value={unitQuery} maxLength={100} onChange={e => setUnitQuery(e.target.value)} /></label><Button type="button" variant="secondary" onClick={searchUnits} disabled={unitBusy}>{unitBusy ? "Searching…" : "Search Units"}</Button>{unitMore && <p className="text-xs">More than 20 matches. Refine your search.</p>}
          <label className="block text-xs font-bold">College *<select className={inputClass} required value={unitId} onChange={e => { personRequest.current++; setUnitId(e.target.value); setLoading(!!e.target.value); setCurrent(null); setPersonId(""); setCandidates([]); setPersonQuery(""); setError(""); setPersonBusy(false); setFields({}); }}><option value="">Select receiving office or college</option>{unitId && !unitOptions.some(u => u.id === unitId) && current && <option value={unitId}>{current.unit.code} — {current.unit.name}</option>}{unitOptions.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}</select></label>{!unitOptions.length && <p className="text-xs">No matching active offices or colleges. Try another search.</p>}
        </div>}
        {initialRow && <p className="rounded bg-cream p-3 text-sm"><strong>{initialRow.unit.code}</strong> — {initialRow.unit.name}</p>}
        {!remove && mode === "NEW" && <label className="block text-xs font-bold">Position *<input className={inputClass} name="position" required minLength={2} maxLength={150} value={newPerson.position} onChange={e => setNewPerson(old => ({ ...old, position: e.target.value }))} aria-invalid={!!fields.position} />{fieldError("position")}</label>}
        {loading && <p role="status">Loading current designation…</p>}
        {current && <p className="text-sm">Current receiver: <strong>{current.person ? `${current.person.fullName} (${current.person.employeeNo})` : "Not assigned"}</strong>{!current.unit.isActive && " · Inactive unit"}</p>}
        {unitId && <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={() => { setStale(true); setLoading(true); setCurrent(null); setPersonId(""); setCandidates([]); setPersonBusy(false); setError(""); setRefreshKey(k => k + 1); }}>Reload designation</Button>}
        {!remove && current?.unit.isActive && <>
          <fieldset className="flex flex-wrap gap-4 text-sm"><legend className="mb-2 text-xs font-bold">Custodian details</legend><label><input type="radio" name="mode" checked={mode === "NEW"} onChange={() => { personRequest.current++; setPersonBusy(false); setMode("NEW"); setFields({}); setError(""); }} /> Enter custodian details</label><label><input type="radio" name="mode" checked={mode === "EXISTING"} onChange={() => { setMode("EXISTING"); setFields({}); setError(""); }} /> Use a registered person</label></fieldset>
          {mode === "EXISTING" ? <div className="space-y-2"><label className="block text-xs font-bold">Search name or employee number<input className={inputClass} value={personQuery} maxLength={100} onChange={e => setPersonQuery(e.target.value)} /></label><Button type="button" variant="secondary" disabled={personBusy} onClick={searchPeople}>{personBusy ? "Searching…" : "Search Personnel"}</Button>
            <label className="block text-xs font-bold">Employee *<select className={inputClass} required value={personId} disabled={loading || personBusy} onChange={e => setPersonId(e.target.value)} aria-invalid={!!fields.personId} aria-describedby={fields.personId ? `${fieldPrefix}-personId-error` : undefined}><option value="">Select a designated receiver</option>{candidates.map(p => <option key={p.id} value={p.id}>{p.fullName} · {p.employeeNo} · {p.position}</option>)}</select>{fieldError("personId")}</label>
            {personMore && <p className="text-xs">More than 20 matches. Refine your search.</p>}{!candidates.length && !loading && !personBusy && <p className="text-sm">No personnel found for this unit. <button type="button" className="font-bold underline" onClick={() => setMode("NEW")}>Enter custodian details</button></p>}
          </div> : null}
        </>}
        {current?.person && <p className="rounded border border-border p-3 text-sm">{remove ? `Remove ${current.person.fullName} as the receiver for ${current.unit.code}?` : `Replace ${current.person.fullName}${proposedName ? ` with ${proposedName}` : ""} for ${current.unit.code}?`} Existing item receipt history is preserved.</p>}

      </fieldset>
      {saving && <p role="status">Saving designation…</p>}
      <div className="flex justify-end gap-3 border-t border-border pt-4"><Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" variant={remove ? "danger" : "primary"} disabled={saving || loading || !current || stale || (!remove && (!current.unit.isActive || (mode === "EXISTING" && personBusy))) || (remove && !current.person)}>{saving ? "Saving…" : remove ? "Remove Custodian" : current?.person ? "Replace Custodian" : "Assign Custodian"}</Button></div>
    </form>
  </Dialog>;
}

export function ReceivingHistoryDialog({ row, onClose }: { row: ReceivingCustodianRow; onClose: () => void }) {
  const [entries, setEntries] = useState<ReceivingCustodianHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    getReceivingCustodianHistoryAction({ unitId: row.unit.id }).then(result => {
      if (!active) return;
      if (result.success) { setEntries(result.data.items); setCursor(result.data.nextCursor); } else setError(result.error);
    }).catch(() => { if (active) setError("Unable to load designation history."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [row.unit.id, retry]);
  async function more() {
    if (!cursor) return;
    setLoading(true); setError("");
    try { const result = await getReceivingCustodianHistoryAction({ unitId: row.unit.id, cursor }); if (result.success) { setEntries(old => [...old, ...result.data.items]); setCursor(result.data.nextCursor); } else setError(result.error); }
    catch { setError("Unable to load designation history."); }
    finally { setLoading(false); }
  }
  return <Dialog title="Receiving-Custodian History" busy={false} onClose={onClose}>
    <p className="mb-4 font-bold">{row.unit.code} — {row.unit.name}</p>
    {loading && <p role="status">Loading designation history…</p>}
    {error && <div role="alert"><p className="text-[#A60212]">{error}</p><Button variant="outline" onClick={() => { if (cursor && entries.length) { void more(); } else { setLoading(true); setError(""); setRetry(r => r + 1); } }}>Retry</Button></div>}
    {!loading && !error && !entries.length && <p>No receiving-custodian changes recorded.</p>}
    <ol className="space-y-3">{entries.map(entry => <li key={entry.id} className="rounded border border-border p-3 text-sm"><p className="font-bold">{entry.action.replaceAll("_", " ")}</p><p className="text-xs text-[#6E2B32]">{date(entry.createdAt)} · {entry.actorName}</p><p className="mt-2">Previous: {entry.beforePerson ? `${entry.beforePerson.fullName} · ${entry.beforePerson.employeeNo}` : "Not assigned"}</p><p>New: {entry.afterPerson ? `${entry.afterPerson.fullName} · ${entry.afterPerson.employeeNo}` : "Not assigned"}</p><p className="mt-2 break-words">Reason: {entry.reason}</p></li>)}</ol>
    {cursor && <Button className="mt-4" variant="secondary" onClick={more} disabled={loading}>Load older changes</Button>}
  </Dialog>;
}
