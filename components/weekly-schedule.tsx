'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  color: string;
  role: string;
  department?: string;
}

interface Shift {
  id: string;
  team_member_id: string;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  notes: string | null;
  team_members: { id: string; name: string; color: string; department?: string };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEPT_COLORS: Record<string, string> = {
  foh: '#4f8cff',
  kitchen: '#e6884b',
};

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function WeeklySchedule({
  initialShifts,
  members,
  initialWeekStart,
}: {
  initialShifts: Shift[];
  members: TeamMember[];
  initialWeekStart: string;
}) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [loading, setLoading] = useState(false);
  const [showAddShift, setShowAddShift] = useState<string | null>(null);

  const monday = getMonday(weekStart);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return formatDate(d);
  });

  const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(weekDates[6] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  async function navigateWeek(delta: number) {
    const newMonday = new Date(monday);
    newMonday.setDate(monday.getDate() + delta * 7);
    const newStart = formatDate(newMonday);
    setWeekStart(newStart);
    setLoading(true);

    const sunday = new Date(newMonday);
    sunday.setDate(newMonday.getDate() + 6);

    const res = await fetch(`/api/shifts?weekStart=${newStart}`);
    if (res.ok) {
      const data = await res.json();
      setShifts(data);
    }
    setLoading(false);
  }

  async function addShift(date: string, memberId: string, startTime: string, endTime: string) {
    const shiftType = parseInt(startTime.split(':')[0]) < 14 ? 'morning' : 'evening';
    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_member_id: memberId,
        date,
        start_time: startTime,
        end_time: endTime,
        shift_type: shiftType,
      }),
    });
    if (res.ok) {
      const shift = await res.json();
      setShifts((prev) => [...prev, shift]);
    }
    setShowAddShift(null);
  }

  async function deleteShift(id: string) {
    const res = await fetch('/api/shifts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setShifts((prev) => prev.filter((s) => s.id !== id));
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-2 rounded hover:bg-white transition"
        >
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>
        <div className="text-center">
          <h2 className="font-display text-xl">{weekLabel}</h2>
          <button
            onClick={() => {
              const today = new Date();
              const mon = new Date(today);
              mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
              setWeekStart(formatDate(mon));
              navigateWeek(0);
            }}
            className="text-xs text-neutral-500 hover:text-ink transition uppercase tracking-widest mt-1"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => navigateWeek(1)}
          className="p-2 rounded hover:bg-white transition"
        >
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      </div>

      {members.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded p-10 text-center">
          <p className="text-sm text-neutral-500">
            Add team members on the{' '}
            <a href="/dashboard/team" className="text-gold hover:underline">Team page</a>
            {' '}first, then come back here to set up shifts.
          </p>
        </div>
      ) : (
        <div className={cn('transition-opacity', loading && 'opacity-50')}>
          {/* Calendar grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-neutral-200 border border-neutral-200 rounded overflow-hidden">
            {/* Header row */}
            {weekDates.map((date, i) => {
              const d = new Date(date + 'T00:00:00');
              const isToday = date === todayStr;
              return (
                <div
                  key={date}
                  className={cn(
                    'bg-white px-2 py-3 text-center',
                    isToday && 'bg-gold/10'
                  )}
                >
                  <p className="text-xs uppercase tracking-widest text-neutral-500">{DAYS[i]}</p>
                  <p className={cn(
                    'text-lg font-display mt-0.5',
                    isToday && 'text-gold'
                  )}>
                    {d.getDate()}
                  </p>
                </div>
              );
            })}

            {/* Shift cells */}
            {weekDates.map((date) => {
              const dayShifts = shifts.filter((s) => s.date === date);
              const fohShifts = dayShifts.filter((s) => (s.team_members.department || 'foh') === 'foh');
              const kitchenShifts = dayShifts.filter((s) => (s.team_members.department || 'foh') === 'kitchen');
              const isToday = date === todayStr;

              const renderDeptShifts = (deptShifts: Shift[]) => {
                const morning = deptShifts.filter((s) => s.shift_type === 'morning');
                const evening = deptShifts.filter((s) => s.shift_type === 'evening');
                return (
                  <>
                    {morning.map((s) => (
                      <ShiftPill key={s.id} shift={s} onDelete={deleteShift} />
                    ))}
                    {evening.map((s) => (
                      <ShiftPill key={s.id} shift={s} onDelete={deleteShift} />
                    ))}
                  </>
                );
              };

              return (
                <div
                  key={`cell-${date}`}
                  className={cn(
                    'bg-white p-2 min-h-[160px] flex flex-col',
                    isToday && 'bg-gold/5'
                  )}
                >
                  <div className="mb-1">
                    <p className="text-[9px] uppercase tracking-widest text-neutral-400 mb-0.5">🍸 FOH</p>
                    {fohShifts.length > 0 ? renderDeptShifts(fohShifts) : (
                      <p className="text-[9px] text-neutral-300 italic">—</p>
                    )}
                  </div>
                  <div className="border-t border-dashed border-neutral-200 pt-1 mb-1">
                    <p className="text-[9px] uppercase tracking-widest text-neutral-400 mb-0.5">🔪 Kitchen</p>
                    {kitchenShifts.length > 0 ? renderDeptShifts(kitchenShifts) : (
                      <p className="text-[9px] text-neutral-300 italic">—</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAddShift(date)}
                    className="mt-auto text-[10px] text-neutral-400 hover:text-ink flex items-center gap-0.5 transition py-1"
                  >
                    <Plus size={10} strokeWidth={2} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DEPT_COLORS.foh }} />
                <p className="text-[10px] uppercase tracking-widest text-neutral-400">Front of House</p>
              </div>
              <div className="flex flex-wrap gap-2 pl-[18px]">
                {members.filter((m) => (m.department || 'foh') === 'foh').map((m) => (
                  <span key={m.id} className="text-xs text-neutral-600">{m.name}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DEPT_COLORS.kitchen }} />
                <p className="text-[10px] uppercase tracking-widest text-neutral-400">Kitchen</p>
              </div>
              <div className="flex flex-wrap gap-2 pl-[18px]">
                {members.filter((m) => m.department === 'kitchen').map((m) => (
                  <span key={m.id} className="text-xs text-neutral-600">{m.name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add shift modal */}
      {showAddShift && (
        <AddShiftModal
          date={showAddShift}
          members={members}
          onClose={() => setShowAddShift(null)}
          onAdd={addShift}
        />
      )}
    </div>
  );
}

function ShiftPill({ shift, onDelete }: { shift: Shift; onDelete: (id: string) => void }) {
  const deptColor = DEPT_COLORS[shift.team_members.department || 'foh'] || DEPT_COLORS.foh;
  return (
    <div
      className="group/pill flex items-center gap-1 rounded px-1.5 py-1 text-[11px] mb-0.5"
      style={{ backgroundColor: deptColor + '20' }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: deptColor }}
      />
      <span className="truncate flex-1" style={{ color: deptColor }}>
        {shift.team_members.name}
      </span>
      <span className="text-[9px] text-neutral-500 shrink-0">
        {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(shift.id); }}
        className="opacity-0 group-hover/pill:opacity-100 text-neutral-400 hover:text-red-500 transition shrink-0"
      >
        <X size={10} strokeWidth={2} />
      </button>
    </div>
  );
}

function AddShiftModal({
  date,
  members,
  onClose,
  onAdd,
}: {
  date: string;
  members: TeamMember[];
  onClose: () => void;
  onAdd: (date: string, memberId: string, startTime: string, endTime: string) => void;
}) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? '');
  const [preset, setPreset] = useState<'morning' | 'evening' | 'custom'>('morning');
  const [startTime, setStartTime] = useState('07:30');
  const [endTime, setEndTime] = useState('15:00');

  function applyPreset(p: 'morning' | 'evening' | 'custom') {
    setPreset(p);
    if (p === 'morning') { setStartTime('07:30'); setEndTime('15:00'); }
    if (p === 'evening') { setStartTime('15:00'); setEndTime('23:00'); }
  }

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-cream border border-neutral-200 rounded-lg w-full max-w-sm p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">Add shift</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-ink transition">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <p className="text-sm text-neutral-600 mb-4">{dateLabel}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Employee</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Shift</label>
            <div className="flex gap-1">
              {(['morning', 'evening', 'custom'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'flex-1 py-2 text-xs uppercase tracking-widest rounded transition',
                    preset === p ? 'bg-ink text-cream' : 'border border-neutral-200 hover:bg-white'
                  )}
                >
                  {p === 'morning' ? '7:30–3 PM' : p === 'evening' ? '3–11 PM' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Start</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">End</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onAdd(date, memberId, startTime, endTime)}
              className="flex-1 bg-ink text-cream py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition"
            >
              Add shift
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-neutral-300 rounded text-xs uppercase tracking-widest hover:bg-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
