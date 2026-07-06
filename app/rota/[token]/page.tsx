import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAFF_TOKEN } from '@/lib/staff-token';

export const dynamic = 'force-dynamic';

const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Server may run in UTC — always compute "now" in Aruba time
function arubaNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Aruba' }));
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return m === '00' ? `${h12} ${ampm}` : `${h12}:${m} ${ampm}`;
}

interface ShiftRow {
  id: string;
  team_member_id: string;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: 'morning' | 'evening';
  team_members: { id: string; name: string; department: string } | null;
}

export default async function StaffSchedulePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { w?: string };
}) {
  if (params.token !== STAFF_TOKEN) notFound();

  const weekOffset = parseInt(searchParams.w ?? '0') || 0;

  const today = arubaNow();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = formatDate(monday);
  const sundayStr = formatDate(sunday);
  const todayStr = formatDate(today);

  const supabase = createClient();
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, team_members(id, name, department)')
    .gte('date', mondayStr)
    .lte('date', sundayStr)
    .order('start_time');

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return formatDate(d);
  });

  const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  function sortByDept(a: ShiftRow, b: ShiftRow) {
    const dA = a.team_members?.department === 'kitchen' ? 1 : 0;
    const dB = b.team_members?.department === 'kitchen' ? 1 : 0;
    return dA - dB;
  }

  function renderShift(s: ShiftRow, evening = false) {
    const isKitchen = s.team_members?.department === 'kitchen';
    return (
      <div
        key={s.id}
        className={cn(
          'flex items-center justify-between rounded-lg px-3 py-2',
          isKitchen
            ? evening ? 'bg-orange-100' : 'bg-orange-50'
            : evening ? 'bg-blue-100' : 'bg-blue-50'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            isKitchen
              ? evening ? 'bg-orange-500' : 'bg-orange-400'
              : evening ? 'bg-blue-500' : 'bg-blue-400'
          )} />
          <span className={cn(
            'text-sm font-medium truncate',
            isKitchen
              ? evening ? 'text-orange-800' : 'text-orange-700'
              : evening ? 'text-blue-800' : 'text-blue-700'
          )}>
            {s.team_members?.name ?? '?'}
          </span>
        </div>
        <span className={cn(
          'text-xs shrink-0 ml-2',
          isKitchen
            ? evening ? 'text-orange-600' : 'text-orange-500'
            : evening ? 'text-blue-600' : 'text-blue-500'
        )}>
          {formatTime(s.start_time)} – {formatTime(s.end_time)}
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="max-w-lg mx-auto px-4 py-6">
        <header className="text-center mb-6">
          <h1 className="font-display text-2xl tracking-wide">CHE BAR</h1>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-0.5">Staff schedule</p>
        </header>

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href={`/rota/${STAFF_TOKEN}?w=${weekOffset - 1}`}
            className="p-2 rounded-lg bg-white border border-neutral-200 hover:border-neutral-400 transition"
          >
            <ChevronLeft size={18} strokeWidth={1.5} />
          </Link>
          <div className="text-center">
            <h2 className="font-display text-lg">{weekLabel}</h2>
            {weekOffset !== 0 ? (
              <Link href={`/rota/${STAFF_TOKEN}`} className="text-[10px] uppercase tracking-widest text-gold">
                Back to this week
              </Link>
            ) : (
              <p className="text-[10px] uppercase tracking-widest text-neutral-400">This week</p>
            )}
          </div>
          <Link
            href={`/rota/${STAFF_TOKEN}?w=${weekOffset + 1}`}
            className="p-2 rounded-lg bg-white border border-neutral-200 hover:border-neutral-400 transition"
          >
            <ChevronRight size={18} strokeWidth={1.5} />
          </Link>
        </div>

        {/* Days */}
        <div className="space-y-3">
          {weekDates.map((date, i) => {
            const d = new Date(date + 'T00:00:00');
            const isToday = date === todayStr;
            const dayShifts = ((shifts ?? []) as ShiftRow[]).filter((s) => s.date === date);
            const morning = dayShifts.filter((s) => s.shift_type === 'morning').sort(sortByDept);
            const evening = dayShifts.filter((s) => s.shift_type === 'evening').sort(sortByDept);

            return (
              <div
                key={date}
                className={cn(
                  'rounded-xl border p-4',
                  isToday ? 'border-gold/60 bg-gold/5 ring-1 ring-gold/20' : 'border-neutral-200 bg-white'
                )}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className={cn('font-display text-base', isToday && 'text-gold')}>
                    {DAYS_FULL[i]}
                    {isToday && <span className="text-[9px] uppercase tracking-widest ml-2">Today</span>}
                  </h3>
                  <span className="text-xs text-neutral-400">
                    {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {dayShifts.length === 0 ? (
                  <p className="text-xs text-neutral-300 italic">No shifts scheduled</p>
                ) : (
                  <div className="space-y-2">
                    {morning.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sun size={12} className="text-amber-400" />
                          <span className="text-[9px] uppercase tracking-widest text-neutral-400">Morning</span>
                        </div>
                        <div className="space-y-1">{morning.map((s) => renderShift(s))}</div>
                      </div>
                    )}
                    {evening.length > 0 && (
                      <div className="rounded-lg bg-indigo-100/60 border border-indigo-200/60 p-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Moon size={12} className="text-indigo-500" />
                          <span className="text-[9px] uppercase tracking-widest text-indigo-500">Evening</span>
                        </div>
                        <div className="space-y-1">{evening.map((s) => renderShift(s, true))}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <footer className="text-center mt-8 pb-4">
          <p className="text-[10px] text-neutral-400">
            Questions about your shifts? Ask your manager.
          </p>
        </footer>
      </div>
    </div>
  );
}
