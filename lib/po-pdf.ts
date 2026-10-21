// Purchase order PDF, written by hand (no PDF library): A4, the built-in Helvetica fonts
// (nothing embedded, so a PO is a few KB), one item table that flows onto extra pages if needed.

export interface PoPdfInput {
  poNumber: string;
  issuedAt: string; // ISO timestamp
  buyer: { name: string; address: string[]; phone: string; email: string };
  supplier: { name: string; contactName?: string | null; phone?: string | null; email?: string | null };
  items: { name: string; size: string | null; qty: number; unit: string }[];
  notes?: string | null;
  orderedBy?: string | null;
}

// Helvetica / Helvetica-Bold advance widths for characters 32–126 (1/1000 em, standard AFM metrics)
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELV_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// Characters outside Latin-1 that WinAnsiEncoding still has
const WIN_ANSI: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };

function toWinAnsi(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0x3f;
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) out.push(c);
    else if (WIN_ANSI[ch]) out.push(WIN_ANSI[ch]);
    else if (c === 0x09 || c === 0x0a || c === 0x0d) out.push(0x20);
    else out.push(0x3f); // "?" for anything the standard fonts can't show
  }
  return out;
}

function charWidth(code: number, bold: boolean): number {
  const table = bold ? HELV_BOLD : HELV;
  if (code >= 32 && code <= 126) return table[code - 32];
  if (code === 0x97) return 1000;
  if (code === 0x95) return 350;
  if (code >= 0x91 && code <= 0x94) return 333;
  if (code >= 0xc0) {
    // Accented letters: use the plain letter's width
    const base = String.fromCharCode(code).normalize('NFD').charCodeAt(0);
    if (base >= 32 && base <= 126) return table[base - 32];
  }
  return 556;
}

export function textWidth(s: string, size: number, bold = false): number {
  return (toWinAnsi(s).reduce((w, c) => w + charWidth(c, bold), 0) * size) / 1000;
}

