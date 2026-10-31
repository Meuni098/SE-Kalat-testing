import MasterDataPage from "../page";

export const dynamic = "force-dynamic";

export default function CollegesPage() {
  return <MasterDataPage searchParams={Promise.resolve({ tab: "colleges" })} />;
}
