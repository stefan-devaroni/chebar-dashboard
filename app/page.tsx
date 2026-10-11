import { redirect } from 'next/navigation';

export default function Home({ searchParams }: { searchParams: { code?: string } }) {
  // If Supabase falls back to the Site URL (redirect URL not allow-listed),
  // the magic-link code lands here — finish the login instead of dropping it.
  if (searchParams.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(searchParams.code)}`);
  }
  redirect('/dashboard');
}
