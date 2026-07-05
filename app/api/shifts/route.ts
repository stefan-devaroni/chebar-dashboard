import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const weekStart = request.nextUrl.searchParams.get('weekStart');
  const weekEnd = request.nextUrl.searchParams.get('weekEnd');

  let query = supabase
    .from('shifts')
    .select('*, team_members(id, name, color, department)')
    .order('start_time');

  if (weekStart) {
    const start = new Date(weekStart);
    query = query.gte('date', start.toISOString().split('T')[0]);
    if (weekEnd) {
      query = query.lte('date', new Date(weekEnd).toISOString().split('T')[0]);
    } else {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      query = query.lte('date', end.toISOString().split('T')[0]);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('shifts')
    .insert({
      team_member_id: body.team_member_id,
      date: body.date,
      start_time: body.start_time,
      end_time: body.end_time,
      shift_type: body.shift_type || 'morning',
      notes: body.notes || null,
    })
    .select('*, team_members(id, name, color, department)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { id } = await request.json();

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'deleted' });
}
