'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface MetricRow {
  date: string;
  revenue_total: number | null;
  music_night: boolean;
  musician_name: string | null;
  musician_fee: number | null;
}

export function MusicRoiClient({ initialData }: { initialData: MetricRow[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [musician, setMusician] = useState('');
  const [fee, setFee] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!musician.trim() || !fee) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const { error: err } = await supabase.from('daily_metrics').upsert(
      {
        date,
        music_night: true,
        musician_name: musician.trim(),
        musician_fee: parseFloat(fee) || 0,
      },
      { onConflict: 'date' }
    );

    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      setMusician('');
      setFee('');
      router.refresh();
    }
  }

  const musicNights = initialData.filter((m) => m.music_night && m.musician_name);
  const nonMusicNights = initialData.filter((m) => !m.music_night);

  const roiData = useMemo(() => {
    const musicians = new Map<string, { nights: number; totalRevenue: number; totalFee: number }>();

    for (const m of musicNights) {
      if (!m.musician_name || m.revenue_total == null) continue;
      const existing = musicians.get(m.musician_name) ?? { nights: 0, totalRevenue: 0, totalFee: 0 };
      existing.nights++;
      existing.totalRevenue += m.revenue_total;
      existing.totalFee += m.musician_fee ?? 0;
      musicians.set(m.musician_name, existing);
    }

    const dowAverages = new Map<number, { total: number; count: number }>();
    for (const m of nonMusicNights) {
      if (m.revenue_total == null) continue;
      const dow = new Date(m.date + 'T00:00:00').getDay();
      const existing = dowAverages.get(dow) ?? { total: 0, count: 0 };
      existing.total += m.revenue_total;
      existing.count++;
      dowAverages.set(dow, existing);
    }

    const musicDowMap = new Map<string, number[]>();
    for (const m of musicNights) {
      if (!m.musician_name) continue;
      const dow = new Date(m.date + 'T00:00:00').getDay();
      const existing = musicDowMap.get(m.musician_name) ?? [];
      existing.push(dow);
      musicDowMap.set(m.musician_name, existing);
    }

    return Array.from(musicians.entries()).map(([name, stats]) => {
      const dows = musicDowMap.get(name) ?? [];
      let nonMusicAvg = 0;
      let dowCount = 0;
      for (const dow of dows) {
        const avg = dowAverages.get(dow);
        if (avg && avg.count > 0) {
          nonMusicAvg += avg.total / avg.count;
          dowCount++;
        }
      }
      nonMusicAvg = dowCount > 0 ? nonMusicAvg / dowCount : 0;

      const avgRevenue = stats.totalRevenue / stats.nights;
      const avgFee = stats.totalFee / stats.nights;
      const incremental = avgRevenue - nonMusicAvg;

      return {
        name,
        nights: stats.nights,
        avgRevenue: Math.round(avgRevenue),
        avgFee: Math.round(avgFee),
        nonMusicAvg: Math.round(nonMusicAvg),
        incremental: Math.round(incremental),
        netRoi: Math.round(incremental - avgFee),
      };
    });
  }, [musicNights, nonMusicNights]);

  return (
    <div className="space-y-10">
      {/* Log form */}
      <section className="bg-white border border-neutral-200 rounded p-6">
        <h2 className="font-display text-xl mb-5">Log a music night</h2>
        <form onSubmit={handleSubmit} className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Musician</label>
            <input
              type="text"
              value={musician}
              onChange={(e) => setMusician(e.target.value)}
              required
              placeholder="Name"
              className="px-3 py-2 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold w-48"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Fee ($)</label>
            <input
              type="number"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              required
              step="0.01"
              placeholder="0.00"
              className="px-3 py-2 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold w-28"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-ink text-cream px-6 py-2 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Log night'}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {success && <p className="text-sm text-gold">Logged.</p>}
        </form>
      </section>

      {/* ROI Table */}
      <section className="bg-white border border-neutral-200 rounded p-6">
        <h2 className="font-display text-xl mb-5">Musician ROI comparison</h2>
        {roiData.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-8">
            No music nights logged yet. Log nights above and enter daily revenue on the Metrics page to see comparisons.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-neutral-500 border-b border-neutral-200">
                  <th className="text-left py-3 pr-4">Musician</th>
                  <th className="text-right py-3 px-4">Nights</th>
                  <th className="text-right py-3 px-4">Avg revenue</th>
                  <th className="text-right py-3 px-4">Avg fee</th>
                  <th className="text-right py-3 px-4">Non-music avg</th>
                  <th className="text-right py-3 px-4">Incremental</th>
                  <th className="text-right py-3 pl-4">Net ROI</th>
                </tr>
              </thead>
              <tbody>
                {roiData.map((row) => (
                  <tr key={row.name} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-3 pr-4 font-medium">{row.name}</td>
                    <td className="py-3 px-4 text-right">{row.nights}</td>
                    <td className="py-3 px-4 text-right">${row.avgRevenue}</td>
                    <td className="py-3 px-4 text-right">${row.avgFee}</td>
                    <td className="py-3 px-4 text-right text-neutral-500">
                      {row.nonMusicAvg > 0 ? `$${row.nonMusicAvg}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {row.nonMusicAvg > 0 ? (
                        <span className={row.incremental >= 0 ? 'text-green-700' : 'text-red-700'}>
                          {row.incremental >= 0 ? '+' : ''}${row.incremental}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 pl-4 text-right font-medium">
                      {row.nonMusicAvg > 0 ? (
                        <span className={row.netRoi >= 0 ? 'text-green-700' : 'text-red-700'}>
                          {row.netRoi >= 0 ? '+' : ''}${row.netRoi}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-neutral-400 mt-4">
          Non-music avg compares same day-of-week nights without music. Incremental = music night avg revenue minus non-music avg. Net ROI = incremental minus musician fee.
        </p>
      </section>

      {/* Recent music nights log */}
      <section className="bg-white border border-neutral-200 rounded p-6">
        <h2 className="font-display text-xl mb-5">Recent music nights</h2>
        {musicNights.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-6">No nights logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-neutral-500 border-b border-neutral-200">
                  <th className="text-left py-3 pr-4">Date</th>
                  <th className="text-left py-3 px-4">Musician</th>
                  <th className="text-right py-3 px-4">Fee</th>
                  <th className="text-right py-3 pl-4">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {musicNights.slice(0, 20).map((m) => (
                  <tr key={m.date} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-2.5 pr-4">
                      {new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 px-4">{m.musician_name}</td>
                    <td className="py-2.5 px-4 text-right">${m.musician_fee ?? 0}</td>
                    <td className="py-2.5 pl-4 text-right">
                      {m.revenue_total != null ? `$${m.revenue_total}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
