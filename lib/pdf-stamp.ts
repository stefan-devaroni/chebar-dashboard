import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Marks a One Pager document for the one person downloading it through their buyer link (Oct 2026): their name
// diagonally across every page and a line along the bottom, like the One Pager itself shows them. Standard
// Helvetica only draws Latin-1 (WinAnsi) characters, so anything else is simplified or dropped.

const latin1 = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7e\xa0-\xff]/g, '');

export async function stampPdf(bytes: Uint8Array, text: { mark: string; footer: string; title: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mark = latin1(text.mark);
  const footer = latin1(text.footer);
  const angle = 30;
  const [cos, sin] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)];
  for (const page of pdf.getPages()) {
    const { x, y, width, height } = page.getCropBox();
    // turned, the mark spans at most 85% of the page width, whatever the name's length
    const size = Math.min(Math.min(width, height) / 34, (0.85 * width) / (font.widthOfTextAtSize(mark, 1) * cos));
    const half = font.widthOfTextAtSize(mark, size) / 2;
    const rise = font.heightAtSize(size) / 3;
    for (const at of [0.2, 0.5, 0.8]) {
      // centred on (x + width/2, y + height*at), turned 30 degrees
      const cx = x + width / 2;
      const cy = y + height * at;
      page.drawText(mark, {
        x: cx - half * cos + rise * sin,
        y: cy - half * sin - rise * cos,
        size,
        font,
        rotate: degrees(angle),
        color: rgb(0.7, 0.12, 0.1),
        opacity: 0.15,
      });
    }
    // the line along the bottom, on a light strip so it reads on dark footers too
    const small = Math.max(6, Math.min(width, height) / 85);
    const lineWidth = font.widthOfTextAtSize(footer, small);
    const left = x + (width - lineWidth) / 2;
    page.drawRectangle({ x: left - small, y: y + small * 0.4, width: lineWidth + 2 * small, height: small * 1.5, color: rgb(1, 1, 1), opacity: 0.85 });
    page.drawText(footer, { x: left, y: y + small * 0.8, size: small, font, color: rgb(0.55, 0.12, 0.1) });
  }
  pdf.setTitle(latin1(text.title));
  pdf.setSubject(footer);
  pdf.setCreator('Che Bar');
  pdf.setProducer('Che Bar');
  return pdf.save();
}
