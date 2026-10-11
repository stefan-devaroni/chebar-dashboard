import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();

  // Protect API routes (except the email-ingest webhook, which carries its own secret)
  const isProtectedApi = url.pathname.startsWith('/api') && !url.pathname.startsWith('/api/ingest-email');
  if (!user && isProtectedApi) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Protect /dashboard routes
  if (!user && url.pathname.startsWith('/dashboard')) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Enforce email allowlist
  if (user && (url.pathname.startsWith('/dashboard') || isProtectedApi)) {
    const allowed = process.env.ALLOWED_EMAILS;
    if (allowed) {
      const allowedList = allowed.split(',').map((e) => e.trim().toLowerCase());
      if (!allowedList.includes(user.email?.toLowerCase() ?? '')) {
        if (isProtectedApi) {
          return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
        await supabase.auth.signOut();
        url.pathname = '/login';
        url.searchParams.set('error', 'not_allowed');
        return NextResponse.redirect(url);
      }
    }
  }

  // If user already signed in, redirect /login to /dashboard
  if (user && url.pathname === '/login') {
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
