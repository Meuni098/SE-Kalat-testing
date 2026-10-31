import { redirect } from "next/navigation";
import { getReceivingCustodiansAction } from "@/actions/receiving-custodian-actions";
import { ReceivingCustodiansClient } from "@/components/people/receiving-custodians-client";
import type { DirectoryFilters } from "@/types/receiving-custodian";

export const dynamic = "force-dynamic";

export default async function ReceivingCustodiansPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const status = value("status");
  const filters: DirectoryFilters = {
    query: value("query"), campus: value("campus"), unitType: value("unitType"),
    status: status === "ASSIGNED" || status === "UNASSIGNED" ? status : "ALL",
    includeInactive: value("includeInactive") === "true",
    page: value("page") ? Number(value("page")) : 1,
  };
  const result = await getReceivingCustodiansAction(filters);
  if (!result.success && result.code === "UNAUTHENTICATED") redirect("/login");
  return <ReceivingCustodiansClient result={result} />;
}
