'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { NotificationBell } from '@/components/notification-bell';
import { ChangePassword } from '@/components/change-password';
import type { Permission } from '@/lib/permissions';
import { Sun, BookOpen, Briefcase, CalendarCheck, CalendarDays, ClipboardCheck, Ellipsis, FileText, ListChecks, Megaphone, ShoppingCart, TrendingUp, Truck, Users, UtensilsCrossed, LogOut } from 'lucide-react';

export type NavBadges = { missing: number; pending: number; applicants: number };

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string; // phone tab bar, where space is tight
  icon: typeof Sun;
  perm: Permission;
  unless?: Permission; // hidden when the person also has this (it's covered there)
  alsoActiveOn?: string[];
  badge?: keyof NavBadges;
  ownerOnly?: boolean; // owners only, whatever else someone may open (ownerOnly in lib/permissions.ts)
};

// Order set by Stefan (Oct 23 2026). Each person sees what they can open (lib/permissions.ts)
const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Today', icon: Sun, perm: 'today' },
  { href: '/dashboard/checklists', label: 'Checklists', icon: ClipboardCheck, perm: 'checklists' },
  { href: '/dashboard/purchasing', label: 'Purchasing', icon: ShoppingCart, perm: 'purchasing', alsoActiveOn: ['/dashboard/orders'], badge: 'missing' },
  { href: '/dashboard/schedule', label: 'Schedule', icon: CalendarDays, perm: 'schedule' },
  // With the schedule too, Team is a tab on that page ("Schedule & Team")
  { href: '/dashboard/team', label: 'Team', icon: Users, perm: 'team', unless: 'schedule' },
  { href: '/dashboard/reservations', label: 'Reservations', shortLabel: 'Bookings', icon: CalendarCheck, perm: 'reservations' },
  { href: '/dashboard/menu', label: 'Menu & Recipes', shortLabel: 'Menu', icon: UtensilsCrossed, perm: 'menu' },
  // Purchasing has the deliveries on its Orders screen
  { href: '/dashboard/orders', label: 'Deliveries', icon: Truck, perm: 'deliveries', unless: 'purchasing', badge: 'pending' },
  { href: '/dashboard/handbook', label: 'Handbook', icon: BookOpen, perm: 'handbook' },
  { href: '/dashboard/applicants', label: 'Applicants', icon: Briefcase, perm: 'applicants', badge: 'applicants' },
  { href: '/dashboard/tasks', label: 'Tasks', icon: ListChecks, perm: 'tasks' },
  { href: '/dashboard/sales', label: 'Sales', icon: TrendingUp, perm: 'sales' },
  { href: '/dashboard/marketing', label: 'Marketing', icon: Megaphone, perm: 'marketing' },
  // The business summary for prospective buyers (Oct 2026)
  { href: '/dashboard/one-pager', label: 'One Pager', icon: FileText, perm: 'sales', ownerOnly: true },
];

function itemsFor(perms: readonly string[], owner: boolean): NavItem[] {
  const has = (p: Permission) => perms.includes(p);
  return allNavItems
    .filter((i) => has(i.perm) && !(i.unless && has(i.unless)) && (!i.ownerOnly || owner))
    .map((i) => (i.href === '/dashboard/schedule' && has('team') ? { ...i, label: 'Schedule & Team', shortLabel: 'Schedule', alsoActiveOn: ['/dashboard/team'] } : i));
}

// Phones: the tab bar has 5 slots. With more items than that, the first 4 from this list get
// a tab (shown in nav order) and the rest go under "More".
const PHONE_SLOTS = 5;
const PHONE_FIRST = ['/dashboard', '/dashboard/purchasing', '/dashboard/schedule', '/dashboard/reservations', '/dashboard/checklists', '/dashboard/menu', '/dashboard/orders', '/dashboard/team'];
const phoneRank = (i: NavItem) => (PHONE_FIRST.includes(i.href) ? PHONE_FIRST.indexOf(i.href) : PHONE_FIRST.length);

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

export function NavSidebar({ perms, owner = false, email = null, badges = { missing: 0, pending: 0, applicants: 0 } }: { perms: Permission[]; owner?: boolean; email?: string | null; badges?: NavBadges }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const navItems = itemsFor(perms, owner);
  const onBar = navItems.length <= PHONE_SLOTS ? navItems : [...navItems].sort((a, b) => phoneRank(a) - phoneRank(b)).slice(0, PHONE_SLOTS - 1);
  const phoneTabs = navItems.filter((i) => onBar.includes(i));
  const phoneMore = navItems.filter((i) => !onBar.includes(i));
  // The bell's alerts are mostly job applications (and it reads /api/notifications, which needs Applicants)
  const bell = perms.includes('applicants');

  const isActive = (item: NavItem) =>
    pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href)) ||
    (item.alsoActiveOn ?? []).some((p) => pathname.startsWith(p));
  const moreActive = phoneMore.some(isActive);
  const moreBadge = phoneMore.reduce((sum, i) => sum + (i.badge ? badges[i.badge] : 0), 0);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const tabClass = (active: boolean) =>
    cn('relative flex flex-col items-center justify-center gap-1 h-16 text-[11px] transition', active ? 'text-cream' : 'text-neutral-500');

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex bg-ink text-cream flex-col h-screen sticky top-0 w-60 shrink-0">
        <div className="pl-6 pr-3 py-8 flex items-start justify-between gap-2">
          <div>
            <Link href={navItems[0]?.href ?? '/dashboard'} className="font-display text-2xl block">Che Bar</Link>
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-1">Dashboard</p>
          </div>
          {bell && <NotificationBell placement="sidebar" />}
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
          <ChangePassword email={email} placement="sidebar" />
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
        <div className="flex items-center gap-1">
          {bell && <NotificationBell placement="header" />}
          <ChangePassword email={email} placement="header" />
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-neutral-400 py-2 pl-3">
            <LogOut size={15} strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </header>

      {/* Phone: "More" sheet for tabs that don't fit the bar */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-ink/50" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] bg-ink border-t border-neutral-800 rounded-t-2xl px-3 pt-3 pb-2"
            onClick={(e) => e.stopPropagation()}
          >
            {phoneMore.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-4 px-4 h-14 rounded-xl text-[15px]',
                    isActive(item) ? 'bg-neutral-800 text-cream' : 'text-neutral-300 active:bg-neutral-900'
                  )}
                >
                  <Icon size={20} strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && <Badge count={badges[item.badge]} kind={item.badge} />}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Phone: tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-ink border-t border-neutral-800 pb-[env(safe-area-inset-bottom)]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${phoneTabs.length + (phoneMore.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {phoneTabs.map((item) => {
            const Icon = item.icon;
            const active = isActive(item) && !moreOpen;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className={tabClass(active)}>
                {active && <span className="absolute top-0 inset-x-5 h-0.5 rounded-full bg-gold" />}
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                  {item.badge && <Badge count={badges[item.badge]} kind={item.badge} className="absolute -top-1.5 -right-3" />}
                </span>
                {item.shortLabel ?? item.label}
              </Link>
            );
          })}
          {phoneMore.length > 0 && (
            <button onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className={tabClass(moreActive || moreOpen)}>
              {(moreActive || moreOpen) && <span className="absolute top-0 inset-x-5 h-0.5 rounded-full bg-gold" />}
              <span className="relative">
                <Ellipsis size={22} strokeWidth={moreActive || moreOpen ? 2 : 1.5} />
                {moreBadge > 0 && <Badge count={moreBadge} kind="missing" className="absolute -top-1.5 -right-3" />}
              </span>
              More
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
