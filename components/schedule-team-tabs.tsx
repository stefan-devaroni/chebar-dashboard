import Link from 'next/link';
import { cn } from '@/lib/utils';

// "Schedule & Team" is one menu item for managers: the schedule and the team list are two tabs.
// Employees only get the schedule, so their page shows no tabs.

const TABS = [
  { key: 'schedule', href: '/dashboard/schedule', label: 'Schedule' },
  { key: 'team', href: '/dashboard/team', label: 'Team' },
] as const;

export function ScheduleTeamTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <nav className="flex gap-1 border-b border-neutral-200 mb-6">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            'px-4 py-2.5 text-sm -mb-px border-b-2 transition',
            active === t.key ? 'border-ink text-ink font-medium' : 'border-transparent text-neutral-500 hover:text-ink'
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
