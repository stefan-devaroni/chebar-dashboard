// Sends email through Resend (https://resend.com). Does nothing until
// RESEND_API_KEY is set in Netlify and chebararuba.com is verified in Resend.
export const RESTAURANT_EMAIL = process.env.RESERVATIONS_REPLY_TO || 'chebararuba@gmail.com';
const FROM = process.env.RESERVATIONS_FROM || 'Che Bar <reservations@chebararuba.com>';

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = FROM,
  replyTo = RESTAURANT_EMAIL,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, html, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error('Email not sent', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (error) {
    console.error('Email not sent', error);
    return false;
  }
}
