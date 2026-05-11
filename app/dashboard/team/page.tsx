import { createClient } from '@/lib/supabase/server';
import { TeamManager } from '@/components/team-manager';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const supabase = createClient();
  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .order('name');

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Team</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Manage employees, owners, and managers.
        </p>
      </header>
      <TeamManager initialMembers={members ?? []} />
    </div>
  );
}
