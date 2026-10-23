'use client';

import { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addDays } from '@/lib/reservations';
import { PERIODS, datesIn, money, rangeLabel, shortDate, totals, type Period, type ProductTotal, type SalesData } from '@/lib/sales';

// Sales tab: pick a period, see total sales against the comparison period, a daily (or, for the
// year, monthly) chart, the split by time of day and the products sold. Periods load once each.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const card = 'bg-white border border-neutral-200 rounded-2xl';

/** Round axis steps (500, 1k, 1.5k ... or 20k, 40k ...) from zero to just above the highest bar */
function roundTicks(max: number): number[] {
  if (max <= 0) return [0, 100];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks = [0];
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export function SalesView({ initial, today }: { initial: SalesData | null; today: string }) {
  const [cache, setCache] = useState<Partial<Record<Period, SalesData>>>(initial ? { [initial.period]: initial } : {});
  const [period, setPeriod] = useState<Period>(initial?.period ?? 'yesterday');
  const [loading, setLoading] = useState<Period | null>(null);
  const [error, setError] = useState('');
  const data = cache[period];

  async function choose(p: Period) {
    setPeriod(p);
    setError('');
    if (cache[p]) return;
    setLoading(p);
    const res = await fetch(`/api/sales?period=${p}`, { cache: 'no-store' }).catch(() => null);
    const loaded: SalesData | null = res?.ok ? await res.json().catch(() => null) : null;
    setLoading((l) => (l === p ? null : l));
    if (!loaded) {
      setError('Could not load these sales. Check the connection and try again.');
      return;
    }
    setCache((c) => ({ ...c, [p]: loaded }));
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 mb-3 [scrollbar-width:none]">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => choose(p.key)}
            aria-pressed={period === p.key}
            className={cn(
              'shrink-0 px-4 py-2 rounded-full text-sm border transition',
              period === p.key ? 'bg-ink text-cream border-ink' : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {!data && !error && (
        <div className={cn(card, 'p-10 text-center text-sm text-neutral-500')}>{loading ? 'Loading sales…' : 'Could not load sales.'}</div>
      )}
      {data && <PeriodSales data={data} today={today} />}
    </div>
  );
}

function PeriodSales({ data, today }: { data: SalesData; today: string }) {
  const { range } = data;
  const reported = new Set(data.days.filter((d) => d.revenue_total !== null).map((d) => d.date));
  // Today's report only comes in after closing: until then today is left out, and so is the
  // matching last day of the comparison, so both sides cover the same days
  const todayPending = range.from <= today && today <= range.to && !reported.has(today);
  const t = totals(data.days);
  const c = totals(todayPending ? data.compareDays.filter((d) => d.date !== range.compare.to) : data.compareDays);
  const lastDay = todayPending ? addDays(today, -1) : range.to < today ? range.to : today;
  const elapsed = lastDay >= range.from ? datesIn({ from: range.from, to: lastDay }) : [];
  const missing = elapsed.filter((d) => !reported.has(d));
  const change = reported.size > 0 && c.revenue > 0 ? ((t.revenue - c.revenue) / c.revenue) * 100 : null;

  if (reported.size === 0) {
    return (
      <div className={cn(card, 'p-8 text-center')}>
        <p className="text-xs uppercase tracking-wider text-neutral-500">{rangeLabel(range)}</p>
        <p className="mt-3 text-neutral-700">
          {data.period === 'today' ? 'No report for today yet. It shows up here as soon as Revel sends it.' : 'No sales reports for this period yet.'}
        </p>
        <p className="mt-2 text-sm text-neutral-500">Revel&apos;s daily reports come in by email at revel@ingest.chebararuba.com.</p>
      </div>
    );
  }

  const stats: [string, string][] = [];
  if (t.orders > 0) stats.push(['Orders', t.orders.toLocaleString('en-US')], ['Average order', money(t.revenue / t.orders, true)]);
  if (t.guests > 0) stats.push(['Guests', t.guests.toLocaleString('en-US')], ['Per guest', money(t.revenue / t.guests, true)]);
  if (reported.size > 1) stats.push(['Average day', money(t.revenue / reported.size)]);

  return (
    <div className="space-y-4">
      <section className={cn(card, 'p-5')}>
        <p className="text-xs uppercase tracking-wider text-neutral-500">{rangeLabel(range)}</p>
        <p className="font-display text-4xl mt-1">{money(t.revenue)}</p>
        {change !== null ? (
          <p className={cn('mt-1 text-sm flex items-center gap-1', change >= 0 ? 'text-green-700' : 'text-red-600')}>
            {change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {Math.abs(change).toFixed(0)}% {range.compareLabel}
            <span className="text-neutral-400">({money(c.revenue)})</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-neutral-400">No reports to compare with yet ({range.compareLabel.replace(/^vs /, '')}).</p>
        )}

        {stats.length > 0 && (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mt-5 pt-4 border-t border-neutral-100">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-neutral-500">{label}</dt>
                <dd className="text-lg tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {missing.length > 0 && (
          <p className="mt-4 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
            Reports for {elapsed.length - missing.length} of {elapsed.length} days. Missing: {missing.slice(0, 6).map((d) => shortDate(d)).join(', ')}
            {missing.length > 6 ? ` and ${missing.length - 6} more` : ''}.
          </p>
        )}
        {todayPending && <p className="mt-3 text-xs text-neutral-500">Today&apos;s report isn&apos;t in yet, so today is left out for now.</p>}
      </section>

      {range.from !== range.to && <SalesChart data={data} />}
      <Dayparts breakfast={t.breakfast} lunch={t.lunch} dinner={t.dinner} total={t.revenue} />
      <Products products={data.products} productDays={data.productDays} days={elapsed.length} />
    </div>
  );
}

function SalesChart({ data }: { data: SalesData }) {
  const byDate = new Map(data.days.map((d) => [d.date, d.revenue_total]));
  const dates = datesIn(data.range);
  const points =
    data.period === 'thisYear'
      ? MONTHS.slice(0, Number(data.range.to.slice(5, 7))).map((label, i) => {
          const prefix = `${data.range.to.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`;
          const days = data.days.filter((d) => d.date.startsWith(prefix) && d.revenue_total !== null);
          return { label, full: label, value: days.length ? days.reduce((s, d) => s + (d.revenue_total ?? 0), 0) : null };
        })
      : dates.map((date) => ({
          label: dates.length <= 7 ? shortDate(date).slice(0, 3) : String(Number(date.slice(8, 10))),
          full: shortDate(date),
          value: byDate.get(date) ?? null,
        }));

  const ticks = roundTicks(Math.max(0, ...points.map((p) => p.value ?? 0)));

  return (
    <section className={cn(card, 'p-4 pt-5')}>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#737373' }} interval="preserveStartEnd" minTickGap={4} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1]]}
            tick={{ fontSize: 11, fill: '#a3a3a3' }}
            tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k` : `$${v}`)}
          />
          <Tooltip
            cursor={{ fill: '#f4f1ea' }}
            formatter={(v) => [money(Number(v)), 'Sales']}
            labelFormatter={(_, payload) => String(payload?.[0]?.payload?.full ?? '')}
          />
          <Bar dataKey="value" fill="#d4a45c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

// Revel's Sales Summary has no time-of-day split; only show one when the reports covered the whole period
function Dayparts({ breakfast, lunch, dinner, total }: { breakfast: number; lunch: number; dinner: number; total: number }) {
  const parts = ([['Breakfast', breakfast], ['Lunch', lunch], ['Dinner', dinner]] as const).filter(([, v]) => v > 0);
  const sum = parts.reduce((s, [, v]) => s + v, 0);
  if (!sum || sum < total * 0.9) return null;
  return (
    <section className={cn(card, 'p-5')}>
      <h2 className="font-medium mb-3">By time of day</h2>
      <div className="space-y-3">
        {parts.map(([label, value]) => {
          const pct = Math.round((value / sum) * 100);
          return (
            <div key={label}>
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="tabular-nums">
                  {money(value)} <span className="text-neutral-400">· {pct}%</span>
                </span>
              </div>
              <div className="h-2 bg-neutral-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const qty = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(1));

function Products({ products, productDays, days }: { products: ProductTotal[]; productDays: number; days: number }) {
  const [sort, setSort] = useState<'revenue' | 'quantity'>('revenue');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  if (products.length === 0) {
    return (
      <section className={cn(card, 'p-5')}>
        <h2 className="font-medium">Products</h2>
        <p className="mt-2 text-sm text-neutral-500">No product mix reports for this period yet.</p>
      </section>
    );
  }

  const categoryTotals = new Map<string, number>();
  for (const p of products) if (p.category) categoryTotals.set(p.category, (categoryTotals.get(p.category) ?? 0) + p.revenue);
  const categories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

  const q = query.trim().toLowerCase();
  const list = products
    .filter((p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q)))
    .sort((a, b) => (sort === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity));
  const top = Math.max(1, ...list.map((p) => (sort === 'revenue' ? p.revenue : p.quantity)));
  const visible = showAll || q ? list : list.slice(0, 10);

  return (
    <section className={cn(card, 'overflow-hidden')}>
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Products</h2>
          <div className="flex text-xs bg-neutral-100 rounded-full p-0.5">
            {(['revenue', 'quantity'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn('px-3 py-1.5 rounded-full', sort === s ? 'bg-white shadow-sm text-ink' : 'text-neutral-500')}
              >
                {s === 'revenue' ? 'By sales' : 'By number sold'}
              </button>
            ))}
          </div>
        </div>
        {productDays < days && (
          <p className="mt-1 text-xs text-neutral-500">
            From product mix reports for {productDays} of {days} days.
          </p>
        )}

        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-5 px-5 mt-3 pb-1 [scrollbar-width:none]">
            {['', ...categories].map((name) => (
              <button
                key={name || 'all'}
                onClick={() => setCategory(name)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs border',
                  category === name ? 'bg-ink text-cream border-ink' : 'bg-white text-neutral-600 border-neutral-200'
                )}
              >
                {name || 'All'}
              </button>
            ))}
          </div>
        )}

        {products.length > 12 && (
          <label className="mt-3 flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2">
            <Search size={15} className="text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        )}
      </div>

      <ol className="divide-y divide-neutral-100 border-t border-neutral-100">
        {visible.map((p, i) => (
          <li key={p.name} className="flex items-center gap-3 px-5 py-2.5">
            <span className="w-5 text-xs text-neutral-400 tabular-nums">{i + 1}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm truncate">{p.name}</span>
              {p.category && !category && <span className="block text-[11px] text-neutral-400 truncate">{p.category}</span>}
              <span className="block h-1 mt-1 bg-neutral-100 rounded-full overflow-hidden">
                <span className="block h-full bg-gold" style={{ width: `${((sort === 'revenue' ? p.revenue : p.quantity) / top) * 100}%` }} />
              </span>
            </span>
            <span className="text-right shrink-0">
              <span className="block text-sm tabular-nums">{money(p.revenue)}</span>
              <span className="block text-[11px] text-neutral-500 tabular-nums">{qty(p.quantity)} sold</span>
            </span>
          </li>
        ))}
        {visible.length === 0 && <li className="px-5 py-6 text-sm text-neutral-500 text-center">No products match.</li>}
      </ol>

      {!showAll && !q && list.length > 10 && (
        <button onClick={() => setShowAll(true)} className="w-full py-3 text-sm text-neutral-600 border-t border-neutral-100 hover:bg-neutral-50">
          Show all {list.length}
        </button>
      )}
    </section>
  );
}
