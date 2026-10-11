import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { parseManagerEmails, resolveRole } from '@/lib/role-logic';

// Employees may only use these (managers get everything).
const EMPLOYEE_PAGES = ['/dashboard/schedule', '/dashboard/orders'];
function employeeApiAllowed(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/shifts') && method === 'GET') return true;
  if (pathname.startsWith('/api/time-off') && (method === 'GET' || method === 'POST')) return true;
  if (pathname.startsWith('/api/team') && method === 'GET') return true;
  // Deliveries: see orders and check in what arrived — nothing else on orders
  if (pathname === '/api/orders' && method === 'GET') return true;
  if (pathname === '/api/orders/receive' && method === 'POST') return true;
  return false;
}

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
  // The email-ingest webhook carries its own shared secret
  const isProtectedApi = url.pathname.startsWith('/api') && !url.pathname.startsWith('/api/ingest-email');

  if (!user && isProtectedApi) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!user && isDashboard) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (isDashboard || isProtectedApi)) {
    const email = user.email?.toLowerCase() ?? '';

    // Managers: emails in ALLOWED_EMAILS (owner, co-owner, GM), or a team member
    // with role owner/manager. Employees: team members with a linked email.
    const managerEmails = parseManagerEmails(process.env.ALLOWED_EMAILS);
    let member: { role: string; active: boolean | null } | null = null;
    if (!managerEmails.includes(email)) {
      // Errors (e.g. email column not migrated yet) leave member null => allowlist only
      const { data } = await supabase
        .from('team_members')
        .select('role, active')
        .eq('email', email)
        .maybeSingle();
      member = data;
    }
    const role = resolveRole(email, managerEmails, member);

    if (!role) {
      if (isProtectedApi) {
        return withSession(NextResponse.json({ error: 'Not authorized' }, { status: 403 }));
      }
      await supabase.auth.signOut();
      url.pathname = '/login';
      url.searchParams.set('error', 'not_allowed');
      // signOut() queued cookie deletions on supabaseResponse — send them with the redirect
      return withSession(NextResponse.redirect(url));
    }

    if (role === 'employee') {
      if (isProtectedApi && !employeeApiAllowed(url.pathname, request.method)) {
        return withSession(NextResponse.json({ error: 'Managers only' }, { status: 403 }));
      }
      if (isDashboard && !EMPLOYEE_PAGES.some((p) => url.pathname.startsWith(p))) {
        url.pathname = '/dashboard/schedule';
        url.search = '';
        return withSession(NextResponse.redirect(url));
      }
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
