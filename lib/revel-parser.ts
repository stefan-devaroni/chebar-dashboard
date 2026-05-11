// Parses Revel POS daily sales and product mix CSV reports.
// Revel's export formats vary by configuration, so this handles common patterns
// and falls back to heuristic column matching.

export interface ParsedDailySales {
  date: string;
  revenue_total: number | null;
  revenue_breakfast: number | null;
  revenue_lunch: number | null;
  revenue_dinner: number | null;
  covers_total: number | null;
  covers_breakfast: number | null;
  covers_lunch: number | null;
  covers_dinner: number | null;
  labor_cost: number | null;
}

export interface ParsedProductMix {
  date: string;
  items: {
    name: string;
    category: string;
    quantity: number;
    revenue: number;
    cost: number | null;
  }[];
}

export type ParseResult =
  | { type: 'daily_sales'; data: ParsedDailySales[] }
  | { type: 'product_mix'; data: ParsedProductMix }
  | { type: 'unknown'; raw: string };

export function parseRevelCsv(csvText: string, fileName: string): ParseResult {
  const lines = csvText.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { type: 'unknown', raw: csvText };

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Detect report type from headers or filename
  if (isProductMixReport(headers, fileName)) {
    return parseProductMix(headers, lines.slice(1));
  }

  if (isDailySalesReport(headers, fileName)) {
    return parseDailySales(headers, lines.slice(1));
  }

  // Fallback: try to detect by content
  if (headers.some((h) => h.includes('item') || h.includes('product') || h.includes('menu'))) {
    return parseProductMix(headers, lines.slice(1));
  }

  if (headers.some((h) => h.includes('date') && (h.includes('revenue') || h.includes('sales') || h.includes('total')))) {
    return parseDailySales(headers, lines.slice(1));
  }

  return { type: 'unknown', raw: csvText };
}

function isDailySalesReport(headers: string[], fileName: string): boolean {
  const fn = fileName.toLowerCase();
  if (fn.includes('daily') || fn.includes('sales_summary') || fn.includes('day_report')) return true;
  const salesKeywords = ['net sales', 'gross sales', 'total sales', 'revenue', 'net_sales', 'gross_sales'];
  return headers.some((h) => salesKeywords.some((k) => h.includes(k)));
}

function isProductMixReport(headers: string[], fileName: string): boolean {
  const fn = fileName.toLowerCase();
  if (fn.includes('product_mix') || fn.includes('productmix') || fn.includes('item_sales')) return true;
  const pmKeywords = ['item name', 'product', 'menu item', 'qty', 'quantity sold'];
  return headers.some((h) => pmKeywords.some((k) => h.includes(k)));
}

function parseDailySales(headers: string[], rows: string[]): ParseResult {
  const dateCol = findCol(headers, ['date', 'business date', 'report date', 'day']);
  const revenueCol = findCol(headers, ['net sales', 'gross sales', 'total sales', 'revenue', 'total revenue', 'net_sales', 'total']);
  const coversCol = findCol(headers, ['covers', 'guests', 'customer count', 'transactions', 'checks', 'order count']);
  const laborCol = findCol(headers, ['labor', 'labor cost', 'labor_cost', 'payroll']);

  // Daypart columns (Revel often has these)
  const bfastRevCol = findCol(headers, ['breakfast', 'morning', 'am revenue', 'breakfast sales']);
  const lunchRevCol = findCol(headers, ['lunch', 'midday', 'lunch sales']);
  const dinnerRevCol = findCol(headers, ['dinner', 'evening', 'pm revenue', 'dinner sales', 'night']);
  const bfastCoversCol = findCol(headers, ['breakfast covers', 'breakfast guests', 'am covers']);
  const lunchCoversCol = findCol(headers, ['lunch covers', 'lunch guests']);
  const dinnerCoversCol = findCol(headers, ['dinner covers', 'dinner guests', 'pm covers']);

  const results: ParsedDailySales[] = [];

  for (const row of rows) {
    const cells = parseCSVLine(row);
    const dateStr = dateCol >= 0 ? normalizeDate(cells[dateCol]) : null;
    if (!dateStr) continue;

    results.push({
      date: dateStr,
      revenue_total: numOrNull(cells[revenueCol]),
      revenue_breakfast: numOrNull(cells[bfastRevCol]),
      revenue_lunch: numOrNull(cells[lunchRevCol]),
      revenue_dinner: numOrNull(cells[dinnerRevCol]),
      covers_total: intOrNull(cells[coversCol]),
      covers_breakfast: intOrNull(cells[bfastCoversCol]),
      covers_lunch: intOrNull(cells[lunchCoversCol]),
      covers_dinner: intOrNull(cells[dinnerCoversCol]),
      labor_cost: numOrNull(cells[laborCol]),
    });
  }

  return { type: 'daily_sales', data: results };
}

function parseProductMix(headers: string[], rows: string[]): ParseResult {
  const nameCol = findCol(headers, ['item name', 'product', 'menu item', 'item', 'name', 'description']);
  const catCol = findCol(headers, ['category', 'group', 'department', 'class', 'type']);
  const qtyCol = findCol(headers, ['qty', 'quantity', 'quantity sold', 'units', 'count', 'sold']);
  const revCol = findCol(headers, ['sales', 'revenue', 'net sales', 'amount', 'total', 'gross']);
  const costCol = findCol(headers, ['cost', 'cogs', 'food cost', 'cost of goods']);

  // Try to extract date from first row or use today
  const today = new Date().toISOString().split('T')[0];
  let reportDate = today;

  const items: ParsedProductMix['items'] = [];

  for (const row of rows) {
    const cells = parseCSVLine(row);
    const name = nameCol >= 0 ? cells[nameCol]?.trim() : null;
    if (!name || name === '' || name.toLowerCase() === 'total') continue;

    items.push({
      name,
      category: catCol >= 0 ? cells[catCol]?.trim() ?? '' : '',
      quantity: parseInt(cells[qtyCol] ?? '0') || 0,
      revenue: parseFloat(cleanNumber(cells[revCol] ?? '0')) || 0,
      cost: costCol >= 0 ? numOrNull(cells[costCol]) : null,
    });
  }

  return { type: 'product_mix', data: { date: reportDate, items } };
}

// --- Utilities ---

function findCol(headers: string[], keywords: string[]): number {
  for (const kw of keywords) {
    const idx = headers.findIndex((h) => h.includes(kw));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function cleanNumber(s: string): string {
  return (s ?? '').replace(/[$,AWG\s]/gi, '').trim();
}

function numOrNull(s: string | undefined): number | null {
  if (s === undefined || s === null) return null;
  const n = parseFloat(cleanNumber(s));
  return isNaN(n) ? null : n;
}

function intOrNull(s: string | undefined): number | null {
  if (s === undefined || s === null) return null;
  const n = parseInt(cleanNumber(s));
  return isNaN(n) ? null : n;
}

function normalizeDate(s: string | undefined): string | null {
  if (!s) return null;
  const cleaned = s.replace(/['"]/g, '').trim();

  // Try ISO format (2026-05-10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // Try MM/DD/YYYY or M/D/YYYY
  const mdy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }

  // Try DD-Mon-YYYY (10-May-2026)
  const dmy = cleaned.match(/^(\d{1,2})-(\w{3})-(\d{4})$/);
  if (dmy) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = months[dmy[2].toLowerCase()];
    if (m) return `${dmy[3]}-${m}-${dmy[1].padStart(2, '0')}`;
  }

  // Try Date constructor as last resort
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

  return null;
}
