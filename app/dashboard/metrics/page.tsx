import { createClient } from '@/lib/supabase/server';
import { MetricsClient } from '@/components/metrics-client';

export const dynamic = 'force-dynamic';

export default async function MetricsPage() {
  const supabase = createClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: metrics } = await supabase
    .from('daily_metrics')
    .select('*')
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Metrics</h1>
        <p className="text-sm text-neutral-500 mt-1">Daily revenue tracking by daypart.</p>
      </header>
      <MetricsClient initialData={metrics ?? []} />
    </div>
  );
}
