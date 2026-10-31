import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#FFF4E0] flex">
      {/* 260px Fixed Sidebar */}
      <Sidebar user={user} />

      {/* Main Canvas with margin-left 260px */}
      <div className="ml-[260px] flex-1 flex flex-col min-w-0">
        <Header user={user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
