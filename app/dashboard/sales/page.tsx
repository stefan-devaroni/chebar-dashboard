import { createClient } from '@/lib/supabase/server';
import { SalesView } from '@/components/sales-view';
import { arubaNow } from '@/lib/reservations';
import { shortDate, type Period } from '@/lib/sales';
import { loadSales } from '@/lib/sales-server';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const supabase = createClient();
  const today = arubaNow().date;

  // Open on today once today's report is in, otherwise on yesterday
  const { data: latest } = await supabase.from('daily_metrics').select('date').order('date', { ascending: false }).limit(1).maybeSingle();
  const period: Period = latest?.date === today ? 'today' : 'yesterday';
  const initial = await loadSales(supabase, period, today).catch(() => null);

  return (
    <div className="max-w-3xl">
      <header className="mb-5">
        <h1 className="font-display text-3xl">Sales</h1>
        <p className="text-sm text-neutral-500 mt-1">
          From Revel&apos;s daily sales and product mix reports.
          {latest?.date ? ` Latest report: ${shortDate(latest.date)}.` : ''}
        </p>
      </header>
      <SalesView initial={initial} today={today} />
    </div>
  );
}
