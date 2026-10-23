import Link from 'next/link';
import { AlertTriangle, Check, ChevronRight, Moon, Sun, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { openMissing, stageCounts, type PurchaseOrder } from '@/lib/purchasing';
import { arubaNow, formatTime, isActive, toMinutes, type Reservation } from '@/lib/reservations';
import { businessDate, formatClock, isLate, runsOn, type Checklist } from '@/lib/checklists';
import { getSessionInfo } from '@/lib/roles';
import { can, type Permission } from '@/lib/permissions';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface TodayShift {
  id: string;
  start_time: string;
  end_time: string;
  shift_type: 'morning' | 'evening';
  team_members: { name: string; department: string } | null;
}

function shortTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'p' : 'a';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
}

function Card({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block bg-white border border-neutral-200 rounded-xl p-4 hover:border-neutral-400 transition">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-medium">{title}</h2>
        <ChevronRight size={16} strokeWidth={1.75} className="text-neutral-400" />
      </div>
      {children}
    </Link>
  );
}

export default async function TodayPage() {
  const supabase = createClient();
  // The server runs in UTC; "today" is Aruba's day
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Aruba' }));
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const checklistDay = businessDate();
  // Each card only for those who can open that part of the dashboard
  const session = await getSessionInfo().catch(() => null);
  const show = (p: Permission) => can(session?.perms, p);
  const [
    { data: orders },
    { data: shifts },
    { data: tasks, count: openTasks },
    { data: bookings, error: bookingsError },
    { data: lists, error: listsError },
    { data: listItems },
    { data: listChecks },
  ] = await Promise.all([
    supabase.from('purchase_orders').select('*'),
    supabase
      .from('shifts')
      .select('id, start_time, end_time, shift_type, team_members(name, department)')
      .eq('date', today)
      .order('start_time'),
    supabase
      .from('tasks')
      .select('id, title, due_date', { count: 'exact' })
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(3),
    supabase
      .from('reservations')
      .select('id, time, party_size, name, status')
      .eq('date', today)
      .order('time'),
    supabase.from('checklists').select('id, name, department, days, due_time, sort, active').order('sort'),
    supabase.from('checklist_items').select('id, checklist_id, active'),
    supabase.from('checklist_checks').select('item_id, checked_at').eq('date', checklistDay),
  ]);

  const allOrders = (orders ?? []) as PurchaseOrder[];
  const issues = openMissing(allOrders);
  const { toSend, waiting } = stageCounts(allOrders);
  const todayShifts = (shifts ?? []) as unknown as TodayShift[];
  const byKitchenLast = (a: TodayShift, b: TodayShift) =>
    (a.team_members?.department === 'kitchen' ? 1 : 0) - (b.team_members?.department === 'kitchen' ? 1 : 0);
  const morning = todayShifts.filter((s) => s.shift_type === 'morning').sort(byKitchenLast);
  const evening = todayShifts.filter((s) => s.shift_type === 'evening').sort(byKitchenLast);

  // Reservations card (hidden until supabase/reservations.sql has been run)
  const todayBookings = ((bookings ?? []) as Pick<Reservation, 'id' | 'time' | 'party_size' | 'name' | 'status'>[]).filter(isActive);
  const bookedGuests = todayBookings.reduce((sum, r) => sum + r.party_size, 0);
  const nowMinutes = arubaNow().minutes;
  const upcoming = todayBookings
    .filter((r) => r.status === 'confirmed' && toMinutes(r.time) >= nowMinutes - 30)
    .slice(0, 3);

  // Checklists card (hidden until supabase/checklists.sql has been run)
  const checkedAt = new Map((listChecks ?? []).map((c) => [c.item_id as string, c.checked_at as string]));
  const listStatus = ((lists ?? []) as Checklist[])
    .filter((l) => runsOn(l, checklistDay))
    .map((l) => {
      const ids = (listItems ?? []).filter((i) => i.checklist_id === l.id && (i.active || checkedAt.has(i.id))).map((i) => i.id as string);
      const done = ids.length > 0 && ids.every((id) => checkedAt.has(id));
      const finished = done ? ids.map((id) => checkedAt.get(id)!).sort().pop() : undefined;
      return { list: l, total: ids.length, checked: ids.filter((id) => checkedAt.has(id)).length, done, finished, late: isLate(l, checklistDay, done) };
    });

  const stats = [
    { label: 'To send', value: toSend, tone: 'text-amber-700' },
    { label: 'On the way', value: waiting, tone: 'text-blue-700' },
    { label: 'Missing', value: issues.length, tone: 'text-red-700' },
  ];

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="font-display text-3xl">Today</h1>
      </header>

      {show('purchasing') && issues.length > 0 && (
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 mb-4 text-sm hover:bg-red-100 transition"
        >
          <AlertTriangle size={16} strokeWidth={2} className="shrink-0" />
          <span className="flex-1">
            {issues.length === 1
              ? `${issues[0].supplierName} delivery was missing items`
              : `${issues.length} deliveries had missing items`}
          </span>
          <ChevronRight size={16} strokeWidth={1.75} className="shrink-0" />
        </Link>
      )}

      <div className="space-y-4">
        {show('reservations') && !bookingsError && (
          <Card title="Reservations" href="/dashboard/reservations">
            {todayBookings.length === 0 ? (
              <p className="text-sm text-neutral-500">No bookings today.</p>
            ) : (
              <>
                <p className="text-sm text-neutral-600 mb-2">
                  {todayBookings.length} {todayBookings.length === 1 ? 'booking' : 'bookings'} · {bookedGuests} {bookedGuests === 1 ? 'guest' : 'guests'}
                </p>
                {upcoming.length === 0 ? (
                  <p className="text-xs text-neutral-400">No more arrivals expected today.</p>
                ) : (
                  <ul className="space-y-1">
                    {upcoming.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 text-sm">
                        <span className="w-[68px] shrink-0 font-medium tabular-nums">{formatTime(r.time)}</span>
                        <span className="flex-1 min-w-0 truncate">{r.name}</span>
                        <span className="flex items-center gap-1 text-neutral-500 tabular-nums">
                          <Users size={13} />
                          {r.party_size}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        )}

        {show('checklists') && !listsError && listStatus.length > 0 && (
          <Card title="Checklists" href="/dashboard/checklists">
            <ul className="space-y-1.5">
              {listStatus.map((s) => (
                <li key={s.list.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{s.list.name}</span>
                  {s.done ? (
                    <span className="flex items-center gap-1 text-emerald-700 shrink-0">
                      <Check size={14} strokeWidth={2.5} />
                      {s.finished && formatClock(s.finished)}
                    </span>
                  ) : (
                    <span className={cn('tabular-nums shrink-0', s.late ? 'text-amber-700 font-medium' : 'text-neutral-500')}>
                      {s.late && 'Late · '}
                      {s.checked}/{s.total}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {show('purchasing') && (
          <Card title="Orders" href="/dashboard/orders">
            <div className="grid grid-cols-3 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="bg-neutral-50 rounded-lg py-3 text-center">
                  <p className={cn('text-2xl font-semibold tabular-nums', s.value > 0 ? s.tone : 'text-neutral-300')}>{s.value}</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {show('schedule') && (
          <Card title="Working today" href="/dashboard/schedule">
            {todayShifts.length === 0 ? (
              <p className="text-sm text-neutral-500">Nobody is scheduled today.</p>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Morning', list: morning, icon: <Sun size={14} className="text-amber-500" /> },
                  { label: 'Evening', list: evening, icon: <Moon size={14} className="text-indigo-400" /> },
                ].filter((g) => g.list.length > 0).map((g) => (
                  <div key={g.label}>
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-neutral-400 mb-1.5">{g.icon}{g.label}</p>
                    <ul className="space-y-1">
                      {g.list.map((s) => (
                        <li key={s.id} className="flex items-center justify-between text-sm">
                          <span className={s.team_members?.department === 'kitchen' ? 'text-orange-700' : 'text-blue-700'}>
                            {s.team_members?.name ?? '—'}
                          </span>
                          <span className="text-neutral-500 tabular-nums">{shortTime(s.start_time)}–{shortTime(s.end_time)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {show('tasks') && (
          <Card title="Tasks" href="/dashboard/tasks">
            {!openTasks ? (
              <p className="text-sm text-neutral-500">No open tasks.</p>
            ) : (
              <>
                <ul className="space-y-1.5 mb-2">
                  {(tasks ?? []).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{t.title}</span>
                      {t.due_date && (
                        <span className="text-xs text-neutral-500 shrink-0">
                          {new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {openTasks > 3 && <p className="text-xs text-neutral-400">+ {openTasks - 3} more</p>}
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
