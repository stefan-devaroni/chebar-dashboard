import { createClient } from '@/lib/supabase/server';
import { TeamManager } from '@/components/team-manager';
import { ScheduleTeamTabs } from '@/components/schedule-team-tabs';
import { getSessionInfo } from '@/lib/roles';
import { can } from '@/lib/permissions';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const supabase = createClient();
  const [session, { data: members }] = await Promise.all([
    getSessionInfo().catch(() => null),
    supabase.from('team_members').select('*').order('name'),
  ]);
  // Without the schedule, Team is a page of its own (no tabs)
  const schedule = can(session?.perms, 'schedule');
  const owner = session?.owner ?? false;

  return (
    <div>
      <header className={schedule ? 'mb-4' : 'mb-2'}>
        <h1 className="font-display text-3xl">{schedule ? 'Schedule & Team' : 'Team'}</h1>
      </header>
      {schedule && <ScheduleTeamTabs active="team" />}
      <p className={cn('text-sm text-neutral-500 mb-6', schedule && '-mt-2')}>
        {owner ? 'Who works here, their logins, and what each person can open.' : 'Who works here and their logins.'}
      </p>
      <TeamManager initialMembers={members ?? []} viewer={{ owner, perms: session?.perms ?? [] }} />
    </div>
  );
}
