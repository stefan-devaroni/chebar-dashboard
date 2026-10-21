import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { APPLICATION_COLUMNS, STATUSES } from '@/lib/applications';

// Applicants tab (managers): list, update status and notes, delete (with the CV).

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

async function manager() {
  const session = await getSessionInfo();
  return session?.role === 'manager' ? session : null;
}

export async function GET() {
  if (!(await manager())) return json({ error: 'Managers only' }, 403);
  const { data, error } = await createClient()
    .from('job_applications')
    .select(APPLICATION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);
  return error ? json({ error: error.message }, 500) : json(data);
}

// { id, status?, notes? }
export async function PUT(request: NextRequest) {
  const session = await manager();
  if (!session) return json({ error: 'Managers only' }, 403);
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string') return json({ error: 'Missing id' }, 400);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: session.memberName ?? session.email.split('@')[0],
  };
  if ('status' in body) {
    if (!STATUSES.includes(body.status)) return json({ error: 'Unknown status' }, 400);
    patch.status = body.status;
  }
  if ('notes' in body) patch.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 4000) || null : null;

  const { data, error } = await createClient().from('job_applications').update(patch).eq('id', body.id).select(APPLICATION_COLUMNS).single();
  return error ? json({ error: error.message }, 500) : json(data);
}

// { id } — removes the application and its CV for good
export async function DELETE(request: NextRequest) {
  if (!(await manager())) return json({ error: 'Managers only' }, 403);
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string') return json({ error: 'Missing id' }, 400);
  const supabase = createClient();
  const { data } = await supabase.from('job_applications').select('cv_path').eq('id', body.id).maybeSingle();
  if (data?.cv_path) await supabase.storage.from('applications').remove([data.cv_path]);
  const { error } = await supabase.from('job_applications').delete().eq('id', body.id);
  return error ? json({ error: error.message }, 500) : json({ ok: true });
}
