import type { SupabaseClient } from '@supabase/supabase-js';

// Facebook + Instagram numbers for the Marketing tab, read with the read-only key in META_ACCESS_TOKEN.
// The key belongs to the system user "Chebardashboard" in the Sonensein business portfolio: the
// Che Bar Aruba page and @chebararuba with Community activity + Insights; permissions pages_show_list,
// pages_read_engagement, read_insights, instagram_basic, instagram_manage_insights, ads_read.
// Meta renamed and dropped many insight metrics in 2025-2026, so each one is asked for on its own and
// meta_sync_log records what worked and what Meta refused. Used by POST /api/marketing/meta and the
// daily netlify/functions/meta-sync-daily.mts, so this file only uses relative imports.

const GRAPH = 'https://graph.facebook.com/v25.0';
const HOUR = 3_600_000;
/** Days of daily numbers kept fresh: 4 weeks shown, compared with the 4 weeks before */
export const META_DAYS = 56;

async function graph<T>(path: string, token: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(GRAPH + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `Meta answered ${res.status}`);
  return body as T;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);
const arubaDate = (ms: number) => new Date(ms - 4 * HOUR).toISOString().slice(0, 10);
const midnight = (date: string) => Date.parse(date + 'T04:00:00Z'); // midnight in Aruba (UTC-4)
const unix = (ms: number) => Math.floor(ms / 1000);
// Meta stamps a day's value with the end of that day (Pacific time); step back into the day itself
const dayOfEndTime = (endTime: string) => new Date(Date.parse(endTime) - 12 * HOUR).toISOString().slice(0, 10);
const asNumber = (v: unknown) => (typeof v === 'number' ? v : undefined);

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Runs the jobs a few at a time and stops starting new ones after the deadline */
async function inBatches<T>(items: T[], size: number, deadline: number, job: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length && Date.now() < deadline; i += size) await Promise.all(items.slice(i, i + size).map(job));
}

/** Upserts rows grouped by the fields they carry, so a missing number never overwrites a stored one */
async function upsertGrouped(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string) {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const clean = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined));
    const key = Object.keys(clean).sort().join(',');
    groups.set(key, [...(groups.get(key) ?? []), clean]);
  }
  const errors: string[] = [];
  for (const group of groups.values()) {
    const { error } = await supabase.from(table).upsert(group, { onConflict });
    if (error) errors.push(error.message);
  }
  return errors;
}

type Platform = 'facebook' | 'instagram';
type DailyField = 'followers' | 'new_followers' | 'reach' | 'views' | 'profile_views' | 'engagements';
type DailyRow = { date: string; platform: Platform } & Partial<Record<DailyField, number>>;

interface Post {
  external_id: string;
  platform: Platform;
  posted_at: string;
  post_date: string;
  post_type: string;
  caption: string | null;
  image_url: string | null;
  permalink: string | null;
  likes: number;
  comments: number;
  shares?: number;
  reach?: number;
  views?: number;
  saves?: number;
  interactions?: number;
}

interface Page {
  id: string;
  name: string;
  access_token: string;
  followers_count?: number;
  fan_count?: number;
  instagram_business_account?: { id: string; username?: string; followers_count?: number };
}

type Values = {
  data: {
    name: string;
    values?: { value: unknown; end_time?: string }[];
    total_value?: { value?: unknown; breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] };
  }[];
};

export interface MetaSyncSummary {
  ok: boolean;
  page?: string;
  instagram?: string;
  posts: number;
  days: number;
  /** What was read: "ok" or Meta's error, per item */
  checks: Record<string, string>;
  error?: string;
}

