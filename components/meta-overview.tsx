'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Bookmark, ExternalLink, Eye, Facebook, Heart, Instagram, MessageCircle, RefreshCw, Share2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Marketing tab: Facebook + Instagram followers, the last 7 days or 4 weeks against the period before,
// a day-by-day trend chart, the Instagram audience and every recent post's results. lib/meta.ts fills
// social_daily, social_posts and social_audience; the tab refreshes from Meta on open when the numbers
// are more than 3 hours old.

type Platform = 'facebook' | 'instagram';

export interface SocialDay {
  date: string;
  platform: Platform;
  followers: number | null;
  new_followers: number | null;
  reach: number | null;
  views: number | null;
  profile_views: number | null;
  engagements: number | null;
}

export interface SyncedPost {
  external_id: string;
  platform: Platform;
  posted_at: string | null;
  post_date: string;
  post_type: string;
  caption: string | null;
  image_url: string | null;
  permalink: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
  views: number | null;
  saves: number | null;
  interactions: number | null;
}

export interface AudienceRow {
  platform: Platform;
  breakdown: string;
  label: string;
  value: number;
}

export interface LastSync {
  ran_at: string;
  ok: boolean;
  error: string | null;
  summary: { page?: string; instagram?: string } | null;
}

type Metric = 'views' | 'reach' | 'engagements' | 'profile_views' | 'new_followers';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'views', label: 'Views' },
  { key: 'reach', label: 'Reach' },
  { key: 'engagements', label: 'Interactions' },
  { key: 'profile_views', label: 'Profile visits' },
  { key: 'new_followers', label: 'New followers' },
];
const PLATFORMS: { key: Platform; label: string; Icon: typeof Instagram; tint: string; color: string }[] = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram, tint: 'text-pink-600 bg-pink-50', color: '#db2777' },
  { key: 'facebook', label: 'Facebook', Icon: Facebook, tint: 'text-blue-600 bg-blue-50', color: '#2563eb' },
];
const STALE_MS = 3 * 3_600_000;
const card = 'bg-white border border-neutral-200 rounded-2xl';
const num = (n: number) => Math.round(n).toLocaleString('en-US');

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

const shortDate = (date: string, weekday = false) =>
  new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(weekday ? { weekday: 'short' } : {}) });

/** Sum and per-day average of a metric over a stretch of days, counting only days Meta gave a number for */
function stretch(rows: SocialDay[], key: Metric, from: string, to: string) {
  const values = rows.filter((r) => r.date >= from && r.date <= to).map((r) => r[key]).filter((v): v is number => typeof v === 'number');
  return values.length ? { sum: values.reduce((s, v) => s + v, 0), avg: values.reduce((s, v) => s + v, 0) / values.length } : null;
}

