'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface DailyMetric {
  id: string;
  date: string;
  revenue_total: number | null;
  revenue_breakfast: number | null;
  revenue_lunch: number | null;
  revenue_dinner: number | null;
  covers_total: number | null;
  covers_breakfast: number | null;
  covers_lunch: number | null;
  covers_dinner: number | null;
  labor_cost: number | null;
  music_night: boolean;
  musician_name: string | null;
  musician_fee: number | null;
  notes: string | null;
  entered_by: string | null;
}

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  revenue_breakfast: '',
  revenue_lunch: '',
  revenue_dinner: '',
  covers_breakfast: '',
  covers_lunch: '',
  covers_dinner: '',
  labor_cost: '',
  notes: '',
};

export function MetricsClient({ initialData }: { initialData: DailyMetric[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const rb = parseFloat(form.revenue_breakfast) || 0;
    const rl = parseFloat(form.revenue_lunch) || 0;
    const rd = parseFloat(form.revenue_dinner) || 0;

    const { error: err } = await supabase.from('daily_metrics').upsert(
      {
        date: form.date,
        revenue_breakfast: rb || null,
        revenue_lunch: rl || null,
        revenue_dinner: rd || null,
        revenue_total: rb + rl + rd || null,
        covers_breakfast: parseInt(form.covers_breakfast) || null,
        covers_lunch: parseInt(form.covers_lunch) || null,
        covers_dinner: parseInt(form.covers_dinner) || null,
        covers_total:
          (parseInt(form.covers_breakfast) || 0) +
          (parseInt(form.covers_lunch) || 0) +
          (parseInt(form.covers_dinner) || 0) || null,
        labor_cost: parseFloat(form.labor_cost) || null,
        notes: form.notes || null,
      },
      { onConflict: 'date' }
    );

    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      setForm(emptyForm);
      router.refresh();
    }
  }

  const chartData = initialData.map((m) => ({
    date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Breakfast: m.revenue_breakfast ?? 0,
    Lunch: m.revenue_lunch ?? 0,
    Dinner: m.revenue_dinner ?? 0,
  }));

  return (
    <div className="space-y-10">
      {/* Entry form */}
      <section className="bg-white border border-neutral-200 rounded p-6">
        <h2 className="font-display text-xl mb-5">Log daily revenue</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            <Field label="Date" name="date" type="date" value={form.date} onChange={handleChange} />
            <Field label="Breakfast $" name="revenue_breakfast" type="number" value={form.revenue_breakfast} onChange={handleChange} placeholder="0.00" />
            <Field label="Lunch $" name="revenue_lunch" type="number" value={form.revenue_lunch} onChange={handleChange} placeholder="0.00" />
            <Field label="Dinner $" name="revenue_dinner" type="number" value={form.revenue_dinner} onChange={handleChange} placeholder="0.00" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Field label="Breakfast covers" name="covers_breakfast" type="number" value={form.covers_breakfast} onChange={handleChange} placeholder="0" />
            <Field label="Lunch covers" name="covers_lunch" type="number" value={form.covers_lunch} onChange={handleChange} placeholder="0" />
            <Field label="Dinner covers" name="covers_dinner" type="number" value={form.covers_dinner} onChange={handleChange} placeholder="0" />
            <Field label="Labor cost $" name="labor_cost" type="number" value={form.labor_cost} onChange={handleChange} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold resize-none"
              placeholder="Any notes about the day..."
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-ink text-cream px-6 py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {error && <p className="text-sm text-red-700">{error}</p>}
            {success && <p className="text-sm text-gold">Saved.</p>}
          </div>
        </form>
      </section>

      {/* Chart */}
      <section className="bg-white border border-neutral-200 rounded p-6">
        <h2 className="font-display text-xl mb-5">Revenue — last 30 days</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-10">
            No data yet. Log your first day above.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(0)}`, undefined]}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e5e5' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Breakfast" stackId="rev" fill="#d4a45c" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Lunch" stackId="rev" fill="#1a1a1a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Dinner" stackId="rev" fill="#7c6f5b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
        {label}
      </label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step={type === 'number' ? '0.01' : undefined}
        className="w-full px-3 py-2 bg-cream border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
      />
    </div>
  );
}
