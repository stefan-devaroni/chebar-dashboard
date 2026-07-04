'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, UserPlus, X, Sun, Moon } from 'lucide-react';

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

  const todayStr = new Date().toISOString().split('T')[0];

  const fohMembers = members.filter((m) => m.department !== 'kitchen');
  const kitchenMembers = members.filter((m) => m.department === 'kitchen');

  function isScheduled(memberId: string, date: string, type: 'morning' | 'evening') {
    return shifts.some(
      (s) => s.team_member_id === memberId && s.date === date && s.shift_type === type
    );
  }

  function getScheduledMembers(date: string, type: 'morning' | 'evening', dept: 'foh' | 'kitchen') {
    const deptMembers = dept === 'kitchen' ? kitchenMembers : fohMembers;
    return deptMembers.filter((m) => isScheduled(m.id, date, type));
  }

  function getUnscheduledMembers(date: string, type: 'morning' | 'evening', dept: 'foh' | 'kitchen') {
    const deptMembers = dept === 'kitchen' ? kitchenMembers : fohMembers;
    return deptMembers.filter((m) => !isScheduled(m.id, date, type));
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
          {/* Day cards — horizontal scroll on mobile, grid on desktop */}
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-7 pb-2 snap-x snap-mandatory">
            {weekDates.map((date, i) => {
              const d = new Date(date + 'T00:00:00');
              const isToday = date === todayStr;
              const amFoh = getScheduledMembers(date, 'morning', 'foh');
              const amKitchen = getScheduledMembers(date, 'morning', 'kitchen');
              const pmFoh = getScheduledMembers(date, 'evening', 'foh');
              const pmKitchen = getScheduledMembers(date, 'evening', 'kitchen');
              const unschedAMFoh = getUnscheduledMembers(date, 'morning', 'foh');
              const unschedAMKitchen = getUnscheduledMembers(date, 'morning', 'kitchen');
              const unschedPMFoh = getUnscheduledMembers(date, 'evening', 'foh');
              const unschedPMKitchen = getUnscheduledMembers(date, 'evening', 'kitchen');

              return (
                <div
                  key={date}
                  className={cn(
                    'min-w-[260px] sm:min-w-0 snap-start rounded-xl border flex flex-col',
                    isToday
                      ? 'border-gold/60 bg-gold/5 ring-1 ring-gold/20'
                      : 'border-neutral-200 bg-white'
                  )}
                >
                  {/* Day header */}
                  <div className={cn(
                    'px-3 py-2.5 text-center border-b',
                    isToday ? 'border-gold/20' : 'border-neutral-100'
                  )}>
                    <p className="text-[10px] uppercase tracking-widest text-neutral-400">{DAYS[i]}</p>
                    <p className={cn(
                      'text-lg font-display',
                      isToday ? 'text-gold' : 'text-ink'
                    )}>
                      {d.getDate()}
                    </p>
                  </div>

                  {/* AM section */}
                  <div className="px-2.5 pt-2.5 pb-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sun size={11} className="text-amber-500" />
                      <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">AM</span>
                      <span className="text-[10px] text-neutral-300 ml-auto">{amFoh.length + amKitchen.length}</span>
                    </div>

                    {/* Scheduled staff */}
                    <div className="flex flex-wrap gap-1 mb-1">
                      {amFoh.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => toggleShift(m.id, date, 'morning')}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition"
                        >
                          {m.name}
                        </button>
                      ))}
                      {amKitchen.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => toggleShift(m.id, date, 'morning')}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition"
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>

                    {/* Unscheduled staff — dimmed, tap to add */}
                    <div className="flex flex-wrap gap-1">
                      {unschedAMFoh.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => toggleShift(m.id, date, 'morning')}
                          className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-blue-200 text-blue-300 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition"
                        >
                          {m.name}
                        </button>
                      ))}
                      {unschedAMKitchen.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => toggleShift(m.id, date, 'morning')}
                          className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-orange-200 text-orange-300 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50 transition"
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="mx-2.5 border-t border-dashed border-neutral-200" />

                  {/* PM section */}
                  <div className="px-2.5 pt-2 pb-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Moon size={11} className="text-indigo-400" />
                      <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">PM</span>
                      <span className="text-[10px] text-neutral-300 ml-auto">{pmFoh.length + pmKitchen.length}</span>
                    </div>

                    {/* Scheduled staff */}
                    <div className="flex flex-wrap gap-1 mb-1">
                      {pmFoh.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => toggleShift(m.id, date, 'evening')}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition"
                        >
                          {m.name}
                        </button>
                      ))}
                      {pmKitchen.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => toggleShift(m.id, date, 'evening')}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition"
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>

                    {/* Unscheduled staff — dimmed, tap to add */}
                    <div className="flex flex-wrap gap-1">
                      {unschedPMFoh.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => toggleShift(m.id, date, 'evening')}
                          className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-blue-200 text-blue-300 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition"
                        >
                          {m.name}
                        </button>
                      ))}
                      {unschedPMKitchen.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => toggleShift(m.id, date, 'evening')}
                          className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-orange-200 text-orange-300 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50 transition"
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-[10px] text-neutral-400">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="uppercase tracking-widest">FOH</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="uppercase tracking-widest">Kitchen</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-full border border-dashed border-neutral-300" />
              <span className="uppercase tracking-widest">Tap to add</span>
            </div>
          </div>
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
