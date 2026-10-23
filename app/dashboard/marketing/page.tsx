import { createClient } from '@/lib/supabase/server';
import { MarketingHub } from '@/components/marketing-hub';
import { MetaOverview, type LastSync, type SocialDay, type SyncedPost } from '@/components/meta-overview';
import { addDays, arubaNow } from '@/lib/reservations';

export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  const supabase = createClient();
  const today = arubaNow().date;

  const [{ data: daily }, { data: posts }, { data: lastSync }, { data: drafts }] = await Promise.all([
    supabase
      .from('social_daily')
      .select('date, platform, followers, new_followers, reach, views, profile_views, engagements')
      .gte('date', addDays(today, -60))
      .order('date'),
    supabase
      .from('social_posts')
      .select('external_id, platform, posted_at, post_date, post_type, caption, image_url, permalink, likes, comments, shares, reach, views, saves')
      .not('external_id', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(40),
    supabase.from('meta_sync_log').select('ran_at, ok, error, summary').order('ran_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('content_drafts').select('*').order('created_at', { ascending: false }).limit(25),
  ]);

  const googleConnected = !!(
    process.env.GOOGLE_ACCOUNT_ID &&
    process.env.GOOGLE_LOCATION_ID &&
    process.env.GOOGLE_ACCESS_TOKEN
  );

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl">Marketing</h1>
        <p className="text-sm text-neutral-500 mt-1">Facebook and Instagram numbers, post ideas, content and review replies.</p>
      </header>
      <MarketingHub
        overview={
          <MetaOverview
            daily={(daily ?? []) as SocialDay[]}
            posts={(posts ?? []) as SyncedPost[]}
            lastSync={(lastSync ?? null) as LastSync | null}
            today={today}
          />
        }
        initialDrafts={drafts ?? []}
        googleConnected={googleConnected}
      />
    </div>
  );
}
