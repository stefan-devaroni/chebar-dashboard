'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Anyone signed in can change their own password (Supabase Auth, with their own session).
// An owner who forgot theirs first signs in with the emailed link on the login page.
export function ChangePassword({ email, placement }: { email: string | null; placement: 'sidebar' | 'header' }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function show() {
    setPassword('');
    setRepeat('');
    setError(null);
    setDone(false);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== repeat) return setError('The two passwords are not the same.');
    setSaving(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (!error) return setDone(true);
    if (/reauth|recent/i.test(error.message)) setError('For safety, sign out and sign in again, then change it.');
    else if (/different/i.test(error.message)) setError('That is already your password.');
    else if (/session/i.test(error.message)) setError('You are signed out. Sign in again first.');
    else setError(error.message);
  }

  const inputClass = 'w-full px-3 py-3 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold';

  return (
    <>
      {placement === 'sidebar' ? (
        <button
          onClick={show}
          className="flex items-center gap-3 px-3 py-2 rounded text-sm text-neutral-400 hover:text-cream hover:bg-neutral-900 transition w-full"
        >
          <KeyRound size={16} strokeWidth={1.5} />
          Change password
        </button>
      ) : (
        <button onClick={show} aria-label="Change password" title="Change password" className="w-10 h-10 flex items-center justify-center text-neutral-400">
          <KeyRound size={17} strokeWidth={1.5} />
        </button>
      )}

      {open && createPortal(
        <div className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50 sm:px-4" onClick={() => setOpen(false)}>
          <div
            className="bg-cream text-ink w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-xl">Change password</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="w-10 h-10 -mr-2 flex items-center justify-center text-neutral-400 hover:text-ink">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            {email && <p className="text-xs text-neutral-500 mb-4">Signed in as {email}</p>}

            {done ? (
              <div className="space-y-4">
                <p className="text-sm bg-white border border-neutral-200 rounded-xl px-3 py-3">
                  Password changed. Use it the next time you sign in.
                </p>
                <button onClick={() => setOpen(false)} className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium">
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={save} className="space-y-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password (at least 8 characters)"
                  autoComplete="new-password"
                  className={inputClass}
                />
                <input
                  type="password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  placeholder="Type it again"
                  autoComplete="new-password"
                  className={inputClass}
                />
                {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-800">{error}</div>}
                <button
                  type="submit"
                  disabled={saving || !password || !repeat}
                  className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save new password'}
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
