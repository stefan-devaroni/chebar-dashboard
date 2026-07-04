'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, X, UserPlus } from 'lucide-react';

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
  shift_type: 'morning' | 'evening';
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
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
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState<'foh' | 'kitchen'>('foh');

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

    const res = await fetch(`/api/shifts?weekStart=${newStart}`);
    if (res.ok) {
      const data = await res.json();
      setShifts(data);
    }
    setLoading(false);
  }

  const toggleShift = useCallback(async (memberId: string, date: string, shiftType: 'morning' | 'evening') => {
    const existing = shifts.find(
      (s) => s.team_member_id === memberId && s.date === date && s.shift_type === shiftType
    );

    if (existing) {
      setShifts((prev) => prev.filter((s) => s.id !== existing.id));
      await fetch('/api/shifts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existing.id }),
      });
    } else {
      const startTime = shiftType === 'morning' ? '07:30' : '17:00';
      const endTime = shiftType === 'morning' ? '15:00' : '23:00';
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
    }
  }, [shifts]);

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

  function hasShift(memberId: string, date: string, type: 'morning' | 'evening') {
    return shifts.some(
      (s) => s.team_member_id === memberId && s.date === date && s.shift_type === type
    );
  }

  function renderMemberRows(deptMembers: TeamMember[]) {
    return deptMembers.map((member) => (
      <div key={member.id} className="contents">
        {/* Name cell */}
        <div className="bg-white px-2 py-2 flex items-center min-w-0 border-b border-neutral-100 sticky left-0 z-10">
          <span className="text-xs truncate">{member.name}</span>
        </div>
        {/* Day cells */}
        {weekDates.map((date) => {
          const am = hasShift(member.id, date, 'morning');
          const pm = hasShift(member.id, date, 'evening');
          const isToday = date === todayStr;
          return (
            <div
              key={date}
              className={cn(
                'bg-white border-b border-neutral-100 px-0.5 py-1.5 flex flex-col items-center gap-0.5',
                isToday && 'bg-gold/5'
              )}
            >
              <button
                onClick={() => toggleShift(member.id, date, 'morning')}
                className={cn(
                  'w-full text-[10px] py-1 rounded transition font-medium',
                  am
                    ? 'bg-blue-500 text-white'
                    : 'text-neutral-300 hover:bg-neutral-100'
                )}
              >
                AM
              </button>
              <button
                onClick={() => toggleShift(member.id, date, 'evening')}
                className={cn(
                  'w-full text-[10px] py-1 rounded transition font-medium',
                  pm
                    ? 'bg-indigo-500 text-white'
                    : 'text-neutral-300 hover:bg-neutral-100'
                )}
              >
                PM
              </button>
            </div>
          );
        })}
      </div>
    ));
  }

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
              const newStart = formatDate(mon);
              setWeekStart(newStart);
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

      {/* Add team member button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAddMember(true)}
          className="flex items-center gap-1.5 bg-ink text-cream px-3 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition"
        >
          <UserPlus size={12} strokeWidth={2} />
          Add team member
        </button>
      </div>

      {members.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded p-10 text-center">
          <p className="text-sm text-neutral-500">
            Add your first team member to start building the schedule.
          </p>
        </div>
      ) : (
        <div className={cn('transition-opacity', loading && 'opacity-50')}>
          {/* Schedule grid — scrollable on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="min-w-[600px]">
              {/* FOH section */}
              {fohMembers.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-medium">Front of House</h3>
                  </div>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <div className="grid group/row" style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
                      {/* Header */}
                      <div className="bg-neutral-50 px-2 py-2 text-xs text-neutral-400 uppercase tracking-widest sticky left-0 z-10">Name</div>
                      {weekDates.map((date, i) => {
                        const d = new Date(date + 'T00:00:00');
                        const isToday = date === todayStr;
                        return (
                          <div key={date} className={cn('bg-neutral-50 px-1 py-2 text-center', isToday && 'bg-gold/10')}>
                            <p className="text-[10px] uppercase tracking-widest text-neutral-400">{DAYS[i]}</p>
                            <p className={cn('text-sm font-display', isToday && 'text-gold')}>{d.getDate()}</p>
                          </div>
                        );
                      })}
                      {renderMemberRows(fohMembers)}
                    </div>
                  </div>
                </div>
              )}

              {/* Kitchen section */}
              {kitchenMembers.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-medium">Kitchen</h3>
                  </div>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <div className="grid group/row" style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
                      {/* Header */}
                      <div className="bg-neutral-50 px-2 py-2 text-xs text-neutral-400 uppercase tracking-widest sticky left-0 z-10">Name</div>
                      {weekDates.map((date, i) => {
                        const d = new Date(date + 'T00:00:00');
                        const isToday = date === todayStr;
                        return (
                          <div key={date} className={cn('bg-neutral-50 px-1 py-2 text-center', isToday && 'bg-gold/10')}>
                            <p className="text-[10px] uppercase tracking-widest text-neutral-400">{DAYS[i]}</p>
                            <p className={cn('text-sm font-display', isToday && 'text-gold')}>{d.getDate()}</p>
                          </div>
                        );
                      })}
                      {renderMemberRows(kitchenMembers)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Daily summary */}
          <div className="mt-4 grid grid-cols-7 gap-1">
            {weekDates.map((date, i) => {
              const dayShifts = shifts.filter((s) => s.date === date);
              const amCount = dayShifts.filter((s) => s.shift_type === 'morning').length;
              const pmCount = dayShifts.filter((s) => s.shift_type === 'evening').length;
              return (
                <div key={date} className="text-center">
                  <p className="text-[10px] text-neutral-400">{DAYS[i]}</p>
                  <p className="text-xs">
                    <span className="text-blue-600">{amCount}</span>
                    <span className="text-neutral-300"> / </span>
                    <span className="text-indigo-600">{pmCount}</span>
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-neutral-400 text-center mt-1">
            <span className="text-blue-600">AM</span> / <span className="text-indigo-600">PM</span> staff per day
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
