import { parseManagerEmails } from './role-logic';

// Who may add sales numbers by email (/api/ingest-email). Every mail to any address
// @ingest.chebararuba.com reaches that route, so before any attachment is opened it checks the
// sender: Revel's scheduled reports and the owners' own addresses (they forward a Revel CSV export
// to fill a missed day) get through, anything else is logged as skipped. Pure, so it can be tested
// on its own: lib/inbound-sender.test.ts, `npm test`.
//
// A From line can be forged. SendGrid also posts what SPF and DKIM said about the mail (form fields
// `SPF` and `dkim`, and in `envelope` the return path that SPF checked). `confirmedBy` says which of
// them vouch for the From address's own domain; a domain in REQUIRE_PASS_FOR must have one.

/** Revel's scheduled daily reports come from this address: "REVEL <noreply@revelsystems.com>" */
export const REVEL_SENDER = 'noreply@revelsystems.com';

/**
 * Mail from these domains is refused unless SPF or DKIM passed for that same domain. Empty for now:
 * since Nov 5 2026 every email's results are kept in report_ingestions.sender_auth, to see what
 * Revel's mails carry before requiring it. Add 'revelsystems.com' once they reliably have a pass.
 */
export const REQUIRE_PASS_FOR: readonly string[] = [];

export interface SenderAuth {
  /** SendGrid's SPF result for the return path: pass, softfail, fail, neutral, none, ... */
  spf: string | null;
  /** SendGrid's DKIM results, one per signature, e.g. "{@revelsystems.com : pass}" */
  dkim: string | null;
  /** The return path (envelope sender) the SPF result is about, lower case */
  envelopeFrom: string | null;
}

export type Proof = 'dkim' | 'spf';

export interface SenderCheck {
  ok: boolean;
  /** Revel's reports or an owner; null when it's neither */
  sender: 'revel' | 'owner' | null;
  /** The From address, lower case; null when the From line doesn't hold one clear address */
  address: string | null;
  /** Which checks vouch for the From address's domain (empty: neither does) */
  confirmedBy: Proof[];
  /** Why it was refused, in plain English (report_ingestions.error_message); empty when ok */
  reason: string;
}

const NOT_OPENED = 'Nothing attached to it was opened or kept.';

