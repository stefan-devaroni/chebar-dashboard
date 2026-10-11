import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';

export async function GET() {
  const supabase = createClient();
  const session = await getSessionInfo();
  // Employees get names/departments (needed to read the schedule) but not emails
  const columns = session?.role === 'manager' ? '*' : 'id, name, role, color, active, department, created_at';

  const { data, error } = await supabase
    .from('team_members')
    .select(columns)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('team_members')
    .insert({
      name: body.name,
      role: body.role || 'employee',
      department: body.department || 'foh',
      color: body.color || '#d4a45c',
      email: body.email ? String(body.email).trim().toLowerCase() : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const update: Record<string, any> = {
    name: body.name,
    role: body.role,
    department: body.department,
    color: body.color,
    active: body.active,
  };
  if ('email' in body) {
    update.email = body.email ? String(body.email).trim().toLowerCase() : null;
  }

  const { data, error } = await supabase
    .from('team_members')
    .update(update)
    .eq('id', body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { id } = await request.json();

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'deleted' });
}
