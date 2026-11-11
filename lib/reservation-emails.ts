import { formatDate, formatTime, toMinutes, type Lang } from '@/lib/reservations';

// Guest emails for bookings: confirmation, change and cancellation, in the guest's
// language (bookings made on chebararuba.com/es/reservar/ are 'es').

const SITE = 'https://chebararuba.com';
const ADDRESS = 'Paseo Herencia Mall, J.E. Irausquin Blvd 382A, Palm Beach, Aruba';
const MAPS = 'https://maps.google.com/?q=Che+Bar+Paseo+Herencia+Aruba';

interface EmailBooking {
  date: string;
  time: string;
  party: number;
  name: string;
  lang?: Lang; // default 'en'
}

const BOOKING_PAGE: Record<Lang, string> = { en: `${SITE}/reserve/`, es: `${SITE}/es/reservar/` };

export function manageLink(token: string, lang: Lang = 'en'): string {
  return `${BOOKING_PAGE[lang]}#manage=${token}`;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const isHappyHour = (t: string) => toMinutes(t) >= 17 * 60 && toMinutes(t) < 19 * 60;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Every guest-facing line, per language
const T = {
  en: {
    openDaily: 'Open daily 7:30 AM – 11 PM',
    when: (b: EmailBooking) => `${formatDate(b.date, 'long')} at ${formatTime(b.time)}`,
    tableFor: (n: number) => `Table for ${n}`,
    hi: (name: string) => `Hi ${name},`,
    happyHour: 'Your table is during Happy Hour (5–7 PM).',
    needChange: 'Need to change or cancel?',
    manage: 'Manage your booking',
    findUs: (directions: string) => `Find us at Paseo Herencia Mall in Palm Beach (${directions}). Questions? Just reply to this email.`,
    directions: 'directions',
    questions: 'Questions? Just reply to this email.',
    seeYou: 'See you soon,',
    confirmed: {
      subject: (b: EmailBooking) => `Your table at Che Bar: ${formatDate(b.date)} at ${formatTime(b.time)}`,
      title: "You're booked!",
      textTitle: "You're booked at Che Bar!",
    },
    updated: {
      subject: (b: EmailBooking) => `Updated: your table at Che Bar, ${formatDate(b.date)} at ${formatTime(b.time)}`,
      title: 'Your booking has changed',
      intro: 'Here are the new details:',
      textIntro: 'Your booking at Che Bar has changed. New details:',
    },
    cancelled: {
      subject: (b: EmailBooking) => `Cancelled: your table at Che Bar on ${formatDate(b.date)}`,
      title: 'Your booking is cancelled',
      textIntro: 'Your booking at Che Bar is cancelled:',
      another: 'Hope to see you another time.',
      book: 'Book a new table',
    },
  },
  es: {
    openDaily: 'Abierto todos los días de 7:30 AM a 11 PM',
    when: (b: EmailBooking) => `${cap(formatDate(b.date, 'long', 'es'))} a las ${formatTime(b.time)}`,
    tableFor: (n: number) => `Mesa para ${n}`,
    hi: (name: string) => `Hola, ${name}:`,
    happyHour: 'Tu mesa es durante el happy hour (5–7 PM).',
    needChange: '¿Necesitas cambiarla o cancelarla?',
    manage: 'Administrar tu reserva',
    findUs: (directions: string) => `Estamos en Paseo Herencia Mall, en Palm Beach (${directions}). ¿Tienes preguntas? Responde a este correo.`,
    directions: 'cómo llegar',
    questions: '¿Tienes preguntas? Responde a este correo.',
    seeYou: 'Hasta pronto,',
    confirmed: {
      subject: (b: EmailBooking) => `Tu mesa en Che Bar: ${formatDate(b.date, 'short', 'es')} a las ${formatTime(b.time)}`,
      title: '¡Listo, tienes tu mesa!',
      textTitle: '¡Listo, tienes tu mesa en Che Bar!',
    },
    updated: {
      subject: (b: EmailBooking) => `Reserva actualizada: tu mesa en Che Bar, ${formatDate(b.date, 'short', 'es')} a las ${formatTime(b.time)}`,
      title: 'Tu reserva cambió',
      intro: 'Estos son los nuevos datos:',
      textIntro: 'Tu reserva en Che Bar cambió. Nuevos datos:',
    },
    cancelled: {
      subject: (b: EmailBooking) => `Cancelada: tu mesa en Che Bar del ${formatDate(b.date, 'short', 'es')}`,
      title: 'Tu reserva está cancelada',
      textIntro: 'Tu reserva en Che Bar está cancelada:',
      another: 'Esperamos verte en otra ocasión.',
      book: 'Reservar otra mesa',
    },
  },
};

export function layout(body: string, lang: Lang = 'en'): string {
  return `<!doctype html><html lang="${lang}"><body style="margin:0;padding:0;background:#f4f1ea;font-family:Helvetica,Arial,sans-serif;color:#1a1612">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#1a1612"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Helvetica,Arial,sans-serif">
<tr><td style="background:#1a1612;padding:22px;text-align:center;font-family:Georgia,serif;letter-spacing:6px;color:#d4a574;font-size:18px">CHE BAR</td></tr>
<tr><td style="padding:28px 26px">${body}</td></tr>
<tr><td style="padding:18px 26px;background:#faf7f2;color:#7a736c;font-size:12px;line-height:1.6;text-align:center">${esc(ADDRESS)}<br>${T[lang].openDaily}</td></tr>
</table></td></tr></table></body></html>`;
}

function summaryBox(b: EmailBooking, t: (typeof T)[Lang], extra = ''): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;border-radius:10px"><tr><td style="padding:16px 18px">
<div style="font-size:17px;font-weight:bold">${esc(t.when(b))}</div>
<div style="margin-top:4px;color:#5c554e;font-size:14px">${t.tableFor(b.party)} · ${esc(b.name)}</div>${extra}
</td></tr></table>`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#d4a574;color:#1a1612;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;font-size:14px">${label}</a>`;
const hello = (b: EmailBooking, t: (typeof T)[Lang]) => `<p style="margin:0 0 6px;font-size:15px">${esc(t.hi(firstName(b.name)))}</p>`;
const title = (s: string) => `<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:normal;font-size:24px">${s}</h1>`;

export function confirmationEmail(b: EmailBooking & { token: string }) {
  const lang = b.lang ?? 'en', t = T[lang];
  const link = manageLink(b.token, lang);
  const happyHour = isHappyHour(b.time) ? t.happyHour : '';
  const subject = t.confirmed.subject(b);
  const html = layout(`
${hello(b, t)}
${title(t.confirmed.title)}
${summaryBox(b, t, happyHour ? `<div style="margin-top:8px;color:#c0613a;font-size:14px">${happyHour}</div>` : '')}
<p style="margin:22px 0 10px;font-size:14px;color:#5c554e">${t.needChange}</p>
${button(link, t.manage)}
<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#5c554e">${t.findUs(`<a href="${MAPS}" style="color:#a07d55">${t.directions}</a>`)}</p>
<p style="margin:18px 0 0;font-size:14px">${t.seeYou}<br>Che Bar</p>`, lang);
  const text = [
    t.hi(firstName(b.name)),
    '',
    t.confirmed.textTitle,
    t.when(b),
    `${t.tableFor(b.party)} · ${b.name}`,
    ...(happyHour ? [happyHour] : []),
    '',
    `${t.needChange} ${link}`,
    '',
    `Che Bar, ${ADDRESS}`,
    `${cap(t.directions)}: ${MAPS}`,
    t.questions,
  ].join('\n');
  return { subject, html, text };
}

// Sent when staff move a booking to another day/time or change the party size
export function updatedEmail(b: EmailBooking & { token: string }) {
  const lang = b.lang ?? 'en', t = T[lang];
  const link = manageLink(b.token, lang);
  const subject = t.updated.subject(b);
  const html = layout(`
${hello(b, t)}
${title(t.updated.title)}
<p style="margin:0 0 12px;font-size:14px;color:#5c554e">${t.updated.intro}</p>
${summaryBox(b, t)}
<p style="margin:22px 0 10px;font-size:14px;color:#5c554e">${t.needChange}</p>
${button(link, t.manage)}
<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#5c554e">${t.questions}</p>
<p style="margin:18px 0 0;font-size:14px">${t.seeYou}<br>Che Bar</p>`, lang);
  const text = [
    t.hi(firstName(b.name)),
    '',
    t.updated.textIntro,
    `${t.when(b)}, ${t.tableFor(b.party).charAt(0).toLowerCase()}${t.tableFor(b.party).slice(1)}`,
    '',
    `${t.needChange} ${link}`,
    t.questions,
  ].join('\n');
  return { subject, html, text };
}

export function cancellationEmail(b: EmailBooking) {
  const lang = b.lang ?? 'en', t = T[lang];
  const subject = t.cancelled.subject(b);
  const html = layout(`
${hello(b, t)}
${title(t.cancelled.title)}
${summaryBox(b, t)}
<p style="margin:22px 0 10px;font-size:14px;color:#5c554e">${t.cancelled.another}</p>
${button(BOOKING_PAGE[lang], t.cancelled.book)}
<p style="margin:24px 0 0;font-size:14px">Che Bar</p>`, lang);
  const text = [
    t.hi(firstName(b.name)),
    '',
    t.cancelled.textIntro,
    `${t.when(b)}, ${t.tableFor(b.party).charAt(0).toLowerCase()}${t.tableFor(b.party).slice(1)}`,
    '',
    `${t.cancelled.book}: ${BOOKING_PAGE[lang]}`,
  ].join('\n');
  return { subject, html, text };
}
