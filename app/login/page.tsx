'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'not_allowed') {
      setError('Your email is not authorized to access this dashboard. Contact the owner.');
    } else if (err === 'auth_failed') {
      setError('That login link expired or was already used. Enter your email to get a new one.');
    }
  }, [searchParams]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(/invalid login credentials/i.test(error.message) ? 'Wrong email or password.' : error.message);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setError('Enter your email first');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMagicSent(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl mb-2">Che Bar</h1>
          <p className="text-sm text-neutral-600 tracking-widest uppercase">Dashboard</p>
        </div>

        {magicSent ? (
          <div className="bg-white border border-neutral-200 rounded p-6 text-center">
            <p className="text-sm">Check your email for the sign-in link.</p>
          </div>
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold"
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="text-center text-sm text-neutral-500 pt-2">
              Forgot your password? Ask a manager to set a new one.
            </p>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading}
              className="w-full py-2 text-xs text-neutral-400 hover:text-neutral-600 transition disabled:opacity-50"
            >
              Owner: email me a sign-in link instead
            </button>
          </form>
        )}

        <p className="text-center text-xs text-neutral-400 mt-12 tracking-wider uppercase">
          Internal use only
        </p>
      </div>
    </div>
  );
}
