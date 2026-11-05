import { createClient } from '@/lib/supabase/server';
import { ApplicantsView } from '@/components/applicants-view';
import { APPLICATION_COLUMNS, type JobApplication, type JobFairCheck } from '@/lib/applications';
import { isMissingTable } from '@/lib/reservations-server';

export const dynamic = 'force-dynamic';

export default async function ApplicantsPage({ searchParams }: { searchParams: { id?: string } }) {
  const supabase = createClient();
  const [{ data, error }, { data: checks }] = await Promise.all([
    supabase.from('job_applications').select(APPLICATION_COLUMNS).order('created_at', { ascending: false }).limit(500),
    supabase.from('job_fair_checks').select('checked_at, entries, people, note').order('checked_at', { ascending: false }).limit(1),
  ]);

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Applicants</h1>
        <p className="text-sm text-neutral-500 mt-1">Job applications from chebararuba.com/careers and the virtual job fair. Keep everyone on file for future openings.</p>
      </header>
      <ApplicantsView
        initialApplications={(data ?? []) as JobApplication[]}
        initialOpenId={searchParams.id ?? null}
        setupNeeded={isMissingTable(error)}
        lastCheck={((checks ?? [])[0] as JobFairCheck | undefined) ?? null}
      />
    </div>
  );
}
