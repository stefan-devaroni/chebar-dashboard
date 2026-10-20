import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { MenuView } from '@/components/menu-view';
import { MENU_ITEM_COLUMNS, type MenuItem } from '@/lib/menu';
import { isMissingTable } from '@/lib/reservations-server';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const [session, { data, error }] = await Promise.all([
    getSessionInfo().catch(() => null),
    createClient().from('menu_items').select(MENU_ITEM_COLUMNS).eq('active', true).order('sort'),
  ]);

  return (
    <div className="max-w-3xl">
      <MenuView initialItems={(data ?? []) as MenuItem[]} role={session?.role ?? 'employee'} setupNeeded={isMissingTable(error)} />
    </div>
  );
}
