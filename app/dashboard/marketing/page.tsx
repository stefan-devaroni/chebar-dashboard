import { createClient } from '@/lib/supabase/server';
import { MarketingHub } from '@/components/marketing-hub';

export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  const supabase = createClient();

  const { data: posts } = await supabase
    .from('social_posts')
    .select('*')
    .order('post_date', { ascending: false })
    .limit(50);

  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(25);

  const { data: drafts } = await supabase
    .from('content_drafts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25);

  const googleConnected = !!(
    process.env.GOOGLE_ACCOUNT_ID &&
    process.env.GOOGLE_LOCATION_ID &&
    process.env.GOOGLE_ACCESS_TOKEN
  );

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Marketing</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Social media, ad spend, reviews, and content creation — all in one place.
        </p>
      </header>
      <MarketingHub
        initialPosts={posts ?? []}
        initialCampaigns={campaigns ?? []}
        initialDrafts={drafts ?? []}
        googleConnected={googleConnected}
      />
    </div>
  );
}
