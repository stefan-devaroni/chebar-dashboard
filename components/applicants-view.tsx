'use client';

import { useMemo, useState } from 'react';
import { Briefcase, Check, Copy, FileText, Mail, MessageCircle, Phone, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/clipboard';
import { STATUS_LABELS, STATUSES, whatsappNumber, type ApplicationStatus, type JobApplication } from '@/lib/applications';

const CAREERS_URL = 'https://chebararuba.com/careers/';

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-amber-50 text-amber-800 border-amber-200',
  interview: 'bg-purple-50 text-purple-700 border-purple-200',
  later: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  hired: 'bg-green-50 text-green-700 border-green-200',
  not_a_fit: 'bg-neutral-50 text-neutral-500 border-neutral-200',
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const longDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export function ApplicantsView({
  initialApplications,
  initialOpenId,
  setupNeeded,
}: {
  initialApplications: JobApplication[];
  initialOpenId: string | null;
  setupNeeded: boolean;
}) {
  const [apps, setApps] = useState(initialApplications);
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [copied, setCopied] = useState(false);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: apps.length };
    for (const a of apps) out[a.status] = (out[a.status] ?? 0) + 1;
    return out;
  }, [apps]);

  const shown = apps.filter((a) => {
    if (filter !== 'all' && a.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [a.name, a.email, a.phone ?? '', a.positions.join(' '), a.notes ?? ''].some((v) => v.toLowerCase().includes(q));
  });
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

  return (
    <div>
      <button onClick={copyLink} className="mb-5 inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-neutral-300 bg-white">
        {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
        {copied ? 'Link copied' : 'Copy the careers page link'}
      </button>

      <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-2 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {(['all', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'shrink-0 px-3.5 py-2 rounded-full border text-sm transition',
              filter === s ? 'bg-ink border-ink text-cream' : 'bg-white border-neutral-200 text-neutral-700'
            )}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
            {(counts[s] ?? 0) > 0 && <span className={cn('ml-1.5 text-xs', filter === s ? 'text-neutral-300' : 'text-neutral-400')}>{counts[s]}</span>}
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
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
          {shown.map((a) => (
            <button key={a.id} onClick={() => setOpenId(a.id)} className="w-full flex items-center gap-3 px-4 py-3 min-h-[64px] text-left active:bg-neutral-50">
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="font-medium truncate">{a.name}</span>
                  {a.cv_path && <FileText size={14} className="text-neutral-400 shrink-0" aria-label="CV attached" />}
                </span>
                <span className="block text-xs text-neutral-500 truncate">
                  {a.positions.join(', ')} · {shortDate(a.created_at)}
                </span>
              </span>
              <span className={cn('shrink-0 text-xs px-2.5 py-1 rounded-full border', STATUS_STYLES[a.status])}>{STATUS_LABELS[a.status]}</span>
            </button>
          ))}
        </div>
      )}

      {open && <ApplicantSheet app={open} onClose={closeSheet} onChange={replace} onDeleted={() => { setApps((prev) => prev.filter((a) => a.id !== open.id)); closeSheet(); }} />}
    </div>
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

  const rows: [string, string][] = [
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
            <p className="text-sm text-neutral-600">{app.positions.join(', ')}</p>
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

        {app.experience && (
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
