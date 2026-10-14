'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/clipboard';
import {
  addDays,
  arubaNow,
  BOOKING_PAGE_URL,
  formatDate,
  formatTime,
  guestsBySlot,
  isActive,
  slotOf,
  slotTimes,
  toMinutes,
  type Reservation,
  type ReservationSettings,
  type ReservationStatus,
} from '@/lib/reservations';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  Plus,
  Settings,
  StickyNote,
  Users,
  X,
} from 'lucide-react';

type Role = 'manager' | 'employee';

interface Props {
  initialDate: string;
  today: string;
  initialRange: { from: string; to: string };
  initialReservations: Reservation[];
  initialSettings: ReservationSettings;
  role: Role;
  setupNeeded: boolean;
}

const PARTS = [
  { label: 'Morning', test: (m: number) => m < 12 * 60 },
  { label: 'Afternoon', test: (m: number) => m >= 12 * 60 && m < 17 * 60 },
  { label: 'Evening', test: (m: number) => m >= 17 * 60 },
];

const STATUS_PILL: Partial<Record<ReservationStatus, { label: string; className: string }>> = {
  seated: { label: 'Arrived', className: 'bg-emerald-100 text-emerald-800' },
  no_show: { label: 'No-show', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-neutral-200 text-neutral-600' },
};

const guestsText = (n: number) => `${n} ${n === 1 ? 'guest' : 'guests'}`;

function dayLabel(date: string, today: string) {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  if (date === addDays(today, -1)) return 'Yesterday';
  return formatDate(date);
}

const inputClass = 'w-full px-3 py-3 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold';
const labelClass = 'block text-xs uppercase tracking-wider text-neutral-500 mb-1.5';

export function ReservationsView({
  initialDate,
  today,
  initialRange,
  initialReservations,
  initialSettings,
  role,
  setupNeeded,
}: Props) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState<Reservation[]>(initialReservations);
  const [range, setRange] = useState(initialRange);
  const [settings, setSettings] = useState(initialSettings);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ editing: Reservation | null } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isManager = role === 'manager';

  const load = useCallback(async (from: string, to: string) => {
    const res = await fetch(`/api/reservations?from=${from}&to=${to}`);
    if (!res.ok) return;
    setRows(await res.json());
    setRange({ from, to });
  }, []);

  // Guests book while this screen sits open (e.g. on the POS iPad, which has no
  // reload button as a home-screen app): refresh every minute and when staff
  // come back to it, and start fresh once the day changes.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (arubaNow().date !== today) {
        window.location.href = '/dashboard/reservations';
        return;
      }
      load(range.from, range.to);
    };
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load, range.from, range.to, today]);

  useEffect(() => {
    chipRefs.current[date]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [date]);

  function goTo(d: string) {
    if (!d) return;
    setDate(d);
    setShowCancelled(false);
    window.history.replaceState(null, '', `?date=${d}`);
    if (d < range.from || d > range.to) load(d < range.from ? d : range.from, d > range.to ? d : range.to);
  }

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  async function setStatus(r: Reservation, status: ReservationStatus) {
    const res = await fetch('/api/reservations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || 'Could not save. Try again.');
      return;
    }
    setRows((prev) => prev.map((x) => (x.id === r.id ? data : x)));
  }

  async function saveSettings(patch: Partial<ReservationSettings>) {
    const res = await fetch('/api/reservations/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || 'Could not save. Try again.');
      return false;
    }
    setSettings((prev) => ({ ...prev, ...data }));
    return true;
  }

  async function copyLink() {
    const ok = await copyText(BOOKING_PAGE_URL);
    flash(ok ? 'Booking link copied' : BOOKING_PAGE_URL);
  }

  const strip = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);
  const guestsByDate = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of rows) if (isActive(r)) out[r.date] = (out[r.date] ?? 0) + r.party_size;
    return out;
  }, [rows]);

  const dayRows = useMemo(
    () =>
      rows
        .filter((r) => r.date === date)
        .sort((a, b) => a.time.localeCompare(b.time) || a.created_at.localeCompare(b.created_at)),
    [rows, date]
  );
  const listed = dayRows.filter((r) => r.status !== 'cancelled');
  const cancelled = dayRows.filter((r) => r.status === 'cancelled');
  const holding = dayRows.filter(isActive);
  const dayGuests = holding.reduce((sum, r) => sum + r.party_size, 0);
  const closedOnline = settings.closed_dates.includes(date);
  const opened = rows.find((r) => r.id === openId) ?? null;

  if (setupNeeded) {
    return (
      <>
        <h1 className="font-display text-3xl mb-6">Reservations</h1>
        <div className="bg-white border border-neutral-200 rounded-xl p-5 text-sm text-neutral-600">
          {isManager ? (
            <>
              <p className="font-medium text-ink mb-1">One-time setup needed</p>
              <p>
                Open Supabase → SQL Editor, paste the file <code className="text-xs bg-neutral-100 px-1 rounded">supabase/reservations.sql</code>{' '}
                and press Run. Then reload this page.
              </p>
            </>
          ) : (
            <p>Reservations aren&apos;t set up yet. Ask a manager.</p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-3xl">Reservations</h1>
          <p className="text-sm text-neutral-500 mt-1">{formatDate(date, 'long')}</p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Online booking settings"
            className="w-11 h-11 -mr-1 flex items-center justify-center rounded-xl text-neutral-500 hover:text-ink hover:bg-white"
          >
            <Settings size={20} strokeWidth={1.5} />
          </button>
        )}
      </header>

      {!settings.online_enabled && (
        <button
          onClick={() => isManager && setShowSettings(true)}
          className="w-full text-left bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 mb-4 text-sm"
        >
          Online booking is paused. Guests can&apos;t book on the website right now.
        </button>
      )}

      {/* Day picker */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => goTo(addDays(date, -1))}
          aria-label="Previous day"
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-white border border-neutral-200"
        >
          <ChevronLeft size={18} />
        </button>
        <label className="relative flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-white border border-neutral-200 text-[15px] font-medium cursor-pointer">
          <CalendarDays size={16} className="text-neutral-400" />
          {dayLabel(date, today)}
          <input
            type="date"
            value={date}
            onChange={(e) => goTo(e.target.value)}
            onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            aria-label="Pick a date"
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <button
          onClick={() => goTo(addDays(date, 1))}
          aria-label="Next day"
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-white border border-neutral-200"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {strip.map((d) => {
          const guests = guestsByDate[d] ?? 0;
          const selected = d === date;
          const closed = settings.closed_dates.includes(d);
          return (
            <button
              key={d}
              ref={(el) => {
                chipRefs.current[d] = el;
              }}
              onClick={() => goTo(d)}
              className={cn(
                'shrink-0 w-[52px] py-2 rounded-xl border text-center transition',
                selected ? 'bg-ink border-ink text-cream' : 'bg-white border-neutral-200'
              )}
            >
              <span className={cn('block text-[10px] uppercase tracking-wider', selected ? 'text-neutral-300' : 'text-neutral-500')}>
                {d === today ? 'Today' : formatDate(d).slice(0, 3)}
              </span>
              <span className="block text-lg font-semibold leading-tight">{Number(d.slice(8))}</span>
              <span
                className={cn(
                  'block text-[10px] tabular-nums',
                  guests > 0 ? (selected ? 'text-gold' : 'text-ink font-medium') : selected ? 'text-neutral-400' : 'text-neutral-300'
                )}
              >
                {guests > 0 ? `${guests} ppl` : closed ? 'closed' : '—'}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setForm({ editing: null })}
        className="w-full flex items-center justify-center gap-2 bg-gold text-ink py-3.5 rounded-xl text-[15px] font-medium mb-4"
      >
        <Plus size={18} strokeWidth={2} />
        Add booking
      </button>

      <div className="flex items-center justify-between gap-3 px-1 mb-3">
        <p className="text-sm text-neutral-600">
          {holding.length === 0 ? 'No bookings' : `${holding.length} ${holding.length === 1 ? 'booking' : 'bookings'} · ${guestsText(dayGuests)}`}
        </p>
        {isManager && date >= today ? (
          <button
            onClick={() =>
              saveSettings({
                closed_dates: closedOnline ? settings.closed_dates.filter((d) => d !== date) : [...settings.closed_dates, date],
              })
            }
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border',
              closedOnline ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-neutral-200 text-neutral-600'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', closedOnline ? 'bg-red-500' : 'bg-emerald-500')} />
            {closedOnline ? 'Online booking off' : 'Online booking on'}
          </button>
        ) : (
          closedOnline && <span className="text-xs text-red-700">Online booking off</span>
        )}
      </div>

      {listed.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">
          No bookings for {dayLabel(date, today).toLowerCase() === 'today' ? 'today' : 'this day'}.
        </div>
      ) : (
        <div className="space-y-5">
          {PARTS.map((part) => {
            const list = listed.filter((r) => part.test(toMinutes(r.time)));
            if (list.length === 0) return null;
            const guests = list.filter(isActive).reduce((sum, r) => sum + r.party_size, 0);
            return (
              <section key={part.label}>
                <div className="flex items-baseline justify-between px-1 mb-2">
                  <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-medium">{part.label}</h2>
                  <span className="text-xs text-neutral-400">{guestsText(guests)}</span>
                </div>
                <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
                  {list.map((r) => (
                    <BookingRow
                      key={r.id}
                      r={r}
                      canArrive={r.status === 'confirmed' && r.date === today}
                      onOpen={() => setOpenId(r.id)}
                      onArrived={() => setStatus(r, 'seated')}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {cancelled.length > 0 && (
        <div className="mt-5">
          <button onClick={() => setShowCancelled((v) => !v)} className="px-1 py-2 text-xs text-neutral-500">
            {showCancelled ? 'Hide' : 'Show'} cancelled ({cancelled.length})
          </button>
          {showCancelled && (
            <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
              {cancelled.map((r) => (
                <BookingRow key={r.id} r={r} canArrive={false} onOpen={() => setOpenId(r.id)} onArrived={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}

      {opened && (
        <DetailsSheet
          r={opened}
          today={today}
          onClose={() => setOpenId(null)}
          onStatus={async (status) => {
            await setStatus(opened, status);
            if (status === 'cancelled' || status === 'seated' || status === 'no_show') setOpenId(null);
          }}
          onEdit={() => {
            setOpenId(null);
            setForm({ editing: opened });
          }}
        />
      )}

      {form && (
        <BookingForm
          editing={form.editing}
          defaultDate={date}
          settings={settings}
          rows={rows}
          range={range}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            setRows((prev) => (prev.some((x) => x.id === saved.id) ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved]));
            setForm(null);
            if (saved.date !== date) goTo(saved.date);
            flash(form.editing ? 'Booking updated' : 'Booking added');
          }}
        />
      )}

      {showSettings && (
        <SettingsSheet
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={async (next) => {
            if (await saveSettings(next)) {
              setShowSettings(false);
              flash('Settings saved');
            }
          }}
          onCopyLink={copyLink}
        />
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(88px+env(safe-area-inset-bottom))] lg:bottom-8 z-50 bg-ink text-cream text-sm px-4 py-2.5 rounded-full shadow-lg max-w-[90vw] truncate">
          {toast}
        </div>
      )}
    </>
  );
}

function BookingRow({
  r,
  canArrive,
  onOpen,
  onArrived,
}: {
  r: Reservation;
  canArrive: boolean;
  onOpen: () => void;
  onArrived: () => void;
}) {
  const pill = STATUS_PILL[r.status];
  return (
    <div className={cn('flex items-stretch', (r.status === 'no_show' || r.status === 'cancelled') && 'opacity-60')}>
      <button onClick={onOpen} className="flex-1 min-w-0 flex items-start gap-3 px-4 py-3 min-h-[60px] text-left hover:bg-neutral-50 active:bg-neutral-50">
        <span className="w-[74px] shrink-0 text-[15px] font-semibold tabular-nums pt-px">{formatTime(r.time)}</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className={cn('text-[15px] font-medium truncate', r.status === 'cancelled' && 'line-through')}>{r.name}</span>
            {pill && <span className={cn('shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded', pill.className)}>{pill.label}</span>}
          </span>
          {r.notes && <span className="block text-xs text-neutral-500 truncate mt-0.5">{r.notes}</span>}
        </span>
        <span className="flex items-center gap-1 text-[15px] font-medium tabular-nums shrink-0 pt-px">
          <Users size={14} className="text-neutral-400" />
          {r.party_size}
        </span>
      </button>
      {canArrive && (
        <button
          onClick={onArrived}
          aria-label={`${r.name} arrived`}
          className="w-[60px] shrink-0 flex flex-col items-center justify-center gap-0.5 border-l border-neutral-100 text-emerald-700 hover:bg-emerald-50 active:bg-emerald-50"
        >
          <Check size={18} strokeWidth={2} />
          <span className="text-[10px] font-medium">Arrived</span>
        </button>
      )}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50 sm:px-4" onClick={onClose}>
      <div
        className="bg-cream w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-xl truncate">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 shrink-0 flex items-center justify-center text-neutral-400 hover:text-ink">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DetailsSheet({
  r,
  today,
  onClose,
  onStatus,
  onEdit,
}: {
  r: Reservation;
  today: string;
  onClose: () => void;
  onStatus: (status: ReservationStatus) => void;
  onEdit: () => void;
}) {
  const pill = STATUS_PILL[r.status];
  const happened = r.date <= today;
  const booked = new Date(r.created_at).toLocaleString('en-US', {
    timeZone: 'America/Aruba',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const actionClass = 'w-full py-3.5 rounded-xl text-[15px] font-medium';

  return (
    <Sheet title={r.name} onClose={onClose}>
      <div className="mb-4">
        <p className="text-lg font-medium">{formatDate(r.date, 'long')}</p>
        <p className="text-neutral-600">
          {formatTime(r.time)} · {guestsText(r.party_size)}
          {pill && <span className={cn('ml-2 text-[11px] font-medium px-1.5 py-0.5 rounded align-middle', pill.className)}>{pill.label}</span>}
        </p>
      </div>

      <div className="space-y-2 mb-4">
        {r.phone && (
          <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-4 py-3 text-[15px]">
            <Phone size={16} className="text-neutral-400 shrink-0" />
            {r.phone}
          </a>
        )}
        {r.email && (
          <a href={`mailto:${r.email}`} className="flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-4 py-3 text-[15px] min-w-0">
            <Mail size={16} className="text-neutral-400 shrink-0" />
            <span className="truncate">{r.email}</span>
          </a>
        )}
        {r.notes && (
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[15px]">
            <StickyNote size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <span>{r.notes}</span>
          </div>
        )}
        <p className="text-xs text-neutral-400 px-1">
          {r.source === 'online' ? 'Booked online' : 'Added by staff'} · {booked}
        </p>
      </div>

      <div className="space-y-2">
        {r.status === 'confirmed' && happened && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onStatus('seated')} className={cn(actionClass, 'bg-emerald-600 text-white')}>
              Arrived
            </button>
            <button onClick={() => onStatus('no_show')} className={cn(actionClass, 'bg-white border border-neutral-200 text-neutral-700')}>
              No-show
            </button>
          </div>
        )}
        {(r.status === 'seated' || r.status === 'no_show') && (
          <button onClick={() => onStatus('confirmed')} className={cn(actionClass, 'bg-white border border-neutral-200 text-neutral-700')}>
            Undo — back to booked
          </button>
        )}
        {r.status === 'cancelled' && (
          <button onClick={() => onStatus('confirmed')} className={cn(actionClass, 'bg-white border border-neutral-200 text-neutral-700')}>
            Restore booking
          </button>
        )}
        <button onClick={onEdit} className={cn(actionClass, 'bg-ink text-cream')}>
          Edit details
        </button>
        {r.status !== 'cancelled' && (
          <button
            onClick={() => {
              if (confirm(`Cancel the booking for ${r.name}?`)) onStatus('cancelled');
            }}
            className="w-full py-3 text-sm text-red-600"
          >
            Cancel booking
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const btn = 'w-12 h-12 shrink-0 rounded-xl bg-white border border-neutral-200 text-xl leading-none disabled:opacity-40';
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)))}
        className="w-20 h-12 text-center bg-white border border-neutral-200 rounded-xl text-lg font-medium tabular-nums focus:outline-none focus:border-gold"
      />
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
        +
      </button>
    </div>
  );
}

function BookingForm({
  editing,
  defaultDate,
  settings,
  rows,
  range,
  onClose,
  onSaved,
}: {
  editing: Reservation | null;
  defaultDate: string;
  settings: ReservationSettings;
  rows: Reservation[];
  range: { from: string; to: string };
  onClose: () => void;
  onSaved: (r: Reservation) => void;
}) {
  const [date, setDate] = useState(editing?.date ?? defaultDate);
  const [time, setTime] = useState(editing?.time ?? '');
  const [party, setParty] = useState(editing?.party_size ?? 2);
  const [name, setName] = useState(editing?.name ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const times = useMemo(() => {
    const base = slotTimes('07:00', '22:30');
    return time && !base.includes(time) ? [...base, time].sort() : base;
  }, [time]);

  // Warn (never block) when the half hour goes over the online limit
  const slotGuests = useMemo(() => {
    if (!time || date < range.from || date > range.to) return null;
    const others = rows.filter((r) => r.date === date && r.id !== editing?.id);
    return guestsBySlot(others)[slotOf(time)] ?? 0;
  }, [rows, range, date, time, editing?.id]);
  const over = slotGuests !== null && slotGuests + party > settings.max_guests_per_slot;

  async function save() {
    setError(null);
    if (!date) return setError('Pick a date.');
    if (!time) return setError('Pick a time.');
    if (!name.trim()) return setError('Enter a name.');
    setSaving(true);
    const payload = { date, time, party_size: party, name, phone, email, notes };
    try {
      const res = await fetch('/api/reservations', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save. Try again.');
        setSaving(false);
        return;
      }
      onSaved(data);
    } catch {
      setError('Network error. Try again.');
      setSaving(false);
    }
  }

  return (
    <Sheet title={editing ? 'Edit booking' : 'Add booking'} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Time</label>
            <select value={time} onChange={(e) => setTime(e.target.value)} className={cn(inputClass, !time && 'text-neutral-400')}>
              <option value="">Pick…</option>
              {times.map((t) => (
                <option key={t} value={t}>
                  {formatTime(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Guests</label>
          <Stepper value={party} min={1} max={100} onChange={setParty} label="guests" />
        </div>

        {over && (
          <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2.5">
            That half hour will have {slotGuests! + party} guests booked (the online limit is {settings.max_guests_per_slot}). You can still save.
          </p>
        )}

        <div>
          <label className={labelClass}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maria Lopez" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Phone (optional)</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +1 555 123 4567" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email (optional)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Birthday, high chair, allergies…"
            className={cn(inputClass, 'resize-none')}
          />
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-800">{error}</div>}

        <button onClick={save} disabled={saving} className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium disabled:opacity-50">
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add booking'}
        </button>
      </div>
    </Sheet>
  );
}

const NOTICE_OPTIONS: [number, string][] = [
  [0, 'No minimum'],
  [30, '30 minutes'],
  [60, '1 hour'],
  [120, '2 hours'],
  [180, '3 hours'],
  [1440, '1 day'],
];
const AHEAD_OPTIONS = [7, 14, 30, 60, 90, 180];

function SettingsSheet({
  settings,
  onClose,
  onSave,
  onCopyLink,
}: {
  settings: ReservationSettings;
  onClose: () => void;
  onSave: (next: Partial<ReservationSettings>) => Promise<void>;
  onCopyLink: () => void;
}) {
  const [s, setS] = useState(settings);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ReservationSettings>) => setS((prev) => ({ ...prev, ...patch }));
  const times = slotTimes('06:00', '23:30');
  const notice = NOTICE_OPTIONS.some(([v]) => v === s.min_notice_minutes)
    ? NOTICE_OPTIONS
    : [...NOTICE_OPTIONS, [s.min_notice_minutes, `${s.min_notice_minutes} minutes`] as [number, string]].sort((a, b) => a[0] - b[0]);
  const ahead = AHEAD_OPTIONS.includes(s.max_days_ahead) ? AHEAD_OPTIONS : [...AHEAD_OPTIONS, s.max_days_ahead].sort((a, b) => a - b);
  const choice = (on: boolean) =>
    cn('py-3 rounded-xl text-sm font-medium transition', on ? 'bg-ink text-cream' : 'bg-white border border-neutral-200 text-neutral-600');

  return (
    <Sheet title="Online booking" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className={labelClass}>Guests can book online</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => set({ online_enabled: true })} className={choice(s.online_enabled)}>
              On
            </button>
            <button type="button" onClick={() => set({ online_enabled: false })} className={choice(!s.online_enabled)}>
              Paused
            </button>
          </div>
        </div>

        <div>
          <label className={labelClass}>Most guests arriving per half hour</label>
          <Stepper value={s.max_guests_per_slot} min={1} max={200} onChange={(n) => set({ max_guests_per_slot: n })} label="guests per half hour" />
          <p className="text-[11px] text-neutral-500 mt-1.5">When a half hour is full, guests pick another time. You can still add bookings by hand.</p>
        </div>

        <div>
          <label className={labelClass}>Biggest group that can book online</label>
          <Stepper value={s.max_party_online} min={1} max={50} onChange={(n) => set({ max_party_online: n })} label="group size" />
          <p className="text-[11px] text-neutral-500 mt-1.5">Bigger groups are asked to WhatsApp you.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First time</label>
            <select value={s.first_time} onChange={(e) => set({ first_time: e.target.value })} className={inputClass}>
              {times.map((t) => (
                <option key={t} value={t}>
                  {formatTime(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Last time</label>
            <select value={s.last_time} onChange={(e) => set({ last_time: e.target.value })} className={inputClass}>
              {times.map((t) => (
                <option key={t} value={t}>
                  {formatTime(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Book at least</label>
            <select value={s.min_notice_minutes} onChange={(e) => set({ min_notice_minutes: Number(e.target.value) })} className={inputClass}>
              {notice.map(([v, label]) => (
                <option key={v} value={v}>
                  {v === 0 ? label : `${label} ahead`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Book up to</label>
            <select value={s.max_days_ahead} onChange={(e) => set({ max_days_ahead: Number(e.target.value) })} className={inputClass}>
              {ahead.map((d) => (
                <option key={d} value={d}>
                  {d} days ahead
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Booking page</label>
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl pl-3 pr-1 py-1">
            <span className="flex-1 min-w-0 truncate text-sm text-neutral-600">{BOOKING_PAGE_URL.replace('https://', '')}</span>
            <a
              href={BOOKING_PAGE_URL}
              target="_blank"
              rel="noopener"
              aria-label="Open booking page"
              className="w-10 h-10 flex items-center justify-center text-neutral-500 hover:text-ink"
            >
              <ExternalLink size={16} />
            </a>
            <button type="button" onClick={onCopyLink} className="flex items-center gap-1.5 text-sm font-medium px-3 h-10 rounded-lg bg-neutral-100">
              <Copy size={14} />
              Copy
            </button>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1.5">Put it in your Instagram bio and Google profile.</p>
        </div>

        <button
          onClick={async () => {
            setSaving(true);
            await onSave(s);
            setSaving(false);
          }}
          disabled={saving}
          className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Sheet>
  );
}
