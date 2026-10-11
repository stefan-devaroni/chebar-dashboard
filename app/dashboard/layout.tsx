import { NavSidebar, type NavBadges } from '@/components/nav-sidebar';
import { getSessionInfo } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { openMissing, pendingDeliveries, type PurchaseOrder } from '@/lib/purchasing';

async function getBadges(): Promise<NavBadges> {
  try {
    const { data } = await createClient().from('purchase_orders').select('*');
    const orders = (data ?? []) as PurchaseOrder[];
    return { missing: openMissing(orders).length, pending: pendingDeliveries(orders).length };
  } catch {
    return { missing: 0, pending: 0 };
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, badges] = await Promise.all([getSessionInfo().catch(() => null), getBadges()]);
  const role = session?.role ?? 'employee';

  return (
    <div className="flex min-h-screen">
      <NavSidebar role={role} badges={badges} />
      <main className="flex-1 p-4 pt-16 sm:p-6 sm:pt-18 lg:p-10 lg:pt-10 max-w-6xl">{children}</main>
    </div>
  );
}
