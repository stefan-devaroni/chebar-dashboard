import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { MENU_ITEM_COLUMNS, parseMenuInput } from '@/lib/menu';

// Menu & recipes. All staff can read; only managers add or change items.
// Removing an item sets active=false so it can come back later.

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await createClient().from('menu_items').select(MENU_ITEM_COLUMNS).eq('active', true).order('sort');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

async function manager() {
  const session = await getSessionInfo();
  return session?.role === 'manager' ? session : null;
}

export async function POST(request: NextRequest) {
  const session = await manager();
  if (!session) return NextResponse.json({ error: 'Managers only' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const parsed = parseMenuInput({ menu: 'mornings', station: 'kitchen', ingredients: [], ...body });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!parsed.value.name || !parsed.value.section) {
    return NextResponse.json({ error: 'Name and section are required.' }, { status: 400 });
  }

  const supabase = createClient();
  // New items go at the end of their section
  const { data: last } = await supabase
    .from('menu_items')
    .select('sort')
    .eq('section', parsed.value.section)
    .order('sort', { ascending: false })
    .limit(1);
  const { data: lastOverall } = await supabase.from('menu_items').select('sort').order('sort', { ascending: false }).limit(1);
  const sort = (last?.[0]?.sort ?? lastOverall?.[0]?.sort ?? 0) + 1;

  const { data, error } = await supabase
    .from('menu_items')
    .insert({ ...parsed.value, sort, updated_by: session.memberName ?? session.email.split('@')[0] })
    .select(MENU_ITEM_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const session = await manager();
  if (!session) return NextResponse.json({ error: 'Managers only' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { id, ...fields } = body;
  const parsed = parseMenuInput(fields);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await createClient()
    .from('menu_items')
    .update({ ...parsed.value, updated_by: session.memberName ?? session.email.split('@')[0], updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(MENU_ITEM_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
