'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, CalendarDays, ShoppingCart, ClipboardList, Megaphone, Menu, X } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/dashboard/purchasing', label: 'Purchasing', icon: ShoppingCart },
  { href: '/dashboard/orders', label: 'Orders', icon: ClipboardList },
  { href: '/dashboard/marketing', label: 'Marketing', icon: Megaphone },
];

export function NavSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
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
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-6 border-t border-neutral-800">
        <p className="px-3 text-[10px] uppercase tracking-widest text-neutral-500">Che Bar Aruba</p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-ink text-cream z-40 flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-display text-xl">Che Bar</Link>
        <button onClick={() => setOpen(true)} className="p-1.5">
          <Menu size={22} strokeWidth={1.5} />
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
