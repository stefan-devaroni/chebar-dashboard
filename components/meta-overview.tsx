'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, ExternalLink, Eye, Facebook, Heart, Instagram, MessageCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Marketing tab, first sub-tab: followers, the last 28 days and recent posts from Facebook and
// Instagram (lib/meta.ts fills social_daily and social_posts). Refreshes from Meta on open when the
// numbers are more than 3 hours old.

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
}

export interface LastSync {
  ran_at: string;
  ok: boolean;
  error: string | null;
  summary: { page?: string; instagram?: string } | null;
}

const STALE_MS = 3 * 3_600_000;
const card = 'bg-white border border-neutral-200 rounded-2xl';
const num = (n: number) => n.toLocaleString('en-US');

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

const PLATFORMS: { key: Platform; label: string; Icon: typeof Instagram; tint: string }[] = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram, tint: 'text-pink-600 bg-pink-50' },
  { key: 'facebook', label: 'Facebook', Icon: Facebook, tint: 'text-blue-600 bg-blue-50' },
];

export function MetaOverview({ daily, posts, lastSync, today }: { daily: SocialDay[]; posts: SyncedPost[]; lastSync: LastSync | null; today: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
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

  const shownError = error || (lastSync && !lastSync.ok ? lastSync.error : '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          {lastSync ? `Updated ${ago(lastSync.ran_at)}` : 'Not updated yet'}
          {lastSync?.summary?.instagram ? ` · @${lastSync.summary.instagram}` : ''}
        </p>
        <button
          onClick={refresh}
          disabled={syncing}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-neutral-700 disabled:opacity-60"
        >
          <RefreshCw size={14} className={cn(syncing && 'animate-spin')} />
          {syncing ? 'Updating…' : 'Refresh'}
        </button>
      </div>

      {shownError && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">{shownError}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {PLATFORMS.map((p) => (
          <PlatformCard key={p.key} platform={p} rows={daily.filter((d) => d.platform === p.key)} today={today} />
        ))}
      </div>

      <Posts posts={posts} syncing={syncing} />
    </div>
  );
}

function PlatformCard({ platform, rows, today }: { platform: (typeof PLATFORMS)[number]; rows: SocialDay[]; today: string }) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const withFollowers = sorted.filter((r) => r.followers !== null);
  const latest = withFollowers[withFollowers.length - 1];
  const followersOn = (date: string) => [...withFollowers].reverse().find((r) => r.date <= date)?.followers ?? null;
  const weekAgo = latest ? followersOn(addDays(latest.date, -7)) : null;

  const from = addDays(today, -28);
  const recent = sorted.filter((r) => r.date >= from && r.date < today);
  const total = (key: keyof SocialDay) => {
    const values = recent.map((r) => r[key]).filter((v): v is number => typeof v === 'number');
    return values.length ? { sum: values.reduce((s, v) => s + v, 0), days: values.length } : null;
  };
  const newFollowers = total('new_followers');
  const reach = total('reach');
  const stats: [string, string][] = [];
  if (reach) stats.push(['Reach per day', num(Math.round(reach.sum / reach.days))]);
  for (const [key, label] of [['views', 'Views'], ['profile_views', 'Profile visits'], ['engagements', 'Interactions']] as const) {
    const t = total(key);
    if (t) stats.push([label, num(t.sum)]);
  }

  return (
    <section className={cn(card, 'p-5')}>
      <div className="flex items-center gap-2">
        <span className={cn('p-1.5 rounded-lg', platform.tint)}>
          <platform.Icon size={16} />
        </span>
        <h2 className="font-medium">{platform.label}</h2>
      </div>
      <p className="font-display text-4xl mt-3">{latest?.followers != null ? num(latest.followers) : '—'}</p>
      <p className="text-sm text-neutral-500">
        followers
        {latest && weekAgo !== null ? ` · ${latest.followers! - weekAgo >= 0 ? '+' : ''}${num(latest.followers! - weekAgo)} this week` : ''}
        {(!latest || weekAgo === null) && newFollowers ? ` · +${num(newFollowers.sum)} new in 4 weeks` : ''}
      </p>

      {stats.length > 0 ? (
        <>
          <p className="mt-5 pt-4 border-t border-neutral-100 text-xs uppercase tracking-wider text-neutral-500">Last 4 weeks</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-2">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-neutral-500">{label}</dt>
                <dd className="text-lg tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="mt-5 pt-4 border-t border-neutral-100 text-sm text-neutral-500">No reach or views from Meta yet.</p>
      )}
    </section>
  );
}

function Posts({ posts, syncing }: { posts: SyncedPost[]; syncing: boolean }) {
  const [showAll, setShowAll] = useState(false);
  if (posts.length === 0) {
    return (
      <section className={cn(card, 'p-8 text-center text-sm text-neutral-500')}>
        {syncing ? 'Getting your posts from Facebook and Instagram…' : 'No posts yet.'}
      </section>
    );
  }
  const visible = showAll ? posts : posts.slice(0, 10);
  return (
    <section className={cn(card, 'overflow-hidden')}>
      <h2 className="font-medium px-5 pt-5 pb-3">Recent posts</h2>
      <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
        {visible.map((p) => {
          const platform = PLATFORMS.find((x) => x.key === p.platform) ?? PLATFORMS[0];
          const seen = p.views ?? p.reach;
          return (
            <li key={p.external_id}>
              <a href={p.permalink ?? '#'} target="_blank" rel="noopener noreferrer" className="flex gap-3 px-5 py-3 hover:bg-neutral-50">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-16 h-16 rounded-lg object-cover bg-neutral-100 shrink-0" />
                ) : (
                  <span className="w-16 h-16 rounded-lg bg-neutral-100 shrink-0" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <platform.Icon size={12} />
                    {new Date(p.post_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {p.post_type && p.post_type !== 'post' && p.post_type !== 'feed' ? ` · ${p.post_type.replace(/_/g, ' ')}` : ''}
                    <ExternalLink size={11} className="ml-auto text-neutral-300" />
                  </span>
                  <span className="block text-sm text-neutral-800 line-clamp-2 mt-0.5">{p.caption || 'No caption'}</span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-neutral-600 tabular-nums">
                    <span className="flex items-center gap-1"><Heart size={12} /> {num(p.likes ?? 0)}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={12} /> {num(p.comments ?? 0)}</span>
                    {seen !== null && <span className="flex items-center gap-1"><Eye size={12} /> {num(seen)} {p.views !== null ? 'views' : 'reached'}</span>}
                    {p.saves !== null && p.saves > 0 && <span className="flex items-center gap-1"><Bookmark size={12} /> {num(p.saves)}</span>}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {!showAll && posts.length > 10 && (
        <button onClick={() => setShowAll(true)} className="w-full py-3 text-sm text-neutral-600 border-t border-neutral-100 hover:bg-neutral-50">
          Show all {posts.length}
        </button>
      )}
    </section>
  );
}
