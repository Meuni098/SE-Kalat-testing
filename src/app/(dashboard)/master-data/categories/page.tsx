import MasterDataPage from "../page";

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  return <MasterDataPage searchParams={Promise.resolve({ tab: "categories" })} />;
}
