'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import {
  businessDate,
  DAY_LETTERS,
  DEPARTMENT_LABELS,
  formatClock,
  formatDue,
  isLate,
  runsOn,
  shiftDate,
  type Checklist,
  type ChecklistCheck,
  type ChecklistItem,
  type Department,
} from '@/lib/checklists';

type Role = 'manager' | 'employee';

interface Props {
  date: string;
  today: string;
  role: Role;
  myDepartment: Department;
  initialLists: Checklist[];
  initialItems: ChecklistItem[];
  initialChecks: ChecklistCheck[];
  setupNeeded: boolean;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const inputClass = 'w-full px-3 py-3 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold';
const labelClass = 'block text-xs uppercase tracking-wider text-neutral-500 mb-1.5';

// Business-day order: a 12:30 AM deadline sorts after 11 PM
const dueKey = (l: Checklist) => {
  if (!l.due_time) return 9999;
  const [h, m] = l.due_time.split(':').map(Number);
  return h * 60 + m + (h < 5 ? 1440 : 0);
};

function dayTitle(date: string, today: string) {
  if (date === today) return 'Today';
  if (date === shiftDate(today, -1)) return 'Yesterday';
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function daysText(days: number[]) {
  if (days.length === 7) return 'Every day';
  if (days.join() === '1,2,3,4,5') return 'Mon–Fri';
  if (days.join() === '0,6') return 'Weekends';
  return days.map((d) => DAY_NAMES[d]).join(', ');
}

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save. Check your connection and try again.');
  return data;
}

export function ChecklistsView({ date, today, role, myDepartment, initialLists, initialItems, initialChecks, setupNeeded }: Props) {
  const router = useRouter();
  const isManager = role === 'manager';
  const isToday = date === today;
  const [lists, setLists] = useState(initialLists);
  const [items, setItems] = useState(initialItems);
  const [checks, setChecks] = useState(initialChecks);
  const [editMode, setEditMode] = useState(false);
  const [listSheet, setListSheet] = useState<{ editing: Checklist | null } | null>(null);
  const [itemSheet, setItemSheet] = useState<ChecklistItem | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // New props arrive when a manager steps to another day
  useEffect(() => {
    setLists(initialLists);
    setItems(initialItems);
    setChecks(initialChecks);
  }, [initialLists, initialItems, initialChecks]);

  // Others tick items on their own phones: refresh every minute and when the
  // page comes back into view, and start fresh when the business day rolls over.
  useEffect(() => {
    if (!isToday) return;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      if (businessDate() !== today) {
        window.location.href = '/dashboard/checklists';
        return;
      }
      const res = await fetch('/api/checklists');
      if (!res.ok) return;
      const data = await res.json();
      setLists(data.lists);
      setItems(data.items);
      setChecks(data.checks);
    };
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [isToday, today]);

  const checkByItem = useMemo(() => new Map(checks.map((c) => [c.item_id, c])), [checks]);
  const itemsFor = (listId: string, includeRemovedChecked = true) =>
    items
      .filter((i) => i.checklist_id === listId && (i.active || (includeRemovedChecked && checkByItem.has(i.id))))
      .sort((a, b) => a.sort - b.sort);

  const isMine = (l: Checklist) => myDepartment === 'all' || l.department === 'all' || l.department === myDepartment;
  const todaysLists = lists
    .filter((l) => runsOn(l, date))
    .sort((a, b) => Number(isMine(b)) - Number(isMine(a)) || dueKey(a) - dueKey(b) || a.sort - b.sort);

  const summary = todaysLists.map((l) => {
    const its = itemsFor(l.id);
    const done = its.length > 0 && its.every((i) => checkByItem.has(i.id));
    const finishedAt = done ? its.map((i) => checkByItem.get(i.id)!.checked_at).sort().pop() : undefined;
    return { list: l, items: its, done, finishedAt, late: isLate(l, date, done) };
  });
  const doneCount = summary.filter((s) => s.done).length;
  const lateCount = summary.filter((s) => s.late).length;

  async function toggle(item: ChecklistItem) {
    if (!isToday || busy[item.id]) return;
    const previous = checkByItem.get(item.id);
    setBusy((b) => ({ ...b, [item.id]: true }));
    setChecks((cs) =>
      previous
        ? cs.filter((c) => c.item_id !== item.id)
        : [...cs, { id: 'pending', item_id: item.id, checklist_id: item.checklist_id, date, checked_by: 'You', checked_at: new Date().toISOString() }]
    );
    try {
      const data = await send('/api/checklists/check', 'POST', { itemId: item.id, checked: !previous, date });
      if (data.check) setChecks((cs) => cs.map((c) => (c.item_id === item.id ? data.check : c)));
    } catch (error) {
      setChecks((cs) => (previous ? [...cs.filter((c) => c.item_id !== item.id), previous] : cs.filter((c) => c.item_id !== item.id)));
      alert((error as Error).message);
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[item.id];
        return next;
      });
    }
  }

  // ---- manager editing ----
  async function saveList(patch: Partial<Checklist>, editing: Checklist | null) {
    const saved: Checklist = editing
      ? await send('/api/checklists', 'PUT', { id: editing.id, ...patch })
      : await send('/api/checklists', 'POST', patch);
    setLists((ls) => (editing ? ls.map((l) => (l.id === saved.id ? saved : l)) : [...ls, saved]));
  }

  async function addItem(listId: string, text: string) {
    const saved: ChecklistItem = await send('/api/checklists/items', 'POST', { checklist_id: listId, text });
    setItems((its) => [...its, saved]);
  }

  async function saveItem(item: ChecklistItem, patch: Partial<ChecklistItem>) {
    const saved: ChecklistItem = await send('/api/checklists/items', 'PUT', { id: item.id, ...patch });
    setItems((its) => its.map((i) => (i.id === saved.id ? saved : i)));
  }

  async function move(listId: string, index: number, direction: -1 | 1) {
    const ordered = itemsFor(listId, false);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const sortOf = new Map(ordered.map((i, n) => [i.id, n + 1]));
    setItems((its) => its.map((i) => (sortOf.has(i.id) ? { ...i, sort: sortOf.get(i.id)! } : i)));
    try {
      await send('/api/checklists/items', 'PUT', { order: ordered.map((i) => i.id) });
    } catch (error) {
      alert((error as Error).message);
    }
  }

  if (setupNeeded) {
    return (
      <>
        <h1 className="font-display text-3xl mb-6">Checklists</h1>
        <div className="bg-white border border-neutral-200 rounded-xl p-5 text-sm text-neutral-600">
          {isManager ? (
            <>
              <p className="font-medium text-ink mb-1">One-time setup needed</p>
              <p>
                Open Supabase → SQL Editor, paste the file <code className="text-xs bg-neutral-100 px-1 rounded">supabase/checklists.sql</code> and press
                Run. Then reload this page.
              </p>
            </>
          ) : (
            <p>Checklists aren&apos;t set up yet. Ask a manager.</p>
          )}
        </div>
      </>
    );
  }

  const longDate = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-3xl">Checklists</h1>
          <p className="text-sm text-neutral-500 mt-1">{editMode ? 'Edit your lists' : longDate}</p>
        </div>
        {isManager && (
          <button
            onClick={() => setEditMode((v) => !v)}
            className={cn(
              'shrink-0 px-4 h-11 rounded-xl text-sm font-medium border',
              editMode ? 'bg-ink text-cream border-ink' : 'bg-white border-neutral-200 text-neutral-700'
            )}
          >
            {editMode ? 'Done' : 'Edit lists'}
          </button>
        )}
      </header>

      {editMode ? (
        <EditLists
          lists={lists.filter((l) => l.active).sort((a, b) => dueKey(a) - dueKey(b) || a.sort - b.sort)}
          itemsFor={(id) => itemsFor(id, false)}
          onNewList={() => setListSheet({ editing: null })}
          onEditList={(l) => setListSheet({ editing: l })}
          onAddItem={addItem}
          onEditItem={setItemSheet}
          onMove={move}
        />
      ) : (
        <>
          {isManager && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => router.push(`/dashboard/checklists?date=${shiftDate(date, -1)}`)}
                aria-label="Previous day"
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-white border border-neutral-200"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 h-11 flex items-center justify-center rounded-xl bg-white border border-neutral-200 text-[15px] font-medium">
                {dayTitle(date, today)}
              </div>
              <button
                onClick={() => router.push(shiftDate(date, 1) >= today ? '/dashboard/checklists' : `/dashboard/checklists?date=${shiftDate(date, 1)}`)}
                disabled={isToday}
                aria-label="Next day"
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-white border border-neutral-200 disabled:opacity-40"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {summary.length > 0 && (
            <p className="text-sm text-neutral-600 px-1 mb-3">
              {doneCount} of {summary.length} done
              {lateCount > 0 && <span className="text-amber-700"> · {lateCount} late</span>}
              {!isToday && <span className="text-neutral-400"> · past day, read only</span>}
            </p>
          )}

          {summary.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">
              No checklists {isToday ? 'today' : 'that day'}.{isManager && ' Tap "Edit lists" to add one.'}
            </div>
          ) : (
            <div className="space-y-4">
              {summary.map(({ list, items: its, done, finishedAt, late }) => {
                const checkedCount = its.filter((i) => checkByItem.has(i.id)).length;
                const open = !done || expanded[list.id];
                return (
                  <section key={list.id} className={cn('bg-white border rounded-xl overflow-hidden', late ? 'border-amber-300' : 'border-neutral-200')}>
                    <button
                      onClick={() => done && setExpanded((e) => ({ ...e, [list.id]: !e[list.id] }))}
                      className={cn('w-full flex items-center gap-3 px-4 py-3.5 text-left', done && 'cursor-pointer')}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-[16px] font-medium">{list.name}</span>
                        <span className="block text-xs text-neutral-500 mt-0.5">
                          {DEPARTMENT_LABELS[list.department]}
                          {list.due_time && ` · by ${formatDue(list.due_time)}`}
                        </span>
                      </span>
                      {done ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">
                          <Check size={13} strokeWidth={3} />
                          Done {finishedAt && formatClock(finishedAt)}
                          <ChevronDown size={14} className={cn('transition', open && 'rotate-180')} />
                        </span>
                      ) : (
                        <span className={cn('text-sm font-medium tabular-nums shrink-0', late ? 'text-amber-700' : 'text-neutral-500')}>
                          {late && 'Late · '}
                          {checkedCount}/{its.length}
                        </span>
                      )}
                    </button>
                    <div className="h-1 bg-neutral-100">
                      <div
                        className={cn('h-full transition-all', done ? 'bg-emerald-500' : late ? 'bg-amber-400' : 'bg-gold')}
                        style={{ width: `${its.length ? (checkedCount / its.length) * 100 : 0}%` }}
                      />
                    </div>
                    {open && (
                      <ul className="divide-y divide-neutral-100">
                        {its.map((item) => {
                          const check = checkByItem.get(item.id);
                          return (
                            <li key={item.id}>
                              <button
                                onClick={() => toggle(item)}
                                disabled={!isToday}
                                className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left active:bg-neutral-50 disabled:cursor-default"
                              >
                                <span
                                  className={cn(
                                    'w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition',
                                    check ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-neutral-300'
                                  )}
                                >
                                  {check && <Check size={16} strokeWidth={3} />}
                                </span>
                                <span className={cn('flex-1 text-[15px] leading-snug', check && 'text-neutral-400 line-through')}>{item.text}</span>
                                {check ? (
                                  <span className="text-[11px] leading-tight text-neutral-400 text-right shrink-0">
                                    {check.checked_by}
                                    <br />
                                    {formatClock(check.checked_at)}
                                  </span>
                                ) : (
                                  !isToday && <span className="text-[11px] font-medium text-red-600 shrink-0">Missed</span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {listSheet && (
        <ListSheet
          editing={listSheet.editing}
          onClose={() => setListSheet(null)}
          onSave={async (patch) => {
            await saveList(patch, listSheet.editing);
            setListSheet(null);
          }}
          onRemove={
            listSheet.editing
              ? async () => {
                  await saveList({ active: false }, listSheet.editing);
                  setListSheet(null);
                }
              : undefined
          }
        />
      )}

      {itemSheet && (
        <ItemSheet
          item={itemSheet}
          onClose={() => setItemSheet(null)}
          onSave={async (text) => {
            await saveItem(itemSheet, { text });
            setItemSheet(null);
          }}
          onRemove={async () => {
            await saveItem(itemSheet, { active: false });
            setItemSheet(null);
          }}
        />
      )}
    </>
  );
}

function EditLists({
  lists,
  itemsFor,
  onNewList,
  onEditList,
  onAddItem,
  onEditItem,
  onMove,
}: {
  lists: Checklist[];
  itemsFor: (listId: string) => ChecklistItem[];
  onNewList: () => void;
  onEditList: (l: Checklist) => void;
  onAddItem: (listId: string, text: string) => Promise<void>;
  onEditItem: (i: ChecklistItem) => void;
  onMove: (listId: string, index: number, direction: -1 | 1) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function add(listId: string) {
    const text = (drafts[listId] ?? '').trim();
    if (!text) return;
    try {
      await onAddItem(listId, text);
      setDrafts((d) => ({ ...d, [listId]: '' }));
    } catch (error) {
      alert((error as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onNewList} className="w-full flex items-center justify-center gap-2 bg-gold text-ink py-3.5 rounded-xl text-[15px] font-medium">
        <Plus size={18} strokeWidth={2} />
        New checklist
      </button>
      <p className="text-xs text-neutral-500 px-1">Tap a list's name to change who does it, which days and by when. Tap an item to change or remove it.</p>

      {lists.map((list) => {
        const its = itemsFor(list.id);
        return (
          <section key={list.id} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <button onClick={() => onEditList(list)} className="w-full text-left px-4 py-3.5 border-b border-neutral-100 hover:bg-neutral-50">
              <span className="block text-[16px] font-medium">{list.name}</span>
              <span className="block text-xs text-neutral-500 mt-0.5">
                {DEPARTMENT_LABELS[list.department]} · {daysText(list.days)}
                {list.due_time && ` · by ${formatDue(list.due_time)}`}
              </span>
            </button>
            <ul className="divide-y divide-neutral-100">
              {its.map((item, index) => (
                <li key={item.id} className="flex items-center">
                  <button onClick={() => onEditItem(item)} className="flex-1 min-w-0 text-left px-4 py-3 text-[15px] leading-snug hover:bg-neutral-50">
                    {item.text}
                  </button>
                  <button
                    onClick={() => onMove(list.id, index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="w-10 h-11 flex items-center justify-center text-neutral-400 disabled:opacity-25"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => onMove(list.id, index, 1)}
                    disabled={index === its.length - 1}
                    aria-label="Move down"
                    className="w-10 h-11 mr-1 flex items-center justify-center text-neutral-400 disabled:opacity-25"
                  >
                    <ArrowDown size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 p-3 border-t border-neutral-100 bg-neutral-50">
              <input
                type="text"
                value={drafts[list.id] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [list.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && add(list.id)}
                placeholder="Add an item…"
                className={cn(inputClass, 'py-2.5')}
              />
              <button onClick={() => add(list.id)} className="shrink-0 px-4 rounded-xl bg-ink text-cream text-sm font-medium">
                Add
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50 sm:px-4" onClick={onClose}>
      <div
        className="bg-cream w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-xl truncate">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 shrink-0 flex items-center justify-center text-neutral-400 hover:text-ink">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Done-by times every 30 minutes across the business day (5 AM to 4:30 AM)
const DUE_TIMES = Array.from({ length: 48 }, (_, i) => {
  const m = (5 * 60 + i * 30) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

function ListSheet({
  editing,
  onClose,
  onSave,
  onRemove,
}: {
  editing: Checklist | null;
  onClose: () => void;
  onSave: (patch: Partial<Checklist>) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [department, setDepartment] = useState<Department>(editing?.department ?? 'all');
  const [days, setDays] = useState<number[]>(editing?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [due, setDue] = useState(editing?.due_time ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choice = (on: boolean) =>
    cn('py-3 rounded-xl text-sm font-medium transition', on ? 'bg-ink text-cream' : 'bg-white border border-neutral-200 text-neutral-600');

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Sheet title={editing ? 'Edit checklist' : 'New checklist'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Opening — Front of House" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Who does it</label>
          <div className="grid grid-cols-3 gap-2">
            {(['all', 'foh', 'kitchen'] as Department[]).map((d) => (
              <button key={d} type="button" onClick={() => setDepartment(d)} className={choice(department === d)}>
                {d === 'foh' ? 'Front' : DEPARTMENT_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Which days</label>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_LETTERS.map((letter, d) => (
              <button
                key={d}
                type="button"
                aria-label={DAY_NAMES[d]}
                aria-pressed={days.includes(d)}
                onClick={() => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()))}
                className={cn('h-11 rounded-xl text-sm font-medium', days.includes(d) ? 'bg-ink text-cream' : 'bg-white border border-neutral-200 text-neutral-500')}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Done by (optional)</label>
          <select value={due} onChange={(e) => setDue(e.target.value)} className={inputClass}>
            <option value="">No set time</option>
            {DUE_TIMES.map((t) => (
              <option key={t} value={t}>
                {formatDue(t)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-neutral-500 mt-1.5">After this time an unfinished list shows as late.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-800">{error}</div>}

        <button
          onClick={() => run(() => onSave({ name, department, days, due_time: due || null }))}
          disabled={saving || !name.trim() || days.length === 0}
          className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : editing ? 'Save' : 'Create checklist'}
        </button>
        {onRemove && (
          <button
            onClick={() => confirm('Remove this checklist? Past days keep their history.') && run(onRemove)}
            disabled={saving}
            className="w-full py-3 text-sm text-red-600"
          >
            Remove checklist
          </button>
        )}
      </div>
    </Sheet>
  );
}

function ItemSheet({
  item,
  onClose,
  onSave,
  onRemove,
}: {
  item: ChecklistItem;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [text, setText] = useState(item.text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Sheet title="Edit item" onClose={onClose}>
      <div className="space-y-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={cn(inputClass, 'resize-none')} />
        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-800">{error}</div>}
        <button
          onClick={() => run(() => onSave(text))}
          disabled={saving || !text.trim()}
          className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => run(onRemove)} disabled={saving} className="w-full py-3 text-sm text-red-600">
          Remove item
        </button>
      </div>
    </Sheet>
  );
}
