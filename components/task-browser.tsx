'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Check, Circle, AlertCircle, Loader2, Plus, X, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignee_email: string | null;
  due_date: string | null;
  notes: string | null;
}

interface Subcategory {
  id: string;
  name: string;
  tasks: Task[];
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  subcategories: Subcategory[];
}

export function TaskBrowser({ initialData }: { initialData: Category[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [data, setData] = useState<Category[]>(initialData);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(initialData[0]?.id ?? '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'done'>('open');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);

  async function updateNote(taskId: string, notes: string | null) {
    const { error } = await supabase
      .from('tasks')
      .update({ notes: notes || null })
      .eq('id', taskId);

    if (!error) {
      setData((prev) =>
        prev.map((cat) => ({
          ...cat,
          subcategories: cat.subcategories.map((sub) => ({
            ...sub,
            tasks: sub.tasks.map((t) =>
              t.id === taskId ? { ...t, notes: notes || null } : t
            ),
          })),
        }))
      );
    }
    setEditingNote(null);
  }

  async function updateStatus(taskId: string, newStatus: TaskStatus) {
    setPending((prev) => new Set(prev).add(taskId));
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (!error) {
      setData((prev) =>
        prev.map((cat) => ({
          ...cat,
          subcategories: cat.subcategories.map((sub) => ({
            ...sub,
            tasks: sub.tasks.map((t) =>
              t.id === taskId ? { ...t, status: newStatus } : t
            ),
          })),
        }))
      );
    }
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }

  async function updateDueDate(taskId: string, dueDate: string | null) {
    const { error } = await supabase
      .from('tasks')
      .update({ due_date: dueDate || null })
      .eq('id', taskId);

    if (!error) {
      setData((prev) =>
        prev.map((cat) => ({
          ...cat,
          subcategories: cat.subcategories.map((sub) => ({
            ...sub,
            tasks: sub.tasks.map((t) =>
              t.id === taskId ? { ...t, due_date: dueDate || null } : t
            ),
          })),
        }))
      );
    }
    setEditingDueDate(null);
  }

  function addTaskToState(task: Task, subcategoryId: string) {
    setData((prev) =>
      prev.map((cat) => ({
        ...cat,
        subcategories: cat.subcategories.map((sub) =>
          sub.id === subcategoryId
            ? { ...sub, tasks: [...sub.tasks, task] }
            : sub
        ),
      }))
    );
  }

  const activeCategory = data.find((c) => c.id === activeCategoryId);
  const totals = data.map((cat) => {
    const all = cat.subcategories.flatMap((s) => s.tasks);
    return {
      id: cat.id,
      total: all.length,
      done: all.filter((t) => t.status === 'done').length,
      open: all.filter((t) => t.status !== 'done').length,
    };
  });

  function filterTasks(tasks: Task[]) {
    if (statusFilter === 'all') return tasks;
    if (statusFilter === 'done') return tasks.filter((t) => t.status === 'done');
    return tasks.filter((t) => t.status !== 'done');
  }

  return (
    <div className="flex gap-8">
      {/* Sidebar — categories */}
      <aside className="w-64 shrink-0">
        <nav className="space-y-1">
          {data.map((cat) => {
            const tot = totals.find((t) => t.id === cat.id)!;
            const active = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded text-sm transition flex items-center justify-between',
                  active
                    ? 'bg-ink text-cream'
                    : 'hover:bg-white text-neutral-700'
                )}
              >
                <span className="flex items-center gap-2">
                  {cat.icon && <span className="text-base">{cat.icon}</span>}
                  <span>{cat.name}</span>
                </span>
                <span
                  className={cn(
                    'text-xs',
                    active ? 'text-neutral-400' : 'text-neutral-500'
                  )}
                >
                  {tot.open}/{tot.total}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main pane */}
      <div className="flex-1 min-w-0">
        {/* Header with filter tabs + New task button */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl">
            {activeCategory?.icon} {activeCategory?.name}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 text-xs">
              {(['open', 'done', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-3 py-1.5 uppercase tracking-widest rounded transition',
                    statusFilter === s
                      ? 'bg-ink text-cream'
                      : 'text-neutral-600 hover:bg-white'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowNewTask(true)}
              className="flex items-center gap-1.5 bg-gold text-ink px-4 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-gold/80 transition"
            >
              <Plus size={14} strokeWidth={2} />
              New task
            </button>
          </div>
        </div>

        {/* Subcategories with tasks */}
        <div className="space-y-8">
          {activeCategory?.subcategories.map((sub) => {
            const filteredTasks = filterTasks(sub.tasks);
            if (filteredTasks.length === 0) return null;
            return (
              <section key={sub.id}>
                <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
                  {sub.name}
                </h3>
                <ul className="space-y-1 bg-white border border-neutral-200 rounded">
                  {filteredTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-start gap-3 px-4 py-3 border-b border-neutral-100 last:border-b-0 group"
                    >
                      <TaskCheckbox
                        status={task.status}
                        pending={pending.has(task.id)}
                        onToggle={() =>
                          updateStatus(
                            task.id,
                            task.status === 'done' ? 'todo' : 'done'
                          )
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm',
                            task.status === 'done' &&
                              'line-through text-neutral-400 decoration-neutral-300'
                          )}
                        >
                          {task.title}
                        </p>
                        <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                          {task.assignee_email && <span>@{task.assignee_email}</span>}
                          {editingDueDate === task.id ? (
                            <input
                              type="date"
                              defaultValue={task.due_date ?? ''}
                              autoFocus
                              onBlur={(e) => updateDueDate(task.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') updateDueDate(task.id, e.currentTarget.value);
                                if (e.key === 'Escape') setEditingDueDate(null);
                              }}
                              className="bg-cream border border-neutral-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-gold"
                            />
                          ) : (
                            <button
                              onClick={() => setEditingDueDate(task.id)}
                              className={cn(
                                'hover:text-ink transition',
                                task.due_date
                                  ? isOverdue(task.due_date) ? 'text-red-600' : ''
                                  : 'opacity-0 group-hover:opacity-100'
                              )}
                            >
                              {task.due_date
                                ? `Due ${new Date(task.due_date + 'T00:00:00').toLocaleDateString()}`
                                : '+ due date'}
                            </button>
                          )}
                        </div>
                        {editingNote === task.id ? (
                          <textarea
                            defaultValue={task.notes ?? ''}
                            autoFocus
                            rows={2}
                            placeholder="Add a note..."
                            onBlur={(e) => updateNote(task.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingNote(null);
                            }}
                            className="mt-2 w-full bg-cream border border-neutral-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-gold resize-y"
                          />
                        ) : task.notes ? (
                          <button
                            onClick={() => setEditingNote(task.id)}
                            className="mt-2 text-xs text-neutral-500 hover:text-ink transition text-left"
                          >
                            <MessageSquare size={12} className="inline mr-1 -mt-0.5" strokeWidth={1.5} />
                            {task.notes}
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingNote(task.id)}
                            className="mt-1.5 text-xs text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-ink transition"
                          >
                            <MessageSquare size={12} className="inline mr-1 -mt-0.5" strokeWidth={1.5} />
                            + note
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {/* New task modal */}
      {showNewTask && activeCategory && (
        <NewTaskModal
          category={activeCategory}
          onClose={() => setShowNewTask(false)}
          onCreated={(task, subcategoryId) => {
            addTaskToState(task, subcategoryId);
            setShowNewTask(false);
          }}
        />
      )}
    </div>
  );
}

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return due < today;
}

function NewTaskModal({
  category,
  onClose,
  onCreated,
}: {
  category: Category;
  onClose: () => void;
  onCreated: (task: Task, subcategoryId: string) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [subcategoryId, setSubcategoryId] = useState(category.subcategories[0]?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('tasks')
      .insert({
        subcategory_id: subcategoryId,
        title: title.trim(),
        status: 'todo',
        due_date: dueDate || null,
        display_order: 999,
      })
      .select()
      .single();

    setSaving(false);
    if (err) {
      setError(err.message);
    } else if (data) {
      onCreated(data as Task, subcategoryId);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-cream border border-neutral-200 rounded-lg w-full max-w-md p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">
            New task in {category.icon} {category.name}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-ink transition">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
              Task title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
              placeholder="What needs to be done?"
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
              Subcategory
            </label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
            >
              {category.subcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
              Due date (optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
            />
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-ink text-cream py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create task'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-neutral-300 rounded text-xs uppercase tracking-widest hover:bg-white transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskCheckbox({
  status,
  pending,
  onToggle,
}: {
  status: TaskStatus;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={pending}
      className="mt-0.5 shrink-0"
      aria-label={status === 'done' ? 'Mark as todo' : 'Mark as done'}
    >
      {pending ? (
        <Loader2 size={18} className="animate-spin text-neutral-400" strokeWidth={1.5} />
      ) : status === 'done' ? (
        <div className="w-[18px] h-[18px] rounded-full bg-gold flex items-center justify-center">
          <Check size={12} className="text-ink" strokeWidth={2.5} />
        </div>
      ) : status === 'blocked' ? (
        <AlertCircle size={18} className="text-red-500" strokeWidth={1.5} />
      ) : (
        <Circle size={18} className="text-neutral-300 hover:text-neutral-500 transition" strokeWidth={1.5} />
      )}
    </button>
  );
}
