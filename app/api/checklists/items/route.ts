import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';

// Checklist items — managers only. Removing an item sets active=false so past
// days still show what was on the list.

export const dynamic = 'force-dynamic';

const ITEM_COLUMNS = 'id, checklist_id, text, sort, active';
const cleanText = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 200) : '');

async function isManager() {
  return (await getSessionInfo())?.role === 'manager';
}

export async function POST(request: NextRequest) {
  if (!(await isManager())) return NextResponse.json({ error: 'Managers only' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const text = cleanText(body.text);
  if (typeof body.checklist_id !== 'string' || !text) return NextResponse.json({ error: 'Type what needs to be done.' }, { status: 400 });

  const supabase = createClient();
  const { data: last } = await supabase
    .from('checklist_items')
    .select('sort')
    .eq('checklist_id', body.checklist_id)
    .order('sort', { ascending: false })
    .limit(1);
  const { data, error } = await supabase
    .from('checklist_items')
    .insert({ checklist_id: body.checklist_id, text, sort: (last?.[0]?.sort ?? 0) + 1 })
    .select(ITEM_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// { id, text?, active? } or { order: [id, id, ...] } to save a new order
export async function PUT(request: NextRequest) {
  if (!(await isManager())) return NextResponse.json({ error: 'Managers only' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const supabase = createClient();

  if (Array.isArray(body.order)) {
    const ids = body.order.filter((id: unknown) => typeof id === 'string');
    const results = await Promise.all(ids.map((id: string, i: number) => supabase.from('checklist_items').update({ sort: i + 1 }).eq('id', id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (typeof body.id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if ('text' in body) {
    const text = cleanText(body.text);
    if (!text) return NextResponse.json({ error: 'Type what needs to be done.' }, { status: 400 });
    patch.text = text;
  }
  if ('active' in body) patch.active = body.active !== false;

  const { data, error } = await supabase.from('checklist_items').update(patch).eq('id', body.id).select(ITEM_COLUMNS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
