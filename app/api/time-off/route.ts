import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { can, NO_ACCESS } from '@/lib/permissions';

export async function GET() {
  const supabase = createClient();
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let query = supabase
    .from('time_off')
    .select('*')
    .order('start_date', { ascending: false });

  // Without schedule editing, people only see their own requests (reasons can be private)
  if (!can(session.perms, 'schedule.edit')) {
    if (!session.memberId) return NextResponse.json([]);
    query = query.eq('team_member_id', session.memberId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Staff can only file a *request* for themselves; schedule editors can add
  // approved time off for anyone directly.
  const requestOnly = !can(session.perms, 'schedule.edit');
  const teamMemberId = requestOnly ? session.memberId : body.team_member_id;
  const status = requestOnly ? 'requested' : body.status || 'approved';

  if (!teamMemberId) {
    return NextResponse.json({ error: 'No team member linked to this login' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('time_off')
    .insert({
      team_member_id: teamMemberId,
      start_date: body.start_date,
      end_date: body.end_date,
      reason: body.reason || null,
      status,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Approve / deny a request: schedule editors only (the middleware checks this too)
export async function PUT(request: NextRequest) {
  const session = await getSessionInfo();
  if (!session || !can(session.perms, 'schedule.edit')) {
    return NextResponse.json({ error: NO_ACCESS }, { status: 403 });
  }

  const { id, status } = await request.json();
  if (!['requested', 'approved', 'denied'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('time_off')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionInfo();
  if (!session || !can(session.perms, 'schedule.edit')) {
    return NextResponse.json({ error: NO_ACCESS }, { status: 403 });
  }

  const supabase = createClient();
  const { id } = await request.json();

  const { error } = await supabase
    .from('time_off')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'deleted' });
}
