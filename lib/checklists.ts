// Daily checklists: shared types and the "which day is it" rule.
// A business day runs 5 AM to 5 AM Aruba time (UTC-4), so a closing list
// ticked off at 12:30 AM still counts for the night before.

export type Department = 'all' | 'foh' | 'kitchen';

export interface Checklist {
  id: string;
  name: string;
  department: Department;
  days: number[]; // 0 = Sunday ... 6 = Saturday
  due_time: string | null; // HH:MM
  sort: number;
  active: boolean;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  text: string;
  sort: number;
  active: boolean;
}

export interface ChecklistCheck {
  id: string;
  item_id: string;
  checklist_id: string;
  date: string;
  checked_by: string;
  checked_at: string;
}

export const DEPARTMENT_LABELS: Record<Department, string> = {
  all: 'Everyone',
  foh: 'Front of House',
  kitchen: 'Kitchen',
};

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ROLLOVER_HOUR = 5;

// Aruba wall-clock time as a Date whose UTC fields hold the local values
function arubaClock(at = Date.now()): Date {
  return new Date(at - 4 * 3600 * 1000);
}

export function businessDate(at = Date.now()): string {
  return new Date(arubaClock(at).getTime() - ROLLOVER_HOUR * 3600 * 1000).toISOString().slice(0, 10);
}

// Minutes since the start of the business day's calendar date (so 00:30 after midnight = 1470)
export function businessMinutes(at = Date.now()): number {
  const clock = arubaClock(at);
  const minutes = clock.getUTCHours() * 60 + clock.getUTCMinutes();
  return clock.toISOString().slice(0, 10) === businessDate(at) ? minutes : minutes + 1440;
}

export function weekdayOf(date: string): number {
  return new Date(date + 'T12:00:00Z').getUTCDay();
}

export function runsOn(list: Pick<Checklist, 'days' | 'active'>, date: string): boolean {
  return list.active && list.days.includes(weekdayOf(date));
}

export function isLate(list: Pick<Checklist, 'due_time'>, date: string, done: boolean, at = Date.now()): boolean {
  if (done || !list.due_time) return false;
  const today = businessDate(at);
  if (date < today) return true;
  if (date > today) return false;
  const [h, m] = list.due_time.split(':').map(Number);
  const due = h * 60 + m + (h < ROLLOVER_HOUR ? 1440 : 0);
  return businessMinutes(at) > due;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Aruba', hour: 'numeric', minute: '2-digit' });
}

export function formatDue(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Validate a manager's list settings
export function parseListInput(body: any): { ok: true; value: Partial<Checklist> } | { ok: false; error: string } {
  const out: Partial<Checklist> = {};
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    if (!name) return { ok: false, error: 'Give the checklist a name.' };
    out.name = name;
  }
  if ('department' in body) {
    if (!['all', 'foh', 'kitchen'].includes(body.department)) return { ok: false, error: 'Unknown team.' };
    out.department = body.department;
  }
  if ('days' in body) {
    const raw: number[] = Array.isArray(body.days) ? (body.days as unknown[]).map(Number) : [];
    const days = Array.from(new Set(raw)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length === 0) return { ok: false, error: 'Pick at least one day.' };
    out.days = days.sort();
  }
  if ('due_time' in body) {
    if (body.due_time === null || body.due_time === '') out.due_time = null;
    else if (typeof body.due_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.due_time)) out.due_time = body.due_time;
    else return { ok: false, error: 'Pick a valid time.' };
  }
  if ('sort' in body) out.sort = Number.isFinite(Number(body.sort)) ? Math.round(Number(body.sort)) : 0;
  if ('active' in body) out.active = body.active !== false;
  return { ok: true, value: out };
}