// Split text into lines that fit maxWidth (breaks long words if it has to)
export function wrap(s: string, maxWidth: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const tryLine = line ? `${line} ${word}` : word;
    if (textWidth(tryLine, size, bold) <= maxWidth) {
      line = tryLine;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (textWidth(line, size, bold) > maxWidth && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && textWidth(line.slice(0, cut), size, bold) > maxWidth) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

const pdfString = (s: string) =>
  '(' + toWinAnsi(s).map((c) => (c === 0x28 || c === 0x29 || c === 0x5c ? '\\' : '') + String.fromCharCode(c)).join('') + ')';
const num = (n: number) => String(Math.round(n * 100) / 100);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const LEFT = 48;
const RIGHT = PAGE_W - 48;

class Page {
  ops: string[] = [];
  text(x: number, y: number, s: string, size: number, bold = false, gray = 0) {
    this.ops.push(`BT ${num(gray)} g /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(x)} ${num(y)} Td ${pdfString(s)} Tj ET`);
  }
  textRight(xRight: number, y: number, s: string, size: number, bold = false, gray = 0) {
    this.text(xRight - textWidth(s, size, bold), y, s, size, bold, gray);
  }
  spaced(x: number, y: number, s: string, size: number, spacing: number) {
    this.ops.push(`BT 0 g /F2 ${num(size)} Tf ${num(spacing)} Tc ${num(x)} ${num(y)} Td ${pdfString(s)} Tj 0 Tc ET`);
  }
  line(x1: number, y1: number, x2: number, y2: number, width = 0.5, gray = 0.75) {
    this.ops.push(`${num(gray)} G ${num(width)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
  }
  box(x: number, y: number, w: number, h: number, gray = 0.75) {
    this.ops.push(`${num(gray)} G 0.75 w ${num(x)} ${num(y)} ${num(w)} ${num(h)} re S`);
  }
  fill(x: number, y: number, w: number, h: number, gray: number) {
    this.ops.push(`${num(gray)} g ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f 0 g`);
  }
}

// Item table columns
const COL = { num: LEFT + 6, item: LEFT + 28, itemW: 238, size: LEFT + 274, sizeW: 112, qtyRight: LEFT + 428, unit: LEFT + 440, unitW: RIGHT - LEFT - 446 };

function tableHeader(page: Page, y: number): number {
  page.fill(LEFT, y - 18, RIGHT - LEFT, 18, 0.9);
  for (const [x, label] of [[COL.num, '#'], [COL.item, 'ITEM'], [COL.size, 'SIZE'], [COL.unit, 'UNIT']] as const) page.text(x, y - 12.5, label, 8, true, 0.2);
  page.textRight(COL.qtyRight, y - 12.5, 'QTY', 8, true, 0.2);
  return y - 18;
}

export function formatPoDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Aruba' });
}

export function buildPurchaseOrderPdf(po: PoPdfInput): Uint8Array {
  const pages: Page[] = [];
  let page = new Page();
  pages.push(page);

  // ---- Header ----
  page.spaced(LEFT, 790, po.buyer.name.toUpperCase(), 22, 3);
  page.text(LEFT, 772, po.buyer.address.slice(0, 2).join(', '), 9, false, 0.25);
  page.text(LEFT, 760, po.buyer.address.slice(2).join(', '), 9, false, 0.25);
  page.text(LEFT, 748, `${po.buyer.phone} · ${po.buyer.email}`, 9, false, 0.25);
  page.textRight(RIGHT, 792, 'PURCHASE ORDER', 15, true);
  page.textRight(RIGHT, 774, po.poNumber, 13, true);
  page.textRight(RIGHT, 759, `Date: ${formatPoDate(po.issuedAt)}`, 9, false, 0.25);
  page.line(LEFT, 734, RIGHT, 734, 1, 0.15);

  // ---- Supplier / deliver-to boxes ----
  const boxW = (RIGHT - LEFT - 16) / 2;
  const boxTop = 722;
  const boxH = 92;
  const columns: { x: number; label: string; title: string; lines: string[] }[] = [
    {
      x: LEFT,
      label: 'SUPPLIER',
      title: po.supplier.name,
      lines: [po.supplier.contactName && `Attn: ${po.supplier.contactName}`, po.supplier.phone, po.supplier.email].filter(Boolean) as string[],
    },
    {
      x: LEFT + boxW + 16,
      label: 'DELIVER TO',
      title: po.buyer.name,
      lines: [po.buyer.address.slice(0, 2).join(', '), po.buyer.address.slice(2).join(', '), po.orderedBy ? `Ordered by: ${po.orderedBy}` : ''].filter(Boolean),
    },
  ];
  for (const c of columns) {
    page.box(c.x, boxTop - boxH, boxW, boxH, 0.8);
    page.text(c.x + 10, boxTop - 15, c.label, 7.5, true, 0.4);
    page.text(c.x + 10, boxTop - 31, wrap(c.title, boxW - 20, 11, true)[0], 11, true);
    let ly = boxTop - 46;
    for (const l of c.lines.slice(0, 3)) {
      page.text(c.x + 10, ly, wrap(l, boxW - 20, 9)[0], 9, false, 0.2);
      ly -= 12.5;
    }
  }

  // ---- Items ----
  let y = tableHeader(page, boxTop - boxH - 22);
  const continued = () => {
    page = new Page();
    pages.push(page);
    page.spaced(LEFT, 790, po.buyer.name.toUpperCase(), 16, 2);
    page.textRight(RIGHT, 792, `${po.poNumber} (continued)`, 11, true);
    page.line(LEFT, 776, RIGHT, 776, 1, 0.15);
    y = tableHeader(page, 760);
  };
  po.items.forEach((item, i) => {
    const nameLines = wrap(item.name, COL.itemW, 10);
    const sizeLines = wrap(item.size ?? '', COL.sizeW, 9);
    const unitLines = wrap(item.unit, COL.unitW, 9);
    const rowH = Math.max(nameLines.length, sizeLines.length, unitLines.length) * 12.5 + 9;
    if (y - rowH < 80) continued();
    const top = y - 15;
    page.text(COL.num, top, String(i + 1), 9, false, 0.45);
    nameLines.forEach((l, k) => page.text(COL.item, top - k * 12.5, l, 10));
    sizeLines.forEach((l, k) => page.text(COL.size, top - k * 12.5, l, 9, false, 0.25));
    page.textRight(COL.qtyRight, top, num(item.qty), 10, true);
    unitLines.forEach((l, k) => page.text(COL.unit, top - k * 12.5, l, 9, false, 0.25));
    y -= rowH;
    page.line(LEFT, y, RIGHT, y, 0.5, 0.82);
  });
  y -= 16;
  page.text(LEFT, y, `${po.items.length} item${po.items.length === 1 ? '' : 's'}`, 9, false, 0.4);

  // ---- Notes, confirmation and signature ----
  const noteLines = po.notes?.trim() ? wrap(po.notes.trim(), RIGHT - LEFT, 9) : [];
  const confirm = wrap(
    `Please confirm this order and the delivery time by WhatsApp or phone (${po.buyer.phone}) or by email (${po.buyer.email}). Thank you.`,
    RIGHT - LEFT,
    9.5
  );
  const needed = (noteLines.length ? noteLines.length * 12 + 30 : 0) + confirm.length * 13 + 80;
  if (y - needed < 60) {
    continued();
    y -= 10;
  }
  if (noteLines.length) {
    y -= 24;
    page.text(LEFT, y, 'Notes', 9, true);
    noteLines.forEach((l) => {
      y -= 12;
      page.text(LEFT, y, l, 9, false, 0.2);
    });
  }
  y -= 26;
  confirm.forEach((l) => {
    page.text(LEFT, y, l, 9.5);
    y -= 13;
  });
  y -= 30;
  page.line(LEFT, y, LEFT + 200, y, 0.75, 0.3);
  page.line(LEFT + 260, y, LEFT + 380, y, 0.75, 0.3);
  page.text(LEFT, y - 12, 'Approved by', 8, false, 0.4);
  page.text(LEFT + 260, y - 12, 'Date', 8, false, 0.4);

  // ---- Footers ----
  pages.forEach((p, i) => {
    p.line(LEFT, 46, RIGHT, 46, 0.5, 0.82);
    p.text(LEFT, 34, `${po.buyer.name} · ${po.poNumber}`, 8, false, 0.45);
    p.textRight(RIGHT, 34, `Page ${i + 1} of ${pages.length}`, 8, false, 0.45);
  });

  return assemble(pages, `Purchase order ${po.poNumber}`);
}

function assemble(pages: Page[], title: string): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body); // returns the new object's number (1-based)

  add('<< /Type /Catalog /Pages 2 0 R >>'); // 1
  add(''); // 2: Pages, filled in below
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); // 3
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'); // 4
  const info = add(`<< /Title ${pdfString(title)} /Producer (Che Bar dashboard) >>`);
  const kids: number[] = [];
  for (const p of pages) {
    const content = p.ops.join('\n');
    const contentObj = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj} 0 R >>`)
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  // Every character in `out` is a single byte (WinAnsi), so latin1 keeps lengths and offsets exact
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
