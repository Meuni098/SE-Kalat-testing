'use client';

import { useState } from 'react';
import { getTransactionAttributionAction } from '@/actions/audit-log-actions';
import type { TransactionAttribution } from '@/types/audit-log';

export function TransactionAttributionButton({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [value, setValue] = useState<TransactionAttribution | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setPending(true); setError(''); setValue(null);
    try {
      const result = await getTransactionAttributionAction(entityType, entityId);
      if (result.success) setValue(result.data); else setError(result.error);
    } catch { setError('Attribution could not be loaded. Please retry.'); }
    finally { setPending(false); }
  }
  const label = (entry: TransactionAttribution['originallyLoggedBy']) => entry ? `${entry.name} · ${new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(entry.at))} PHT` : 'Not recorded';
  return <div className="mt-2 text-xs print:hidden"><button type="button" disabled={pending} className="underline text-[#A60212]" aria-expanded={!!value} onClick={() => value ? setValue(null) : void load()}>{pending ? 'Loading attribution…' : value ? 'Hide logging details' : 'Who logged this?'}</button>{error && <p role="alert">{error}</p>}{value && <dl className="mt-2 space-y-1"><div><dt className="font-bold">Originally logged by</dt><dd>{label(value.originallyLoggedBy)}</dd></div><div><dt className="font-bold">Last updated by</dt><dd>{value.lastUpdatedBy ? label(value.lastUpdatedBy) : 'No updates yet'}</dd></div></dl>}</div>;
}
