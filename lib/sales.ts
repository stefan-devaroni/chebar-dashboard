import { addDays } from '@/lib/reservations';

// Sales tab: the periods Stefan looks at, and the stretch each one is compared with.
// Dates are Aruba business days (YYYY-MM-DD). Weeks start on Monday, like the schedule.
// The numbers come from Revel's daily reports, emailed to revel@ingest.chebararuba.com.

export type Period = 'today' | 'yesterday' | 'last7' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear';

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'thisYear', label: 'This year' },
];

export function isPeriod(p: unknown): p is Period {
  return PERIODS.some((x) => x.key === p);
}

export interface Range {
  from: string;
  to: string;
}

export interface PeriodRange extends Range {
  compare: Range;
  compareLabel: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const dayOfWeek = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay();
const mondayOf = (date: string) => addDays(date, -((dayOfWeek(date) + 6) % 7));
const monthStart = (date: string) => date.slice(0, 8) + '01';

function addMonths(first: string, n: number): string {
  const d = new Date(first + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return d.toISOString().slice(0, 10);
}

const monthEnd = (date: string) => addDays(addMonths(monthStart(date), 1), -1);
const earlier = (a: string, b: string) => (a < b ? a : b);

export function periodRange(period: Period, today: string): PeriodRange {
  switch (period) {
    case 'today': {
      const before = addDays(today, -7);
      return { from: today, to: today, compare: { from: before, to: before }, compareLabel: `vs last ${WEEKDAYS[dayOfWeek(today)]}` };
    }
    case 'yesterday': {
      const day = addDays(today, -1);
      const before = addDays(day, -7);
      return { from: day, to: day, compare: { from: before, to: before }, compareLabel: `vs the ${WEEKDAYS[dayOfWeek(day)]} before` };
    }
    case 'last7':
      return {
        from: addDays(today, -6),
        to: today,
        compare: { from: addDays(today, -13), to: addDays(today, -7) },
        compareLabel: 'vs the 7 days before',
      };
    case 'thisWeek': {
      const monday = mondayOf(today);
      return {
        from: monday,
        to: today,
        compare: { from: addDays(monday, -7), to: addDays(today, -7) },
        compareLabel: 'vs the same days last week',
      };
    }
    case 'lastWeek': {
      const monday = addDays(mondayOf(today), -7);
      return {
        from: monday,
        to: addDays(monday, 6),
        compare: { from: addDays(monday, -7), to: addDays(monday, -1) },
        compareLabel: 'vs the week before',
      };
    }
    case 'thisMonth': {
      const first = monthStart(today);
      const previous = addMonths(first, -1);
      const sameDay = earlier(addDays(previous, Number(today.slice(8, 10)) - 1), monthEnd(previous));
      return { from: first, to: today, compare: { from: previous, to: sameDay }, compareLabel: 'vs the same days last month' };
    }
    case 'lastMonth': {
      const first = addMonths(monthStart(today), -1);
      const before = addMonths(first, -1);
      return {
        from: first,
        to: monthEnd(first),
        compare: { from: before, to: monthEnd(before) },
        compareLabel: `vs ${MONTHS[Number(before.slice(5, 7)) - 1]}`,
      };
    }
    case 'thisYear': {
      const lastYear = String(Number(today.slice(0, 4)) - 1);
      const sameDay = lastYear + today.slice(4);
      return {
        from: today.slice(0, 4) + '-01-01',
        to: today,
        compare: { from: lastYear + '-01-01', to: sameDay.endsWith('-02-29') ? lastYear + '-02-28' : sameDay },
        compareLabel: 'vs the same days last year',
      };
    }
  }
}

/** Every date from `from` to `to`, inclusive. */
export function datesIn(range: Range): string[] {
  const out: string[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface SalesDay {
  date: string;
  revenue_total: number | null;
  revenue_breakfast: number | null;
  revenue_lunch: number | null;
  revenue_dinner: number | null;
  covers_total: number | null;
  orders_total: number | null;
}

export const SALES_DAY_COLUMNS = 'date, revenue_total, revenue_breakfast, revenue_lunch, revenue_dinner, covers_total, orders_total';

export interface ProductTotal {
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  days: number;
}

export interface SalesData {
  period: Period;
  range: PeriodRange;
  days: SalesDay[];
  compareDays: SalesDay[];
  /** Days in the period that have a product mix report */
  productDays: number;
  products: ProductTotal[];
}

export function totals(days: SalesDay[]) {
  const sum = (key: keyof Omit<SalesDay, 'date'>) => days.reduce((s, d) => s + (Number(d[key]) || 0), 0);
  return {
    revenue: sum('revenue_total'),
    breakfast: sum('revenue_breakfast'),
    lunch: sum('revenue_lunch'),
    dinner: sum('revenue_dinner'),
    orders: sum('orders_total'),
    guests: sum('covers_total'),
  };
}

export function money(n: number, cents = false): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
}

export function shortDate(date: string, withWeekday = true): string {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(withWeekday ? { weekday: 'short' } : {}),
  });
}

export function rangeLabel(range: Range): string {
  if (range.from === range.to) return shortDate(range.from);
  const year = range.from.slice(0, 4) !== range.to.slice(0, 4);
  return `${shortDate(range.from, !year)} – ${shortDate(range.to, !year)}`;
}
