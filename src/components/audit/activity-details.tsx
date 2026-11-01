'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getAuditLogDetailAction, getMyActivityDetailAction } from '@/actions/audit-log-actions';
import type { AuditDetail } from '@/types/audit-log';

export function ActivityDetails({ id, personal }: { id: string; personal: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function load() {
    setOpen(true); setLoading(true); setError(''); setDetail(null);
    try {
      const response = await (personal ? getMyActivityDetailAction(id) : getAuditLogDetailAction(id));
      if (response.success) setDetail(response.data);
      else { setError(response.error); if (response.code === 'UNAUTHENTICATED') router.replace('/login'); }
    } catch { setError('Activity details could not be loaded. Please retry.'); }
    finally { setLoading(false); }
  }
  const before = detail?.beforeState ?? {};
  const after = detail?.afterState ?? {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  const display = (state: Record<string, unknown>, key: string) => !(key in state) ? 'Not recorded' : typeof state[key] === 'object' ? JSON.stringify(state[key]) : String(state[key]);
  return <div>
    <button className="underline text-[#A60212]" disabled={loading} aria-expanded={open} aria-controls={`details-${id}`} onClick={() => open ? (setOpen(false), setDetail(null)) : void load()}>{open ? 'Hide changes' : personal ? 'View my changes' : 'View changes'}</button>
    {open && <div id={`details-${id}`} className="mt-3 min-w-64 rounded border border-border bg-cream p-3">
      {loading && <p role="status">Loading changes…</p>}
      {error && <div role="alert"><p>{error}</p><button className="underline" onClick={() => void load()}>Retry</button></div>}
      {detail && <><p className="mb-2 break-all">{detail.entityType}: {detail.entityId}</p>{!personal && <p className="mb-2">IP: {detail.ipAddress ?? 'Not recorded'}</p>}
        {!detail.payloadVisible ? <p>You no longer have access to this record. Only your activity summary is available.</p> : fields.length ? <table className="w-full text-left text-xs"><thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>{fields.map(key => <tr key={key} className="border-t border-border"><th scope="row" className="p-2">{key}</th><td className="max-w-xs break-all p-2">{display(before, key)}</td><td className="max-w-xs break-all p-2">{display(after, key)}</td></tr>)}</tbody></table> : <p>No field changes were recorded for this event.</p>}</>}
    </div>}
  </div>;
}
