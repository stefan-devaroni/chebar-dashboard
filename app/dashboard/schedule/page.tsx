import { createClient } from '@/lib/supabase/server';
import { WeeklySchedule } from '@/components/weekly-schedule';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const supabase = createClient();

  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .eq('active', true)
    .order('name');

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, team_members(id, name, color, department)')
    .gte('date', monday.toISOString().split('T')[0])
    .lte('date', sunday.toISOString().split('T')[0])
    .order('start_time');

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Schedule</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Weekly shift planner for the team.
        </p>
      </header>
      <WeeklySchedule
        initialShifts={shifts ?? []}
        members={members ?? []}
        initialWeekStart={monday.toISOString().split('T')[0]}
      />
    </div>
  );
}
