// Online reservations: shared types plus the slot and capacity rules used by
// the public booking API and the dashboard. Dates and times are Aruba local
// time (UTC-4 all year, no daylight saving). No imports, so it runs anywhere.

export type ReservationStatus = 'confirmed' | 'seated' | 'no_show' | 'cancelled';
export type ReservationSource = 'online' | 'staff';

export interface Reservation {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, 24h
  party_size: number;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: ReservationStatus;
  source: ReservationSource;
  created_at: string;
}

export interface ReservationSettings {
  online_enabled: boolean;
  max_guests_per_slot: number; // guests arriving per half hour; online booking stops above it
  max_party_online: number; // bigger groups are asked to message instead
  first_time: string; // first bookable time, HH:MM
  last_time: string; // last bookable time, HH:MM
  min_notice_minutes: number;
  max_days_ahead: number;
  closed_dates: string[]; // days with no online booking
}

export const DEFAULT_SETTINGS: ReservationSettings = {
  online_enabled: true,
  max_guests_per_slot: 20,
  max_party_online: 8,
  first_time: '07:30',
  last_time: '21:30',
  min_notice_minutes: 60,
  max_days_ahead: 60,
  closed_dates: [],
};

export const SLOT_MINUTES = 30;
export const BOOKING_PAGE_URL = 'https://chebararuba.com/reserve/';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isTime(t: unknown): t is string {
  return typeof t === 'string' && TIME_RE.test(t);
}

