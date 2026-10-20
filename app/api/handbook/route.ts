import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { CHAPTER_COLUMNS, cleanBody, cleanTitle, SECTION_COLUMNS } from '@/lib/handbook';

// Employee handbook. All staff can read; only managers write, reorder or delete.

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const [chapters, sections] = await Promise.all([
    supabase.from('handbook_chapters').select(CHAPTER_COLUMNS).order('sort'),
    supabase.from('handbook_sections').select(SECTION_COLUMNS).order('sort'),
  ]);
  const error = chapters.error || sections.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chapters: chapters.data, sections: sections.data });
}

async function manager() {
  const session = await getSessionInfo();
  return session?.role === 'manager' ? session : null;
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

// { kind: 'chapter', title } or { kind: 'section', chapter_id, title }
export async function POST(request: NextRequest) {
  if (!(await manager())) return json({ error: 'Managers only' }, 403);
  const body = await request.json().catch(() => ({}));
  const title = cleanTitle(body.title);
  if (!title) return json({ error: 'Type a title.' }, 400);
  const supabase = createClient();

  if (body.kind === 'chapter') {
    const { data: last } = await supabase.from('handbook_chapters').select('sort').order('sort', { ascending: false }).limit(1);
    const { data, error } = await supabase
      .from('handbook_chapters')
      .insert({ title, sort: (last?.[0]?.sort ?? 0) + 1 })
      .select(CHAPTER_COLUMNS)
      .single();
    return error ? json({ error: error.message }, 500) : json(data);
  }

  if (body.kind === 'section' && typeof body.chapter_id === 'string') {
    const { data: last } = await supabase
      .from('handbook_sections')
      .select('sort')
      .eq('chapter_id', body.chapter_id)
      .order('sort', { ascending: false })
      .limit(1);
    const { data, error } = await supabase
      .from('handbook_sections')
      .insert({ chapter_id: body.chapter_id, title, sort: (last?.[0]?.sort ?? 0) + 1 })
      .select(SECTION_COLUMNS)
      .single();
    return error ? json({ error: error.message }, 500) : json(data);
  }
  return json({ error: 'Unknown request' }, 400);
}

// { kind: 'chapter', id, title } | { kind: 'section', id, title?, body? } | { kind: 'order', table, ids }
export async function PUT(request: NextRequest) {
  const session = await manager();
  if (!session) return json({ error: 'Managers only' }, 403);
  const body = await request.json().catch(() => ({}));
  const supabase = createClient();

  if (body.kind === 'order' && Array.isArray(body.ids) && ['chapters', 'sections'].includes(body.table)) {
    const table = body.table === 'chapters' ? 'handbook_chapters' : 'handbook_sections';
    const ids = body.ids.filter((id: unknown) => typeof id === 'string');
    const results = await Promise.all(ids.map((id: string, i: number) => supabase.from(table).update({ sort: i + 1 }).eq('id', id)));
    const failed = results.find((r) => r.error);
    return failed?.error ? json({ error: failed.error.message }, 500) : json({ ok: true });
  }

  if (typeof body.id !== 'string') return json({ error: 'Missing id' }, 400);

  if (body.kind === 'chapter') {
    const title = cleanTitle(body.title);
    if (!title) return json({ error: 'Type a title.' }, 400);
    const { data, error } = await supabase.from('handbook_chapters').update({ title }).eq('id', body.id).select(CHAPTER_COLUMNS).single();
    return error ? json({ error: error.message }, 500) : json(data);
  }

  if (body.kind === 'section') {
    const patch: Record<string, unknown> = {
      updated_by: session.memberName ?? session.email.split('@')[0],
      updated_at: new Date().toISOString(),
    };
    if ('title' in body) {
      const title = cleanTitle(body.title);
      if (!title) return json({ error: 'Type a title.' }, 400);
      patch.title = title;
    }
    if ('body' in body) patch.body = cleanBody(body.body);
    const { data, error } = await supabase.from('handbook_sections').update(patch).eq('id', body.id).select(SECTION_COLUMNS).single();
    return error ? json({ error: error.message }, 500) : json(data);
  }
  return json({ error: 'Unknown request' }, 400);
}

// { kind: 'chapter' | 'section', id } — deleting a chapter deletes its sections
export async function DELETE(request: NextRequest) {
  if (!(await manager())) return json({ error: 'Managers only' }, 403);
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !['chapter', 'section'].includes(body.kind)) return json({ error: 'Unknown request' }, 400);
  const table = body.kind === 'chapter' ? 'handbook_chapters' : 'handbook_sections';
  const { error } = await createClient().from(table).delete().eq('id', body.id);
  return error ? json({ error: error.message }, 500) : json({ ok: true });
}
