import { createClient } from '@/lib/supabase/server';
import { WeeklySchedule } from '@/components/weekly-schedule';
import { getSessionInfo, screenRole } from '@/lib/roles';
import { can } from '@/lib/permissions';
import { ScheduleTeamTabs } from '@/components/schedule-team-tabs';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const supabase = createClient();
  const session = await getSessionInfo().catch(() => null);
  const role = screenRole(session, 'schedule.edit');
  const team = can(session?.perms, 'team');

  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, role, color, active, department')
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
      <header className={team ? 'mb-4' : 'mb-6'}>
        <h1 className="font-display text-3xl">{team ? 'Schedule & Team' : 'Schedule'}</h1>
      </header>
      {team && <ScheduleTeamTabs active="schedule" />}
      <WeeklySchedule
        initialShifts={shifts ?? []}
        members={members ?? []}
        initialWeekStart={mondayStr}
        role={role}
        selfMemberId={session?.memberId ?? null}
      />
    </div>
  );
}
