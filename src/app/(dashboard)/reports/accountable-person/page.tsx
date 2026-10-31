import { redirect } from "next/navigation";
import { reportHref } from "@/lib/report-sections";
export default async function AccountablePersonReportsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  redirect(reportHref("accountable-person",await searchParams));
}
