'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, UserPlus, UserMinus, X, Sun, Moon, Clock, CalendarDays, Calendar, AlertTriangle } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  department: string;
  active: boolean;
}

interface Shift {
  id: string;
  team_member_id: string;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: 'morning' | 'evening';
}

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const PRESET_SHIFTS = [
  { label: '7:30–3', start: '07:30', end: '15:00', type: 'morning' as const },
  { label: '8–3', start: '08:00', end: '15:00', type: 'morning' as const },
  { label: '9–1', start: '09:00', end: '13:00', type: 'morning' as const },
  { label: '3–11', start: '15:00', end: '23:00', type: 'evening' as const },
  { label: '5–11', start: '17:00', end: '23:00', type: 'evening' as const },
  { label: '6–11', start: '18:00', end: '23:00', type: 'evening' as const },
];

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatShortTime(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'p' : 'a';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return m === '00' ? `${h12}${ampm}` : `${h12}:${m}${ampm}`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return m === '00' ? `${h12} ${ampm}` : `${h12}:${m} ${ampm}`;
}

export function WeeklySchedule({
  initialShifts,
  members: initialMembers,
  initialWeekStart,
}: {
  initialShifts: Shift[];
  members: TeamMember[];
  initialWeekStart: string;
}) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [loading, setLoading] = useState(false);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<{ start: string; end: string; type: 'morning' | 'evening' } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customStart, setCustomStart] = useState('07:30');
  const [customEnd, setCustomEnd] = useState('15:00');

  const [showAddMember, setShowAddMember] = useState(false);
  const [removeMode, setRemoveMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState<'foh' | 'kitchen'>('foh');

  const [view, setView] = useState<'day' | 'week'>('day');
  const [dayIndex, setDayIndex] = useState(() => {
    const today = new Date();
    const dow = today.getDay();
    return (dow + 6) % 7; // 0=Mon .. 6=Sun
  });

  const monday = getMonday(weekStart);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return formatDate(d);
  });

  const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(weekDates[6] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  async function navigateWeek(delta: number) {
    const newMonday = new Date(monday);
    newMonday.setDate(monday.getDate() + delta * 7);
    const newStart = formatDate(newMonday);
    setWeekStart(newStart);
    setLoading(true);

    const res = await fetch(`/api/shifts?weekStart=${newStart}`);
    if (res.ok) {
      const data = await res.json();
      setShifts(data);
    }
    setLoading(false);
  }

  function navigateDay(delta: number) {
    const newIdx = dayIndex + delta;
    if (newIdx < 0) {
      navigateWeek(-1);
      setDayIndex(6);
    } else if (newIdx > 6) {
      navigateWeek(1);
      setDayIndex(0);
    } else {
      setDayIndex(newIdx);
    }
  }

  async function createShift(memberId: string, date: string, shift: { start: string; end: string; type: 'morning' | 'evening' }) {
    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_member_id: memberId,
        date,
        start_time: shift.start,
        end_time: shift.end,
        shift_type: shift.type,
      }),
    });
    if (res.ok) {
      const newShift = await res.json();
      setShifts((prev) => [...prev, newShift]);
    }
  }

  function handleSelectDate(date: string) {
    if (selectedMemberId && selectedShift) {
      createShift(selectedMemberId, date, selectedShift);
    } else {
      setSelectedDate(selectedDate === date ? null : date);
    }
  }

  function handleSelectMember(id: string) {
    const newId = selectedMemberId === id ? null : id;
    setSelectedMemberId(newId);
    if (newId && selectedShift && selectedDate) {
      createShift(newId, selectedDate, selectedShift);
      setSelectedDate(null);
    }
  }

  function handleSelectShift(shift: { start: string; end: string; type: 'morning' | 'evening' }) {
    setSelectedShift(shift);
    setCustomMode(false);
    if (selectedMemberId && selectedDate) {
      createShift(selectedMemberId, selectedDate, shift);
      setSelectedDate(null);
    }
  }

  async function removeShift(id: string) {
    setShifts((prev) => prev.filter((s) => s.id !== id));
    await fetch('/api/shifts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  async function addMember() {
    if (!newName.trim()) return;
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), department: newDept }),
    });
    if (res.ok) {
      const member = await res.json();
      setMembers((prev) => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setShowAddMember(false);
    }
  }

  async function removeMember(id: string) {
    if (selectedMemberId === id) setSelectedMemberId(null);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setShifts((prev) => prev.filter((s) => s.team_member_id !== id));
    await fetch('/api/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const fohMembers = members.filter((m) => m.department !== 'kitchen');
  const kitchenMembers = members.filter((m) => m.department === 'kitchen');

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const readyToAssign = selectedMemberId !== null && selectedShift !== null;

  function getMemberName(memberId: string) {
    return members.find((m) => m.id === memberId)?.name ?? '?';
  }

  function getMemberDept(memberId: string) {
    return members.find((m) => m.id === memberId)?.department ?? 'foh';
  }

  function sortByDept(a: Shift, b: Shift) {
    const dA = getMemberDept(a.team_member_id) === 'kitchen' ? 1 : 0;
    const dB = getMemberDept(b.team_member_id) === 'kitchen' ? 1 : 0;
    return dA - dB;
  }

  function selectPresetShift(preset: typeof PRESET_SHIFTS[0]) {
    handleSelectShift({ start: preset.start, end: preset.end, type: preset.type });
  }

  function applyCustomShift() {
    const hour = parseInt(customStart.split(':')[0]);
    const type = hour < 15 ? 'morning' : 'evening';
    handleSelectShift({ start: customStart, end: customEnd, type: type as 'morning' | 'evening' });
  }

  // Day view data
  const currentDayDate = weekDates[dayIndex];
  const currentDay = new Date(currentDayDate + 'T00:00:00');
  const dayShiftsForView = shifts.filter((s) => s.date === currentDayDate);
  const dayMorning = dayShiftsForView.filter((s) => s.shift_type === 'morning').sort(sortByDept);
  const dayEvening = dayShiftsForView.filter((s) => s.shift_type === 'evening').sort(sortByDept);
  const isDayToday = currentDayDate === todayStr;

  // Monthly Sunday shifts for the "one Sunday off per month" check
  const [monthlySundayShifts, setMonthlySundayShifts] = useState<Shift[]>([]);
  const currentMonth = monday.getMonth();
  const currentYear = monday.getFullYear();

  useEffect(() => {
    const firstOfMonth = new Date(currentYear, currentMonth, 1);
    const lastOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const monthStart = formatDate(firstOfMonth);
    const monthEnd = formatDate(lastOfMonth);
    // Find all Sundays in this month
    fetch(`/api/shifts?weekStart=${monthStart}&weekEnd=${monthEnd}`)
      .then(r => r.ok ? r.json() : [])
      .then((allShifts: Shift[]) => {
        const sundays: string[] = [];
        const d = new Date(firstOfMonth);
        while (d <= lastOfMonth) {
          if (d.getDay() === 0) sundays.push(formatDate(d));
          d.setDate(d.getDate() + 1);
        }
        setMonthlySundayShifts(allShifts.filter((s: Shift) => sundays.includes(s.date)));
      })
      .catch(() => {});
  }, [currentMonth, currentYear]);

  // Schedule warnings
  interface Warning {
    type: 'overlap' | 'hours' | 'no-day-off' | 'sunday';
    severity: 'error' | 'warn';
    message: string;
  }

  const warnings = useMemo<Warning[]>(() => {
    const w: Warning[] = [];
    const activeMembers = members.filter(m => m.active !== false);

    function timeToMin(t: string) {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }

    for (const member of activeMembers) {
      const memberShifts = shifts.filter(s => s.team_member_id === member.id);

      // 1. Overlapping shifts on same day
      const byDate: Record<string, Shift[]> = {};
      for (const s of memberShifts) {
        (byDate[s.date] ??= []).push(s);
      }
      for (const [date, dayS] of Object.entries(byDate)) {
        for (let i = 0; i < dayS.length; i++) {
          for (let j = i + 1; j < dayS.length; j++) {
            const a = dayS[i], b = dayS[j];
            if (timeToMin(a.start_time) < timeToMin(b.end_time) && timeToMin(b.start_time) < timeToMin(a.end_time)) {
              const d = new Date(date + 'T00:00:00');
              w.push({
                type: 'overlap',
                severity: 'error',
                message: `${member.name} has overlapping shifts on ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
              });
            }
          }
        }
      }

      // 2. Over 45 hours/week
      let totalMin = 0;
      for (const s of memberShifts) {
        totalMin += timeToMin(s.end_time) - timeToMin(s.start_time);
      }
      const totalHrs = Math.round(totalMin / 60 * 10) / 10;
      if (totalHrs > 45) {
        w.push({
          type: 'hours',
          severity: 'warn',
          message: `${member.name} is at ${totalHrs}h this week (max 45h)`,
        });
      }

      // 3. Scheduled 7 days (no day off)
      const daysWorked = new Set(memberShifts.map(s => s.date));
      if (daysWorked.size === 7) {
        w.push({
          type: 'no-day-off',
          severity: 'error',
          message: `${member.name} has no day off this week`,
        });
      }

      // 4. No Sunday off this month
      const firstOfMo = new Date(currentYear, currentMonth, 1);
      const lastOfMo = new Date(currentYear, currentMonth + 1, 0);
      const sundaysInMonth: string[] = [];
      const sd = new Date(firstOfMo);
      while (sd <= lastOfMo) {
        if (sd.getDay() === 0) sundaysInMonth.push(formatDate(sd));
        sd.setDate(sd.getDate() + 1);
      }
      if (sundaysInMonth.length > 0) {
        const sundayShiftsForMember = monthlySundayShifts.filter(s => s.team_member_id === member.id);
        const sundaysWorked = new Set(sundayShiftsForMember.map(s => s.date));
        if (sundaysWorked.size === sundaysInMonth.length) {
          const monthName = firstOfMo.toLocaleDateString('en-US', { month: 'long' });
          w.push({
            type: 'sunday',
            severity: 'error',
            message: `${member.name} has no Sunday off in ${monthName}`,
          });
        }
      }
    }

    return w;
  }, [shifts, members, monthlySundayShifts, currentMonth, currentYear]);

  function renderShiftRow(s: Shift) {
    const isKitchen = getMemberDept(s.team_member_id) === 'kitchen';
    return (
      <div
        key={s.id}
        className={cn(
          'flex items-center justify-between rounded-lg px-3 py-2',
          isKitchen ? 'bg-orange-50' : 'bg-blue-50'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', isKitchen ? 'bg-orange-400' : 'bg-blue-400')} />
          <span className={cn('text-sm font-medium truncate', isKitchen ? 'text-orange-700' : 'text-blue-700')}>
            {getMemberName(s.team_member_id)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('text-xs', isKitchen ? 'text-orange-500' : 'text-blue-500')}>
            {formatTime(s.start_time)} – {formatTime(s.end_time)}
          </span>
          <button
            onClick={() => removeShift(s.id)}
            className="text-neutral-300 hover:text-red-500 active:text-red-500 transition"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* View toggle */}
      <div className="flex mb-4 max-w-xs mx-auto sm:max-w-[200px] sm:mx-0 sm:ml-auto">
        <div className="flex bg-neutral-100 rounded-lg p-0.5 w-full">
          <button
            onClick={() => setView('day')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition',
              view === 'day' ? 'bg-white text-ink shadow-sm' : 'text-neutral-500'
            )}
          >
            <Calendar size={13} strokeWidth={1.5} />
            Day
          </button>
          <button
            onClick={() => setView('week')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition',
              view === 'week' ? 'bg-white text-ink shadow-sm' : 'text-neutral-500'
            )}
          >
            <CalendarDays size={13} strokeWidth={1.5} />
            Week
          </button>
        </div>
      </div>

      {/* Week navigation — week view only */}
      {view === 'week' && (
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigateWeek(-1)} className="p-2 rounded hover:bg-white transition shrink-0">
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <div className="text-center min-w-0">
            <h2 className="font-display text-base sm:text-xl truncate">{weekLabel}</h2>
            <button
              onClick={() => {
                const today = new Date();
                const mon = new Date(today);
                mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
                const newStart = formatDate(mon);
                setWeekStart(newStart);
                setDayIndex((today.getDay() + 6) % 7);
                navigateWeek(0);
              }}
              className="text-[10px] text-neutral-500 hover:text-ink transition uppercase tracking-widest mt-0.5"
            >
              Today
            </button>
          </div>
          <button onClick={() => navigateWeek(1)} className="p-2 rounded hover:bg-white transition shrink-0">
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Day navigation — day view only */}
      {view === 'day' && (
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigateDay(-1)} className="p-2 rounded hover:bg-white transition shrink-0">
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <div className="text-center">
            <h2 className={cn('font-display text-lg sm:text-xl', isDayToday && 'text-gold')}>
              {DAYS_FULL[dayIndex]}
            </h2>
            <p className="text-xs text-neutral-400">
              {currentDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button onClick={() => navigateDay(1)} className="p-2 rounded hover:bg-white transition shrink-0">
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Schedule warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm',
                w.severity === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
              )}
            >
              <AlertTriangle size={14} className={cn('shrink-0', w.severity === 'error' ? 'text-red-500' : 'text-amber-500')} />
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Assignment hint */}
      {readyToAssign && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 text-xs sm:text-sm text-blue-800 flex items-center gap-2">
          <span>
            Tap {view === 'day' ? '"Add to this day"' : 'a day'} to add <strong>{selectedMember?.name}</strong> to <strong>{formatShortTime(selectedShift!.start)}–{formatShortTime(selectedShift!.end)}</strong>
          </span>
          <button
            onClick={() => { setSelectedMemberId(null); setSelectedShift(null); setSelectedDate(null); }}
            className="ml-auto text-blue-500 hover:text-blue-700 text-[10px] uppercase tracking-widest shrink-0"
          >
            Cancel
          </button>
        </div>
      )}
      {selectedDate && !readyToAssign && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 text-xs sm:text-sm text-blue-800 flex items-center gap-2">
          <span>
            <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong> selected
            {selectedMemberId && !selectedShift && ' — now pick a shift'}
            {!selectedMemberId && ' — now pick a team member'}
          </span>
          <button
            onClick={() => { setSelectedMemberId(null); setSelectedShift(null); setSelectedDate(null); }}
            className="ml-auto text-blue-500 hover:text-blue-700 text-[10px] uppercase tracking-widest shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ===== DAY VIEW ===== */}
      {view === 'day' && (
      <div className={cn('max-w-lg mx-auto', loading && 'opacity-50')}>
        <div className={cn(
          'rounded-xl border p-4',
          isDayToday ? 'border-gold/60 bg-gold/5 ring-1 ring-gold/20' : 'border-neutral-200 bg-white'
        )}>
          {/* Add to this day button */}
          {readyToAssign && (
            <button
              onClick={() => handleSelectDate(currentDayDate)}
              className="w-full mb-3 py-2.5 bg-blue-500 text-white rounded-lg text-xs font-medium uppercase tracking-widest active:bg-blue-600 transition"
            >
              Add {selectedMember?.name} to this day
            </button>
          )}

          {dayShiftsForView.length === 0 && (
            <p className="text-sm text-neutral-400 italic text-center py-6">No shifts scheduled</p>
          )}

          {/* Morning */}
          {dayMorning.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sun size={13} className="text-amber-400" />
                <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">Morning</span>
              </div>
              <div className="space-y-1.5">
                {dayMorning.map(renderShiftRow)}
              </div>
            </div>
          )}

          {/* Divider */}
          {dayMorning.length > 0 && dayEvening.length > 0 && (
            <div className="border-t border-dashed border-neutral-200 my-3" />
          )}

          {/* Evening */}
          {dayEvening.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Moon size={13} className="text-indigo-400" />
                <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">Evening</span>
              </div>
              <div className="space-y-1.5">
                {dayEvening.map(renderShiftRow)}
              </div>
            </div>
          )}
        </div>

        {/* Day dots — quick day switcher */}
        <div className="flex justify-center gap-1 mt-3">
          {weekDates.map((date, i) => {
            const hasShifts = shifts.some((s) => s.date === date);
            return (
              <button
                key={date}
                onClick={() => setDayIndex(i)}
                className={cn(
                  'w-8 h-8 rounded-full text-[10px] font-medium transition flex items-center justify-center',
                  i === dayIndex
                    ? 'bg-ink text-cream'
                    : date === todayStr
                      ? 'bg-gold/10 text-gold border border-gold/30'
                      : hasShifts
                        ? 'bg-neutral-100 text-ink'
                        : 'text-neutral-400'
                )}
              >
                {DAYS_SHORT[i].charAt(0)}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* ===== WEEK VIEW ===== */}
      {view === 'week' && (
      <div className={cn('transition-opacity', loading && 'opacity-50')}>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDates.map((date, i) => {
            const d = new Date(date + 'T00:00:00');
            const isToday = date === todayStr;
            const dayShifts = shifts.filter((s) => s.date === date);
            const morningShifts = dayShifts.filter((s) => s.shift_type === 'morning').sort(sortByDept);
            const eveningShifts = dayShifts.filter((s) => s.shift_type === 'evening').sort(sortByDept);

            const isDateSelected = selectedDate === date;
            return (
              <div
                key={date}
                className={cn(
                  'rounded-lg sm:rounded-xl border flex flex-col transition min-w-0',
                  isDateSelected
                    ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-300'
                    : isToday
                      ? 'border-gold/60 bg-gold/5 ring-1 ring-gold/20'
                      : 'border-neutral-200 bg-white',
                )}
              >
                {/* Day header — click to switch to day view */}
                <div
                  onClick={() => { setDayIndex(i); setView('day'); }}
                  className={cn(
                    'px-1 sm:px-3 py-1.5 sm:py-2.5 text-center border-b cursor-pointer hover:bg-neutral-50 transition',
                    isToday ? 'border-gold/20' : 'border-neutral-100'
                  )}
                >
                  <p className="text-[8px] sm:text-[10px] uppercase tracking-wider sm:tracking-widest text-neutral-400">{DAYS_SHORT[i]}</p>
                  <p className={cn('text-sm sm:text-lg font-display', isToday ? 'text-gold' : 'text-ink')}>
                    {d.getDate()}
                  </p>
                </div>

                {/* Shift area — click to select date or assign */}
                <div
                  onClick={() => handleSelectDate(date)}
                  className={cn(
                    'px-0.5 sm:px-2 py-1 sm:py-2 flex-1 min-h-[48px] sm:min-h-[80px] cursor-pointer transition',
                    !isDateSelected && 'hover:bg-neutral-50/50 active:bg-blue-50'
                  )}
                >
                  {dayShifts.length === 0 && !selectedDate && !readyToAssign && (
                    <p className="text-[8px] sm:text-[10px] text-neutral-300 italic text-center mt-2 sm:mt-4">—</p>
                  )}
                  {dayShifts.length === 0 && (selectedDate || readyToAssign) && (
                    <p className="text-[8px] sm:text-[10px] text-blue-300 text-center mt-2 sm:mt-4">+</p>
                  )}

                  {morningShifts.length > 0 && (
                    <div className="mb-1">
                      <div className="flex items-center justify-center gap-0.5 mb-0.5">
                        <Sun size={7} className="text-amber-400 sm:hidden" />
                        <Sun size={9} className="text-amber-400 hidden sm:block" />
                      </div>
                      <div className="space-y-px">
                        {morningShifts.map((s) => (
                          <div
                            key={s.id}
                            className={cn(
                              'flex items-center rounded px-0.5 sm:px-1.5 py-px sm:py-0.5 text-[7px] sm:text-[10px] group',
                              getMemberDept(s.team_member_id) === 'kitchen'
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-blue-50 text-blue-700'
                            )}
                          >
                            <span className="truncate flex-1 leading-tight">{getMemberName(s.team_member_id)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeShift(s.id); }}
                              className="text-neutral-400 hover:text-red-500 active:text-red-500 transition shrink-0 ml-0.5 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <X size={8} strokeWidth={2} className="sm:hidden" />
                              <X size={10} strokeWidth={2} className="hidden sm:block" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {eveningShifts.length > 0 && (
                    <div>
                      {morningShifts.length > 0 && <div className="border-t border-dashed border-neutral-100 my-0.5" />}
                      <div className="flex items-center justify-center gap-0.5 mb-0.5">
                        <Moon size={7} className="text-indigo-400 sm:hidden" />
                        <Moon size={9} className="text-indigo-400 hidden sm:block" />
                      </div>
                      <div className="space-y-px">
                        {eveningShifts.map((s) => (
                          <div
                            key={s.id}
                            className={cn(
                              'flex items-center rounded px-0.5 sm:px-1.5 py-px sm:py-0.5 text-[7px] sm:text-[10px] group',
                              getMemberDept(s.team_member_id) === 'kitchen'
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-blue-50 text-blue-700'
                            )}
                          >
                            <span className="truncate flex-1 leading-tight">{getMemberName(s.team_member_id)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeShift(s.id); }}
                              className="text-neutral-400 hover:text-red-500 active:text-red-500 transition shrink-0 ml-0.5 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <X size={8} strokeWidth={2} className="sm:hidden" />
                              <X size={10} strokeWidth={2} className="hidden sm:block" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Step 1: Team members */}
      <div className="mt-4 sm:mt-6 bg-white border border-neutral-200 rounded-xl p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h3 className="text-[10px] sm:text-xs uppercase tracking-widest text-neutral-500 font-medium">1. Select team member</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setRemoveMode(!removeMode); setSelectedMemberId(null); setSelectedShift(null); setSelectedDate(null); }}
              className={cn(
                'flex items-center gap-1 text-[10px] uppercase tracking-widest transition',
                removeMode ? 'text-red-500' : 'text-neutral-400 hover:text-red-400'
              )}
            >
              <UserMinus size={10} strokeWidth={2} />
              {removeMode ? 'Done' : 'Remove'}
            </button>
            <button
              onClick={() => { setRemoveMode(false); setShowAddMember(true); }}
              className="flex items-center gap-1 text-[10px] text-gold hover:text-gold/80 uppercase tracking-widest transition"
            >
              <UserPlus size={10} strokeWidth={2} />
              Add
            </button>
          </div>
        </div>

        {removeMode && (
          <p className="text-[10px] text-red-400 mb-2">Tap a name to remove them</p>
        )}

        {fohMembers.length > 0 && (
          <div className="mb-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500" />
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-neutral-400">Front of House</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {fohMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => removeMode ? removeMember(m.id) : handleSelectMember(m.id)}
                  className={cn(
                    'text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full transition font-medium flex items-center gap-1',
                    removeMode
                      ? 'bg-red-50 text-red-600 border border-red-200 active:bg-red-100'
                      : selectedMemberId === m.id
                        ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                        : 'bg-blue-50 text-blue-700 active:bg-blue-100'
                  )}
                >
                  {removeMode && <X size={10} strokeWidth={2} />}
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {kitchenMembers.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500" />
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-neutral-400">Kitchen</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {kitchenMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => removeMode ? removeMember(m.id) : handleSelectMember(m.id)}
                  className={cn(
                    'text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full transition font-medium flex items-center gap-1',
                    removeMode
                      ? 'bg-red-50 text-red-600 border border-red-200 active:bg-red-100'
                      : selectedMemberId === m.id
                        ? 'bg-orange-500 text-white ring-2 ring-orange-300'
                      : 'bg-orange-50 text-orange-700 active:bg-orange-100'
                  )}
                >
                  {removeMode && <X size={10} strokeWidth={2} />}
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Select shift */}
      <div className={cn(
        'mt-2 sm:mt-3 bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 transition-opacity',
        !selectedMemberId && 'opacity-40 pointer-events-none'
      )}>
        <h3 className="text-[10px] sm:text-xs uppercase tracking-widest text-neutral-500 font-medium mb-2 sm:mb-3">2. Select shift</h3>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-2 sm:mb-3">
          <div className="col-span-3 flex items-center gap-1.5 mb-0.5">
            <Sun size={11} className="text-amber-500" />
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-neutral-400">Morning</span>
          </div>
          {PRESET_SHIFTS.filter(s => s.type === 'morning').map((preset) => {
            const isSelected = selectedShift?.start === preset.start && selectedShift?.end === preset.end;
            return (
              <button
                key={preset.start + preset.end}
                onClick={() => selectPresetShift(preset)}
                className={cn(
                  'py-2 sm:py-2.5 px-1 sm:px-3 rounded-lg text-[11px] sm:text-xs font-medium transition text-center',
                  isSelected
                    ? 'bg-ink text-cream ring-2 ring-neutral-400'
                    : 'border border-neutral-200 active:bg-neutral-100'
                )}
              >
                {preset.label}
              </button>
            );
          })}

          <div className="col-span-3 flex items-center gap-1.5 mt-1.5 sm:mt-2 mb-0.5">
            <Moon size={11} className="text-indigo-400" />
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-neutral-400">Evening</span>
          </div>
          {PRESET_SHIFTS.filter(s => s.type === 'evening').map((preset) => {
            const isSelected = selectedShift?.start === preset.start && selectedShift?.end === preset.end;
            return (
              <button
                key={preset.start + preset.end}
                onClick={() => selectPresetShift(preset)}
                className={cn(
                  'py-2 sm:py-2.5 px-1 sm:px-3 rounded-lg text-[11px] sm:text-xs font-medium transition text-center',
                  isSelected
                    ? 'bg-ink text-cream ring-2 ring-neutral-400'
                    : 'border border-neutral-200 active:bg-neutral-100'
                )}
              >
                {preset.label}
              </button>
            );
          })}

          <div className="col-span-3 mt-1.5 sm:mt-2">
            {!customMode ? (
              <button
                onClick={() => setCustomMode(true)}
                className="flex items-center gap-1.5 text-[11px] sm:text-xs text-neutral-500 hover:text-ink transition"
              >
                <Clock size={12} strokeWidth={1.5} />
                Custom shift
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-neutral-200 rounded text-xs focus:outline-none focus:border-gold w-[100px]"
                />
                <span className="text-xs text-neutral-400">to</span>
                <input
                  type="time"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-neutral-200 rounded text-xs focus:outline-none focus:border-gold w-[100px]"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={applyCustomShift}
                    className="px-3 py-1.5 bg-ink text-cream rounded text-[10px] uppercase tracking-widest hover:bg-neutral-800 transition"
                  >
                    Set
                  </button>
                  <button
                    onClick={() => setCustomMode(false)}
                    className="p-1.5 text-neutral-400 hover:text-ink transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 3 hint */}
      {readyToAssign && (
        <div className="mt-2 sm:mt-3 text-center">
          <p className="text-[11px] sm:text-xs text-neutral-500">
            3. {view === 'day' ? <>Tap &quot;Add to this day&quot; above</> : <>Tap a day above</>} to assign <strong>{selectedMember?.name}</strong>
          </p>
        </div>
      )}

      {/* Add team member modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-ink/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4" onClick={() => setShowAddMember(false)}>
          <div
            className="bg-cream border border-neutral-200 rounded-xl w-full max-w-sm p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">Add team member</h2>
              <button onClick={() => setShowAddMember(false)} className="text-neutral-400 hover:text-ink transition">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Maria"
                  className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && addMember()}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Department</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewDept('foh')}
                    className={cn(
                      'flex-1 py-2.5 text-xs uppercase tracking-widest rounded transition',
                      newDept === 'foh' ? 'bg-blue-500 text-white' : 'border border-neutral-200 hover:bg-white'
                    )}
                  >
                    Front of House
                  </button>
                  <button
                    onClick={() => setNewDept('kitchen')}
                    className={cn(
                      'flex-1 py-2.5 text-xs uppercase tracking-widest rounded transition',
                      newDept === 'kitchen' ? 'bg-orange-500 text-white' : 'border border-neutral-200 hover:bg-white'
                    )}
                  >
                    Kitchen
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={addMember}
                  disabled={!newName.trim()}
                  className="flex-1 bg-ink text-cream py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddMember(false)}
                  className="px-5 py-2.5 border border-neutral-300 rounded text-xs uppercase tracking-widest hover:bg-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
