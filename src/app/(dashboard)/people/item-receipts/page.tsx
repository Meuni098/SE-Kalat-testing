import { redirect } from "next/navigation";
import { getItemReceiptsAction } from "@/actions/receiving-custodian-actions";
import { ItemReceiptsClient } from "@/components/people/item-receipts-client";

export const dynamic = "force-dynamic";
export default async function ItemReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const result = await getItemReceiptsAction({ query: value("query"), unitId: value("unitId"), assetId: value("assetId"), page: value("page") ? Number(value("page")) : 1 });
  if (!result.success && result.code === "UNAUTHENTICATED") redirect("/login");
  return <ItemReceiptsClient result={result} />;
}
