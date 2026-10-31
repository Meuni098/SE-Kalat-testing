import { redirect } from "next/navigation";
import { reportHref } from "@/lib/report-sections";
export default async function RequestsReturnsReportsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  redirect(reportHref("requests-returns",await searchParams));
}
