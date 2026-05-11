import { createClient } from '@/lib/supabase/server';
import { TaskBrowser } from '@/components/task-browser';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const supabase = createClient();

  // Fetch all categories with subcategories and tasks
  const { data: categories } = await supabase
    .from('categories')
    .select(`
      id,
      name,
      icon,
      display_order,
      subcategories (
        id,
        name,
        display_order,
        tasks (
          id,
          title,
          status,
          assignee_email,
          due_date,
          notes,
          display_order
        )
      )
    `)
    .order('display_order')
    .order('display_order', { foreignTable: 'subcategories' })
    .order('display_order', { foreignTable: 'subcategories.tasks' });

  if (!categories) {
    return (
      <div>
        <h1 className="font-display text-3xl mb-2">Tasks</h1>
        <p className="text-sm text-neutral-500">
          No tasks loaded. Run <code className="bg-neutral-200 px-1 rounded">npm run seed</code> to populate
          the database from your master plan.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl">Tasks</h1>
        <p className="text-sm text-neutral-500 mt-1">Tiny steps. Easy wins.</p>
      </header>
      <TaskBrowser initialData={categories as any} />
    </div>
  );
}
