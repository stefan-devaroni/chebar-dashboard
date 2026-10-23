import type { SupabaseClient } from '@supabase/supabase-js';

// Revel's two report exports (CSV, Oct 2026), read exactly; used by the email intake and for back-filling.
// - Sales Summary: one row per business day (6 AM to 6 AM): "Time From" = "01/01/2026 06:00 AM",
//   "Net Sales", "Total Orders", "Total Number Of People", ... and a final Total row.
// - Product Mix (Daily): row 0 holds the day labels ("Thu 01/01/2026") above pairs of Quantity/Total
//   columns; row 1 the headers Class, Name, SKU, Barcode, Category, Subcategory, Quantity, Total, ...
//   A one-day export without the day row takes its date from the file name
//   (Product_Mix_2026-10-21_06-00_2026-10-22_06-00.csv).
// Per day, the product totals add up exactly to the summary's "Total Product Sales" (before discounts).

export interface RevelSalesDay {
  date: string;
  netSales: number;
  orders: number;
  guests: number;
}

export interface RevelProductLine {
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

export type RevelReport =
  | { kind: 'sales_summary'; days: RevelSalesDay[] }
  | { kind: 'product_mix'; days: { date: string; items: RevelProductLine[] }[] };

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** "01/01/2026 06:00 AM" or "Thu 01/01/2026" -> "2026-01-01" */
function usDate(s: string | undefined): string | null {
  const m = String(s ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

const amount = (s: string | undefined) => {
  const n = parseFloat(String(s ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** The business day of a one-day export, from a file name like …_2026-10-21_06-00_2026-10-22_06-00.csv */
function dayFromFileName(fileName: string): string | null {
  const m = fileName.match(/(\d{4}-\d{2}-\d{2})_\d{2}-\d{2}_(\d{4}-\d{2}-\d{2})_\d{2}-\d{2}/);
  if (!m) return null;
  const next = new Date(m[1] + 'T00:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10) === m[2] ? m[1] : null;
}

export function readRevelCsv(text: string, fileName: string): RevelReport | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;

  const head = rows[0];
  if (head.includes('Time From') && head.includes('Net Sales')) {
    const col = (name: string) => head.indexOf(name);
    const [from, net, orders, people] = [col('Time From'), col('Net Sales'), col('Total Orders'), col('Total Number Of People')];
    const days: RevelSalesDay[] = [];
    for (const r of rows.slice(1)) {
      const date = usDate(r[from]);
      if (!date) continue; // the Total row
      days.push({ date, netSales: amount(r[net]), orders: orders >= 0 ? amount(r[orders]) : 0, guests: people >= 0 ? amount(r[people]) : 0 });
    }
    return days.length ? { kind: 'sales_summary', days } : null;
  }

  const headerRow = rows.findIndex((r, i) => i < 3 && r[0] === 'Class' && r[1] === 'Name' && r.includes('Quantity'));
  if (headerRow < 0) return null;
  const headers = rows[headerRow];
  const dayRow = headerRow > 0 ? rows[headerRow - 1] : null;
  const fileDay = dayFromFileName(fileName);
  const pairs: { date: string; qty: number }[] = [];
  headers.forEach((h, i) => {
    if (h !== 'Quantity' || headers[i + 1] !== 'Total') return;
    const date = usDate(dayRow?.[i]) ?? fileDay;
    if (date) pairs.push({ date, qty: i });
  });
  const category = headers.indexOf('Category');

  const days = pairs.map(({ date, qty }) => {
    const items: RevelProductLine[] = [];
    for (const r of rows.slice(headerRow + 1)) {
      const name = (r[1] ?? '').trim();
      const quantity = amount(r[qty]);
      const revenue = amount(r[qty + 1]);
      if (!name || (!quantity && !revenue)) continue;
      items.push({ name, category: (r[category] || r[0] || '').trim(), quantity, revenue });
    }
    return { date, items };
  });
  return days.some((d) => d.items.length) ? { kind: 'product_mix', days: days.filter((d) => d.items.length) } : null;
}

export interface SavedReport {
  firstDate: string | null;
  lastDate: string | null;
  records: number;
  summary: string;
  errors: string[];
}

/** Writes a Revel report: daily totals into daily_metrics, item lines into product_sales (one day at a time). */
export async function saveRevelReport(
  supabase: SupabaseClient,
  report: RevelReport,
  { source, ingestionId }: { source: string; ingestionId?: string }
): Promise<SavedReport> {
  const dates = report.days.map((d) => d.date).sort();
  const errors: string[] = [];
  let records = 0;
  let summary = '';

  if (report.kind === 'sales_summary') {
    for (let i = 0; i < report.days.length; i += 200) {
      const chunk = report.days.slice(i, i + 200).map((d) => ({
        date: d.date,
        revenue_total: d.netSales,
        orders_total: Math.round(d.orders),
        covers_total: Math.round(d.guests),
        entered_by: source,
      }));
      const { error } = await supabase.from('daily_metrics').upsert(chunk, { onConflict: 'date' });
      if (error) errors.push(error.message);
      else records += chunk.length;
    }
    const net = report.days.reduce((s, d) => s + d.netSales, 0);
    const orders = report.days.reduce((s, d) => s + d.orders, 0);
    summary = `${report.days.length} day${report.days.length === 1 ? '' : 's'} (${dates[0]} to ${dates[dates.length - 1]}): $${net.toFixed(2)} net sales, ${orders} orders`;
  } else {
    const queue = [...report.days];
    const worker = async () => {
      for (let day = queue.shift(); day; day = queue.shift()) {
        const { data, error } = await supabase.rpc('replace_product_sales', { p_date: day.date, p_items: day.items, p_ingestion: ingestionId ?? null });
        if (error) errors.push(`${day.date}: ${error.message}`);
        else records += Number(data) || 0;
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));
    const totals = new Map<string, { quantity: number; revenue: number }>();
    for (const day of report.days)
      for (const item of day.items) {
        const t = totals.get(item.name) ?? { quantity: 0, revenue: 0 };
        totals.set(item.name, { quantity: t.quantity + item.quantity, revenue: t.revenue + item.revenue });
      }
    summary =
      'Top 10 items:\n' +
      [...totals.entries()]
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10)
        .map(([name, t]) => `${name}: ${t.quantity} sold, $${t.revenue.toFixed(0)}`)
        .join('\n');
  }

  return { firstDate: dates[0] ?? null, lastDate: dates[dates.length - 1] ?? null, records, summary, errors };
}
