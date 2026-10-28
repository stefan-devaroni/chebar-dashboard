import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DOC_KEYS, isSectionKey, pointDocLinks, type LinkStatus } from '@/lib/share-sections';

// Private buyer links for the One Pager (Oct 2026), server side. Each person gets their own link (a random
// token in the address) and a passcode, which is only stored as a scrypt hash and shown once, to the owner who
// made the link. A correct passcode gives a cookie for that link only (12 hours), signed with the link's own
// secret. Every opening and every document download is logged. The page they see carries their name across
// every screen, has no print, and stops working when the link expires, is switched off, runs out of openings
// or gets locked. Documents they download carry their name on every page (lib/pdf-stamp.ts).

export const SESSION_HOURS = 12;
export const COOKIE = 'cb_view';
// Links handed out always use the public address: on Netlify a request's own URL is the deploy's internal one
export const PUBLIC_ORIGIN = 'https://dashboard.chebararuba.com';
/** Private Storage bucket with the One Pager's documents (supabase/one-pager-docs.sql) */
export const DOCS_BUCKET = 'one-pager-docs';

const PASSCODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

export type ShareLink = {
  id: string;
  token: string;
  secret: string;
  doc_slug: string;
  recipient_name: string;
  recipient_company: string;
  recipient_email: string | null;
  passcode_hash: string;
  hidden_sections: string[];
  expires_at: string;
  max_views: number | null;
  failed_attempts: number;
  revoked_at: string | null;
  created_at: string;
  created_by: string | null;
};

export const newToken = () => randomBytes(24).toString('base64url');
export const newSecret = () => randomBytes(32).toString('base64url');

