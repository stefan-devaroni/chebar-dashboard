import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clientIpHash, corsHeaders, isMissingTable } from '@/lib/reservations-server';
import { cvExtension, MAX_CV_BYTES, parseApplication } from '@/lib/applications';
import { applicantThanksEmail, JOBS_FROM, newApplicationEmail } from '@/lib/application-emails';
import { RESTAURANT_EMAIL, sendEmail } from '@/lib/email';
import { notifyOwner } from '@/lib/notify';
import { addNotification } from '@/lib/notifications';

// The application form on chebararuba.com/careers posts here (multipart, with an optional CV).
// No login: protected by a hidden honeypot field, a per-visitor limit and file checks.

export const dynamic = 'force-dynamic';

const DASHBOARD = 'https://dashboard.chebararuba.com';
const PER_HOUR = 3;

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get('origin'));
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Could not read the form. If you attached a CV, make sure it is under 4 MB.' }, 400);
  }

  // Bots fill in every field, including the hidden one; tell them it worked and store nothing
  if (String(form.get('website') ?? '').trim()) return json({ ok: true });

  const parsed = parseApplication(form);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const app = parsed.value;

  const upload = form.get('cv');
  const cv = upload instanceof File && upload.size > 0 ? upload : null;
  if (cv) {
    if (cv.size > MAX_CV_BYTES) return json({ error: 'Your CV is larger than 4 MB. Please send a smaller file, or a PDF.' }, 400);
    if (!cvExtension(cv.name)) return json({ error: 'Please attach your CV as a PDF, Word file or photo.' }, 400);
  }

  const supabase = createClient();
  const ipHash = clientIpHash(request);
  if (ipHash) {
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since);
    if ((count ?? 0) >= PER_HOUR) return json({ error: 'We already received your application. Thank you!' }, 429);
  }

  const id = crypto.randomUUID();
  let cvPath: string | null = null;
  if (cv) {
    const safeName = cv.name.replace(/[^\w.-]+/g, '_').replace(/^_+/, '').slice(-80) || `cv.${cvExtension(cv.name)}`;
    cvPath = `${id}/${safeName}`;
    const { error } = await supabase.storage
      .from('applications')
      .upload(cvPath, Buffer.from(await cv.arrayBuffer()), { contentType: cv.type || 'application/octet-stream' });
    if (error) return json({ error: "We couldn't upload your CV. Please try again, or apply without it." }, 500);
  }

  const { error } = await supabase.from('job_applications').insert({
    id,
    ...app,
    cv_path: cvPath,
    cv_name: cv ? cv.name.slice(0, 120) : null,
    cv_size: cv ? cv.size : null,
    ip_hash: ipHash,
  });
  if (error) {
    if (cvPath) await supabase.storage.from('applications').remove([cvPath]);
    return json({ error: isMissingTable(error) ? 'Applications are not open yet. Please try again later.' : 'Something went wrong. Please try again.' }, 500);
  }

  // Alerts are best-effort: the application is saved either way
  const roles = app.positions.join(', ');
  const link = `${DASHBOARD}/dashboard/applicants?id=${id}`;
  const alert = newApplicationEmail({ ...app, hasCv: !!cvPath }, link);
  const thanks = applicantThanksEmail(app.name);
  await Promise.all([
    addNotification(supabase, { kind: 'application', title: `New job application: ${app.name}`, body: roles, link: `/dashboard/applicants?id=${id}` }),
    notifyOwner({ title: 'New job application', message: `${app.name} · ${roles}`, url: link, tags: ['briefcase'], priority: 3 }),
    // Replying to the alert writes straight to the applicant
    sendEmail({ to: RESTAURANT_EMAIL, from: JOBS_FROM, replyTo: app.email, ...alert }),
    sendEmail({ to: app.email, from: JOBS_FROM, ...thanks }),
  ]);

  return json({ ok: true });
}
