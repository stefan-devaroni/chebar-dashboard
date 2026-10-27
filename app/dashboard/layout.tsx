import { NavSidebar, type NavBadges } from '@/components/nav-sidebar';
import { getSessionInfo } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';
import { openMissing, pendingDeliveries, type PurchaseOrder } from '@/lib/purchasing';

async function getBadges(): Promise<NavBadges> {
  try {
    const supabase = createClient();
    const [{ data }, { count }] = await Promise.all([
      supabase.from('purchase_orders').select('*'),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    ]);
    const orders = (data ?? []) as PurchaseOrder[];
    return { missing: openMissing(orders).length, pending: pendingDeliveries(orders).length, applicants: count ?? 0 };
  } catch {
    return { missing: 0, pending: 0, applicants: 0 };
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, badges] = await Promise.all([getSessionInfo().catch(() => null), getBadges()]);

  return (
    <div className="flex min-h-screen">
      <NavSidebar perms={session?.perms ?? []} owner={session?.owner ?? false} email={session?.email ?? null} badges={badges} />
      <main className="flex-1 min-w-0 px-4 pt-20 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:p-10 max-w-6xl">{children}</main>
    </div>
  );
}
