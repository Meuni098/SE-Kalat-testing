'use client';

import { useState } from 'react';
import { getAuditActorsAction } from '@/actions/audit-log-actions';

export function AuditActorFilter({ initialId = '' }: { initialId?: string }) {
  const [id, setId] = useState(initialId);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function search(more = false) {
    setPending(true); setError('');
    try {
      const response = await getAuditActorsAction(query, more ? cursor ?? undefined : undefined);
      if (response.success) { setItems(more ? [...items, ...response.data.items] : response.data.items); setCursor(response.data.nextCursor); }
      else setError(response.error);
    } catch { setError('Accounts could not be loaded. Retry search.'); }
    finally { setPending(false); }
  }
  return <fieldset className="text-xs"><legend className="font-bold">Logged by account</legend>
    <div className="flex gap-2"><input aria-label="Search account names" maxLength={120} value={query} onChange={e => setQuery(e.target.value)} className="rounded border border-border p-2" /><button type="button" disabled={pending} className="underline" onClick={() => void search()}>Find accounts</button></div>
    <select aria-label="Filter by account" name="actorId" value={id} onChange={e => setId(e.target.value)} className="mt-1 w-full rounded border border-border p-2"><option value="">All accounts</option>{id && !items.some(i => i.id === id) && <option value={id}>Selected account ({id})</option>}{items.map(account => <option key={account.id} value={account.id}>{account.name}{account.isActive ? '' : ' (inactive)'}</option>)}</select>
    {cursor && <button type="button" disabled={pending} onClick={() => void search(true)} className="mt-1 underline">More accounts</button>}{error && <p role="alert">{error}</p>}{pending && <p role="status">Loading accounts…</p>}
  </fieldset>;
}
