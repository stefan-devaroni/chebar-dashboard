import { createClient } from '@/lib/supabase/server';
import { TeamManager } from '@/components/team-manager';
import { ScheduleTeamTabs } from '@/components/schedule-team-tabs';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const supabase = createClient();
  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .order('name');

  return (
    <div>
      <header className="mb-4">
        <h1 className="font-display text-3xl">Schedule &amp; Team</h1>
      </header>
      <ScheduleTeamTabs active="team" />
      <p className="text-sm text-neutral-500 -mt-2 mb-6">Manage employees, owners, and managers.</p>
      <TeamManager initialMembers={members ?? []} />
    </div>
  );
}
