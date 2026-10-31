import { redirect } from "next/navigation";
import { reportHref } from "@/lib/report-sections";
export default async function TransferReportsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  redirect(reportHref("transfers",await searchParams));
}
