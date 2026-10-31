import { ActivityHistory } from "@/components/audit/activity-history";
export const dynamic = "force-dynamic";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ActivityHistory searchParams={searchParams} personal={true} />;
}
