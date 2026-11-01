'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function ActivityRefresh({ label = 'Refresh' }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <span><button type="button" disabled={pending} className="underline disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed" onClick={() => startTransition(() => router.refresh())}>{pending ? 'Refreshing…' : label}</button>{pending && <span role="status" className="sr-only">Refreshing activity history</span>}</span>;
}
