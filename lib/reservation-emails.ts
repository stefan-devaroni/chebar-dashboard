import { formatDate, formatTime, toMinutes } from '@/lib/reservations';

// Guest emails for online bookings: confirmation and cancellation.

const SITE = 'https://chebararuba.com';
const ADDRESS = 'Paseo Herencia Mall, J.E. Irausquin Blvd 382A, Palm Beach, Aruba';
const MAPS = 'https://maps.google.com/?q=Che+Bar+Paseo+Herencia+Aruba';

interface EmailBooking {
  date: string;
  time: string;
  party: number;
  name: string;
}

export function manageLink(token: string): string {
  return `${SITE}/reserve/#manage=${token}`;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const isHappyHour = (t: string) => toMinutes(t) >= 17 * 60 && toMinutes(t) < 19 * 60;

export function layout(body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f1ea;font-family:Helvetica,Arial,sans-serif;color:#1a1612">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#1a1612"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Helvetica,Arial,sans-serif">
<tr><td style="background:#1a1612;padding:22px;text-align:center;font-family:Georgia,serif;letter-spacing:6px;color:#d4a574;font-size:18px">CHE BAR</td></tr>
<tr><td style="padding:28px 26px">${body}</td></tr>
<tr><td style="padding:18px 26px;background:#faf7f2;color:#7a736c;font-size:12px;line-height:1.6;text-align:center">${esc(ADDRESS)}<br>Open daily 7:30 AM – 11 PM</td></tr>
</table></td></tr></table></body></html>`;
}

function summaryBox(b: EmailBooking, extra = ''): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;border-radius:10px"><tr><td style="padding:16px 18px">
<div style="font-size:17px;font-weight:bold">${esc(formatDate(b.date, 'long'))} at ${formatTime(b.time)}</div>
<div style="margin-top:4px;color:#5c554e;font-size:14px">Table for ${b.party} · ${esc(b.name)}</div>${extra}
</td></tr></table>`;
}

export function confirmationEmail(b: EmailBooking & { token: string }) {
  const link = manageLink(b.token);
  const happyHour = isHappyHour(b.time) ? 'Your table is during Happy Hour (5–7 PM).' : '';
  const subject = `Your table at Che Bar: ${formatDate(b.date)} at ${formatTime(b.time)}`;
  const html = layout(`
<p style="margin:0 0 6px;font-size:15px">Hi ${esc(firstName(b.name))},</p>
<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:normal;font-size:24px">You're booked!</h1>
${summaryBox(b, happyHour ? `<div style="margin-top:8px;color:#c0613a;font-size:14px">${happyHour}</div>` : '')}
<p style="margin:22px 0 10px;font-size:14px;color:#5c554e">Need to change or cancel?</p>
<a href="${link}" style="display:inline-block;background:#d4a574;color:#1a1612;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;font-size:14px">Manage your booking</a>
<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#5c554e">Find us at Paseo Herencia Mall in Palm Beach (<a href="${MAPS}" style="color:#a07d55">directions</a>). Questions? Just reply to this email.</p>
<p style="margin:18px 0 0;font-size:14px">See you soon,<br>Che Bar</p>`);
  const text = [
    `Hi ${firstName(b.name)},`,
    '',
    "You're booked at Che Bar!",
    `${formatDate(b.date, 'long')} at ${formatTime(b.time)}`,
    `Table for ${b.party} · ${b.name}`,
    ...(happyHour ? [happyHour] : []),
    '',
    `Need to change or cancel? ${link}`,
    '',
    `Che Bar, ${ADDRESS}`,
    `Directions: ${MAPS}`,
    'Questions? Just reply to this email.',
  ].join('\n');
  return { subject, html, text };
}

// Sent when staff move a booking to another day/time or change the party size
export function updatedEmail(b: EmailBooking & { token: string }) {
  const link = manageLink(b.token);
  const subject = `Updated: your table at Che Bar, ${formatDate(b.date)} at ${formatTime(b.time)}`;
  const html = layout(`
<p style="margin:0 0 6px;font-size:15px">Hi ${esc(firstName(b.name))},</p>
<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:normal;font-size:24px">Your booking has changed</h1>
<p style="margin:0 0 12px;font-size:14px;color:#5c554e">Here are the new details:</p>
${summaryBox(b)}
<p style="margin:22px 0 10px;font-size:14px;color:#5c554e">Need to change or cancel?</p>
<a href="${link}" style="display:inline-block;background:#d4a574;color:#1a1612;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;font-size:14px">Manage your booking</a>
<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#5c554e">Questions? Just reply to this email.</p>
<p style="margin:18px 0 0;font-size:14px">See you soon,<br>Che Bar</p>`);
  const text = [
    `Hi ${firstName(b.name)},`,
    '',
    'Your booking at Che Bar has changed. New details:',
    `${formatDate(b.date, 'long')} at ${formatTime(b.time)}, table for ${b.party}`,
    '',
    `Need to change or cancel? ${link}`,
    'Questions? Just reply to this email.',
  ].join('\n');
  return { subject, html, text };
}

export function cancellationEmail(b: EmailBooking) {
  const subject = `Cancelled: your table at Che Bar on ${formatDate(b.date)}`;
  const html = layout(`
<p style="margin:0 0 6px;font-size:15px">Hi ${esc(firstName(b.name))},</p>
<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:normal;font-size:24px">Your booking is cancelled</h1>
${summaryBox(b)}
<p style="margin:22px 0 10px;font-size:14px;color:#5c554e">Hope to see you another time.</p>
<a href="${SITE}/reserve/" style="display:inline-block;background:#d4a574;color:#1a1612;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;font-size:14px">Book a new table</a>
<p style="margin:24px 0 0;font-size:14px">Che Bar</p>`);
  const text = [
    `Hi ${firstName(b.name)},`,
    '',
    'Your booking at Che Bar is cancelled:',
    `${formatDate(b.date, 'long')} at ${formatTime(b.time)}, table for ${b.party}`,
    '',
    `Book a new table: ${SITE}/reserve/`,
  ].join('\n');
  return { subject, html, text };
}
