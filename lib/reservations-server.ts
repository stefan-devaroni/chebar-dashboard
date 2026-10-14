import { createHmac } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeSettings, type ReservationSettings } from '@/lib/reservations';

// Staff-facing columns (never the guest's manage token or the hashed IP)
export const RESERVATION_COLUMNS =
  'id, date, time, party_size, name, phone, email, notes, status, source, created_at';

// The public website is the only browser origin allowed to call the booking API
const SITE_ORIGINS = ['https://chebararuba.com', 'https://www.chebararuba.com'];

export function corsHeaders(origin: string | null): Record<string, string> {
  const devOrigin =
    process.env.NODE_ENV !== 'production' && !!origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowed = !!origin && (SITE_ORIGINS.includes(origin) || devOrigin);
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin as string } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

// True when supabase/reservations.sql hasn't been run yet
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST202' ||
    /does not exist|schema cache/i.test(error.message ?? '')
  );
}

export async function loadSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('reservation_settings').select('*').eq('id', 1).maybeSingle();
  return { settings: normalizeSettings(data) as ReservationSettings, error };
}

// Hashed (never stored raw) so the public form can be rate-limited per visitor
export function clientIpHash(request: Request): string | null {
  const ip =
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';
  if (!ip) return null;
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'che-bar-reservations')
    .update(ip)
    .digest('hex')
    .slice(0, 32);
}
