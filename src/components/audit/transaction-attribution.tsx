import { getTransactionAttributionAction } from '@/actions/audit-log-actions';

export async function TransactionAttribution({ entityType, entityId }: { entityType: string; entityId: string }) {
  const result = await getTransactionAttributionAction(entityType, entityId);
  if (!result.success) return null;
  const display = (value: typeof result.data.originallyLoggedBy) => value ? `${value.name} · ${new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value.at))} PHT` : 'Not recorded';
  return <dl className="space-y-1 rounded border border-border bg-cream p-3 text-xs print:hidden"><div><dt className="inline font-bold">Originally logged by: </dt><dd className="inline">{display(result.data.originallyLoggedBy)}</dd></div><div><dt className="inline font-bold">Last updated by: </dt><dd className="inline">{result.data.lastUpdatedBy ? display(result.data.lastUpdatedBy) : 'No updates yet'}</dd></div></dl>;
}
