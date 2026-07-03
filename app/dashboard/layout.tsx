import { NavSidebar } from '@/components/nav-sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <NavSidebar />
      <main className="flex-1 p-4 pt-16 sm:p-6 sm:pt-18 lg:p-10 lg:pt-10 max-w-6xl">{children}</main>
    </div>
  );
}
