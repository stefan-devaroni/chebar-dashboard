// The email import's sender check (lib/inbound-sender.ts). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSender,
  confirmedBy,
  dkimResults,
  envelopeFrom,
  fromAddress,
  ownerAddresses,
  readSenderAuth,
  senderAuthLog,
  REQUIRE_PASS_FOR,
  REVEL_SENDER,
  type SenderAuth,
} from './inbound-sender';

const NO_AUTH: SenderAuth = { spf: null, dkim: null, envelopeFrom: null };
const OWNERS = ['owner@example.com', 'partner@example.net']; // stand-ins for the owners' own addresses
const REVEL = 'REVEL <noreply@revelsystems.com>'; // as logged in report_ingestions.sender_email
// What a Revel mail carries when both DKIM and SPF pass for revelsystems.com
const REVEL_PASS: SenderAuth = {
  spf: 'pass',
  dkim: '{@revelsystems.com : pass}',
  envelopeFrom: 'bounces+123@em5.revelsystems.com',
};
const NOT_OPENED = /Nothing attached to it was opened or kept\.$/;

test('fromAddress reads the one address in a From line', () => {
  assert.equal(fromAddress(REVEL), REVEL_SENDER);
  assert.equal(fromAddress('noreply@revelsystems.com'), REVEL_SENDER);
  assert.equal(fromAddress('<noreply@revelsystems.com>'), REVEL_SENDER);
  assert.equal(fromAddress('"Owner, The" <Owner@Example.com>'), 'owner@example.com');
  assert.equal(fromAddress('partner@example.net (The Partner)'), 'partner@example.net');
  assert.equal(fromAddress('  The Partner   <partner@example.net>  '), 'partner@example.net');
});

test('fromAddress takes the real address, not one written in the display name or a comment', () => {
  assert.equal(fromAddress('"noreply@revelsystems.com" <x@evil.example>'), 'x@evil.example');
  assert.equal(fromAddress('"REVEL <noreply@revelsystems.com>" <x@evil.example>'), 'x@evil.example');
  assert.equal(fromAddress('x@evil.example (noreply@revelsystems.com)'), 'x@evil.example');
});

test('fromAddress gives up on lines without one clear address', () => {
  for (const line of [
    '',
    '   ',
    'REVEL',
    null,
    undefined,
    'x@evil.example, noreply@revelsystems.com',
    'X <x@evil.example>, REVEL <noreply@revelsystems.com>',
    'x@evil.example <noreply@revelsystems.com>',
    'x@evil.example REVEL <noreply@revelsystems.com>',
    '<noreply@revelsystems.com> x@evil.example',
    '<noreply@revelsystems.com>, x@evil.example',
    'REVEL <noreply@revelsystems.com',
    'REVEL <>',
    'noreply@@revelsystems.com',
    'noreply@revelsystems',
    'noreply@revelsystems.com.',
  ]) {
    assert.equal(fromAddress(line), null, String(line));
  }
});

test('Revel and the owners get through', () => {
  const revel = checkSender(REVEL, NO_AUTH, OWNERS, []);
  assert.deepEqual(revel, { ok: true, sender: 'revel', address: REVEL_SENDER, confirmedBy: [], reason: '' });
  for (const from of ['The Owner <owner@example.com>', 'PARTNER@Example.NET']) {
    const owner = checkSender(from, NO_AUTH, OWNERS, []);
    assert.equal(owner.ok, true, from);
    assert.equal(owner.sender, 'owner', from);
  }
});

