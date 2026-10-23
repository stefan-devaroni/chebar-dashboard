import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sessionWith } from '@/lib/roles';
import { NO_ACCESS } from '@/lib/permissions';
import { businessDate, parseListInput } from '@/lib/checklists';
import { isDate } from '@/lib/reservations';

// Daily checklists. Everyone with Checklists access can read; only checklist editors change the lists.

export const dynamic = 'force-dynamic';

const LIST_COLUMNS = 'id, name, department, days, due_time, sort, active';
const ITEM_COLUMNS = 'id, checklist_id, text, sort, active';

// GET ?date=YYYY-MM-DD → all lists + items, and the checks for that day
export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get('date');
  const date = isDate(param) ? param : businessDate();

  const supabase = createClient();
  const [lists, items, checks] = await Promise.all([
    supabase.from('checklists').select(LIST_COLUMNS).order('sort'),
    supabase.from('checklist_items').select(ITEM_COLUMNS).order('sort'),
    supabase.from('checklist_checks').select('id, item_id, checklist_id, date, checked_by, checked_at').eq('date', date),
  ]);
  const error = lists.error || items.error || checks.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ date, lists: lists.data, items: items.data, checks: checks.data });
}

const allowed = () => sessionWith('checklists.edit');

// Create a list
export async function POST(request: NextRequest) {
  if (!(await allowed())) return NextResponse.json({ error: NO_ACCESS }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const parsed = parseListInput({ department: 'all', ...body });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!parsed.value.name) return NextResponse.json({ error: 'Give the checklist a name.' }, { status: 400 });

  const supabase = createClient();
  const { data: last } = await supabase.from('checklists').select('sort').order('sort', { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from('checklists')
    .insert({ ...parsed.value, sort: parsed.value.sort ?? (last?.[0]?.sort ?? 0) + 1 })
    .select(LIST_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Update a list (name, team, days, done-by time, order). Removing a list sets
// active=false so past days keep their history.
export async function PUT(request: NextRequest) {
  if (!(await allowed())) return NextResponse.json({ error: NO_ACCESS }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { id, ...fields } = body;
  const parsed = parseListInput(fields);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await createClient().from('checklists').update(parsed.value).eq('id', id).select(LIST_COLUMNS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
