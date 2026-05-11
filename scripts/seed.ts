/**
 * Seed script — parses che_bar_master_plan.md and inserts everything
 * into Supabase. Run with: npm run seed
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var (server-only key).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

interface ParsedTask {
  title: string;
  assignee: string | null;
  order: number;
}

interface ParsedSubcategory {
  name: string;
  order: number;
  tasks: ParsedTask[];
}

interface ParsedCategory {
  name: string;
  icon: string | null;
  order: number;
  subcategories: ParsedSubcategory[];
}

function parseMasterPlan(md: string): ParsedCategory[] {
  const lines = md.split('\n');
  const categories: ParsedCategory[] = [];
  let currentCategory: ParsedCategory | null = null;
  let currentSubcategory: ParsedSubcategory | null = null;
  let catOrder = 0;
  let subOrder = 0;
  let taskOrder = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // ## Category (level 2 heading, but not the title)
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      const heading = h2[1].trim();
      // Extract emoji/icon if present at start
      const iconMatch = heading.match(/^([\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F0FF}🎯📣⚙️🔧📦💰👥]+)\s*(.+)/u);
      const icon = iconMatch ? iconMatch[1] : null;
      const name = (iconMatch ? iconMatch[2] : heading).replace(/^\d+\.\s*/, '').trim();
      currentCategory = { name, icon, order: catOrder++, subcategories: [] };
      categories.push(currentCategory);
      currentSubcategory = null;
      subOrder = 0;
      continue;
    }

    // ### Subcategory
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3 && currentCategory) {
      const name = h3[1].replace(/^\d+\.\d+\s*/, '').trim();
      currentSubcategory = { name, order: subOrder++, tasks: [] };
      currentCategory.subcategories.push(currentSubcategory);
      taskOrder = 0;
      continue;
    }

    // - [ ] task
    const task = line.match(/^\s*-\s+\[\s*([ x~!])?\s*\]\s+(.+)$/);
    if (task && currentCategory) {
      let title = task[2].trim();
      // Skip nested checkboxes for simplicity (treat as part of parent text)
      if (/^\s{4,}/.test(rawLine)) continue;

      // Extract @assignee at end of line (handles `@name` with backticks too)
      const assigneeMatch = title.match(/\s*`?@(\w+)`?\s*$/);
      const assignee = assigneeMatch ? assigneeMatch[1] : null;
      if (assigneeMatch) title = title.replace(assigneeMatch[0], '').trim();

      // If no subcategory yet, create a default one named after the category
      if (!currentSubcategory) {
        currentSubcategory = { name: 'General', order: subOrder++, tasks: [] };
        currentCategory.subcategories.push(currentSubcategory);
        taskOrder = 0;
      }

      currentSubcategory.tasks.push({ title, assignee, order: taskOrder++ });
    }
  }

  // Filter out categories with no tasks (e.g. legend-only sections)
  return categories.filter(c => c.subcategories.some(s => s.tasks.length > 0));
}

async function main() {
  console.log('Reading master plan...');
  const md = readFileSync(resolve('./supabase/master_plan.md'), 'utf-8');
  const parsed = parseMasterPlan(md);

  console.log(`Parsed ${parsed.length} categories`);
  for (const c of parsed) {
    const totalTasks = c.subcategories.reduce((sum, s) => sum + s.tasks.length, 0);
    console.log(`  ${c.icon || ''} ${c.name}: ${c.subcategories.length} sections, ${totalTasks} tasks`);
  }

  console.log('\nClearing existing data...');
  // Delete in reverse FK order
  await supabase.from('task_activity').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('subcategories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('Inserting categories, subcategories, tasks...');
  for (const c of parsed) {
    const { data: catRow, error: catErr } = await supabase
      .from('categories')
      .insert({
        name: c.name,
        slug: slugify(c.name),
        display_order: c.order,
        icon: c.icon,
      })
      .select()
      .single();
    if (catErr || !catRow) {
      console.error('Category insert failed:', catErr);
      continue;
    }

    for (const s of c.subcategories) {
      const { data: subRow, error: subErr } = await supabase
        .from('subcategories')
        .insert({
          category_id: catRow.id,
          name: s.name,
          slug: slugify(s.name),
          display_order: s.order,
        })
        .select()
        .single();
      if (subErr || !subRow) {
        console.error('Subcategory insert failed:', subErr);
        continue;
      }

      if (s.tasks.length > 0) {
        const tasksToInsert = s.tasks.map(t => ({
          subcategory_id: subRow.id,
          title: t.title,
          status: 'todo',
          assignee_email: t.assignee,
          display_order: t.order,
        }));
        const { error: taskErr } = await supabase.from('tasks').insert(tasksToInsert);
        if (taskErr) console.error('Task insert failed:', taskErr);
      }
    }
  }

  // Counts
  const { count: catCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  const { count: subCount } = await supabase.from('subcategories').select('*', { count: 'exact', head: true });
  const { count: taskCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true });

  console.log(`\n✓ Seed complete: ${catCount} categories, ${subCount} subcategories, ${taskCount} tasks`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
