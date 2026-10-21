import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyOwner } from '@/lib/notify';
import { addNotification } from '@/lib/notifications';
import { RESTAURANT_EMAIL, sendEmail } from '@/lib/email';
import { cancellationEmail } from '@/lib/reservation-emails';
import { arubaNow, formatDate, formatTime, toMinutes } from '@/lib/reservations';
import { corsHeaders } from '@/lib/reservations-server';

// The guest's "change or cancel" link: POST { token, action: 'get' | 'cancel' }.
// POST keeps the token out of URLs and server logs.

export const dynamic = 'force-dynamic';

function json(request: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(request.headers.get('origin')) });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return json(request, { error: "This booking link isn't valid.", code: 'invalid' }, 400);
  }

  const supabase = createClient();
  const { data: r, error } = await supabase
    .from('reservations')
    .select('id, date, time, party_size, name, email, status')
    .eq('manage_token', token)
    .maybeSingle();
  if (error) {
    return json(request, { error: `Something went wrong. Please email us at ${RESTAURANT_EMAIL}.`, code: 'unavailable' }, 503);
  }
  if (!r) return json(request, { error: "We couldn't find this booking.", code: 'not_found' }, 404);

  const booking = { date: r.date, time: r.time, party: r.party_size, name: r.name, status: r.status };
  if (body.action !== 'cancel') return json(request, { booking });

  if (r.status === 'cancelled') return json(request, { ok: true, booking });
  const now = arubaNow();
  const passed = r.date < now.date || (r.date === now.date && toMinutes(r.time) <= now.minutes);
  if (r.status !== 'confirmed' || passed) {
    return json(request, { error: `This booking can't be changed online anymore. Please email us at ${RESTAURANT_EMAIL}.`, code: 'locked' }, 409);
  }

  const { error: updateError } = await supabase
    .from('reservations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', r.id);
  if (updateError) {
    return json(request, { error: `Something went wrong. Please email us at ${RESTAURANT_EMAIL}.`, code: 'unavailable' }, 503);
  }

  const details = { date: r.date, time: r.time, party: r.party_size, name: r.name };
  await Promise.all([
    r.email ? sendEmail({ to: r.email, ...cancellationEmail(details) }) : Promise.resolve(false),
    notifyOwner({
      title: 'Booking cancelled',
      message: `${r.party_size} ${r.party_size === 1 ? 'guest' : 'guests'} · ${formatDate(r.date)} at ${formatTime(r.time)} · ${r.name}`,
      url: `https://dashboard.chebararuba.com/dashboard/reservations?date=${r.date}`,
      tags: ['x'],
      priority: 3,
    }),
    addNotification(supabase, {
      kind: 'reservation',
      title: 'Booking cancelled',
      body: `${r.party_size} ${r.party_size === 1 ? 'guest' : 'guests'} · ${formatDate(r.date)} at ${formatTime(r.time)} · ${r.name}`,
      link: `/dashboard/reservations?date=${r.date}`,
    }),
  ]);
  return json(request, { ok: true, booking: { ...booking, status: 'cancelled' } });
}