// One mailbox: no spaces, quotes, brackets or second @, and a domain with at least one dot
const ADDRESS = /^[^\s@<>()[\]\\,;:"]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

/**
 * The one email address in a From line, lower case: 'REVEL <noreply@revelsystems.com>' or a bare
 * 'noreply@revelsystems.com'. Null for anything else, such as two addresses or an address in front
 * of the <...> one, which could make a mail look like it's from someone it isn't.
 */
export function fromAddress(header: string | null | undefined): string | null {
  const line = String(header ?? '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""') // a quoted display name may hold anything, even "<a@b.c>"
    .replace(/\([^()]*\)/g, ' ') // and so may a (comment)
    .trim();
  let address = line;
  const open = line.indexOf('<');
  if (open !== -1) {
    const close = line.indexOf('>', open);
    if (close === -1 || line.indexOf('<', open + 1) !== -1) return null;
    // Only a display name may stand in front of <address>, and nothing after it
    if (/[@,<>]/.test(line.slice(0, open)) || line.slice(close + 1).trim()) return null;
    address = line.slice(open + 1, close);
  }
  address = address.trim().toLowerCase();
  return ADDRESS.test(address) ? address : null;
}

/** SendGrid's dkim field, one entry per signature: '{@sendgrid.info : pass, @revelsystems.com : pass}' */
export function dkimResults(field: string | null | undefined): { domain: string; result: string }[] {
  return Array.from(String(field ?? '').matchAll(/@([a-z0-9.-]+)\s*:\s*([a-z]+)/gi), (m) => ({
    domain: m[1].toLowerCase().replace(/\.+$/, ''),
    result: m[2].toLowerCase(),
  }));
}

/** The return path in SendGrid's envelope field: {"to":["revel@ingest.chebararuba.com"],"from":"..."} */
export function envelopeFrom(field: string | null | undefined): string | null {
  try {
    const from = JSON.parse(String(field ?? '')).from;
    return typeof from === 'string' && from.includes('@') ? from.replace(/[<>\s]/g, '').toLowerCase() : null;
  } catch {
    return null;
  }
}

/** What SendGrid posted about SPF and DKIM (form fields SPF, dkim and envelope) */
export function readSenderAuth(form: { get(name: string): unknown }): SenderAuth {
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  return { spf: field('SPF') ?? field('spf'), dkim: field('dkim'), envelopeFrom: envelopeFrom(field('envelope')) };
}

// The same domain or one of its subdomains: a return path at em5.revelsystems.com counts for revelsystems.com
const within = (domain: string, of: string) => domain === of || domain.endsWith(`.${of}`);
const domainOf = (address: string) => address.slice(address.lastIndexOf('@') + 1);

/** Which of DKIM and SPF passed for the address's own domain */
export function confirmedBy(address: string, auth: SenderAuth): Proof[] {
  const domain = domainOf(address);
  const proofs: Proof[] = [];
  if (dkimResults(auth.dkim).some((s) => s.result === 'pass' && within(s.domain, domain))) proofs.push('dkim');
  const spf = (auth.spf ?? '').trim().toLowerCase().split(/\s+/)[0];
  if (spf === 'pass' && auth.envelopeFrom && within(domainOf(auth.envelopeFrom), domain)) proofs.push('spf');
  return proofs;
}

/** Owners' own addresses: active team members with role 'owner', plus ALLOWED_EMAILS */
export function ownerAddresses(
  members: { email?: string | null; role?: string | null; active?: boolean | null }[],
  allowedEmails: string | undefined
): string[] {
  const owners = members
    .filter((m) => m.role === 'owner' && m.active !== false)
    .map((m) => (m.email ?? '').trim().toLowerCase());
  return Array.from(new Set([...owners, ...parseManagerEmails(allowedEmails)])).filter(Boolean);
}

/**
 * May this email add numbers? Mail from Revel's report address and the owners' own addresses may.
 * For a domain in `requirePassFor`, SPF or DKIM must also confirm it came from that domain.
 */
export function checkSender(
  from: string | null | undefined,
  auth: SenderAuth,
  owners: readonly string[],
  requirePassFor: readonly string[] = REQUIRE_PASS_FOR
): SenderCheck {
  const address = fromAddress(from);
  if (!address) {
    return {
      ok: false,
      sender: null,
      address: null,
      confirmedBy: [],
      reason: `Refused: the From line doesn't hold one clear email address, so there's no telling who sent it. ${NOT_OPENED}`,
    };
  }
  const proofs = confirmedBy(address, auth);
  const sender =
    address === REVEL_SENDER ? 'revel' : owners.some((o) => o.trim().toLowerCase() === address) ? 'owner' : null;
  if (!sender) {
    return {
      ok: false,
      sender,
      address,
      confirmedBy: proofs,
      reason: `Refused: sent from ${address}, which is not Revel's report address (${REVEL_SENDER}) or an owner's own email. ${NOT_OPENED}`,
    };
  }
  const domain = domainOf(address);
  if (proofs.length === 0 && requirePassFor.some((d) => within(domain, d.toLowerCase()))) {
    return {
      ok: false,
      sender,
      address,
      confirmedBy: proofs,
      reason: `Refused: it says it's from ${address}, but neither SPF nor DKIM confirms it came from ${domain}, so it may be forged. ${NOT_OPENED}`,
    };
  }
  return { ok: true, sender, address, confirmedBy: proofs, reason: '' };
}

/** What goes into report_ingestions.sender_auth for every email */
export function senderAuthLog(auth: SenderAuth, check: SenderCheck) {
  return { spf: auth.spf, dkim: auth.dkim, envelope_from: auth.envelopeFrom, confirmed_by: check.confirmedBy };
}
