'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { LayoutDashboard, CalendarDays, ListChecks, ShoppingCart, Truck, Users, Menu, X, LogOut } from 'lucide-react';

type Role = 'manager' | 'employee';
export type NavBadges = { missing: number; pending: number };

const allNavItems: { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[]; alsoActiveOn?: string[]; badge?: keyof NavBadges }[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['manager'] },
  { href: '/dashboard/purchasing', label: 'Purchasing', icon: ShoppingCart, roles: ['manager'], alsoActiveOn: ['/dashboard/orders'], badge: 'missing' },
  { href: '/dashboard/schedule', label: 'Schedule', icon: CalendarDays, roles: ['manager', 'employee'] },
  { href: '/dashboard/orders', label: 'Deliveries', icon: Truck, roles: ['employee'], badge: 'pending' },
  { href: '/dashboard/team', label: 'Team', icon: Users, roles: ['manager'] },
  { href: '/dashboard/tasks', label: 'Tasks', icon: ListChecks, roles: ['manager'] },
];

export function NavSidebar({ role = 'manager', badges = { missing: 0, pending: 0 } }: { role?: Role; badges?: NavBadges }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const navItems = allNavItems.filter((i) => i.roles.includes(role));
  const alerting = navItems.some((i) => i.badge && badges[i.badge] > 0);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const navContent = (
    <>
      <div className="px-6 py-8 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="font-display text-2xl block" onClick={() => setOpen(false)}>
            Che Bar
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-1">Dashboard</p>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden text-neutral-400 hover:text-cream transition p-1">
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href)) ||
            (item.alsoActiveOn ?? []).some((p) => pathname.startsWith(p));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition',
                active
                  ? 'bg-neutral-800 text-cream'
                  : 'text-neutral-400 hover:text-cream hover:bg-neutral-900'
              )}
            >
              <Icon size={16} strokeWidth={1.5} />
              <span className="flex-1">{item.label}</span>
              {item.badge && badges[item.badge] > 0 && (
                <span className={cn(
                  'min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center',
                  item.badge === 'missing' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                )}>
                  {badges[item.badge]}
                </span>
              )}
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
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-ink text-cream z-40 flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-display text-xl">Che Bar</Link>
        <button onClick={() => setOpen(true)} className="p-1.5 relative" aria-label="Open menu">
          <Menu size={22} strokeWidth={1.5} />
          {alerting && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-ink" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-ink/60 z-50" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar — always visible on lg+, slide-in on mobile */}
      <aside
        className={cn(
          'bg-ink text-cream flex flex-col h-screen z-50',
          'fixed lg:sticky top-0',
          'w-64 lg:w-60',
          'transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
