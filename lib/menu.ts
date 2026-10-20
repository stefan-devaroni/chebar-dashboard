// Menu & recipes: one record per dish or drink — what guests see (name, price,
// description, photo) and what staff need (ingredients, steps, notes).

export type MenuName = 'mornings' | 'all_day' | 'nights' | 'drinks';
export type Station = 'kitchen' | 'bar';

export interface Ingredient {
  name: string;
  qty: number | null;
  unit: string;
  item_id?: string | null; // link to a Purchasing item, for costing later
}

export interface MenuItem {
  id: string;
  name: string;
  section: string;
  menu: MenuName;
  station: Station;
  price: number | null;
  description: string | null;
  photo_url: string | null;
  ingredients: Ingredient[];
  steps: string | null;
  notes: string | null;
  allergens: string | null;
  sort: number;
  active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export const MENU_LABELS: Record<MenuName, string> = {
  mornings: 'Mornings',
  all_day: 'All day',
  nights: 'Nights',
  drinks: 'Drinks',
};

export const STATION_LABELS: Record<Station, string> = { kitchen: 'Kitchen', bar: 'Bar' };

export const UNIT_SUGGESTIONS = ['g', 'kg', 'ml', 'l', 'oz', 'piece', 'slice', 'tbsp', 'tsp', 'cup', 'scoop', 'shot', 'dash', 'pinch', 'glass', 'bottle', 'portion'];

export const MENU_ITEM_COLUMNS =
  'id, name, section, menu, station, price, description, photo_url, ingredients, steps, notes, allergens, sort, active, updated_by, updated_at';

// Has the chef added real recipe detail yet (amounts or steps)?
export function hasRecipe(item: Pick<MenuItem, 'steps' | 'ingredients'>): boolean {
  return !!item.steps?.trim() || item.ingredients.some((i) => i.qty !== null);
}

export function formatQty(qty: number | null, unit: string): string {
  if (qty === null) return unit;
  const n = Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
  return unit ? `${n} ${unit}` : n;
}

export function formatPrice(price: number | null): string {
  return price === null ? '' : `$${Number(price).toFixed(2)}`;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Validate a manager's edit (only the fields present are changed)
export function parseMenuInput(body: any): { ok: true; value: Partial<MenuItem> } | { ok: false; error: string } {
  const out: Partial<MenuItem> = {};
  if ('name' in body) {
    const name = text(body.name, 80).replace(/\s+/g, ' ');
    if (!name) return { ok: false, error: 'Give the item a name.' };
    out.name = name;
  }
  if ('section' in body) {
    const section = text(body.section, 60).replace(/\s+/g, ' ');
    if (!section) return { ok: false, error: 'Pick or type a section, like "Dutch Pancakes".' };
    out.section = section;
  }
  if ('menu' in body) {
    if (!['mornings', 'all_day', 'nights', 'drinks'].includes(body.menu)) return { ok: false, error: 'Unknown menu.' };
    out.menu = body.menu;
  }
  if ('station' in body) {
    if (!['kitchen', 'bar'].includes(body.station)) return { ok: false, error: 'Unknown station.' };
    out.station = body.station;
  }
  if ('price' in body) {
    if (body.price === null || body.price === '') out.price = null;
    else {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0 || price > 10000) return { ok: false, error: 'Check the price.' };
      out.price = Math.round(price * 100) / 100;
    }
  }
  for (const key of ['description', 'steps', 'notes', 'allergens'] as const) {
    if (key in body) out[key] = text(body[key], key === 'steps' ? 8000 : 2000) || null;
  }
  if ('photo_url' in body) {
    const url = text(body.photo_url, 500);
    if (url && !/^https:\/\//.test(url)) return { ok: false, error: 'Photo link must start with https://' };
    out.photo_url = url || null;
  }
  if ('ingredients' in body) {
    if (!Array.isArray(body.ingredients)) return { ok: false, error: 'Ingredients must be a list.' };
    const list: Ingredient[] = [];
    for (const raw of body.ingredients.slice(0, 60)) {
      const name = text(raw?.name, 120).replace(/\s+/g, ' ');
      if (!name) continue; // empty rows are dropped
      const qty = raw?.qty === null || raw?.qty === '' || raw?.qty === undefined ? null : Number(raw.qty);
      if (qty !== null && (!Number.isFinite(qty) || qty < 0)) return { ok: false, error: `Check the amount for "${name}".` };
      const item: Ingredient = { name, qty, unit: text(raw?.unit, 20) };
      if (typeof raw?.item_id === 'string' && raw.item_id) item.item_id = raw.item_id;
      list.push(item);
    }
    out.ingredients = list;
  }
  if ('active' in body) out.active = body.active !== false;
  if ('sort' in body && Number.isFinite(Number(body.sort))) out.sort = Math.round(Number(body.sort));
  return { ok: true, value: out };
}
