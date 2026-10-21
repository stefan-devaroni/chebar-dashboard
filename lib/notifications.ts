// The bell in the dashboard: one row per event the owner should see
// (job applications, online bookings, missing deliveries). Best-effort, like the ntfy alerts.
import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationKind = 'application' | 'reservation' | 'delivery';

export interface AppNotification {
  id: string;
  created_at: string;
  kind: NotificationKind | string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
}

export const NOTIFICATION_COLUMNS = 'id, created_at, kind, title, body, link, read_at';

export async function addNotification(
  supabase: SupabaseClient,
  n: { kind: NotificationKind; title: string; body?: string | null; link?: string | null }
) {
  try {
    await supabase.from('notifications').insert({ kind: n.kind, title: n.title.slice(0, 200), body: n.body ?? null, link: n.link ?? null });
  } catch {
    // The push alert and the dashboard data are the record; a missed bell entry is not fatal
  }
}
