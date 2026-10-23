import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { parseManagerEmails } from '@/lib/role-logic';
import { canCallApi, canOpenPage, landingPage, NO_ACCESS, resolvePermissions } from '@/lib/permissions';

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

  // Any response other than supabaseResponse must carry over the cookies getUser()
  // may have just refreshed — otherwise the rotated session is lost and the user
  // gets logged out on a later request.
  const withSession = (res: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  const url = request.nextUrl.clone();
  const isDashboard = url.pathname.startsWith('/dashboard');
  // The email-ingest webhook carries its own shared secret; /api/public is the
  // guest booking API used by chebararuba.com
  const isProtectedApi =
    url.pathname.startsWith('/api') &&
    !url.pathname.startsWith('/api/ingest-email') &&
    !url.pathname.startsWith('/api/public/');

  if (!user && isProtectedApi) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!user && isDashboard) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (isDashboard || isProtectedApi)) {
    const email = user.email?.toLowerCase() ?? '';

    // Emails in ALLOWED_EMAILS have full access. Everyone else needs an active team member
    // with this email; what they may open comes from their role and access list
    // (lib/permissions.ts). The row is read through the current_member() RPC because
    // team_members itself isn't readable with a user session (supabase/access.sql).
    const allowlisted = parseManagerEmails(process.env.ALLOWED_EMAILS).includes(email);
    let member: { role: string; active: boolean | null; access: string[] | null } | null = null;
    if (!allowlisted) {
      // Errors leave member null => allowlist only
      const { data } = await supabase.rpc('current_member').maybeSingle();
      member = data as typeof member;
    }
    const access = resolvePermissions(allowlisted, member);
    const home = access && landingPage(access.perms);

    if (!access || !home) {
      if (isProtectedApi) {
        return withSession(NextResponse.json({ error: 'Not authorized' }, { status: 403 }));
      }
      await supabase.auth.signOut();
      url.pathname = '/login';
      url.searchParams.set('error', 'not_allowed');
      // signOut() queued cookie deletions on supabaseResponse — send them with the redirect
      return withSession(NextResponse.redirect(url));
    }

    if (isProtectedApi && !canCallApi(access.perms, url.pathname, request.method)) {
      return withSession(NextResponse.json({ error: NO_ACCESS }, { status: 403 }));
    }
    // A page that isn't theirs: go to the first one that is
    if (isDashboard && !canOpenPage(access.perms, url.pathname)) {
      url.pathname = home;
      url.search = '';
      return withSession(NextResponse.redirect(url));
    }
  }

  // If user already signed in, redirect /login to /dashboard — but not when
  // /login is showing an error, or a denied user would loop between the two
  if (user && url.pathname === '/login' && !url.searchParams.has('error')) {
    url.pathname = '/dashboard';
    return withSession(NextResponse.redirect(url));
  }

  return supabaseResponse;
}
