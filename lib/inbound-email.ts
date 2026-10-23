import PostalMime from 'postal-mime';

// Reads an email posted by SendGrid Inbound Parse (/api/ingest-email). SendGrid sends either
// the parsed parts (attachment1..N plus `text`) or, when "POST the raw, full MIME message" is
// ticked in its settings, the whole email in one `email` field. Both come out the same here.

export interface InboundFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

// Logos and pictures in an email signature arrive as attachments too; reports are never images
const isImage = (type: string) => type.toLowerCase().startsWith('image/');

export async function readInboundEmail(form: FormData): Promise<{ files: InboundFile[]; text: string }> {
  const raw = form.get('email');
  if (typeof raw === 'string' && raw.trim()) {
    const email = await PostalMime.parse(raw);
    const files = email.attachments
      .filter((a) => !isImage(a.mimeType))
      .map((a, i) => ({
        name: a.filename || `attachment${i + 1}`,
        type: a.mimeType,
        bytes:
          typeof a.content === 'string'
            ? Buffer.from(a.content, a.encoding === 'base64' ? 'base64' : 'utf8')
            : new Uint8Array(a.content),
      }));
    return { files, text: email.text ?? '' };
  }

  const count = parseInt(String(form.get('attachments') ?? '0'), 10) || 0;
  const files: InboundFile[] = [];
  for (let i = 1; i <= count; i++) {
    const part = form.get(`attachment${i}`);
    if (!(part instanceof Blob) || isImage(part.type)) continue;
    files.push({
      name: (part as File).name || `attachment${i}`,
      type: part.type,
      bytes: new Uint8Array(await part.arrayBuffer()),
    });
  }
  return { files, text: String(form.get('text') ?? '') };
}
