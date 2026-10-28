'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Eye, Link2, Power, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { arubaTime, DEFAULT_HIDDEN, SECTION_CHOICES, STATUS_TEXT, type LinkStatus } from '@/lib/share-sections';

// One Pager tab: owners make a private link per buyer, see when each was opened, and switch links off.

type LinkRow = {
  id: string;
  url: string;
  recipient_name: string;
  recipient_company: string;
  recipient_email: string | null;
  hidden_sections: string[];
  expires_at: string;
  max_views: number | null;
  failed_attempts: number;
  revoked_at: string | null;
  created_at: string;
  status: LinkStatus;
  views: number;
  last_viewed: string | null;
  devices: number;
  recent: { viewed_at: string; device: string }[];
};
type Made = { name: string; url: string; passcode: string; expires_at: string };

const inputClass = 'w-full px-3 py-3 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold';
const labelClass = 'block text-xs uppercase tracking-wider text-neutral-500 mb-1.5';
const smallButton = 'inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-neutral-300 bg-white';

const STATUS_STYLE: Record<LinkStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  off: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  used: 'bg-amber-50 text-amber-700 border-amber-200',
  locked: 'bg-red-50 text-red-700 border-red-200',
};

/** YYYY-MM-DD in Aruba, some days from a moment (now by default) */
function arubaDate(days: number, from = Date.now()): string {
  return new Date(from + days * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Aruba' });
}
const arubaDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Aruba', month: 'short', day: 'numeric', year: 'numeric' });

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // Clipboard blocked: the text is on screen to copy by hand
    }
  }
  return (
    <button type="button" onClick={copy} className={smallButton}>
      {done ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
      {done ? 'Copied' : label}
    </button>
  );
}