const FACEBOOK_DAILY: [string, DailyField][] = [
  ['page_media_view', 'views'],
  ['page_total_media_view_unique', 'reach'],
  ['page_post_engagements', 'engagements'],
  ['page_daily_follows_unique', 'new_followers'],
  ['page_views_total', 'profile_views'],
];
const INSTAGRAM_DAILY: [string, DailyField][] = [
  ['reach', 'reach'],
  ['views', 'views'],
  ['profile_views', 'profile_views'],
  ['total_interactions', 'engagements'],
];
const AUDIENCE = ['country', 'city', 'age', 'gender'];

/** budgetMs: the dashboard has about 10 s per request; the daily function can take longer */
export async function syncMeta(supabase: SupabaseClient, trigger: string, budgetMs = 8000): Promise<MetaSyncSummary> {
  const deadline = Date.now() + budgetMs;
  const checks: Record<string, string> = {};
  const summary: MetaSyncSummary = { ok: false, posts: 0, days: 0, checks };
  const daily = new Map<string, DailyRow>();
  const day = (date: string, platform: Platform) => {
    const key = `${platform} ${date}`;
    if (!daily.has(key)) daily.set(key, { date, platform });
    return daily.get(key)!;
  };
  const posts: Post[] = [];
  const audience: { platform: Platform; breakdown: string; label: string; value: number }[] = [];
  const audienceRead = new Set<string>();

  try {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) throw new Error('META_ACCESS_TOKEN is not set in Netlify');
    const today = arubaDate(Date.now());
    const until = unix(midnight(today));

    const { data: pages } = await graph<{ data: Page[] }>('/me/accounts', token, {
      fields: 'id,name,access_token,followers_count,fan_count,instagram_business_account{id,username,followers_count}',
    });
    const page = pages.find((p) => /che bar/i.test(p.name)) ?? pages[0];
    if (!page) throw new Error('The key sees no Facebook page: check the system user’s assigned assets');
    summary.page = page.name;
    const pageFollowers = page.followers_count ?? page.fan_count;
    if (typeof pageFollowers === 'number') day(today, 'facebook').followers = pageFollowers;

    const facebook = async () => {
      // Page numbers per day, one call per metric
      await Promise.all(
        FACEBOOK_DAILY.map(async ([metric, field]) => {
          try {
            const res = await graph<Values>(`/${page.id}/insights`, page.access_token, {
              metric,
              period: 'day',
              since: unix(midnight(addDays(today, -META_DAYS))),
              until,
            });
            for (const v of res.data[0]?.values ?? []) {
              const n = asNumber(v.value);
              if (n !== undefined && v.end_time) day(dayOfEndTime(v.end_time), 'facebook')[field] = n;
            }
            checks[`facebook ${metric}`] = 'ok';
          } catch (e) {
            checks[`facebook ${metric}`] = errorText(e);
          }
        })
      );

      // Posts: published_posts needs pages_read_user_content; /posts is tried as well
      const fields =
        'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)';
      let list: any[] | null = null;
      for (const edge of ['published_posts', 'posts']) {
        try {
          list = (await graph<{ data: any[] }>(`/${page.id}/${edge}`, page.access_token, { fields, limit: 20 })).data;
          checks['facebook posts'] = `ok via ${edge} (${list.length})`;
          break;
        } catch (e) {
          checks[`facebook posts (${edge})`] = errorText(e);
        }
      }
      if (!list) return;
      const fb: Post[] = list.map((p) => ({
        external_id: `fb_${p.id}`,
        platform: 'facebook',
        posted_at: p.created_time,
        post_date: arubaDate(Date.parse(p.created_time)),
        post_type: 'post',
        caption: p.message ?? null,
        image_url: p.full_picture ?? null,
        permalink: p.permalink_url ?? null,
        likes: p.reactions?.summary?.total_count ?? 0,
        comments: p.comments?.summary?.total_count ?? 0,
        shares: p.shares?.count ?? 0,
      }));
      posts.push(...fb);
      let found = 0;
      let failed = '';
      await inBatches(fb, 10, deadline, async (p) => {
        const read = async (metric: string) => {
          const ins = await graph<Values>(`/${p.external_id.slice(3)}/insights`, page.access_token, { metric });
          const val = (name: string) => asNumber(ins.data.find((d) => d.name === name)?.values?.[0]?.value);
          p.views = val('post_media_view');
          p.reach = val('post_total_media_view_unique');
        };
        try {
          await read('post_media_view,post_total_media_view_unique');
          found++;
        } catch (e) {
          try {
            await read('post_media_view');
            found++;
          } catch {
            failed = errorText(e);
          }
        }
      });
      checks['facebook post views'] = found ? `ok (${found})` : failed || 'no data';
    };

    const instagram = async () => {
      const ig = page.instagram_business_account;
      if (!ig) {
        checks.instagram = 'No Instagram account is linked to the page';
        return;
      }
      summary.instagram = ig.username;
      if (typeof ig.followers_count === 'number') day(today, 'instagram').followers = ig.followers_count;

      const newFollowers = async () => {
        // Meta keeps 30 days of this one
        try {
          const res = await graph<Values>(`/${ig.id}/insights`, token, {
            metric: 'follower_count',
            period: 'day',
            since: unix(midnight(addDays(today, -28))),
            until,
          });
          for (const v of res.data[0]?.values ?? []) {
            const n = asNumber(v.value);
            if (n !== undefined && v.end_time) day(dayOfEndTime(v.end_time), 'instagram').new_followers = n;
          }
          checks['instagram follower_count'] = 'ok';
        } catch (e) {
          checks['instagram follower_count'] = errorText(e);
        }
      };

      const followerAudience = () =>
        Promise.all(
          AUDIENCE.map(async (breakdown) => {
            try {
              const res = await graph<Values>(`/${ig.id}/insights`, token, {
                metric: 'follower_demographics',
                period: 'lifetime',
                metric_type: 'total_value',
                breakdown,
              });
              const results = res.data[0]?.total_value?.breakdowns?.[0]?.results ?? [];
              for (const r of [...results].sort((a, b) => b.value - a.value).slice(0, 12))
                audience.push({ platform: 'instagram', breakdown, label: r.dimension_values.join(' '), value: r.value });
              audienceRead.add(breakdown);
              checks[`instagram audience ${breakdown}`] = `ok (${results.length})`;
            } catch (e) {
              checks[`instagram audience ${breakdown}`] = errorText(e);
            }
          })
        );

      const media = async () => {
        try {
          const res = await graph<{ data: any[] }>(`/${ig.id}/media`, token, {
            fields: 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count,thumbnail_url,media_url',
            limit: 20,
          });
          const igPosts: Post[] = res.data.map((m) => ({
            external_id: `ig_${m.id}`,
            platform: 'instagram',
            posted_at: m.timestamp,
            post_date: arubaDate(Date.parse(m.timestamp)),
            post_type: String(m.media_product_type || m.media_type || 'post').toLowerCase(),
            caption: m.caption ?? null,
            image_url: m.thumbnail_url ?? (m.media_type === 'VIDEO' ? null : m.media_url ?? null),
            permalink: m.permalink ?? null,
            likes: m.like_count ?? 0,
            comments: m.comments_count ?? 0,
          }));
          posts.push(...igPosts);
          checks['instagram posts'] = `ok (${igPosts.length})`;
          let found = 0;
          let failed = '';
          await inBatches(igPosts, 10, deadline, async (p) => {
            const read = async (metric: string) => {
              const ins = await graph<Values>(`/${p.external_id.slice(3)}/insights`, token, { metric });
              const val = (name: string) => {
                const d = ins.data.find((x) => x.name === name);
                return asNumber(d?.values?.[0]?.value ?? d?.total_value?.value);
              };
              p.reach = val('reach');
              p.views = val('views');
              p.saves = val('saved');
              p.shares = val('shares');
              p.interactions = val('total_interactions');
            };
            try {
              await read('reach,views,saved,shares,total_interactions');
              found++;
            } catch (e) {
              try {
                await read('reach,saved'); // some post types don't have the others
                found++;
              } catch {
                failed = errorText(e);
              }
            }
          });
          checks['instagram post insights'] = found ? `ok (${found})` : failed || 'no data';
        } catch (e) {
          checks['instagram posts'] = errorText(e);
        }
      };

      // Reach, views, profile visits and interactions per day: one call per day. Load the days not
      // stored yet (newest first), and always the last two, which Meta still adds to
      const perDay = async () => {
        const { data: stored } = await supabase
          .from('social_daily')
          .select('date')
          .eq('platform', 'instagram')
          .not('reach', 'is', null)
          .gte('date', addDays(today, -META_DAYS));
        const have = new Set((stored ?? []).map((r: { date: string }) => r.date));
        const days: string[] = [];
        for (let i = 1; i <= META_DAYS; i++) {
          const d = addDays(today, -i);
          if (i <= 2 || !have.has(d)) days.push(d);
        }
        if (!days.length) return;
        const readDay = async (date: string, metrics: [string, DailyField][]) => {
          const res = await graph<Values>(`/${ig.id}/insights`, token, {
            metric: metrics.map(([m]) => m).join(','),
            period: 'day',
            metric_type: 'total_value',
            since: unix(midnight(date)),
            until: unix(midnight(addDays(date, 1))),
          });
          for (const d of res.data) {
            const field = metrics.find(([m]) => m === d.name)?.[1];
            const n = asNumber(d.total_value?.value);
            if (field && n !== undefined) day(date, 'instagram')[field] = n;
          }
        };
        let working = INSTAGRAM_DAILY;
        try {
          await readDay(days[0], working);
          for (const [m] of working) checks[`instagram ${m}`] = 'ok';
        } catch {
          const ok: [string, DailyField][] = [];
          await Promise.all(
            INSTAGRAM_DAILY.map(async (metric) => {
              try {
                await readDay(days[0], [metric]);
                ok.push(metric);
                checks[`instagram ${metric[0]}`] = 'ok';
              } catch (e) {
                checks[`instagram ${metric[0]}`] = errorText(e);
              }
            })
          );
          working = ok;
        }
        if (!working.length) return;
        summary.days = 1;
        await inBatches(days.slice(1), 8, deadline - 1500, async (d) => {
          try {
            await readDay(d, working);
            summary.days++;
          } catch (e) {
            checks['instagram daily'] = errorText(e);
          }
        });
      };

      await Promise.all([newFollowers(), followerAudience(), media(), perDay()]);
    };

    await Promise.all([facebook(), instagram()]);

    const syncedAt = new Date().toISOString();
    const saveErrors = [
      ...(await upsertGrouped(supabase, 'social_daily', [...daily.values()].map((r) => ({ ...r, updated_at: syncedAt })), 'date,platform')),
      ...(await upsertGrouped(supabase, 'social_posts', posts.map((p) => ({ ...p, synced_at: syncedAt })) as unknown as Record<string, unknown>[], 'external_id')),
    ];
    for (const breakdown of audienceRead) {
      const rows = audience.filter((a) => a.breakdown === breakdown).map((a) => ({ ...a, updated_at: syncedAt }));
      const { error: deleteError } = await supabase.from('social_audience').delete().eq('platform', 'instagram').eq('breakdown', breakdown);
      const { error: insertError } = deleteError ? { error: deleteError } : await supabase.from('social_audience').insert(rows);
      if (insertError) saveErrors.push(insertError.message);
    }
    if (saveErrors.length) checks.save = saveErrors.join('; ').slice(0, 300);
    summary.posts = posts.length;
    summary.ok = saveErrors.length === 0;
  } catch (e) {
    summary.error = errorText(e);
  }

  await supabase.from('meta_sync_log').insert({ trigger, ok: summary.ok, summary, error: summary.error ?? null });
  return summary;
}
