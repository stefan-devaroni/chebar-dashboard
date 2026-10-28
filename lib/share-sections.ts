// Private buyer links for the One Pager (Oct 2026): the parts both the browser and the server need.
// The passcode and cookie logic lives in lib/share-links.ts (server only).

/** The One Pager's sections (its data-section names), in page order; `on` = shown by default */
export const SECTION_CHOICES: { key: string; label: string; on: boolean }[] = [
  { key: 'photos', label: 'Photos', on: true },
  { key: 'keys', label: 'Key numbers', on: true },
  { key: 'sales', label: 'Monthly sales', on: true },
  { key: 'costs', label: 'Revenue and main costs', on: true },
  { key: 'perf', label: 'Sales split and guests', on: true },
  { key: 'delivery', label: 'Delivery apps', on: true },
  { key: 'online', label: 'Online presence', on: true },
  { key: 'staff', label: 'Staff', on: true },
  { key: 'assets', label: 'What comes with it', on: true },
  { key: 'growth', label: 'Room for growth', on: true },
  { key: 'offer', label: 'The offer', on: false },
  { key: 'later', label: 'Next stage', on: true },
];

export const DEFAULT_HIDDEN = SECTION_CHOICES.filter((s) => !s.on).map((s) => s.key);

export function isSectionKey(key: unknown): key is string {
  return typeof key === 'string' && SECTION_CHOICES.some((s) => s.key === key);
}

/** Wrong passcodes before a link locks itself (an owner can unlock it) */
export const MAX_FAILED = 10;

export type LinkStatus = 'active' | 'expired' | 'off' | 'used' | 'locked';

export const STATUS_TEXT: Record<LinkStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  off: 'Switched off',
  used: 'Used up',
  locked: 'Locked',
};

export function linkStatus(
  link: { revoked_at: string | null; expires_at: string; failed_attempts: number; max_views: number | null },
  views: number,
  now = Date.now()
): LinkStatus {
  if (link.revoked_at) return 'off';
  if (new Date(link.expires_at).getTime() <= now) return 'expired';
  if (link.failed_attempts >= MAX_FAILED) return 'locked';
  if (link.max_views != null && views >= link.max_views) return 'used';
  return 'active';
}

/** "iPhone, Safari" style description of a browser's user agent */
export function deviceName(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Other device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  return browser ? `${device}, ${browser}` : device;
}

/** Date and time in Aruba, e.g. "Oct 28, 2026, 3:14 PM" */
export function arubaTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Aruba', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
