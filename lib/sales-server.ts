import { createClient } from '@/lib/supabase/server';
import { periodRange, SALES_DAY_COLUMNS, type Period, type ProductTotal, type SalesData, type SalesDay } from '@/lib/sales';

// Loads one period of the Sales tab: the daily totals, the days it is compared with, and the
// product mix summed per product (product_sales_summary RPC, migration supabase/sales.sql).

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

function toDay(row: Record<string, unknown>): SalesDay {
  return {
    date: String(row.date),
    revenue_total: num(row.revenue_total),
    revenue_breakfast: num(row.revenue_breakfast),
    revenue_lunch: num(row.revenue_lunch),
    revenue_dinner: num(row.revenue_dinner),
    covers_total: num(row.covers_total),
    orders_total: num(row.orders_total),
  };
}

export async function loadSales(supabase: ReturnType<typeof createClient>, period: Period, today: string): Promise<SalesData> {
  const range = periodRange(period, today);
  const days = (from: string, to: string) =>
    supabase.from('daily_metrics').select(SALES_DAY_COLUMNS).gte('date', from).lte('date', to).order('date');

  const [current, compare, products, productDays] = await Promise.all([
    days(range.from, range.to),
    days(range.compare.from, range.compare.to),
    supabase.rpc('product_sales_summary', { p_from: range.from, p_to: range.to }),
    supabase.rpc('product_mix_days', { p_from: range.from, p_to: range.to }),
  ]);
  const error = current.error ?? compare.error ?? products.error ?? productDays.error;
  if (error) throw new Error(error.message);

  return {
    period,
    range,
    days: (current.data ?? []).map(toDay),
    compareDays: (compare.data ?? []).map(toDay),
    productDays: Number(productDays.data) || 0,
    products: ((products.data ?? []) as Record<string, unknown>[]).map(
      (p): ProductTotal => ({
        name: String(p.name),
        category: String(p.category ?? ''),
        quantity: Number(p.quantity) || 0,
        revenue: Number(p.revenue) || 0,
        days: Number(p.days) || 0,
      })
    ),
  };
}
