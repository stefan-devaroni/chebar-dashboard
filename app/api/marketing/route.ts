import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const tab = request.nextUrl.searchParams.get('tab') || 'posts';

  if (tab === 'posts') {
    const { data, error } = await supabase
      .from('social_posts')
      .select('*')
      .order('post_date', { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (tab === 'campaigns') {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(25);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (tab === 'drafts') {
    const { data, error } = await supabase
      .from('content_drafts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json([]);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();
  const table = body._table;
  delete body._table;

  if (table === 'social_posts') {
    const { data, error } = await supabase.from('social_posts').insert(body).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (table === 'campaigns') {
    const { data, error } = await supabase.from('marketing_campaigns').insert(body).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (table === 'drafts') {
    const { data, error } = await supabase.from('content_drafts').insert(body).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'Unknown table' }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();
  const table = body._table;
  const id = body.id;
  delete body._table;
  delete body.id;

  const tableMap: Record<string, string> = {
    social_posts: 'social_posts',
    campaigns: 'marketing_campaigns',
    drafts: 'content_drafts',
  };

  const tableName = tableMap[table];
  if (!tableName) return NextResponse.json({ error: 'Unknown table' }, { status: 400 });

  const { data, error } = await supabase.from(tableName).update(body).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { id, _table } = await request.json();

  const tableMap: Record<string, string> = {
    social_posts: 'social_posts',
    campaigns: 'marketing_campaigns',
    drafts: 'content_drafts',
  };

  const tableName = tableMap[_table];
  if (!tableName) return NextResponse.json({ error: 'Unknown table' }, { status: 400 });

  const { error } = await supabase.from(tableName).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'deleted' });
}
