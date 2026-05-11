'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
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
                className="w-full px-4 py-3 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
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
                className="w-full px-4 py-3 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
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
              className="w-full bg-ink text-cream py-3 rounded text-sm uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading}
              className="w-full border border-neutral-300 py-3 rounded text-sm uppercase tracking-widest hover:bg-white transition disabled:opacity-50"
            >
              Email me a sign-in link
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
