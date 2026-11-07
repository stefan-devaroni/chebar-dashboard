'use client';

import { useMemo, useState } from 'react';
import { Briefcase, Check, Copy, FileText, Mail, MessageCircle, Phone, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/clipboard';
import {
  bestFit,
  compareFit,
  fitScore,
  fits,
  JOB_FAIR_POSITIONS,
  PICK_LABELS,
  pickRank,
  POSITIONS,
  SOURCE_LABELS,
  STATUS_LABELS,
  STATUSES,
  whatsappNumber,
  type ApplicationSource,
  type ApplicationStatus,
  type Fit,
  type JobApplication,
  type JobFairCheck,
  type PickLevel,
} from '@/lib/applications';

const CAREERS_URL = 'https://chebararuba.com/careers/';

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-amber-50 text-amber-800 border-amber-200',
  interview: 'bg-purple-50 text-purple-700 border-purple-200',
  later: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  hired: 'bg-green-50 text-green-700 border-green-200',
  not_a_fit: 'bg-neutral-50 text-neutral-500 border-neutral-200',
};

const PICK_STYLES: Record<PickLevel, string> = {
  top: 'bg-ink text-cream border-ink',
  strong: 'bg-white text-ink border-ink',
  maybe: 'bg-white text-neutral-600 border-neutral-300',
  wait: 'bg-white text-neutral-500 border-neutral-400 border-dashed',
  no: 'bg-neutral-50 text-neutral-400 border-neutral-200',
};

// Job fair jobs first (they say morning or night), then the careers page positions
const POSITION_ORDER: string[] = [...JOB_FAIR_POSITIONS, ...POSITIONS];
const positionOrder = (p: string) => {
  const i = POSITION_ORDER.indexOf(p);
  return i === -1 ? POSITION_ORDER.length : i;
};

type ListOrder = 'fit' | 'newest' | 'job';
const ORDERS: [ListOrder, string][] = [
  ['fit', 'Best fit'],
  ['newest', 'Newest'],
  ['job', 'By job'],
];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const longDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const checkedAt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Aruba', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function PickBadge({ pick, className }: { pick: PickLevel; className?: string }) {
  return <span className={cn('inline-block shrink-0 text-[11px] leading-4 px-2 py-0.5 rounded-full border font-medium', PICK_STYLES[pick], className)}>{PICK_LABELS[pick]}</span>;
}

