import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { businessDate } from '@/lib/checklists';

// Tick or untick an item for today: POST { itemId, checked }.
// Only today's business day can be changed, so past days stay as they were.

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.itemId !== 'string') return NextResponse.json({ error: 'Missing item' }, { status: 400 });
  const date = businessDate();
  if (body.date && body.date !== date) {
    return NextResponse.json({ error: 'Only today’s checklist can be changed. Reload the page.' }, { status: 409 });
  }

  const supabase = createClient();
  if (body.checked === false) {
    const { error } = await supabase.from('checklist_checks').delete().eq('item_id', body.itemId).eq('date', date);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, checked: false });
  }

  const { data: item, error: itemError } = await supabase
    .from('checklist_items')
    .select('id, checklist_id, active')
    .eq('id', body.itemId)
    .maybeSingle();
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  if (!item || !item.active) return NextResponse.json({ error: 'This item was removed. Reload the page.' }, { status: 404 });

  const name = session.memberName || session.email.split('@')[0];
  // Ticking an item someone already ticked keeps the first person and time
  const { data, error } = await supabase
    .from('checklist_checks')
    .upsert(
      { item_id: item.id, checklist_id: item.checklist_id, date, checked_by: name, checked_by_member: session.memberId },
      { onConflict: 'item_id,date', ignoreDuplicates: true }
    )
    .select('id, item_id, checklist_id, date, checked_by, checked_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const check = data?.[0] ?? (await supabase
    .from('checklist_checks')
    .select('id, item_id, checklist_id, date, checked_by, checked_at')
    .eq('item_id', item.id)
    .eq('date', date)
    .maybeSingle()).data;
  return NextResponse.json({ ok: true, checked: true, check });
}
