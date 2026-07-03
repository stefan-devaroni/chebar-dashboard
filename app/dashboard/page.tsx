import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { CheckCircle2, ListTodo, Flame, CalendarClock } from 'lucide-react';

export default async function DashboardHome() {
  const supabase = createClient();

  const { count: totalTasks } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true });
  const { count: doneTasks } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'done');
  const { count: todoTasks } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'todo');

  const { data: recent } = await supabase
    .from('tasks')
    .select('id, title, completed_at')
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(5);

  const { data: fires } = await supabase
    .from('tasks')
    .select('id, title, subcategory_id, subcategories!inner(name, category_id, categories!inner(name, icon))')
    .eq('status', 'todo')
    .limit(5);

  // Due this week: tasks with a due_date between today and end of this week (Sunday)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

  const { data: dueThisWeek } = await supabase
    .from('tasks')
    .select('id, title, due_date, status, subcategories!inner(name, categories!inner(name, icon))')
    .neq('status', 'done')
    .gte('due_date', todayStr)
    .lte('due_date', endOfWeekStr)
    .order('due_date', { ascending: true })
    .limit(10);

  const progress = totalTasks ? Math.round(((doneTasks ?? 0) / totalTasks) * 100) : 0;

  return (
    <div>
      <header className="mb-10">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="font-display text-4xl">Che Bar Dashboard</h1>
      </header>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <MetricCard
          icon={<ListTodo size={18} strokeWidth={1.5} />}
          label="Tasks remaining"
          value={todoTasks ?? 0}
        />
        <MetricCard
          icon={<CheckCircle2 size={18} strokeWidth={1.5} />}
          label="Completed"
          value={doneTasks ?? 0}
          subtext={`${progress}% of ${totalTasks ?? 0}`}
        />
        <MetricCard
          icon={<Flame size={18} strokeWidth={1.5} />}
          label="Days to June 1"
          value={Math.max(0, Math.ceil((new Date('2026-06-01').getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
          subtext="Menu / hours launch"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Today's focus */}
        <section className="bg-white border border-neutral-200 rounded p-6">
          <h2 className="font-display text-xl mb-4">Open tasks</h2>
          {fires && fires.length > 0 ? (
            <ul className="space-y-3">
              {fires.map((task: any) => (
                <li key={task.id} className="text-sm">
                  <div className="text-neutral-900">{task.title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {task.subcategories?.categories?.name} · {task.subcategories?.name}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">All clear.</p>
          )}
          <Link
            href="/dashboard/tasks"
            className="inline-block mt-4 text-xs uppercase tracking-widest text-neutral-600 hover:text-ink"
          >
            View all tasks →
          </Link>
        </section>

        {/* Recent completions */}
        <section className="bg-white border border-neutral-200 rounded p-6">
          <h2 className="font-display text-xl mb-4">Recently completed</h2>
          {recent && recent.length > 0 ? (
            <ul className="space-y-3">
              {recent.map((task) => (
                <li key={task.id} className="text-sm flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-gold mt-0.5 shrink-0" strokeWidth={1.5} />
                  <div>
                    <div className="text-neutral-700 line-through decoration-neutral-300">
                      {task.title}
                    </div>
                    {task.completed_at && (
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {new Date(task.completed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">Nothing yet — check off a task to see it here.</p>
          )}
        </section>
      </div>

      {/* Due this week */}
      <section className="bg-white border border-neutral-200 rounded p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock size={18} className="text-gold" strokeWidth={1.5} />
          <h2 className="font-display text-xl">Due this week</h2>
        </div>
        {dueThisWeek && dueThisWeek.length > 0 ? (
          <ul className="space-y-2">
            {dueThisWeek.map((task: any) => (
              <li key={task.id} className="flex items-center justify-between text-sm py-2 border-b border-neutral-100 last:border-b-0">
                <div>
                  <span className="text-neutral-900">{task.title}</span>
                  <span className="text-xs text-neutral-500 ml-2">
                    {task.subcategories?.categories?.icon} {task.subcategories?.categories?.name}
                  </span>
                </div>
                <span className="text-xs text-neutral-500 shrink-0 ml-4">
                  {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No tasks due this week.</p>
        )}
        <Link
          href="/dashboard/tasks"
          className="inline-block mt-4 text-xs uppercase tracking-widest text-neutral-600 hover:text-ink"
        >
          Manage tasks →
        </Link>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtext?: string;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded p-6">
      <div className="flex items-center gap-2 text-neutral-500 mb-3">
        {icon}
        <span className="text-xs uppercase tracking-widest">{label}</span>
      </div>
      <div className="font-display text-3xl">{value}</div>
      {subtext && <div className="text-xs text-neutral-500 mt-1">{subtext}</div>}
    </div>
  );
}
