'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ListChecks, LineChart, Music, FileBarChart, Megaphone, Users, CalendarDays, ShoppingCart, LogOut } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/dashboard/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/dashboard/team', label: 'Team', icon: Users },
  { href: '/dashboard/purchasing', label: 'Purchasing', icon: ShoppingCart },
  { href: '/dashboard/metrics', label: 'Metrics', icon: LineChart },
  { href: '/dashboard/music', label: 'Music ROI', icon: Music },
  { href: '/dashboard/reports', label: 'Reports', icon: FileBarChart },
  { href: '/dashboard/marketing', label: 'Marketing', icon: Megaphone },
];

export function NavSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-60 bg-ink text-cream flex flex-col h-screen sticky top-0">
      <div className="px-6 py-8">
        <Link href="/dashboard" className="font-display text-2xl block">
          Che Bar
        </Link>
        <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-1">Dashboard</p>
      </div>

      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
        <div className="px-3 mb-3">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">Signed in</p>
          <p className="text-xs text-neutral-300 truncate">{userEmail}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded text-sm text-neutral-400 hover:text-cream hover:bg-neutral-900 transition"
        >
          <LogOut size={16} strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
