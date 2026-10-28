// Private buyer links for the One Pager (Oct 2026): the parts both the browser and the server need.
// The passcode and cookie logic lives in lib/share-links.ts (server only).

type SectionChoice = { key: string; label: string; on: boolean; doc?: { prefix: string; name: string }[] };

/** The One Pager's sections (its data-section names), in page order; `on` = shown by default. `doc` marks a group
 *  in the Documents section and the kinds of document in it: files named <prefix><yyyy>[-mm[-dd]].pdf, viewed page
 *  by page (their page images are <prefix><date>.json in the private bucket one-pager-docs) */
export const SECTION_CHOICES: SectionChoice[] = [
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
  { key: 'doc-tax', label: 'Tax returns', on: true, doc: [{ prefix: 'tax-return-', name: 'Tax return' }] },
  { key: 'doc-bank', label: 'Bank statements', on: true, doc: [{ prefix: 'bank-statement-', name: 'Bank statement' }] },
  { key: 'doc-payroll', label: 'Payslips', on: true, doc: [{ prefix: 'payslips-', name: 'Payslips' }] },
  {
    key: 'doc-company',
    label: 'Company and permits',
    on: true,
    doc: [
      { prefix: 'kvk-extract-', name: 'KvK extract' },
      { prefix: 'permit-business-', name: 'Business permit' },
      { prefix: 'permit-female-staff-', name: 'Permission for female staff' },
      { prefix: 'permit-fee-', name: 'Permit fee' },
      { prefix: 'gas-certificate-', name: 'Gas safety certificate' },
    ],
  },
];

export const DEFAULT_HIDDEN = SECTION_CHOICES.filter((s) => !s.on).map((s) => s.key);
export const DOC_KEYS = SECTION_CHOICES.filter((s) => s.doc).map((s) => s.key);

export function isSectionKey(key: unknown): key is string {
  return typeof key === 'string' && SECTION_CHOICES.some((s) => s.key === key);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The group a One Pager document belongs to, its name, and where its page images are, e.g. tax-return-2026-04.pdf →
 *  { key: 'doc-tax', label: 'Tax return April 2026', pages: 'tax-return-2026-04.json' } */
export function docFile(file: string): { key: string; label: string; pages: string } | null {
  for (const s of SECTION_CHOICES) {
    const kind = s.doc?.find((d) => file.startsWith(d.prefix));
    if (!kind) continue;
    const m = /^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?\.pdf$/.exec(file.slice(kind.prefix.length));
    if (!m) return null;
    const [, year, month, day] = m;
    const when = month ? `${day ? `${Number(day)} ` : ''}${MONTHS[Number(month) - 1]} ${year}` : year;
    return { key: s.key, label: `${kind.name} ${when}`, pages: file.replace(/\.pdf$/, '.json') };
  }
  return null;
}

/** Point the One Pager's document links (href="docs/…", which work next to the local file) at the server */
export const pointDocLinks = (html: string, base: string, attrs = '') => html.replace(/href="docs\//g, `${attrs}href="${base}`);

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

/** A browser that comes back within this long of its last action on a link is still on the same visit */
export const VISIT_GAP_MS = 60 * 60_000;

/**
 * The summary loads that start a visit: what "opened" counts and max openings limits. Going back to the summary from
 * a document, or reloading it, within an hour of the same browser's last action on the link is the same visit (Stefan,
 * Oct 28: Robert's returns from documents were using up his openings). Browsers are told apart by user agent, not
 * network: Robert's Mac switched addresses between two clicks.
 */
export function visitStarts<T extends { viewed_at: string; user_agent: string | null; file: string | null }>(rows: T[]): Set<T> {
  const last = new Map<string, number>();
  const starts = new Set<T>();
  for (const v of [...rows].sort((a, b) => Date.parse(a.viewed_at) - Date.parse(b.viewed_at))) {
    const at = Date.parse(v.viewed_at);
    const before = last.get(v.user_agent ?? '');
    if (!v.file && (before === undefined || at - before > VISIT_GAP_MS)) starts.add(v);
    last.set(v.user_agent ?? '', at);
  }
  return starts;
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
