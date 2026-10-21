import { createClient } from '@/lib/supabase/server';
import { getSessionInfo } from '@/lib/roles';
import { ReservationsView } from '@/components/reservations-view';
import { addDays, arubaNow, isDate, normalizeSettings, STRIP_DAYS, stripStart, type Reservation } from '@/lib/reservations';
import { isMissingTable, RESERVATION_COLUMNS } from '@/lib/reservations-server';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage({ searchParams }: { searchParams: { date?: string } }) {
  const supabase = createClient();
  const today = arubaNow().date;
  const date = isDate(searchParams.date) ? searchParams.date : today;
  // Load the days shown in the day strip (the next two weeks, or the two weeks around the day being viewed)
  const from = stripStart(date, today);
  const to = addDays(from, STRIP_DAYS - 1);

  const [session, { data: rows, error }, { data: settingsRow }] = await Promise.all([
    getSessionInfo().catch(() => null),
    supabase
      .from('reservations')
      .select(RESERVATION_COLUMNS)
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('time'),
    supabase.from('reservation_settings').select('*').eq('id', 1).maybeSingle(),
  ]);

  return (
    <div className="max-w-2xl">
      <ReservationsView
        initialDate={date}
        today={today}
        initialRange={{ from, to }}
        initialReservations={(rows ?? []) as Reservation[]}
        initialSettings={normalizeSettings(settingsRow)}
        role={session?.role ?? 'employee'}
        setupNeeded={isMissingTable(error)}
        emailsEnabled={Boolean(process.env.RESEND_API_KEY)}
      />
    </div>
  );
}
