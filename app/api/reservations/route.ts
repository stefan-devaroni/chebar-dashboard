import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { addDays, arubaNow, isDate, parseStaffBooking } from '@/lib/reservations';
import { RESERVATION_COLUMNS } from '@/lib/reservations-server';

// Staff side of reservations (managers and employees).

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const today = arubaNow().date;
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const start = isDate(from) ? from : today;
  const end = isDate(to) ? to : addDays(start, 13);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('reservations')
    .select(RESERVATION_COLUMNS)
    .gte('date', start)
    .lte('date', end)
    .order('date')
    .order('time');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Add a booking that came in by phone, WhatsApp or in person
export async function POST(request: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseStaffBooking(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;
  if (!v.date || !v.time || !v.party_size || !v.name) {
    return NextResponse.json({ error: 'Date, time, guests and name are required.' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('reservations')
    .insert({ ...v, status: 'confirmed', source: 'staff', created_by: session.memberName ?? session.email })
    .select(RESERVATION_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Change details or status (arrived, no-show, cancelled, back to booked)
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { id, ...fields } = body;
  const parsed = parseStaffBooking(fields);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('reservations')
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(RESERVATION_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
