'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Sun, CalendarCheck, CalendarDays, ListChecks, ShoppingCart, Truck, Users, LogOut } from 'lucide-react';

type Role = 'manager' | 'employee';
export type NavBadges = { missing: number; pending: number };

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string; // phone tab bar, where space is tight
  icon: typeof Sun;
  roles: Role[];
  alsoActiveOn?: string[];
  badge?: keyof NavBadges;
};

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Today', icon: Sun, roles: ['manager'] },
  { href: '/dashboard/reservations', label: 'Reservations', shortLabel: 'Bookings', icon: CalendarCheck, roles: ['manager', 'employee'] },
  { href: '/dashboard/purchasing', label: 'Purchasing', icon: ShoppingCart, roles: ['manager'], alsoActiveOn: ['/dashboard/orders'], badge: 'missing' },
  { href: '/dashboard/schedule', label: 'Schedule', icon: CalendarDays, roles: ['manager', 'employee'] },
  { href: '/dashboard/orders', label: 'Deliveries', icon: Truck, roles: ['employee'], badge: 'pending' },
  { href: '/dashboard/team', label: 'Team', icon: Users, roles: ['manager'] },
  { href: '/dashboard/tasks', label: 'Tasks', icon: ListChecks, roles: ['manager'] },
];

function Badge({ count, kind, className }: { count: number; kind: keyof NavBadges; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={cn(
      'min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center',
      kind === 'missing' ? 'bg-red-500' : 'bg-blue-500',
      className
    )}>
      {count}
    </span>
  );
}

export function NavSidebar({ role = 'manager', badges = { missing: 0, pending: 0 } }: { role?: Role; badges?: NavBadges }) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = allNavItems.filter((i) => i.roles.includes(role));

  const isActive = (item: NavItem) =>
    pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href)) ||
    (item.alsoActiveOn ?? []).some((p) => pathname.startsWith(p));

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex bg-ink text-cream flex-col h-screen sticky top-0 w-60 shrink-0">
        <div className="px-6 py-8">
          <Link href={navItems[0]?.href ?? '/dashboard'} className="font-display text-2xl block">Che Bar</Link>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-1">Dashboard</p>
        </div>
        <nav className="flex-1 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition',
                  isActive(item) ? 'bg-neutral-800 text-cream' : 'text-neutral-400 hover:text-cream hover:bg-neutral-900'
                )}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span className="flex-1">{item.label}</span>
                {item.badge && <Badge count={badges[item.badge]} kind={item.badge} />}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-6 border-t border-neutral-800">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded text-sm text-neutral-400 hover:text-cream hover:bg-neutral-900 transition w-full"
          >
            <LogOut size={16} strokeWidth={1.5} />
            Sign out
          </button>
          <p className="px-3 pt-4 text-[10px] uppercase tracking-widest text-neutral-500">Che Bar Aruba</p>
        </div>
      </aside>

      {/* Phone: top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 bg-ink text-cream h-14 flex items-center justify-between px-4">
        <span className="font-display text-xl">Che Bar</span>
        <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-neutral-400 py-2 pl-3">
          <LogOut size={15} strokeWidth={1.5} />
          Sign out
        </button>
      </header>

      {/* Phone: tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-ink border-t border-neutral-800 pb-[env(safe-area-inset-bottom)]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 h-16 text-[11px] transition',
                  active ? 'text-cream' : 'text-neutral-500'
                )}
              >
                {active && <span className="absolute top-0 inset-x-5 h-0.5 rounded-full bg-gold" />}
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                  {item.badge && <Badge count={badges[item.badge]} kind={item.badge} className="absolute -top-1.5 -right-3" />}
                </span>
                {item.shortLabel ?? item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
