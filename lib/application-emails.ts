import { esc, layout } from '@/lib/reservation-emails';
import type { JobApplication } from '@/lib/applications';

// Emails for the careers page: a thank-you to the applicant and an alert to the restaurant inbox.

export const JOBS_FROM = 'Che Bar <jobs@chebararuba.com>';
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export function applicantThanksEmail(name: string) {
  const subject = 'Thanks for applying to Che Bar';
  const html = layout(`
<p style="margin:0 0 6px;font-size:15px">Hi ${esc(firstName(name))},</p>
<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:normal;font-size:24px">We got your application</h1>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#5c554e">Thanks for applying to join the Che Bar team. We read every application. If there's a match, we'll contact you by phone, WhatsApp or email.</p>
<p style="margin:18px 0 0;font-size:14px">Che Bar</p>`);
  const text = [
    `Hi ${firstName(name)},`,
    '',
    'Thanks for applying to join the Che Bar team. We read every application.',
    "If there's a match, we'll contact you by phone, WhatsApp or email.",
    '',
    'Che Bar',
  ].join('\n');
  return { subject, html, text };
}

type Summary = Pick<JobApplication, 'name' | 'email' | 'phone' | 'positions' | 'adult' | 'availability' | 'shifts' | 'start_date' | 'languages' | 'experience'> & { hasCv: boolean };

export function newApplicationEmail(a: Summary, link: string) {
  const roles = a.positions.join(', ');
  const rows: [string, string][] = [
    ['Position', roles],
    ['Phone', a.phone ?? '—'],
    ['Email', a.email],
    ['18 or older', a.adult ? 'Yes' : 'No'],
    ['Availability', [a.availability, a.shifts.join(', ')].filter(Boolean).join(' · ') || '—'],
    ['Can start', a.start_date ?? '—'],
    ['Languages', a.languages.join(', ') || '—'],
    ['CV', a.hasCv ? 'Yes, in the dashboard' : 'No CV'],
  ];
  const experience = (a.experience ?? '').slice(0, 600);
  const subject = `New job application: ${a.name} (${roles})`;
  const html = layout(`
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:normal;font-size:22px">${esc(a.name)} applied</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">
${rows.map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#7a736c;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:3px 0">${esc(v)}</td></tr>`).join('')}
</table>
<p style="margin:16px 0 4px;font-size:13px;color:#7a736c">Experience</p>
<p style="margin:0 0 20px;font-size:14px;line-height:1.6;white-space:pre-line">${esc(experience)}</p>
<a href="${link}" style="display:inline-block;background:#d4a574;color:#1a1612;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;font-size:14px">Open in the dashboard</a>
<p style="margin:16px 0 0;font-size:13px;color:#7a736c">Reply to this email to write to ${esc(firstName(a.name))}.</p>`);
  const text = [
    `${a.name} applied`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Experience:',
    experience,
    '',
    `Open in the dashboard: ${link}`,
    `Reply to this email to write to ${firstName(a.name)}.`,
  ].join('\n');
  return { subject, html, text };
}
