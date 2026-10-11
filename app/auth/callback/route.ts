import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  // Only same-site paths — '//host' or '@host' would turn this into an open redirect
  const nextParam = request.nextUrl.searchParams.get('next') ?? '/dashboard';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard';

  let target = '/login?error=auth_failed';
  const pendingCookies: { name: string; value: string; options?: any }[] = [];

  if (code) {
    // Cookie-bound: the magic-link PKCE verifier lives in a cookie set by the
    // browser client, and the new session must be written back as cookies.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) target = next;
  }

  // Relative Location: on Netlify, request.url carries the internal
  // main--*.netlify.app host, which would strand the user on the wrong domain.
  const response = new NextResponse(null, { status: 307, headers: { Location: target } });
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
