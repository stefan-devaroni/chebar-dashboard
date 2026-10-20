// Employee handbook: chapters with sections. Managers write; all staff read.

export interface HandbookChapter {
  id: string;
  title: string;
  sort: number;
}

export interface HandbookSection {
  id: string;
  chapter_id: string;
  title: string;
  body: string;
  hint: string | null; // what belongs in this section, shown until it's written
  sort: number;
  updated_by: string | null;
  updated_at: string;
}

export const CHAPTER_COLUMNS = 'id, title, sort';
export const SECTION_COLUMNS = 'id, chapter_id, title, body, hint, sort, updated_by, updated_at';

export const cleanTitle = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 100) : '');
export const cleanBody = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, 20000) : '');

// Handbook text: blank line between paragraphs, "- " bullets, "1. " steps,
// "## " small headings, **bold**. Parsed into blocks; never rendered as HTML.
export type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'bullets'; items: string[] }
  | { type: 'steps'; items: string[] };

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^#{1,3}\s+/.test(line)) {
        blocks.push({ type: 'heading', text: line.replace(/^#{1,3}\s+/, '') });
        i++;
      } else if (/^\s*[-*•]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''));
        blocks.push({ type: 'bullets', items });
      } else if (/^\s*\d+[.)]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
        blocks.push({ type: 'steps', items });
      } else {
        const para: string[] = [];
        while (i < lines.length && !/^(#{1,3}\s+|\s*[-*•]\s+|\s*\d+[.)]\s+)/.test(lines[i])) para.push(lines[i++].trim());
        blocks.push({ type: 'paragraph', lines: para });
      }
    }
  }
  return blocks;
}

// Split "**bold** text" into plain and bold runs
export function boldRuns(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }));
}
