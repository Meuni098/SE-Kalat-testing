"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CAMPUSES, UNIT_TYPES } from "@/lib/receiving-custodian-validation";
import type { ActionResult, DirectoryData, ReceivingCustodianRow } from "@/types/receiving-custodian";
import { ReceivingDesignationDialog, ReceivingHistoryDialog } from "./receiving-custodian-dialogs";

export const receivingInputClass = "w-full rounded border border-[#EBD3B2] bg-[#FFF4E0]/30 px-3 py-2 text-sm text-[#3B0A0F] focus:outline-2 focus:outline-[#A60212]";
export function displayReceivingDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)) + " PHT" : "—";
}
function humanize(value: string) { return value.replaceAll("_", " "); }

export function ReceivingCustodiansClient({ result }: { result: ActionResult<DirectoryData> }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{ kind: "assign" | "remove" | "history"; row?: ReceivingCustodianRow } | null>(null);
  const [notice, setNotice] = useState("");
  const data = result.success ? result.data : null;
  const filterKey = params.toString();
  function filter(form: FormData) {
    const next = new URLSearchParams();
    for (const key of ["query", "campus", "unitType", "status"]) {
      const value = form.get(key)?.toString().trim();
      if (value && value !== "ALL") next.set(key, value);
    }
    if (form.has("includeInactive")) next.set("includeInactive", "true");
    startTransition(() => router.push(`/people/receiving-custodians?${next}`));
  }
  function pageLink(page: number) { const next = new URLSearchParams(params); next.set("page", String(page)); return `/people/receiving-custodians?${next}`; }
  function completed(message: string) { setDialog(null); setNotice(message); startTransition(() => router.refresh()); }
  return <div className="space-y-5 pb-16 text-[#3B0A0F]">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-[#EBD3B2] bg-white p-5">
      <div><p className="text-xs font-bold uppercase tracking-wider text-[#A60212]">People / Office &amp; College Designations</p>
        <h1 className="mt-1 text-2xl font-black uppercase">Receiving Custodians</h1>
        <p className="mt-1 text-sm text-[#6E2B32]">Manage the suggested receiving contact for each office or college. Each item can be received by a different person.</p>
      </div>
      {data?.canManage && <Button onClick={() => setDialog({ kind: "assign" })}>Assign Receiving Custodian</Button>}
    </div>
    <div className="rounded border border-[#EBD3B2] bg-white p-4 text-sm"><p>Track each item by its college and the person who received it.</p><Link className="mt-2 inline-block font-bold text-[#A60212] underline" href="/people/item-receipts">Open Item Receipts →</Link></div>
    <p role="status" className="text-sm font-semibold text-[#2E7D32]">{notice}</p>
    {data && !data.canManage && <p className="rounded border border-[#EBD3B2] bg-white p-3 text-sm">Only AMO administrators and staff can manage receiving custodians.</p>}
    <form key={filterKey} action={filter} className="flex flex-wrap items-end gap-3 rounded border border-[#EBD3B2] bg-white p-4">
      <label className="min-w-48 flex-1 text-xs font-bold">Search offices or custodians<input className={receivingInputClass} name="query" maxLength={100} defaultValue={params.get("query") ?? ""} placeholder="Name, unit code, or employee number" /></label>
      <label className="text-xs font-bold">Campus<select name="campus" className={receivingInputClass} defaultValue={params.get("campus") ?? ""}><option value="">All campuses</option>{CAMPUSES.map(c => <option key={c} value={c}>{humanize(c)}</option>)}</select></label>
      <label className="text-xs font-bold">Unit type<select name="unitType" className={receivingInputClass} defaultValue={params.get("unitType") ?? ""}><option value="">All types</option>{UNIT_TYPES.map(t => <option key={t} value={t}>{humanize(t)}</option>)}</select></label>
      <label className="text-xs font-bold">Status<select name="status" className={receivingInputClass} defaultValue={params.get("status") ?? "ALL"}><option value="ALL">All statuses</option><option value="ASSIGNED">Assigned</option><option value="UNASSIGNED">Unassigned</option></select></label>
      <label className="flex items-center gap-2 py-2 text-xs"><input type="checkbox" name="includeInactive" defaultChecked={params.get("includeInactive") === "true"} />Show inactive units</label>
      <Button type="submit" disabled={pending}>{pending ? "Loading…" : "Search"}</Button><Link href="/people/receiving-custodians" className="py-2 text-sm underline">Clear filters</Link>
    </form>
    {!result.success && <div role="alert" className="rounded border border-[#A60212] bg-white p-5"><p>{result.error}</p><Button variant="outline" onClick={() => startTransition(() => router.refresh())} disabled={pending}>Retry</Button></div>}
    {data?.unlinked ? <p className="rounded border border-[#EBD3B2] bg-white p-6">Your account is not linked to an office or college. Contact AMO.</p> : data && <div aria-busy={pending} className="overflow-hidden rounded border border-[#EBD3B2] bg-white">
      <div className="flex justify-between bg-[#3B0A0F] p-4 text-sm font-bold text-[#FFF4E0]"><span>Office &amp; College Receiving Directory</span><span>{data.total} unit(s)</span></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#FFF4E0] text-xs uppercase"><tr>{["Office / College", "Unit Type", "Campus", "Receiving Custodian", "Designated On", "Status", "Actions"].map(h => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#EBD3B2]">{data.items.map(r => <tr key={r.unit.id} className="align-top hover:bg-[#FFF4E0]/40">
          <td className="px-4 py-4"><strong className="block">{r.unit.code}</strong><span className="text-xs text-[#6E2B32]">{r.unit.name}</span></td>
          <td className="px-4 py-4 text-xs">{humanize(r.unit.unitType)}</td><td className="px-4 py-4 text-xs">{humanize(r.unit.campus)}</td>
          <td className="px-4 py-4">{r.person ? <><strong className="block">{r.person.fullName}</strong><span className="block font-mono text-xs">{r.person.employeeNo}</span><span className="text-xs text-[#6E2B32]">{r.person.position}</span>{r.person.email && <span className="block break-all text-xs">{r.person.email}</span>}</> : <span className="text-[#6E2B32]">Not assigned</span>}</td>
          <td className="px-4 py-4 text-xs">{displayReceivingDate(r.assignedAt)}</td><td className="px-4 py-4 text-xs font-bold">{!r.unit.isActive ? "Inactive unit" : r.person ? "Designated" : "Not assigned"}</td>
          <td className="px-4 py-4"><div className="flex flex-wrap gap-2">{data.canManage && <>{r.unit.isActive && <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "assign", row: r })}>{r.person ? "Replace" : "Assign Custodian"}</Button>}{r.person && <Button size="sm" variant="danger" onClick={() => setDialog({ kind: "remove", row: r })}>Remove</Button>}</>}<Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "history", row: r })}>View History</Button><Link className="text-xs font-bold text-[#A60212] underline" href={`/people/item-receipts?unitId=${r.unit.id}`}>Item Receipts</Link></div></td>
        </tr>)}</tbody></table></div>
      {data.items.length === 0 && <div className="p-8 text-center text-sm text-[#6E2B32]"><p>{params.size ? "No matching offices, colleges, or custodians." : "No offices or colleges are available."}</p>{data.canManage && !params.size && <Link href="/master-data/colleges" className="underline">Manage Colleges &amp; Units</Link>}{params.size > 0 && <Link href="/people/receiving-custodians" className="underline">Clear filters</Link>}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EBD3B2] p-4 text-sm"><span>Page {data.page} · {data.total} unit(s)</span><div className="flex gap-4">{data.page > 1 && <Link className="underline" href={pageLink(data.page - 1)}>Previous</Link>}{data.page * 25 < data.total && <Link className="underline" href={pageLink(data.page + 1)}>Next</Link>}{data.page > 1 && data.items.length === 0 && <Link className="underline" href={pageLink(1)}>Return to page 1</Link>}</div></div>
    </div>}
    {dialog?.kind === "history" && dialog.row && <ReceivingHistoryDialog row={dialog.row} onClose={() => setDialog(null)} />}
    {dialog && dialog.kind !== "history" && <ReceivingDesignationDialog initialRow={dialog.row} remove={dialog.kind === "remove"} onClose={() => setDialog(null)} onComplete={completed} />}
  </div>;
}
