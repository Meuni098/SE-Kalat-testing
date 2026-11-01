"use client";
import { TransactionAttributionButton } from "@/components/audit/transaction-attribution-button";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ItemReceiptDialog } from "./item-receipt-dialog";
import type { ActionResult } from "@/types/receiving-custodian";
import type { ItemReceiptData } from "@/types/item-receipt";

export function ItemReceiptsClient({ result }: { result: ActionResult<ItemReceiptData> }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const data = result.success ? result.data : null;
  function pageLink(page: number) { const next = new URLSearchParams(params); next.set("page", String(page)); return `/people/item-receipts?${next}`; }
  return <div className="space-y-5 pb-16 text-[#3B0A0F]">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-border bg-white p-5"><div><h1 className="text-2xl font-black uppercase">Item Receipts</h1></div>{data?.canManage && <Button onClick={() => setOpen(true)}>Record Item Receipt</Button>}</div>
    <p role="status" className="text-sm font-bold text-[#2E7D32]">{notice}</p>
    {data && !data.canManage && <p className="text-sm">Only AMO administrators and staff can record receipts. Your view is read-only.</p>}
    <form key={params.toString()} action={form => { const next = new URLSearchParams(params); next.delete("page"); const query = form.get("query")?.toString().trim() ?? ""; if (query) next.set("query", query); else next.delete("query"); startTransition(() => router.push(`/people/item-receipts?${next}`)); }} className="flex flex-wrap items-end gap-3 rounded border border-border bg-white p-4">
      <label className="flex-1 text-xs font-bold">Search item or receiver<input className="mt-1 w-full rounded border border-border px-3 py-2 text-sm" name="query" maxLength={100} defaultValue={params.get("query") ?? ""} placeholder="Property number, item, receiver, or employee number" /></label><Button type="submit" disabled={pending}>Search</Button><Link className="py-2 text-sm underline" href="/people/item-receipts">Clear filters</Link>
    </form>
    {!result.success && <div role="alert" className="rounded border border-[#A60212] bg-white p-4"><p>{result.error}</p><Button onClick={() => startTransition(() => router.refresh())}>Retry</Button></div>}
    {data?.unlinked && <p>Your account is not linked to an office or college. Contact AMO.</p>}
    {data && !data.unlinked && <div className="overflow-hidden rounded border border-border bg-white" aria-busy={pending}><div className="bg-[#3B0A0F] p-4 text-sm font-bold text-[#FFF4E0]">Receiving History · {data.total} receipt(s)</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-cream text-xs uppercase"><tr>{["Item", "Office / College", "Received by", "Recorded at", "Recorded by", "Remarks"].map(h => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{data.items.map(item => <tr key={item.id} className="align-top"><td className="px-4 py-3"><strong className="block">{item.propertyNo}</strong><span>{item.assetName}</span><Link className="mt-1 block text-xs underline" href={`/people/item-receipts?assetId=${item.assetId}`}>All receipts for this item</Link></td><td className="px-4 py-3">{item.unitCode}</td><td className="px-4 py-3"><strong className="block">{item.receiverName}</strong><span className="block font-mono text-xs">{item.receiverEmployeeNo}</span><span className="text-xs">{item.receiverPosition}</span></td><td className="px-4 py-3 text-xs">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(item.receivedAt))} PHT</td><td className="px-4 py-3">{item.recordedByName}<TransactionAttributionButton entityType="RECEIPT" entityId={item.id} /></td><td className="max-w-xs whitespace-pre-wrap break-words px-4 py-3">{item.remarks}</td></tr>)}</tbody></table></div>{!data.items.length && <p className="p-8 text-center text-sm text-[#6E2B32]">{params.size ? "No receipts match these filters." : "No item receipts recorded yet."}</p>}<div className="flex justify-between p-4 text-sm"><span>Page {data.page}</span><div className="flex gap-4">{data.page > 1 && <Link className="underline" href={pageLink(data.page - 1)}>Previous</Link>}{data.page * 25 < data.total && <Link className="underline" href={pageLink(data.page + 1)}>Next</Link>}</div></div></div>}
    {open && <ItemReceiptDialog initialUnitId={params.get("unitId") ?? ""} onClose={() => setOpen(false)} onComplete={() => { setOpen(false); setNotice("Item receipt recorded. Received-by details updated."); startTransition(() => router.refresh()); }} />}
  </div>;
}