test('everyone else is refused with a plain reason, even when SPF and DKIM pass for their own domain', () => {
  for (const from of [
    'Someone <someone@example.com>',
    'Che Bar Aruba <chebararuba@gmail.com>', // the restaurant's Gmail is not an owner's own address
    'REVEL <reports@revelsystems.com>', // only Revel's report address
    'REVEL <noreply@mail.revelsystems.com>',
    'REVEL <noreply@revelsystems.co>',
    'REVEL <noreply@revelsystems.com.evil.example>',
    '"noreply@revelsystems.com" <x@evil.example>',
    'Owner <owner@example.com.evil.example>',
  ]) {
    const check = checkSender(from, REVEL_PASS, OWNERS, []);
    assert.equal(check.ok, false, from);
    assert.equal(check.sender, null, from);
    assert.match(check.reason, /^Refused: sent from [^\s,]+, which is not Revel's report address/, from);
    assert.match(check.reason, NOT_OPENED, from);
  }
  const unclear = checkSender('x@evil.example, REVEL <noreply@revelsystems.com>', REVEL_PASS, OWNERS, []);
  assert.equal(unclear.ok, false);
  assert.equal(unclear.address, null);
  assert.match(unclear.reason, /no telling who sent it/);
  assert.match(unclear.reason, NOT_OPENED);
});

test('owners come from active owner rows and ALLOWED_EMAILS', () => {
  const owners = ownerAddresses(
    [
      { email: 'Partner@Example.NET ', role: 'owner', active: true },
      { email: 'owner@example.com', role: 'owner', active: null },
      { email: 'old.owner@example.com', role: 'owner', active: false },
      { email: 'manager@example.com', role: 'manager', active: true },
      { email: null, role: 'owner', active: true },
    ],
    ' Owner@Example.com, extra@example.org '
  );
  assert.deepEqual(owners.sort(), ['extra@example.org', 'owner@example.com', 'partner@example.net']);
  assert.deepEqual(ownerAddresses([], undefined), []);
});

test('SPF and DKIM only count when they pass for the From domain', () => {
  const at = REVEL_SENDER;
  assert.deepEqual(confirmedBy(at, REVEL_PASS), ['dkim', 'spf']);
  assert.deepEqual(confirmedBy(at, { ...NO_AUTH, dkim: '{@sendgrid.info : pass, @revelsystems.com : pass}' }), ['dkim']);
  assert.deepEqual(confirmedBy(at, { ...NO_AUTH, dkim: '{@mail.revelsystems.com : pass}' }), ['dkim']);
  assert.deepEqual(confirmedBy(at, { ...NO_AUTH, spf: 'pass', envelopeFrom: 'noreply@revelsystems.com' }), ['spf']);
  for (const auth of [
    NO_AUTH,
    { ...NO_AUTH, dkim: '{@sendgrid.info : pass}' },
    { ...NO_AUTH, dkim: '{@revelsystems.com : fail}' },
    { ...NO_AUTH, dkim: 'none' },
    { ...NO_AUTH, dkim: '{@evilrevelsystems.com : pass}' },
    { ...NO_AUTH, dkim: '{@revelsystems.com.evil.example : pass}' },
    { ...NO_AUTH, spf: 'pass', envelopeFrom: 'bounce@amazonses.com' },
    { ...NO_AUTH, spf: 'pass', envelopeFrom: null },
    { ...NO_AUTH, spf: 'softfail', envelopeFrom: 'noreply@revelsystems.com' },
    { ...NO_AUTH, spf: 'none', envelopeFrom: 'noreply@revelsystems.com' },
  ]) {
    assert.deepEqual(confirmedBy(at, auth), [], JSON.stringify(auth));
  }
});

test('a domain that must pass is refused without SPF or DKIM, and let through with either', () => {
  const required = ['revelsystems.com'];
  const forged = checkSender(REVEL, { spf: 'softfail', dkim: 'none', envelopeFrom: 'x@evil.example' }, OWNERS, required);
  assert.equal(forged.ok, false);
  assert.equal(forged.sender, 'revel');
  assert.match(forged.reason, /neither SPF nor DKIM confirms it came from revelsystems\.com, so it may be forged/);
  assert.match(forged.reason, NOT_OPENED);
  assert.equal(checkSender(REVEL, REVEL_PASS, OWNERS, required).ok, true);
  assert.equal(checkSender(REVEL, { ...NO_AUTH, dkim: '{@revelsystems.com : pass}' }, OWNERS, required).ok, true);
  assert.equal(
    checkSender(REVEL, { ...NO_AUTH, spf: 'pass', envelopeFrom: 'bounces@em5.revelsystems.com' }, OWNERS, required).ok,
    true
  );
  // Other domains are not affected
  assert.equal(checkSender('owner@example.com', NO_AUTH, OWNERS, required).ok, true);
});

test('without a list, REQUIRE_PASS_FOR decides', () => {
  const forged: SenderAuth = { spf: 'fail', dkim: 'none', envelopeFrom: 'x@evil.example' };
  assert.equal(checkSender(REVEL, forged, OWNERS).ok, !REQUIRE_PASS_FOR.includes('revelsystems.com'));
});

test('reads what SendGrid posts', () => {
  assert.deepEqual(dkimResults('{@sendgrid.info : pass, @RevelSystems.com : PASS}'), [
    { domain: 'sendgrid.info', result: 'pass' },
    { domain: 'revelsystems.com', result: 'pass' },
  ]);
  assert.deepEqual(dkimResults('none'), []);
  assert.deepEqual(dkimResults(null), []);
  assert.equal(
    envelopeFrom('{"to":["revel@ingest.chebararuba.com"],"from":"Bounces@EM5.revelsystems.com"}'),
    'bounces@em5.revelsystems.com'
  );
  assert.equal(envelopeFrom('{"to":["revel@ingest.chebararuba.com"],"from":""}'), null);
  assert.equal(envelopeFrom('null'), null);
  assert.equal(envelopeFrom('not json'), null);
  assert.equal(envelopeFrom(null), null);

  const form = new FormData();
  form.set('SPF', ' pass ');
  form.set('dkim', '{@revelsystems.com : pass}');
  form.set('envelope', '{"to":["revel@ingest.chebararuba.com"],"from":"bounces@em5.revelsystems.com"}');
  const auth = readSenderAuth(form);
  assert.deepEqual(auth, {
    spf: 'pass',
    dkim: '{@revelsystems.com : pass}',
    envelopeFrom: 'bounces@em5.revelsystems.com',
  });
  assert.deepEqual(readSenderAuth(new FormData()), NO_AUTH);
  assert.deepEqual(senderAuthLog(auth, checkSender(REVEL, auth, OWNERS, [])), {
    spf: 'pass',
    dkim: '{@revelsystems.com : pass}',
    envelope_from: 'bounces@em5.revelsystems.com',
    confirmed_by: ['dkim', 'spf'],
  });
});
