import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { sendEmail } from '@/lib/email';
import { cancellationEmail, confirmationEmail, updatedEmail } from '@/lib/reservation-emails';
import { addDays, arubaNow, isDate, parseStaffBooking } from '@/lib/reservations';
import { RESERVATION_COLUMNS } from '@/lib/reservations-server';

// Staff side of reservations (managers and employees). With `notify: true` and
// an email on the booking, the guest is emailed about the change.

export const dynamic = 'force-dynamic';

const newToken = () => randomBytes(16).toString('hex');

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

// Add a booking that came in by phone, email or in person
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
  const token = newToken(); // so the guest's email can carry a change/cancel link
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      ...v,
      status: 'confirmed',
      source: 'staff',
      manage_token: token,
      created_by: session.memberName ?? session.email,
    })
    .select(RESERVATION_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const emailed =
    body.notify && data.email
      ? await sendEmail({
          to: data.email,
          ...confirmationEmail({ date: data.date, time: data.time, party: data.party_size, name: data.name, token }),
        })
      : false;
  return NextResponse.json({ ...data, emailed });
}

// Change details or status (arrived, no-show, cancelled, back to booked)
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { id, notify, ...fields } = body;
  const parsed = parseStaffBooking(fields);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createClient();
  const { data: before, error: readError } = await supabase
    .from('reservations')
    .select('date, time, party_size, status, manage_token')
    .eq('id', id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  // Older staff bookings have no change/cancel link yet; give them one when emailing
  const token: string = before.manage_token ?? newToken();
  const { data, error } = await supabase
    .from('reservations')
    .update({
      ...parsed.value,
      ...(before.manage_token ? {} : { manage_token: token }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(RESERVATION_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let emailed = false;
  if (notify && data.email) {
    const details = { date: data.date, time: data.time, party: data.party_size, name: data.name };
    const moved = data.date !== before.date || data.time !== before.time || data.party_size !== before.party_size;
    let message: { subject: string; html: string; text: string } | null = null;
    if (data.status === 'cancelled' && before.status !== 'cancelled') message = cancellationEmail(details);
    else if (data.status === 'confirmed' && before.status === 'cancelled') message = confirmationEmail({ ...details, token });
    else if (data.status === 'confirmed' && moved) message = updatedEmail({ ...details, token });
    if (message) emailed = await sendEmail({ to: data.email, ...message });
  }
  return NextResponse.json({ ...data, emailed });
}
