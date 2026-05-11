import { createClient } from '@/lib/supabase/server';
import { ReportAnalyzer } from '@/components/report-analyzer';
import { IngestionLog } from '@/components/ingestion-log';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const supabase = createClient();

  const { data: ingestions } = await supabase
    .from('report_ingestions')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(25);

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Reports</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Drop in PnL statements, sales reports, or product mix exports for instant analysis.
        </p>
      </header>

      <ReportAnalyzer />

      <section className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Auto-ingested reports</h2>
          <p className="text-xs text-neutral-500">From Revel POS nightly emails</p>
        </div>
        <IngestionLog ingestions={ingestions ?? []} />
      </section>
    </div>
  );
}
