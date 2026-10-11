import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cookie-bound client: sees the logged-in user's session (unlike lib/supabase/server.ts,
// which uses the service-role key and has no notion of who is asking).
export function createSessionClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only in server components / route handlers; middleware refreshes the session.
        },
      },
    }
  );
}