export function ShareLinks() {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [expires, setExpires] = useState(() => arubaDate(14));
  const [maxViews, setMaxViews] = useState('');
  const [hidden, setHidden] = useState<string[]>(DEFAULT_HIDDEN);

  async function load() {
    const res = await fetch('/api/one-pager/links', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setLinks(body.links);
    else setError(body.error ?? 'Could not load the links.');
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/one-pager/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company, email, expires, max_views: maxViews, hidden }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? 'Could not make the link.');
      return;
    }
    setMade({ name: name.trim(), url: body.url, passcode: body.passcode, expires_at: body.expires_at });
    setName('');
    setCompany('');
    setEmail('');
    setMaxViews('');
    setExpires(arubaDate(14));
    setHidden(DEFAULT_HIDDEN);
    load();
  }

  async function act(id: string, action: string, extra: Record<string, string> = {}) {
    setError('');
    const res = await fetch(`/api/one-pager/links/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'That didn’t work.');
    }
    load();
  }

  const message = made
    ? `Here is the Che Bar business summary, as agreed under the NDA:\n${made.url}\n\nPasscode: ${made.passcode}\n\n` +
      `The link works until ${arubaDay(made.expires_at)} and is for you only. Please don't share or forward it.`
    : '';

  return (
    <section className="mt-10">
      <header className="mb-4">
        <h2 className="font-display text-2xl">Buyer links</h2>
        <p className="text-sm text-neutral-500 mt-1">
          A private link and passcode for each person. Their name is printed across every screen, printing is blocked, and you see each time
          they open it.
        </p>
      </header>

      {made && (
        <div className="mb-6 rounded-2xl border border-gold/60 bg-gold/10 p-4 space-y-3">
          <p className="font-medium">Link for {made.name}. Note the passcode now: it is only shown this once.</p>
          <div className="grid gap-1.5 text-sm">
            <p className="break-all"><span className="text-neutral-500">Link: </span>{made.url}</p>
            <p><span className="text-neutral-500">Passcode: </span><span className="font-mono text-lg tracking-widest">{made.passcode}</span></p>
            <p className="text-neutral-500">Works until {arubaDay(made.expires_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={made.url} label="Copy link" />
            <CopyButton text={made.passcode} label="Copy passcode" />
            <CopyButton text={message} label="Copy message" />
            <button type="button" onClick={() => setMade(null)} className="text-sm px-3 py-2 text-neutral-500">Done</button>
          </div>
          <p className="text-[11px] text-neutral-500 leading-snug">Safest: send the link by email and the passcode separately, by WhatsApp or a call.</p>
        </div>
      )}

      <form onSubmit={create} className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Name</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Full name" />
          </label>
          <label className="block">
            <span className={labelClass}>Company</span>
            <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={80} placeholder="Optional" />
          </label>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} placeholder="Optional, for your records" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Works until</span>
              <input className={inputClass} type="date" value={expires} min={arubaDate(1)} max={arubaDate(180)} onChange={(e) => setExpires(e.target.value)} required />
            </label>
            <label className="block">
              <span className={labelClass}>Max openings</span>
              <input className={inputClass} type="number" inputMode="numeric" min={1} max={1000} value={maxViews} onChange={(e) => setMaxViews(e.target.value)} placeholder="No limit" />
            </label>
          </div>
        </div>
        <fieldset>
          <legend className={labelClass}>What they see</legend>
          <div className="flex flex-wrap gap-2">
            {SECTION_CHOICES.map((s) => {
              const on = !hidden.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setHidden(on ? [...hidden, s.key] : hidden.filter((k) => k !== s.key))}
                  className={cn('text-sm px-3 py-1.5 rounded-full border', on ? 'bg-ink text-cream border-ink' : 'bg-white text-neutral-500 border-neutral-300')}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <button disabled={busy} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-ink text-cream px-5 py-3 rounded-xl text-base font-medium disabled:opacity-50">
          <Link2 className="w-4 h-4" />
          {busy ? 'Making the link…' : 'Make link'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-3">
        {links === null ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-neutral-500">No links yet.</p>
        ) : (
          links.map((l) => (
            <div key={l.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {l.recipient_name}
                    {l.recipient_company && <span className="text-neutral-500"> · {l.recipient_company}</span>}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {l.views === 0 || !l.last_viewed
                      ? 'Not opened yet'
                      : `Opened ${l.views} ${l.views === 1 ? 'time' : 'times'}, last on ${arubaTime(l.last_viewed)}`}
                    {l.devices > 1 && ` · from ${l.devices} different networks`}
                  </p>
                  <p className="text-sm text-neutral-500">
                    Works until {arubaDay(l.expires_at)}
                    {l.max_views ? ` · ${l.max_views} ${l.max_views === 1 ? 'opening' : 'openings'} at most` : ''}
                  </p>
                </div>
                <span className={cn('text-xs px-2.5 py-1 rounded-full border', STATUS_STYLE[l.status])}>{STATUS_TEXT[l.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={l.url} label="Copy link" />
                {l.revoked_at ? (
                  <button type="button" onClick={() => act(l.id, 'on')} className={smallButton}>
                    <Power className="w-4 h-4" /> Switch on
                  </button>
                ) : (
                  <button type="button" onClick={() => act(l.id, 'off')} className={cn(smallButton, 'border-red-200 text-red-700')}>
                    <Power className="w-4 h-4" /> Switch off
                  </button>
                )}
                {l.status === 'locked' && (
                  <button type="button" onClick={() => act(l.id, 'unlock')} className={smallButton}>
                    <Unlock className="w-4 h-4" /> Unlock
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => act(l.id, 'extend', { expires: arubaDate(14, Math.max(Date.now(), new Date(l.expires_at).getTime())) })}
                  className={smallButton}
                >
                  + 2 weeks
                </button>
                {l.views > 0 && (
                  <button type="button" onClick={() => setOpen(open === l.id ? null : l.id)} className={smallButton}>
                    <Eye className="w-4 h-4" /> {open === l.id ? 'Hide openings' : 'Openings'}
                  </button>
                )}
              </div>
              {open === l.id && (
                <ul className="mt-3 text-sm divide-y divide-neutral-100">
                  {l.recent.map((v, i) => (
                    <li key={i} className="py-1.5 flex justify-between gap-3">
                      <span>{arubaTime(v.viewed_at)}</span>
                      <span className="text-neutral-500 text-right">{v.device}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
