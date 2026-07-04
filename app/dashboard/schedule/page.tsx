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

  const mondayStr = monday.toISOString().split('T')[0];
  const sundayStr = sunday.toISOString().split('T')[0];

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .gte('date', mondayStr)
    .lte('date', sundayStr);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl">Schedule</h1>
      </header>
      <WeeklySchedule
        initialShifts={shifts ?? []}
        members={members ?? []}
        initialWeekStart={mondayStr}
      />
    </div>
  );
}
