import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { notifyOwner } from '@/lib/notify';
import {
  arubaNow,
  closedMessage,
  dayAvailability,
  formatDate,
  formatTime,
  guestsBySlot,
  isDate,
  parseGuestBooking,
  type Reservation,
} from '@/lib/reservations';
import { clientIpHash, corsHeaders, loadSettings } from '@/lib/reservations-server';

// Public booking API for chebararuba.com/reserve/ — no login (middleware lets /api/public through).

export const dynamic = 'force-dynamic';

const UNAVAILABLE = {
  error: 'Online booking is not available right now. Please call or WhatsApp us at +297 699 1696.',
  code: 'unavailable',
};
const SLOT_FULL = { error: 'Sorry, that time just filled up. Please pick another time.', code: 'slot_full' };
const MAX_BOOKINGS_PER_HOUR = 5; // per visitor, to stop spam

function json(request: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(request.headers.get('origin')) });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

// GET                    → booking rules for the page (biggest group, closed days)
// GET ?date=...&party=N  → the times a party of N can still book that day
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { settings, error } = await loadSettings(supabase);
  if (error) return json(request, UNAVAILABLE, 503);

  const now = arubaNow();
  const date = request.nextUrl.searchParams.get('date');
  if (!date) {
    return json(request, {
      online: settings.online_enabled,
      today: now.date,
      maxParty: settings.max_party_online,
      maxDaysAhead: settings.max_days_ahead,
      closedDates: settings.closed_dates.filter((d) => d >= now.date),
    });
  }
  if (!isDate(date)) return json(request, { error: 'Invalid date.', code: 'invalid' }, 400);

  const requested = parseInt(request.nextUrl.searchParams.get('party') ?? '2', 10) || 2;
  const party = Math.min(Math.max(requested, 1), settings.max_party_online);
  const { data: rows, error: rowsError } = await supabase
    .from('reservations')
    .select('time, party_size, status')
    .eq('date', date);
  if (rowsError) return json(request, UNAVAILABLE, 503);

  const day = dayAvailability(date, party, settings, guestsBySlot(rows ?? []), now);
  return json(request, { date, ...day, ...(day.open ? {} : { message: closedMessage(day.reason, settings) }) });
}

// POST → book a table
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: 'Invalid request.', code: 'invalid' }, 400);
  }
  // Honeypot: a hidden field real guests never fill in
  if (body?.website) return json(request, { error: 'Invalid request.', code: 'invalid' }, 400);

  const parsed = parseGuestBooking(body);
  if (!parsed.ok) return json(request, { error: parsed.error, code: 'invalid' }, 400);
  const b = parsed.value;

  const supabase = createClient();
  const { settings, error: settingsError } = await loadSettings(supabase);
  if (settingsError) return json(request, UNAVAILABLE, 503);

  if (b.party > settings.max_party_online) {
    return json(
      request,
      { error: `For groups over ${settings.max_party_online}, please message us on WhatsApp.`, code: 'party_too_big' },
      400
    );
  }

  const ipHash = clientIpHash(request);
  if (ipHash) {
    const { count } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= MAX_BOOKINGS_PER_HOUR) {
      return json(
        request,
        { error: 'Too many bookings from this device. Please call or WhatsApp us at +297 699 1696.', code: 'rate_limited' },
        429
      );
    }
  }

  const { data: rows, error: rowsError } = await supabase
    .from('reservations')
    .select('time, party_size, status')
    .eq('date', b.date);
  if (rowsError) return json(request, UNAVAILABLE, 503);

  const day = dayAvailability(b.date, b.party, settings, guestsBySlot(rows ?? []));
  if (!day.open) return json(request, { error: closedMessage(day.reason, settings), code: 'closed' }, 409);
  const slot = day.slots.find((s) => s.time === b.time);
  if (!slot) {
    return json(request, { error: "That time can't be booked online anymore. Please pick another.", code: 'time_unavailable' }, 409);
  }
  if (!slot.available) return json(request, SLOT_FULL, 409);

  // The database re-checks the limit under a lock, so two guests can't both
  // take the last seats in the same half hour.
  const token = randomBytes(16).toString('hex');
  const { data, error } = await supabase.rpc('book_reservation', {
    p_date: b.date,
    p_time: b.time,
    p_party: b.party,
    p_max_per_slot: settings.max_guests_per_slot,
    p_name: b.name,
    p_phone: b.phone,
    p_email: b.email,
    p_notes: b.notes,
    p_manage_token: token,
    p_client_ref: b.clientRef,
    p_ip_hash: ipHash,
  });
  if (error) {
    if (/slot_full/.test(error.message)) return json(request, SLOT_FULL, 409);
    console.error('book_reservation failed', error);
    return json(request, UNAVAILABLE, 503);
  }

  const r = (Array.isArray(data) ? data[0] : data) as Reservation & { manage_token: string };
  if (!r?.manage_token) return json(request, UNAVAILABLE, 503);

  // A retried submit gets the original booking back — alert only once
  if (r.manage_token === token) {
    await notifyOwner({
      title: `New booking: ${r.party_size} ${r.party_size === 1 ? 'guest' : 'guests'}`,
      message: `${formatDate(r.date)} at ${formatTime(r.time)} · ${r.name}`,
      url: `https://dashboard.chebararuba.com/dashboard/reservations?date=${r.date}`,
      tags: ['fork_and_knife'],
      priority: 3,
    });
  }

  return json(request, {
    ok: true,
    booking: { date: r.date, time: r.time, party: r.party_size, name: r.name, token: r.manage_token },
  });
}
