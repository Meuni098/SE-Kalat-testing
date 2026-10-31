import MasterDataPage from "../page";

export const dynamic = "force-dynamic";

export default function ProductsPage() {
  return <MasterDataPage searchParams={Promise.resolve({ tab: "products" })} />;
}