export function isDate(d: unknown): d is string {
  if (typeof d !== 'string' || !DATE_RE.test(d)) return false;
  const parsed = new Date(d + 'T00:00:00Z');
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d;
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function slotTimes(first: string, last: string, step = SLOT_MINUTES): string[] {
  const out: string[] = [];
  for (let m = toMinutes(first); m <= toMinutes(last); m += step) out.push(fromMinutes(m));
  return out;
}

// The half hour a time counts toward (staff can enter any time, e.g. 18:15)
export function slotOf(t: string): string {
  const m = toMinutes(t);
  return fromMinutes(m - (m % SLOT_MINUTES));
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function formatDate(date: string, style: 'short' | 'long' = 'short'): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: style,
    month: style,
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function arubaNow(at: number = Date.now()): { date: string; minutes: number } {
  const d = new Date(at - 4 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The Bookings day strip shows the next two weeks. When the day being viewed falls
// outside them, the strip moves so that day sits near its middle.
export const STRIP_DAYS = 14;
export function stripStart(date: string, today: string): string {
  return date >= today && date <= addDays(today, STRIP_DAYS - 1) ? today : addDays(date, -6);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000);
}

// Bookings that still hold a table
export function isActive(r: Pick<Reservation, 'status'>): boolean {
  return r.status === 'confirmed' || r.status === 'seated';
}

export function guestsBySlot(rows: Pick<Reservation, 'time' | 'party_size' | 'status'>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (!isActive(r) || !isTime(r.time)) continue;
    const s = slotOf(r.time);
    out[s] = (out[s] ?? 0) + r.party_size;
  }
  return out;
}

export type ClosedReason = 'paused' | 'past' | 'too_far' | 'closed';

export interface DayAvailability {
  open: boolean;
  reason?: ClosedReason;
  slots: { time: string; available: boolean }[];
}

// Which half hours a party can still book online on a given day
export function dayAvailability(
  date: string,
  party: number,
  settings: ReservationSettings,
  booked: Record<string, number>,
  now = arubaNow()
): DayAvailability {
  if (!settings.online_enabled) return { open: false, reason: 'paused', slots: [] };
  if (date < now.date) return { open: false, reason: 'past', slots: [] };
  const ahead = daysBetween(now.date, date);
  if (ahead > settings.max_days_ahead) return { open: false, reason: 'too_far', slots: [] };
  if (settings.closed_dates.includes(date)) return { open: false, reason: 'closed', slots: [] };

  const earliest = now.minutes + settings.min_notice_minutes; // minutes from today's midnight
  const slots = slotTimes(settings.first_time, settings.last_time)
    .filter((t) => ahead * 1440 + toMinutes(t) >= earliest)
    .map((t) => ({ time: t, available: (booked[t] ?? 0) + party <= settings.max_guests_per_slot }));
  return { open: true, slots };
}

export function closedMessage(reason: ClosedReason | undefined, settings: ReservationSettings): string {
  switch (reason) {
    case 'paused':
      return 'Online booking is paused right now. Walk-ins are welcome.';
    case 'past':
      return 'That day has already passed.';
    case 'too_far':
      return `We take online bookings up to ${settings.max_days_ahead} days ahead.`;
    default:
      return "We're not taking online bookings that day. Walk-ins are welcome.";
  }
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : fallback;
}

// Fill defaults and repair anything odd in the settings row
export function normalizeSettings(row: Partial<ReservationSettings> | null | undefined): ReservationSettings {
  const s = { ...DEFAULT_SETTINGS, ...(row ?? {}) };
  let first = isTime(s.first_time) ? slotOf(s.first_time) : DEFAULT_SETTINGS.first_time;
  let last = isTime(s.last_time) ? slotOf(s.last_time) : DEFAULT_SETTINGS.last_time;
  if (toMinutes(last) < toMinutes(first)) [first, last] = [last, first];
  return {
    online_enabled: s.online_enabled !== false,
    max_guests_per_slot: clampInt(s.max_guests_per_slot, 1, 500, DEFAULT_SETTINGS.max_guests_per_slot),
    max_party_online: clampInt(s.max_party_online, 1, 50, DEFAULT_SETTINGS.max_party_online),
    first_time: first,
    last_time: last,
    min_notice_minutes: clampInt(s.min_notice_minutes, 0, 7 * 1440, DEFAULT_SETTINGS.min_notice_minutes),
    max_days_ahead: clampInt(s.max_days_ahead, 1, 365, DEFAULT_SETTINGS.max_days_ahead),
    closed_dates: Array.isArray(s.closed_dates) ? Array.from(new Set(s.closed_dates.filter(isDate))).sort() : [],
  };
}

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export interface GuestBooking {
  date: string;
  time: string;
  party: number;
  name: string;
  phone: string | null;
  email: string; // confirmations go by email
  notes: string | null;
  clientRef: string | null;
}

// Validate what a guest typed on the booking page
export function parseGuestBooking(body: any): { ok: true; value: GuestBooking } | { ok: false; error: string } {
  const name = clean(body?.name, 80);
  const phone = clean(body?.phone, 30);
  const email = clean(body?.email, 120);
  const notes = clean(body?.notes, 500);
  const party = Number(body?.party);

  if (!isDate(body?.date)) return { ok: false, error: 'Please pick a day.' };
  if (!isTime(body?.time)) return { ok: false, error: 'Please pick a time.' };
  if (!Number.isInteger(party) || party < 1) return { ok: false, error: 'How many guests?' };
  if (!name) return { ok: false, error: 'Please enter your name.' };
  if (!email) return { ok: false, error: 'Please enter your email so we can send your confirmation.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That email address doesn't look right." };
  if (phone && (!/^\+?[\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7)) {
    return { ok: false, error: "That phone number doesn't look right." };
  }
  const clientRef =
    typeof body?.clientRef === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.clientRef) ? body.clientRef : null;

  return {
    ok: true,
    value: { date: body.date, time: body.time, party, name, phone: phone || null, email, notes: notes || null, clientRef },
  };
}

// Validate a booking entered by staff (no online limits; phone optional)
export function parseStaffBooking(body: any): { ok: true; value: Partial<Reservation> } | { ok: false; error: string } {
  const out: Partial<Reservation> = {};
  if ('date' in body) {
    if (!isDate(body.date)) return { ok: false, error: 'Pick a date.' };
    out.date = body.date;
  }
  if ('time' in body) {
    if (!isTime(body.time)) return { ok: false, error: 'Pick a time.' };
    out.time = body.time;
  }
  if ('party_size' in body) {
    const n = Number(body.party_size);
    if (!Number.isInteger(n) || n < 1 || n > 100) return { ok: false, error: 'Party size must be 1–100.' };
    out.party_size = n;
  }
  if ('name' in body) {
    const name = clean(body.name, 80);
    if (!name) return { ok: false, error: 'Enter a name.' };
    out.name = name;
  }
  if ('phone' in body) out.phone = clean(body.phone, 30) || null;
  if ('email' in body) out.email = clean(body.email, 120) || null;
  if ('notes' in body) out.notes = clean(body.notes, 500) || null;
  if ('status' in body) {
    if (!['confirmed', 'seated', 'no_show', 'cancelled'].includes(body.status)) return { ok: false, error: 'Unknown status.' };
    out.status = body.status;
  }
  return { ok: true, value: out };
}
