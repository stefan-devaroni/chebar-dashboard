// Push alerts to the owner's phone via ntfy (https://ntfy.sh).
// The topic name is the only secret — keep NTFY_TOPIC long and random.
export async function notifyOwner({
  title,
  message,
  url,
  tags = ['warning'],
  priority = 4,
}: {
  title: string;
  message: string;
  url?: string;
  tags?: string[];
  priority?: number;
}) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  try {
    // JSON publishing keeps non-ASCII text (supplier names, "—") out of HTTP headers
    await fetch('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, title, message, tags, priority, click: url }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Alerts are best-effort; the dashboard is the record.
  }
}
