import { redirect } from "next/navigation";
import { reportHref } from "@/lib/report-sections";
export default async function PhysicalInventoryReportsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  redirect(reportHref("physical-inventory",await searchParams));
}