export function ApplicantsView({
  initialApplications,
  initialOpenId,
  setupNeeded,
  lastCheck,
}: {
  initialApplications: JobApplication[];
  initialOpenId: string | null;
  setupNeeded: boolean;
  lastCheck: JobFairCheck | null;
}) {
  const [apps, setApps] = useState(initialApplications);
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  const [source, setSource] = useState<ApplicationSource | 'all'>('all');
  // Best fit first whenever Claude has reviewed anyone
  const [order, setOrder] = useState<ListOrder>(() => (initialApplications.some((a) => a.review) ? 'fit' : 'newest'));
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [copied, setCopied] = useState(false);

  const hasJobFair = apps.some((a) => a.source === 'job_fair');
  const fromSource = useMemo(() => apps.filter((a) => source === 'all' || a.source === source), [apps, source]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: fromSource.length };
    for (const a of fromSource) out[a.status] = (out[a.status] ?? 0) + 1;
    return out;
  }, [fromSource]);
  const sourceCounts = useMemo(() => {
    const out: Record<string, number> = { all: apps.length };
    for (const a of apps) out[a.source] = (out[a.source] ?? 0) + 1;
    return out;
  }, [apps]);

  const shown = fromSource.filter((a) => {
    if (filter !== 'all' && a.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [a.name, a.email, a.phone ?? '', a.positions.join(' '), a.notes ?? ''].some((v) => v.toLowerCase().includes(q));
  });

  // "By job": everyone under each job they applied for, best picks first
  const groups = useMemo(() => {
    const map = new Map<string, JobApplication[]>();
    for (const a of shown) for (const p of a.positions) map.set(p, [...(map.get(p) ?? []), a]);
    return [...map.entries()]
      .sort(([a], [b]) => positionOrder(a) - positionOrder(b) || a.localeCompare(b))
      .map(([position, list]) => ({
        position,
        list: list.sort((a, b) => pickRank(a, position) - pickRank(b, position) || fitScore(b) - fitScore(a) || b.created_at.localeCompare(a.created_at)),
      }));
  }, [shown]);

  // "Best fit": one list from best to worst. The number is the place among everyone, so it stays the same when filtering.
  const ranks = useMemo(() => new Map([...apps].sort(compareFit).map((a, i) => [a.id, i + 1])), [apps]);
  const byFit = useMemo(() => [...shown].sort(compareFit), [shown]);

  // Claude's top and strong picks per job fair job
  const picks = useMemo(() => {
    const fair = apps.filter((a) => a.source === 'job_fair' && a.status !== 'not_a_fit' && a.status !== 'hired');
    return JOB_FAIR_POSITIONS.map((position) => ({
      position,
      list: fair
        .map((a) => ({ a, f: fits(a).find((f) => f.position === position) }))
        .filter((x): x is { a: JobApplication; f: Fit } => !!x.f && (x.f.pick === 'top' || x.f.pick === 'strong'))
        .sort((x, y) => pickRank(x.a, position) - pickRank(y.a, position) || fitScore(y.a) - fitScore(x.a) || x.a.name.localeCompare(y.a.name)),
    })).filter((g) => g.list.length > 0);
  }, [apps]);

  const open = apps.find((a) => a.id === openId) ?? null;

  function replace(updated: JobApplication) {
    setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  async function copyLink() {
    if (await copyText(CAREERS_URL)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else alert(CAREERS_URL);
  }

  function closeSheet() {
    setOpenId(null);
    window.history.replaceState(null, '', '/dashboard/applicants');
  }

  if (setupNeeded) {
    return <p className="bg-white border border-neutral-200 rounded-xl p-6 text-sm text-neutral-600">The applicants list needs a one-time database update (supabase/applications.sql).</p>;
  }

  const chip = (active: boolean) =>
    cn('shrink-0 px-3.5 py-2 rounded-full border text-sm transition', active ? 'bg-ink border-ink text-cream' : 'bg-white border-neutral-200 text-neutral-700');
  const chipCount = (active: boolean) => cn('ml-1.5 text-xs', active ? 'text-neutral-300' : 'text-neutral-400');

  return (
    <div>
      <button onClick={copyLink} className="mb-5 inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-neutral-300 bg-white">
        {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
        {copied ? 'Link copied' : 'Copy the careers page link'}
      </button>

      {hasJobFair && (picks.length > 0 || lastCheck) && (
        <section className="mb-6 bg-white border border-neutral-200 rounded-xl p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
            <h2 className="font-display text-xl">Claude&rsquo;s picks from the job fair</h2>
            {lastCheck && <p className="text-xs text-neutral-500">Portal checked {checkedAt(lastCheck.checked_at)}</p>}
          </div>
          {picks.length === 0 ? (
            <p className="text-sm text-neutral-500">No strong candidates right now.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {picks.map((g) => (
                <div key={g.position} className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">{g.position}</p>
                  <ul className="space-y-2.5">
                    {g.list.map(({ a, f }) => (
                      <li key={a.id} className="min-w-0">
                        <button onClick={() => setOpenId(a.id)} className="flex items-center gap-2 text-left max-w-full">
                          <span className="font-medium underline decoration-neutral-300 underline-offset-4 truncate">{a.name}</span>
                          <PickBadge pick={f.pick} />
                        </button>
                        {f.take && <p className="text-xs text-neutral-500 mt-0.5">{f.take}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {lastCheck?.note && <p className="text-xs text-neutral-400 mt-3">Last check: {lastCheck.note}</p>}
        </section>
      )}

      {hasJobFair && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {(['all', 'job_fair', 'careers'] as const).map((s) => (
              <button key={s} onClick={() => setSource(s)} className={chip(source === s)}>
                {s === 'all' ? 'Everyone' : SOURCE_LABELS[s]}
                {(sourceCounts[s] ?? 0) > 0 && <span className={chipCount(source === s)}>{sourceCounts[s]}</span>}
              </button>
            ))}
          </div>
          <div className="flex rounded-full border border-neutral-200 bg-white p-0.5 text-sm" role="group" aria-label="List order">
            {ORDERS.map(([key, text]) => (
              <button key={key} onClick={() => setOrder(key)} aria-pressed={order === key} className={cn('px-3 py-1.5 rounded-full whitespace-nowrap', order === key ? 'bg-ink text-cream' : 'text-neutral-600')}>
                {text}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-2 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {(['all', ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={chip(filter === s)}>
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
            {(counts[s] ?? 0) > 0 && <span className={chipCount(filter === s)}>{counts[s]}</span>}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 px-3 mb-4 bg-white border border-neutral-200 rounded-xl">
        <Search size={16} className="text-neutral-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, position, notes" className="flex-1 py-3 text-base bg-transparent focus:outline-none" />
      </label>

      {shown.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center">
          <Briefcase size={30} strokeWidth={1.5} className="mx-auto text-neutral-300 mb-3" />
          <p className="text-sm text-neutral-600">{apps.length === 0 ? 'No applications yet.' : 'No applicants match.'}</p>
          {apps.length === 0 && <p className="text-xs text-neutral-400 mt-1">They arrive here from chebararuba.com/careers.</p>}
        </div>
      ) : order === 'fit' ? (
        <div>
          <p className="text-xs text-neutral-500 mb-2">Claude&rsquo;s order, best fit first. People you mark Not a fit move to the bottom.</p>
          <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
            {byFit.map((a) => (
              <ApplicantRow key={a.id} app={a} rank={ranks.get(a.id)} onOpen={() => setOpenId(a.id)} />
            ))}
          </div>
        </div>
      ) : order === 'job' ? (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.position}>
              <h2 className="flex items-baseline gap-2 mb-2">
                <span className="font-display text-xl">{g.position}</span>
                <span className="text-xs text-neutral-400">{g.list.length}</span>
              </h2>
              <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
                {g.list.map((a) => (
                  <ApplicantRow key={a.id} app={a} position={g.position} onOpen={() => setOpenId(a.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
          {shown.map((a) => (
            <ApplicantRow key={a.id} app={a} onOpen={() => setOpenId(a.id)} />
          ))}
        </div>
      )}

      {open && <ApplicantSheet app={open} onClose={closeSheet} onChange={replace} onDeleted={() => { setApps((prev) => prev.filter((a) => a.id !== open.id)); closeSheet(); }} />}
    </div>
  );
}

function ApplicantRow({ app, position, rank, onOpen }: { app: JobApplication; position?: string; rank?: number; onOpen: () => void }) {
  const fit = position ? fits(app).find((f) => f.position === position) ?? null : bestFit(app);
  const detail = position
    ? fit?.take || app.positions.join(', ')
    : rank !== undefined && fit
      ? (
          <>
            {fit.position}
            {/* Too long to read on a phone; the sheet has it */}
            {fit.take && <span className="hidden sm:inline"> · {fit.take}</span>}
          </>
        )
      : `${app.positions.join(', ')} · ${shortDate(app.created_at)}`;
  return (
    <button onClick={onOpen} className={cn('w-full flex items-center gap-3 py-3 min-h-[64px] text-left active:bg-neutral-50', rank !== undefined ? 'pl-2 pr-4 sm:pl-3' : 'px-4')}>
      {rank !== undefined && <span className="w-6 shrink-0 text-right text-sm tabular-nums text-neutral-400">{rank}</span>}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="font-medium truncate">{app.name}</span>
          {app.cv_path && <FileText size={14} className="text-neutral-400 shrink-0" aria-label="CV attached" />}
          {app.source === 'job_fair' && <span className="shrink-0 text-[11px] leading-4 px-1.5 py-0.5 rounded bg-gold/20 text-ink">Job fair</span>}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-neutral-500 min-w-0 mt-0.5">
          {fit && <PickBadge pick={fit.pick} />}
          <span className="truncate">{detail}</span>
        </span>
      </span>
      <span className={cn('shrink-0 text-xs px-2.5 py-1 rounded-full border', STATUS_STYLES[app.status])}>{STATUS_LABELS[app.status]}</span>
    </button>
  );
}

function ApplicantSheet({
  app,
  onClose,
  onChange,
  onDeleted,
}: {
  app: JobApplication;
  onClose: () => void;
  onChange: (a: JobApplication) => void;
  onDeleted: () => void;
}) {
  const [notes, setNotes] = useState(app.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const wa = whatsappNumber(app.phone);
  const fair = app.source === 'job_fair';
  const review = app.review;
  const appFits = fits(app);
  const facts = (review?.facts ?? []).filter((f) => f && typeof f.k === 'string' && typeof f.v === 'string' && f.v);
  const ask = (review?.ask ?? []).filter((x) => typeof x === 'string' && x);

  async function save(patch: { status?: ApplicationStatus; notes?: string }) {
    setSaving(true);
    const res = await fetch('/api/applications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: app.id, ...patch }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || 'Could not save. Try again.');
      return false;
    }
    onChange(data);
    return true;
  }

  async function saveNotes() {
    if (await save({ notes })) {
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2000);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${app.name}'s application and CV for good? This can't be undone.`)) return;
    const res = await fetch('/api/applications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: app.id }) });
    if (!res.ok) {
      alert('Could not delete. Try again.');
      return;
    }
    onDeleted();
  }

  const rows: [string, string][] = fair
    ? [
        ['Position', app.positions.join(', ')],
        ['18 or older', app.adult === null ? '—' : app.adult ? 'Yes' : 'No'],
        ['From', 'Virtual job fair'],
        ['Applied', shortDate(app.created_at)],
      ]
    : [
        ['Position', app.positions.join(', ')],
        ['18 or older', app.adult === null ? '—' : app.adult ? 'Yes' : 'No'],
        ['Availability', app.availability ?? '—'],
        ['Shifts', app.shifts.join(', ') || '—'],
        ['Can start', app.start_date ? longDate(app.start_date) : '—'],
        ['Languages', app.languages.join(', ') || '—'],
        ['Applied', shortDate(app.created_at)],
      ];
  const quick = 'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-white border border-neutral-200 text-xs text-neutral-700 active:bg-neutral-50';

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-cream w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="font-display text-2xl leading-tight">{app.name}</p>
            <p className="text-sm text-neutral-600">
              {app.positions.join(', ')}
              {fair && ' · Job fair'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center text-neutral-400 hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-5">
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={quick}>
              <MessageCircle size={18} />
              WhatsApp
            </a>
          )}
          {app.phone && (
            <a href={`tel:${app.phone.replace(/[^\d+]/g, '')}`} className={quick}>
              <Phone size={18} />
              Call
            </a>
          )}
          <a href={`mailto:${app.email}`} className={quick}>
            <Mail size={18} />
            Email
          </a>
          {app.cv_path && (
            <a href={`/api/applications/cv?id=${app.id}`} target="_blank" rel="noreferrer" className={quick}>
              <FileText size={18} />
              CV
            </a>
          )}
        </div>

        {fair && review && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Claude&rsquo;s review</p>
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3 space-y-3">
              {appFits.length > 0 && (
                <ul className="space-y-2">
                  {appFits.map((f) => (
                    <li key={f.position} className="text-sm">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <PickBadge pick={f.pick} />
                        <span className="font-medium">{f.position}</span>
                      </span>
                      {f.take && <span className="block text-neutral-600 mt-0.5">{f.take}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {review.summary && <p className="text-sm">{review.summary}</p>}
              {review.interview && <p className="inline-block text-xs font-medium px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700">{review.interview}</p>}
              {facts.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {facts.map((f) => (
                    <div key={f.k} className="min-w-0">
                      <dt className="text-[11px] uppercase tracking-wider text-neutral-400">{f.k}</dt>
                      <dd className="text-sm break-words">{f.v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {ask.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1">Ask about</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {ask.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <dl className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 mb-4">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-3 px-4 py-2.5 text-sm">
              <dt className="w-24 shrink-0 text-neutral-500">{k}</dt>
              <dd className="min-w-0">{v}</dd>
            </div>
          ))}
          <div className="flex gap-3 px-4 py-2.5 text-sm">
            <dt className="w-24 shrink-0 text-neutral-500">Contact</dt>
            <dd className="min-w-0 break-words">
              {app.phone ?? '—'}
              <br />
              {app.email}
            </dd>
          </div>
        </dl>

        {!fair && app.experience && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Experience</p>
            <p className="text-sm whitespace-pre-line bg-white border border-neutral-200 rounded-xl px-4 py-3">{app.experience}</p>
          </div>
        )}
        {app.about && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">About them</p>
            <p className="text-sm whitespace-pre-line bg-white border border-neutral-200 rounded-xl px-4 py-3">{app.about}</p>
          </div>
        )}

        <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Status</p>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {STATUSES.map((s) => (
            <button
              key={s}
              disabled={saving}
              onClick={() => s !== app.status && save({ status: s })}
              className={cn('py-2.5 rounded-xl border text-sm transition', app.status === s ? 'bg-ink border-ink text-cream' : 'bg-white border-neutral-200 text-neutral-700')}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Your notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Interview notes, references, when to call back…"
          className="w-full px-3 py-3 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold resize-none"
        />
        <button
          onClick={saveNotes}
          disabled={saving || notes === (app.notes ?? '')}
          className={cn('w-full mt-2 py-3 rounded-xl text-sm font-medium transition disabled:opacity-50', savedNote ? 'bg-green-600 text-white' : 'bg-ink text-cream')}
        >
          {savedNote ? 'Saved' : 'Save notes'}
        </button>
        {app.updated_by && <p className="text-xs text-neutral-400 mt-2">Last updated by {app.updated_by}</p>}

        <button onClick={remove} className="mt-6 w-full flex items-center justify-center gap-1.5 py-2 text-sm text-red-600">
          <Trash2 size={15} />
          Delete application
        </button>
      </div>
    </div>
  );
}
