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

  // Compute the week in Aruba time — the server runs in UTC, which is 4h ahead
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Aruba' }));
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const mondayStr = fmt(monday);
  const sundayStr = fmt(sunday);

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
