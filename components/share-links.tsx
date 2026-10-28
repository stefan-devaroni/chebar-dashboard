'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, KeyRound, Link2, Power, SlidersHorizontal, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { arubaTime, DEFAULT_HIDDEN, SECTION_CHOICES, STATUS_TEXT, type LinkStatus } from '@/lib/share-sections';

// One Pager tab: owners make a private link per buyer, see when each was opened and which documents were viewed,
// change what a link shows, and switch links off. Clicking a person shows their link, passcode and message at the
// top to copy again (Stefan, Oct 28: "whichever one I clicked on last").

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
  documents: number;
  last_viewed: string | null;
  devices: number;
  recent: { viewed_at: string; device: string; file: string | null }[];
};
// The link shown at the top: the one just made or clicked. No passcode when the link was made before passcodes were
// kept (Oct 28 2026): it can get a new one.
type Shown = { id: string; name: string; url: string; passcode: string | null; expires_at: string; isNew: boolean };

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

/** What a link shows: the page's parts, then the document groups buyers can download */
function SectionChips({ hidden, onChange }: { hidden: string[]; onChange: (hidden: string[]) => void }) {
  const groups = [
    { title: 'On the page', choices: SECTION_CHOICES.filter((s) => !s.doc) },
    { title: 'Documents to view', choices: SECTION_CHOICES.filter((s) => s.doc) },
  ];
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="text-xs text-neutral-500 mb-1.5">{g.title}</p>
          <div className="flex flex-wrap gap-2">
            {g.choices.map((s) => {
              const on = !hidden.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? [...hidden, s.key] : hidden.filter((k) => k !== s.key))}
                  className={cn('text-sm px-3 py-1.5 rounded-full border', on ? 'bg-ink text-cream border-ink' : 'bg-white text-neutral-500 border-neutral-300')}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ShareLinks() {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const shownBox = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; hidden: string[] } | null>(null);
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

  // Bring the box into view whenever another link is shown in it
  const shownId = shown?.id;
  useEffect(() => {
    if (shownId) shownBox.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [shownId]);

  async function show(l: LinkRow) {
    setError('');
    const res = await fetch(`/api/one-pager/links/${l.id}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? 'Could not open that link.');
      return;
    }
    setShown({ id: l.id, name: l.recipient_name, url: body.url, passcode: body.passcode, expires_at: body.expires_at, isNew: false });
  }

  async function newPasscode() {
    if (!shown || !window.confirm(`Give ${shown.name} a new passcode? The old one stops working.`)) return;
    setError('');
    const res = await fetch(`/api/one-pager/links/${shown.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'passcode' }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.passcode) {
      setError(body.error ?? 'Could not make a new passcode.');
      return;
    }
    setShown({ ...shown, passcode: body.passcode });
    load();
  }

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
    setShown({ id: body.id, name: name.trim(), url: body.url, passcode: body.passcode, expires_at: body.expires_at, isNew: true });
    setName('');
    setCompany('');
    setEmail('');
    setMaxViews('');
    setExpires(arubaDate(14));
    setHidden(DEFAULT_HIDDEN);
    load();
  }

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
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

  const message = shown?.passcode
    ? `Here is the Che Bar business summary, as agreed under the NDA:\n${shown.url}\n\nPasscode: ${shown.passcode}\n\n` +
      `The link works until ${arubaDay(shown.expires_at)} and is for you only. Please don't share or forward it.`
    : '';

  return (
    <section className="mt-10">
      <header className="mb-4">
        <h2 className="font-display text-2xl">Buyer links</h2>
        <p className="text-sm text-neutral-500 mt-1">
          A private link and passcode for each person. Their name is printed across every screen, including every page of the documents,
          which they can view but not download or print. You see each time they open the link or a document.
        </p>
      </header>

      {shown && (
        <div ref={shownBox} className="mb-6 scroll-mt-4 rounded-2xl border border-gold/60 bg-gold/10 p-4 space-y-3">
          <p className="font-medium">{shown.isNew ? `New link for ${shown.name}` : shown.name}</p>
          <div className="grid gap-1.5 text-sm">
            <p className="break-all"><span className="text-neutral-500">Link: </span>{shown.url}</p>
            {shown.passcode ? (
              <p><span className="text-neutral-500">Passcode: </span><span className="font-mono text-lg tracking-widest">{shown.passcode}</span></p>
            ) : (
              <p className="text-neutral-600">
                This link was made before passcodes were saved, so its passcode can’t be shown. Give it a new one with the button
                below; the old one then stops working.
              </p>
            )}
            <p className="text-neutral-500">Works until {arubaDay(shown.expires_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={shown.url} label="Copy link" />
            {shown.passcode && <CopyButton text={shown.passcode} label="Copy passcode" />}
            {shown.passcode && <CopyButton text={message} label="Copy message" />}
            <button type="button" onClick={newPasscode} className={smallButton}>
              <KeyRound className="w-4 h-4" /> New passcode
            </button>
            <button type="button" onClick={() => setShown(null)} className="text-sm px-3 py-2 text-neutral-500">Done</button>
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
          <SectionChips hidden={hidden} onChange={setHidden} />
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
            <div
              key={l.id}
              className={cn('rounded-2xl border bg-white p-4', shown?.id === l.id ? 'border-gold ring-1 ring-gold/40' : 'border-neutral-200')}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button type="button" onClick={() => show(l)} className="group min-w-0 text-left" title="Show the link, passcode and message">
                  <span className="block font-medium group-hover:underline">
                    {l.recipient_name}
                    {l.recipient_company && <span className="text-neutral-500"> · {l.recipient_company}</span>}
                  </span>
                  <span className="block text-sm text-neutral-500">
                    {l.views === 0 || !l.last_viewed
                      ? 'Not opened yet'
                      : `Opened ${plural(l.views, 'time', 'times')}, last on ${arubaTime(l.last_viewed)}`}
                    {l.documents > 0 && ` · ${plural(l.documents, 'document viewed', 'documents viewed')}`}
                    {l.devices > 1 && ` · from ${l.devices} different networks`}
                  </span>
                  <span className="block text-sm text-neutral-500">
                    Works until {arubaDay(l.expires_at)}
                    {l.max_views ? ` · ${plural(l.max_views, 'opening', 'openings')} at most` : ''}
                  </span>
                  {l.hidden_sections.length > 0 && (
                    <span className="block text-sm text-neutral-500">
                      Not shown: {SECTION_CHOICES.filter((s) => l.hidden_sections.includes(s.key)).map((s) => s.label).join(', ')}
                    </span>
                  )}
                </button>
                <span className={cn('text-xs px-2.5 py-1 rounded-full border', STATUS_STYLE[l.status])}>{STATUS_TEXT[l.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => show(l)} className={smallButton}>
                  <KeyRound className="w-4 h-4" /> Link and passcode
                </button>
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
                <button
                  type="button"
                  onClick={() => setEditing(editing?.id === l.id ? null : { id: l.id, hidden: l.hidden_sections })}
                  className={smallButton}
                >
                  <SlidersHorizontal className="w-4 h-4" /> What they see
                </button>
                {l.recent.length > 0 && (
                  <button type="button" onClick={() => setOpen(open === l.id ? null : l.id)} className={smallButton}>
                    <Eye className="w-4 h-4" /> {open === l.id ? 'Hide activity' : 'Activity'}
                  </button>
                )}
              </div>
              {editing?.id === l.id && (
                <div className="mt-3 rounded-xl border border-neutral-200 p-3 space-y-3">
                  <SectionChips hidden={editing.hidden} onChange={(hidden) => setEditing({ id: l.id, hidden })} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await act(l.id, 'sections', { hidden: editing.hidden });
                        setEditing(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-ink text-cream"
                    >
                      <Check className="w-4 h-4" /> Save
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="text-sm px-3 py-2 text-neutral-500">Cancel</button>
                  </div>
                </div>
              )}
              {open === l.id && (
                <ul className="mt-3 text-sm divide-y divide-neutral-100">
                  {l.recent.map((v, i) => (
                    <li key={i} className="py-1.5 flex justify-between gap-3">
                      <span>
                        {arubaTime(v.viewed_at)}
                        <span className="text-neutral-500"> · {v.file ? `viewed ${v.file}` : 'opened'}</span>
                      </span>
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