export function MetaOverview({
  daily,
  posts,
  audience,
  lastSync,
  today,
}: {
  daily: SocialDay[];
  posts: SyncedPost[];
  audience: AudienceRow[];
  lastSync: LastSync | null;
  today: string;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState<7 | 28>(28);
  const started = useRef(false);

  async function refresh() {
    setSyncing(true);
    setError('');
    const res = await fetch('/api/marketing/meta', { method: 'POST' }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (!body) setError('Could not reach Meta. Try again in a minute.');
    else if (body.error) setError(body.error);
    router.refresh();
    setSyncing(false);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!lastSync || Date.now() - Date.parse(lastSync.ran_at) > STALE_MS) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Today is still running, so the stretches end yesterday
  const to = addDays(today, -1);
  const from = addDays(to, -(days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  const shownError = error || (lastSync && !lastSync.ok ? lastSync.error : '');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-neutral-100 rounded-full p-0.5 text-sm">
          {([7, 28] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn('px-4 py-1.5 rounded-full', days === d ? 'bg-white shadow-sm text-ink' : 'text-neutral-500')}
            >
              {d === 7 ? 'Last 7 days' : 'Last 4 weeks'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-neutral-500">{lastSync ? `Updated ${ago(lastSync.ran_at)}` : 'Not updated yet'}</p>
          <button
            onClick={refresh}
            disabled={syncing}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-neutral-700 disabled:opacity-60"
          >
            <RefreshCw size={14} className={cn(syncing && 'animate-spin')} />
            {syncing ? 'Updating…' : 'Refresh'}
          </button>
        </div>
      </div>

      {shownError && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">{shownError}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {PLATFORMS.map((p) => (
          <PlatformCard
            key={p.key}
            platform={p}
            rows={daily.filter((d) => d.platform === p.key)}
            range={{ from, to, prevFrom, prevTo }}
            days={days}
            username={p.key === 'instagram' ? lastSync?.summary?.instagram : lastSync?.summary?.page}
          />
        ))}
      </div>

      <TrendChart daily={daily} from={from} to={to} />
      <Audience rows={audience} />
      <Posts posts={posts} syncing={syncing} />
    </div>
  );
}

function Change({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-xs text-neutral-400">no change</span>;
  return (
    <span className={cn('inline-flex items-center text-xs', pct > 0 ? 'text-green-700' : 'text-red-600')}>
      {pct > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function PlatformCard({
  platform,
  rows,
  range,
  days,
  username,
}: {
  platform: (typeof PLATFORMS)[number];
  rows: SocialDay[];
  range: { from: string; to: string; prevFrom: string; prevTo: string };
  days: number;
  username?: string;
}) {
  const withFollowers = [...rows].filter((r) => r.followers !== null).sort((a, b) => a.date.localeCompare(b.date));
  const latest = withFollowers[withFollowers.length - 1];
  const newFollowers = stretch(rows, 'new_followers', range.from, range.to);
  const items = (
    [
      ['views', 'Views', 'sum'],
      ['reach', 'Reach per day', 'avg'],
      ['profile_views', 'Profile visits', 'sum'],
      ['engagements', 'Interactions', 'sum'],
    ] as const
  ).flatMap(([key, label, show]) => {
    const now = stretch(rows, key, range.from, range.to);
    if (!now) return [];
    const before = stretch(rows, key, range.prevFrom, range.prevTo);
    // Compare per-day averages, so a few missing days don't skew the change
    return [{ label, value: show === 'avg' ? now.avg : now.sum, nowAvg: now.avg, beforeAvg: before?.avg ?? 0 }];
  });

  return (
    <section className={cn(card, 'p-5')}>
      <div className="flex items-center gap-2">
        <span className={cn('p-1.5 rounded-lg', platform.tint)}>
          <platform.Icon size={16} />
        </span>
        <h2 className="font-medium">{platform.label}</h2>
        {username && <span className="text-xs text-neutral-400 truncate">{platform.key === 'instagram' ? `@${username}` : username}</span>}
      </div>
      <p className="font-display text-4xl mt-3">{latest?.followers != null ? num(latest.followers) : '—'}</p>
      <p className="text-sm text-neutral-500">
        followers{newFollowers ? ` · +${num(newFollowers.sum)} new in ${days === 7 ? '7 days' : '4 weeks'}` : ''}
      </p>
      {items.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-5 pt-4 border-t border-neutral-100">
          {items.map((i) => (
            <div key={i.label}>
              <dt className="text-xs text-neutral-500">{i.label}</dt>
              <dd className="flex items-baseline gap-2">
                <span className="text-lg tabular-nums">{num(i.value)}</span>
                <Change now={i.nowAvg} before={i.beforeAvg} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-5 pt-4 border-t border-neutral-100 text-sm text-neutral-500">No numbers from Meta for these days yet.</p>
      )}
    </section>
  );
}

function TrendChart({ daily, from, to }: { daily: SocialDay[]; from: string; to: string }) {
  const [metric, setMetric] = useState<Metric>('views');
  const dates = datesBetween(from, to);
  const value = (platform: Platform, date: string) => daily.find((d) => d.platform === platform && d.date === date)?.[metric] ?? null;
  const points = dates.map((date) => ({
    label: dates.length <= 7 ? shortDate(date, true).split(',')[0] : String(Number(date.slice(8, 10))),
    full: shortDate(date, true),
    instagram: value('instagram', date),
    facebook: value('facebook', date),
  }));
  const hasData = points.some((p) => p.instagram !== null || p.facebook !== null);

  return (
    <section className={cn(card, 'p-5')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Day by day</h2>
        <div className="flex gap-3 text-xs text-neutral-500">
          {PLATFORMS.map((p) => (
            <span key={p.key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
              {p.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-5 px-5 mt-3 pb-1 [scrollbar-width:none]">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs border',
              metric === m.key ? 'bg-ink text-cream border-ink' : 'bg-white text-neutral-600 border-neutral-200'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {hasData ? (
        <div className="mt-4 -ml-2">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={points} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#737373' }} interval="preserveStartEnd" minTickGap={6} />
              <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: '#a3a3a3' }} allowDecimals={false} />
              <Tooltip
                formatter={(v, name) => [num(Number(v)), name === 'instagram' ? 'Instagram' : 'Facebook']}
                labelFormatter={(_, payload) => String(payload?.[0]?.payload?.full ?? '')}
              />
              {PLATFORMS.map((p) => (
                <Line key={p.key} type="monotone" dataKey={p.key} stroke={p.color} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-6 mb-2 text-sm text-neutral-500 text-center">No numbers for these days yet.</p>
      )}
    </section>
  );
}

const GENDERS: Record<string, string> = { F: 'Women', M: 'Men', U: 'Not given' };

function Audience({ rows }: { rows: AudienceRow[] }) {
  if (!rows.length) return null;
  const countryName = (() => {
    try {
      const names = new Intl.DisplayNames(['en'], { type: 'region' });
      return (code: string) => names.of(code) ?? code;
    } catch {
      return (code: string) => code;
    }
  })();
  const group = (breakdown: string, rename: (l: string) => string = (l) => l, limit = 6) => {
    const list = rows.filter((r) => r.breakdown === breakdown).sort((a, b) => b.value - a.value);
    const total = list.reduce((s, r) => s + r.value, 0);
    return list.slice(0, limit).map((r) => ({ label: rename(r.label), pct: total ? (r.value / total) * 100 : 0 }));
  };
  const sections = [
    { title: 'Countries', items: group('country', countryName) },
    { title: 'Cities', items: group('city', (l) => l.split(',')[0]) },
    { title: 'Age', items: group('age', (l) => l, 7).sort((a, b) => a.label.localeCompare(b.label)) },
    { title: 'Gender', items: group('gender', (l) => GENDERS[l] ?? l) },
  ].filter((s) => s.items.length);

  return (
    <section className={cn(card, 'p-5')}>
      <div className="flex items-center gap-2">
        <Users size={16} className="text-neutral-500" />
        <h2 className="font-medium">Who follows you on Instagram</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 mt-4">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{s.title}</p>
            <ul className="space-y-1.5">
              {s.items.map((i) => (
                <li key={i.label}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate pr-2">{i.label}</span>
                    <span className="tabular-nums text-neutral-500">{i.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full mt-0.5 overflow-hidden">
                    <div className="h-full bg-pink-400 rounded-full" style={{ width: `${Math.max(i.pct, 1)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const interactionsOf = (p: SyncedPost) => p.interactions ?? (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0);

function Posts({ posts, syncing }: { posts: SyncedPost[]; syncing: boolean }) {
  const [sort, setSort] = useState<'newest' | 'views' | 'interactions'>('newest');
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [showAll, setShowAll] = useState(false);

  if (posts.length === 0) {
    return (
      <section className={cn(card, 'p-8 text-center text-sm text-neutral-500')}>
        {syncing ? 'Getting your posts from Facebook and Instagram…' : 'No posts yet.'}
      </section>
    );
  }

  const list = posts
    .filter((p) => platform === 'all' || p.platform === platform)
    .sort((a, b) =>
      sort === 'views'
        ? (b.views ?? b.reach ?? 0) - (a.views ?? a.reach ?? 0)
        : sort === 'interactions'
          ? interactionsOf(b) - interactionsOf(a)
          : (b.posted_at ?? b.post_date).localeCompare(a.posted_at ?? a.post_date)
    );
  const visible = showAll ? list : list.slice(0, 10);
  const count = (p: Platform) => posts.filter((x) => x.platform === p).length;
  const chip = (active: boolean) =>
    cn('shrink-0 px-3 py-1.5 rounded-full text-xs border', active ? 'bg-ink text-cream border-ink' : 'bg-white text-neutral-600 border-neutral-200');

  return (
    <section className={cn(card, 'overflow-hidden')}>
      <div className="px-5 pt-5 pb-3 space-y-3">
        <h2 className="font-medium">Posts</h2>
        <div className="flex flex-wrap gap-2">
          {(['newest', 'views', 'interactions'] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={chip(sort === s)}>
              {s === 'newest' ? 'Newest' : s === 'views' ? 'Most views' : 'Most interactions'}
            </button>
          ))}
          <span className="w-px bg-neutral-200 mx-1" />
          {(['all', 'instagram', 'facebook'] as const).map((p) => (
            <button key={p} onClick={() => setPlatform(p)} className={chip(platform === p)}>
              {p === 'all' ? 'All' : `${p === 'instagram' ? 'Instagram' : 'Facebook'} (${count(p)})`}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
        {visible.map((p) => (
          <PostRow key={p.external_id} post={p} />
        ))}
        {visible.length === 0 && <li className="px-5 py-8 text-center text-sm text-neutral-500">No posts here yet.</li>}
      </ul>
      {!showAll && list.length > 10 && (
        <button onClick={() => setShowAll(true)} className="w-full py-3 text-sm text-neutral-600 border-t border-neutral-100 hover:bg-neutral-50">
          Show all {list.length}
        </button>
      )}
    </section>
  );
}

function PostRow({ post: p }: { post: SyncedPost }) {
  const platform = PLATFORMS.find((x) => x.key === p.platform) ?? PLATFORMS[0];
  const interactions = interactionsOf(p);
  const engaged = p.reach ? (interactions / p.reach) * 100 : null;
  const stat = (Icon: typeof Heart, value: number | null, label?: string) =>
    value === null ? null : (
      <span className="flex items-center gap-1">
        <Icon size={12} /> {num(value)}
        {label ? ` ${label}` : ''}
      </span>
    );
  return (
    <li>
      <a href={p.permalink ?? '#'} target="_blank" rel="noopener noreferrer" className="flex gap-3 px-5 py-3 hover:bg-neutral-50">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-20 h-20 rounded-lg object-cover bg-neutral-100 shrink-0" />
        ) : (
          <span className="w-20 h-20 rounded-lg bg-neutral-100 shrink-0" />
        )}
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <platform.Icon size={12} />
            {shortDate(p.post_date)}
            {p.post_type && !['post', 'feed'].includes(p.post_type) ? ` · ${p.post_type.replace(/_/g, ' ')}` : ''}
            <ExternalLink size={11} className="ml-auto text-neutral-300" />
          </span>
          <span className="block text-sm text-neutral-800 line-clamp-2 mt-0.5">{p.caption || 'No caption'}</span>
          <span className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-neutral-600 tabular-nums">
            {stat(Eye, p.views, 'views')}
            {p.reach !== null && <span>{num(p.reach)} reached</span>}
            {stat(Heart, p.likes)}
            {stat(MessageCircle, p.comments)}
            {p.shares ? stat(Share2, p.shares) : null}
            {p.saves ? stat(Bookmark, p.saves) : null}
            {engaged !== null && <span className="text-neutral-400">{engaged.toFixed(1)}% engaged</span>}
          </span>
        </span>
      </a>
    </li>
  );
}