/** Eight characters in two groups, e.g. "K7QF-M3XT" */
export function newPasscode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += PASSCODE_ALPHABET[randomInt(PASSCODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

const normalize = (passcode: string) => passcode.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString('base64url')}:${scryptSync(normalize(passcode), salt, 32).toString('base64url')}`;
}

export function checkPasscode(passcode: string, stored: string): boolean {
  const [kind, salt, hash] = stored.split(':');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64url');
  if (want.length !== 32) return false;
  const got = scryptSync(normalize(passcode), Buffer.from(salt, 'base64url'), want.length);
  return timingSafeEqual(want, got);
}

/** Cookie value: link id, expiry (seconds), and a signature with the link's own secret */
export function signSession(linkId: string, secret: string, now = Date.now()): string {
  const body = `${linkId}.${Math.floor(now / 1000) + SESSION_HOURS * 3600}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

export function checkSession(value: string | undefined, linkId: string, secret: string, now = Date.now()): boolean {
  const [id, exp, sig, extra] = (value ?? '').split('.');
  if (extra !== undefined || id !== linkId || !/^\d+$/.test(exp ?? '') || Number(exp) * 1000 < now || !sig) return false;
  const want = createHmac('sha256', secret).update(`${id}.${exp}`).digest();
  const got = Buffer.from(sig, 'base64url');
  return got.length === want.length && timingSafeEqual(want, got);
}

/** A short fingerprint of the visitor's network address, to count devices without storing the address */
export function networkHash(ip: string, secret: string): string {
  return createHash('sha256').update(`${ip}|${secret}`).digest('base64url').slice(0, 12);
}

export function clientIp(request: NextRequest): string {
  return request.headers.get('x-nf-client-connection-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
}

/** The link behind a token, and how often its page has been opened (document downloads don't count) */
export async function loadLink(token: string): Promise<{ link: ShareLink; views: number } | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const supabase = createClient();
  const { data } = await supabase.from('share_links').select('*').eq('token', token).maybeSingle();
  if (!data) return null;
  const { count } = await supabase.from('share_link_views').select('id', { count: 'exact', head: true }).eq('link_id', data.id).is('file', null);
  return { link: data as ShareLink, views: count ?? 0 };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** The marks that name the person: across the page or document, and along the bottom */
export function markText(link: Pick<ShareLink, 'recipient_name' | 'recipient_company'>, at: Date): { mark: string; ribbon: string } {
  const who = [link.recipient_name, link.recipient_company].filter(Boolean).join(' · ');
  const day = at.toLocaleDateString('en-US', { timeZone: 'America/Aruba', month: 'short', day: 'numeric', year: 'numeric' });
  return { mark: `CONFIDENTIAL · ${who} · ${day}`, ribbon: `Confidential · prepared for ${who} · please do not share or forward` };
}

/** The sections a link leaves out; the Documents section goes when all its groups do */
function hiddenKeys(link: Pick<ShareLink, 'hidden_sections'>): string[] {
  const keys = link.hidden_sections.filter(isSectionKey);
  return DOC_KEYS.every((k) => keys.includes(k)) ? [...keys, 'documents'] : keys;
}

/** The One Pager as one buyer sees it: their sections only (taken out of the page, not just hidden), their name
 *  across every screen, no print, and document links that go through their own link */
export function buyerHtml(
  doc: string,
  link: Pick<ShareLink, 'token' | 'recipient_name' | 'recipient_company' | 'hidden_sections'>,
  viewedAt: Date
): string {
  const text = markText(link, viewedAt);
  const mark = escapeHtml(text.mark);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="280"><g transform="rotate(-24 280 140)" ' +
    'font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600">' +
    `<text x="31" y="151" fill="rgba(0,0,0,0.16)">${mark}</text><text x="30" y="150" fill="rgba(255,255,255,0.16)">${mark}</text></g></svg>`;
  const keys = hiddenKeys(link);
  const hidden = keys.map((k) => `[data-section="${k}"]`);
  const style =
    '<style>' +
    (hidden.length ? `${hidden.join(',')}{display:none!important}` : '') +
    `.share-mark{position:fixed;inset:0;z-index:70;pointer-events:none;background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}")}` +
    '.share-ribbon{position:fixed;left:0;right:0;bottom:0;z-index:71;padding:9px 16px;text-align:center;' +
    'font:600 12px/1.4 "Segoe UI",system-ui,-apple-system,Arial,sans-serif;letter-spacing:.04em;color:#1b140d;background:rgba(243,205,140,.94)}' +
    'body{padding-bottom:40px;-webkit-user-select:none;user-select:none}' +
    '@media print{html,body{display:none!important}}' +
    '</style>';
  const overlay = `<div class="share-mark" aria-hidden="true"></div><div class="share-ribbon">${escapeHtml(text.ribbon)}</div>`;
  // Sections sit between <!--section:key--> markers (build_summary.py); the CSS above covers any without them
  const page = keys.reduce(
    (html, k) => html.replace(new RegExp(`<!--section:${k}-->[\\s\\S]*?<!--/section:${k}-->`, 'g'), ''),
    doc.replace(/<!--controls-->[\s\S]*?<!--\/controls-->/, '')
  );
  return pointDocLinks(page, `/view/${link.token}/docs/`)
    .replace('</head>', `${style}</head>`)
    .replace('</body>', `${overlay}</body>`);
}

export const CLOSED_TEXT: Record<Exclude<LinkStatus, 'active'>, string> = {
  expired: 'This link has expired. Ask Che Bar for a new one.',
  off: 'This link has been switched off.',
  used: 'This link has been opened as many times as it allows.',
  locked: 'This link is locked after too many wrong passcodes. Ask Che Bar to unlock it.',
};

/** The passcode page (or a closed-link notice), in the One Pager's dark style; no scripts */
export function passcodePage(opts: { error?: string; closed?: string } = {}): string {
  const body = opts.closed
    ? `<p class="msg">${escapeHtml(opts.closed)}</p>`
    : '<p class="msg">Enter the passcode you received with this link.</p>' +
      '<form method="post"><input name="passcode" required maxlength="20" autocomplete="off" autocapitalize="characters" ' +
      'spellcheck="false" placeholder="XXXX-XXXX" aria-label="Passcode" autofocus><button type="submit">Open</button></form>' +
      (opts.error ? `<p class="err">${escapeHtml(opts.error)}</p>` : '');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Che Bar – confidential</title><style>
*{box-sizing:border-box}html,body{height:100%}
body{margin:0;display:grid;place-items:center;padding:24px;color:#f1e9dc;font:400 16px/1.55 "Segoe UI",system-ui,-apple-system,Arial,sans-serif;
background:radial-gradient(900px 500px at 20% 0%,rgba(217,166,90,.16),transparent 60%),#12100d}
main{width:min(420px,100%);padding:34px 28px;border:1px solid rgba(243,230,210,.16);border-radius:18px;background:#1b1713;text-align:center}
.k{margin:0 0 10px;font:600 11px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:#f3cd8c}
h1{margin:0 0 14px;font:400 40px/1 Didot,"Bodoni 72","Playfair Display",Georgia,serif;letter-spacing:.14em;color:#fff7ea}
.msg{margin:0 0 20px;color:#cfc3b2}
form{display:grid;gap:12px}
input{width:100%;padding:14px 16px;border-radius:12px;border:1px solid rgba(243,230,210,.22);background:#12100d;color:#fff7ea;
font:600 20px/1 ui-monospace,Consolas,monospace;letter-spacing:.2em;text-align:center;text-transform:uppercase}
input:focus{outline:none;border-color:#d9a65a}
button{padding:14px;border:0;border-radius:999px;font:700 15px "Segoe UI",system-ui,sans-serif;color:#1b140d;cursor:pointer;
background:linear-gradient(120deg,#d9a65a,#f3cd8c)}
.err{margin:14px 0 0;color:#f09a7a}
</style></head><body><main><p class="k">Confidential</p><h1>CHE BAR</h1>${body}</main></body></html>`;
}
