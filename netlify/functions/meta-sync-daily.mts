// Daily Facebook + Instagram sync for the Marketing tab, so the follower history keeps growing even
// on days nobody opens the tab. Same work as POST /api/marketing/meta (lib/meta.ts).
import { createClient } from '@supabase/supabase-js';
import { syncMeta } from '../../lib/meta';

export default async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  await syncMeta(supabase, 'daily', 25_000); // scheduled functions may run 30 s
};

// 11:00 UTC = 7 AM in Aruba
export const config = { schedule: '0 11 * * *' };
