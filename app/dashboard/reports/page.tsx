import { createClient } from '@/lib/supabase/server';
import { ReportChat } from '@/components/report-chat';
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

  const { count: metricsCount } = await supabase
    .from('daily_metrics')
    .select('*', { count: 'exact', head: true });

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Reports</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {metricsCount
            ? `${metricsCount} days of data loaded. Ask anything.`
            : 'Email reports to reports@ingest.chebararuba.com or drop files below.'}
        </p>
      </header>

      <ReportChat />

      <section className="mt-12">
        <h2 className="font-display text-xl mb-3">Upload a report for analysis</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Drop a PnL, sales report, or product mix export for a one-off analysis.
        </p>
        <ReportAnalyzer />
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Ingested reports</h2>
          <p className="text-xs text-neutral-500">From Revel POS emails</p>
        </div>
        <IngestionLog ingestions={ingestions ?? []} />
      </section>
    </div>
  );
}
