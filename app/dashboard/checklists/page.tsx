import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { ChecklistsView } from '@/components/checklists-view';
import { businessDate, type Checklist, type ChecklistCheck, type ChecklistItem, type Department } from '@/lib/checklists';
import { isDate } from '@/lib/reservations';
import { isMissingTable } from '@/lib/reservations-server';

export const dynamic = 'force-dynamic';

export default async function ChecklistsPage({ searchParams }: { searchParams: { date?: string } }) {
  const supabase = createClient();
  const session = await getSessionInfo().catch(() => null);
  const role = session?.role ?? 'employee';
  const today = businessDate();
  // Managers can look back at past days; staff always see today
  const date = role === 'manager' && isDate(searchParams.date) && searchParams.date < today ? searchParams.date : today;

  const [lists, items, checks, member] = await Promise.all([
    supabase.from('checklists').select('id, name, department, days, due_time, sort, active').order('sort'),
    supabase.from('checklist_items').select('id, checklist_id, text, sort, active').order('sort'),
    supabase.from('checklist_checks').select('id, item_id, checklist_id, date, checked_by, checked_at').eq('date', date),
    session?.memberId
      ? supabase.from('team_members').select('department').eq('id', session.memberId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const myDepartment = ((member.data as { department?: string } | null)?.department ?? 'all') as Department;

  return (
    <div className="max-w-2xl">
      <ChecklistsView
        date={date}
        today={today}
        role={role}
        myDepartment={myDepartment}
        initialLists={(lists.data ?? []) as Checklist[]}
        initialItems={(items.data ?? []) as ChecklistItem[]}
        initialChecks={(checks.data ?? []) as ChecklistCheck[]}
        setupNeeded={isMissingTable(lists.error)}
      />
    </div>
  );
}
