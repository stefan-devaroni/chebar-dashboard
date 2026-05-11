import { createClient } from '@/lib/supabase/server';
import { MusicRoiClient } from '@/components/music-roi-client';

export const dynamic = 'force-dynamic';

export default async function MusicPage() {
  const supabase = createClient();

  const { data: allMetrics } = await supabase
    .from('daily_metrics')
    .select('date, revenue_total, music_night, musician_name, musician_fee')
    .order('date', { ascending: false });

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Music ROI</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Track live music nights and compare revenue impact.
        </p>
      </header>
      <MusicRoiClient initialData={allMetrics ?? []} />
    </div>
  );
}
