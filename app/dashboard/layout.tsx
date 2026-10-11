import { NavSidebar } from '@/components/nav-sidebar';
import { getSessionInfo } from '@/lib/roles';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionInfo().catch(() => null);
  const role = session?.role ?? 'employee';

  return (
    <div className="flex min-h-screen">
      <NavSidebar role={role} />
      <main className="flex-1 p-4 pt-16 sm:p-6 sm:pt-18 lg:p-10 lg:pt-10 max-w-6xl">{children}</main>
    </div>
  );
}
