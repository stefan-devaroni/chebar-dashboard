// Guest booking emails in English and Spanish (lib/reservation-emails.ts). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cancellationEmail, confirmationEmail, layout, manageLink, updatedEmail } from './reservation-emails';
import { asLang, formatDate, parseGuestBooking } from './reservations';

const TOKEN = '0123456789abcdef0123456789abcdef';
const B = { date: '2026-11-12', time: '17:30', party: 2, name: 'Ana María López', token: TOKEN };

test('English emails are unchanged by default', () => {
  const c = confirmationEmail(B);
  assert.equal(c.subject, 'Your table at Che Bar: Thu, Nov 12 at 5:30 PM');
  assert.match(c.html, /<html lang="en">/);
  assert.match(c.html, /Hi Ana,/);
  assert.match(c.html, /You're booked!/);
  assert.match(c.html, /Thursday, November 12 at 5:30 PM/);
  assert.match(c.html, /Table for 2 · Ana María López/);
  assert.match(c.html, /Your table is during Happy Hour \(5–7 PM\)\./);
  assert.match(c.html, /href="https:\/\/chebararuba\.com\/reserve\/#manage=0123456789abcdef0123456789abcdef"/);
  assert.match(c.html, /Open daily 7:30 AM – 11 PM/);
  assert.equal(
    c.text,
    [
      'Hi Ana,', '', "You're booked at Che Bar!", 'Thursday, November 12 at 5:30 PM', 'Table for 2 · Ana María López',
      'Your table is during Happy Hour (5–7 PM).', '', `Need to change or cancel? https://chebararuba.com/reserve/#manage=${TOKEN}`, '',
      'Che Bar, Paseo Herencia Mall, J.E. Irausquin Blvd 382A, Palm Beach, Aruba', 'Directions: https://maps.google.com/?q=Che+Bar+Paseo+Herencia+Aruba',
      'Questions? Just reply to this email.',
    ].join('\n')
  );
  assert.equal(updatedEmail(B).subject, 'Updated: your table at Che Bar, Thu, Nov 12 at 5:30 PM');
  assert.match(updatedEmail(B).text, /Thursday, November 12 at 5:30 PM, table for 2/);
  const x = cancellationEmail(B);
  assert.equal(x.subject, 'Cancelled: your table at Che Bar on Thu, Nov 12');
  assert.match(x.html, /href="https:\/\/chebararuba\.com\/reserve\/"[^>]*>Book a new table</);
  assert.match(x.text, /Book a new table: https:\/\/chebararuba\.com\/reserve\/$/);
});

test('Spanish confirmation', () => {
  const c = confirmationEmail({ ...B, lang: 'es' });
  assert.equal(c.subject, 'Tu mesa en Che Bar: jue, 12 nov a las 5:30 PM');
  assert.match(c.html, /<html lang="es">/);
  assert.match(c.html, /Hola, Ana:/);
  assert.match(c.html, /¡Listo, tienes tu mesa!/);
  assert.match(c.html, /Jueves, 12 de noviembre a las 5:30 PM/);
  assert.match(c.html, /Mesa para 2 · Ana María López/);
  assert.match(c.html, /Tu mesa es durante el happy hour/);
  assert.match(c.html, /href="https:\/\/chebararuba\.com\/es\/reservar\/#manage=0123456789abcdef0123456789abcdef"[^>]*>Administrar tu reserva</);
  assert.match(c.html, /cómo llegar/);
  assert.match(c.html, /Abierto todos los días de 7:30 AM a 11 PM/);
  assert.doesNotMatch(c.html + c.text, /You're|Table for|Need to change|Open daily|See you/);
  assert.match(c.text, /^Hola, Ana:\n\n¡Listo, tienes tu mesa en Che Bar!\nJueves, 12 de noviembre a las 5:30 PM\nMesa para 2/);
  assert.match(c.text, /Cómo llegar: https:\/\/maps/);
});

test('Spanish change and cancellation', () => {
  const u = updatedEmail({ ...B, time: '08:00', lang: 'es' });
  assert.equal(u.subject, 'Reserva actualizada: tu mesa en Che Bar, jue, 12 nov a las 8:00 AM');
  assert.match(u.html, /Tu reserva cambió/);
  assert.doesNotMatch(u.html, /happy hour/); // 8 AM is not happy hour
  assert.match(u.text, /Jueves, 12 de noviembre a las 8:00 AM, mesa para 2/);
  const x = cancellationEmail({ ...B, lang: 'es' });
  assert.equal(x.subject, 'Cancelada: tu mesa en Che Bar del jue, 12 nov');
  assert.match(x.html, /Tu reserva está cancelada/);
  assert.match(x.html, /href="https:\/\/chebararuba\.com\/es\/reservar\/"[^>]*>Reservar otra mesa</);
  assert.match(x.text, /Reservar otra mesa: https:\/\/chebararuba\.com\/es\/reservar\/$/);
});

test('names are escaped in the HTML', () => {
  const c = confirmationEmail({ ...B, name: '<b>Bo</b> & Co', lang: 'es' });
  assert.doesNotMatch(c.html, /<b>Bo<\/b>/);
  assert.match(c.html, /&lt;b&gt;Bo&lt;\/b&gt; &amp; Co/);
});

test('language helpers', () => {
  assert.equal(asLang('es'), 'es');
  for (const v of ['en', 'ES', 'fr', undefined, null, 1]) assert.equal(asLang(v), 'en');
  assert.equal(manageLink(TOKEN), `https://chebararuba.com/reserve/#manage=${TOKEN}`);
  assert.equal(manageLink(TOKEN, 'es'), `https://chebararuba.com/es/reservar/#manage=${TOKEN}`);
  assert.equal(formatDate('2026-11-12'), 'Thu, Nov 12');
  assert.equal(formatDate('2026-11-12', 'long', 'es'), 'jueves, 12 de noviembre');
  assert.match(layout('x'), /<html lang="en">/); // the job application emails share this layout
  const base = { date: '2026-11-12', time: '08:00', party: 2, name: 'Ana', email: 'ana@example.com' };
  const es = parseGuestBooking({ ...base, lang: 'es' });
  const none = parseGuestBooking(base);
  assert.ok(es.ok && none.ok);
  if (es.ok) assert.equal(es.value.lang, 'es');
  if (none.ok) assert.equal(none.value.lang, 'en');
});
