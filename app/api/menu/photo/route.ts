import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { MENU_ITEM_COLUMNS } from '@/lib/menu';

// Upload a dish photo (managers): multipart form with `file` and `itemId`.
// The browser shrinks photos before sending, so they stay well under the limit.

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function POST(request: NextRequest) {
  const session = await getSessionInfo();
  if (session?.role !== 'manager') return NextResponse.json({ error: 'Managers only' }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const itemId = form?.get('itemId');
  if (!(file instanceof Blob) || typeof itemId !== 'string') {
    return NextResponse.json({ error: 'Pick a photo.' }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return NextResponse.json({ error: 'Unknown menu item' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Use a JPG, PNG or WebP photo.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That photo is too large (max 5 MB).' }, { status: 400 });

  const supabase = createClient();
  const path = `items/${itemId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('menu-photos')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const photoUrl = supabase.storage.from('menu-photos').getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase
    .from('menu_items')
    .update({ photo_url: photoUrl, updated_by: session.memberName ?? session.email.split('@')[0], updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select(MENU_ITEM_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
