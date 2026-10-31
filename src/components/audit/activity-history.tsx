import Link from 'next/link';
import { ActivityRefresh } from './activity-refresh';
import { getAuditLogsAction, getMyActivityAction } from '@/actions/audit-log-actions';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AuditActorFilter } from './audit-actor-filter';
import { ActivityDetails } from './activity-details';
import type { AuditLogQuery } from '@/types/audit-log';

export async function ActivityHistory({ searchParams, personal = false }: { searchParams: Promise<Record<string, string | string[] | undefined>>; personal?: boolean }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const account = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, name: true, role: true, isActive: true } });
  if (!account?.isActive) redirect('/login');
  if (!personal && !['ADMIN', 'AUDITOR'].includes(account.role)) return <p role="alert">You do not have permission to view the Audit Log.</p>;
  const params = await searchParams;
  const query: AuditLogQuery = {};
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) return <p role="alert">Use one value per activity filter.</p>;
    if (value) Object.assign(query, { [key]: key === 'limit' ? Number(value) : value });
  }
  const result = await (personal ? getMyActivityAction(query) : getAuditLogsAction(query));
  if (!result.success && result.code === 'UNAUTHENTICATED') redirect('/login');
  const path = personal ? '/account/my-activity' : '/admin/security-audit';
  const url = (cursor?: string) => { const next = new URLSearchParams(); for (const [key, value] of Object.entries(query)) if (key !== 'cursor') next.set(key, String(value)); if (cursor) next.set('cursor', cursor); return `${path}?${next}`; };
  const timestamp = (value: string) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value));
  return <div className="space-y-5 pb-16 text-[#3B0A0F] print:hidden" key={`${account.id}:${personal}`}>
    <header className="rounded border border-[#EBD3B2] bg-white p-5"><h1 className="text-2xl font-black">{personal ? 'My Activity' : 'Audit Log'}</h1><p className="mt-2 text-sm">{personal ? `${account.name} · Your recorded actions only.` : 'Read-only activity history across all accounts.'} Times shown in Asia/Manila (PHT).</p></header>
    <form action={path} className="flex flex-wrap items-end gap-3 rounded border border-[#EBD3B2] bg-white p-4">
      {[['fromDate', 'From date', 'date'], ['toDate', 'To date', 'date'], ['action', 'Action code', 'text'], ['entityType', 'Record type', 'text'], ['reference', 'Exact reference / ID', 'text']].map(([key, label, type]) => <label key={key} className="text-xs font-bold">{label}<input type={type} name={key} defaultValue={String(query[key as keyof AuditLogQuery] ?? '')} maxLength={120} className="mt-1 block rounded border border-[#EBD3B2] p-2 text-sm" /></label>)}
      {!personal && <AuditActorFilter initialId={query.actorId} />}
      {query.assetId && <input type="hidden" name="assetId" value={query.assetId} />}
      {query.entityId && <input type="hidden" name="entityId" value={query.entityId} />}
      <label className="text-xs font-bold">Rows<select name="limit" defaultValue={query.limit ?? 25} className="mt-1 block rounded border border-[#EBD3B2] p-2">{[25, 50, 100].map(n => <option key={n}>{n}</option>)}</select></label>
      <button type="submit" className="rounded bg-[#A60212] px-4 py-2 text-sm font-bold text-white">Apply filters</button><Link href={path} className="text-sm underline">Clear filters</Link>
    </form>
    {!result.success ? <div role="alert" className="rounded border border-[#A60212] bg-white p-4"><p>{result.error}</p><ActivityRefresh label="Retry" /></div> : <div className="overflow-x-auto rounded border border-[#EBD3B2] bg-white">
      <div className="flex justify-between bg-[#FFF4E0] p-4 text-sm"><span>{result.data.items.length} entries on this page</span><ActivityRefresh /></div>
      <table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-[#FFF4E0] text-xs uppercase"><tr>{['Date and time (PHT)', 'Logged by', ...(!personal ? ['Role at time'] : []), 'Action', 'Record reference', 'Details'].map(h => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#EBD3B2]">{result.data.items.map(row => <tr key={row.id} className="align-top"><td className="whitespace-nowrap p-3">{timestamp(row.createdAt)}</td><td className="min-w-40 p-3">{row.actorName}{row.attributionSource === 'CURRENT_ACCOUNT_FALLBACK' && <p className="max-w-48 text-xs text-[#6E2B32]">Current account name; historical name not recorded.</p>}</td>{!personal && <td className="p-3">{row.actorRole}</td>}<td className="min-w-40 p-3">{row.summary}<span className="block text-xs text-[#6E2B32]">{row.action}</span></td><td className="max-w-xs break-all p-3">{row.entityReference}<span className="block text-xs">{row.entityType}</span></td><td className="min-w-64 p-3"><ActivityDetails key={`${account.id}:${row.id}`} id={row.id} personal={personal} /></td></tr>)}</tbody></table>
      {!result.data.items.length && <p className="p-8 text-center" role="status">{Object.keys(query).some(k => k !== 'limit') ? 'No activity matches these filters.' : personal ? 'You have not logged any activity yet.' : 'No activity has been recorded yet.'}</p>}
      <nav aria-label="Activity pages" className="flex gap-5 p-4 text-sm"><Link href={url()} className="underline">Newest entries</Link>{result.data.nextCursor && <Link className="underline" href={url(result.data.nextCursor)}>Older entries</Link>}</nav>
    </div>}
  </div>;
}
