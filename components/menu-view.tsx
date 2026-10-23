'use client';

import { useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, ImagePlus, Plus, Search, UtensilsCrossed, Wine, X } from 'lucide-react';
import {
  formatPrice,
  formatQty,
  hasRecipe,
  MENU_LABELS,
  STATION_LABELS,
  UNIT_SUGGESTIONS,
  type Ingredient,
  type MenuItem,
  type MenuName,
  type Station,
} from '@/lib/menu';

type Role = 'manager' | 'employee';
type Filter = 'all' | 'mornings' | 'nights' | 'drinks';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mornings', label: 'Mornings' },
  { key: 'nights', label: 'Nights' },
  { key: 'drinks', label: 'Drinks' },
];

const inputClass = 'w-full px-3 py-3 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold';
const labelClass = 'block text-xs uppercase tracking-wider text-neutral-500 mb-1.5';
const headingClass = 'text-xs uppercase tracking-widest text-neutral-500 font-medium mb-2';

// "All day" items (empanadas) belong to both the Mornings and Nights views
const inFilter = (item: MenuItem, filter: Filter) =>
  filter === 'all' || item.menu === filter || (item.menu === 'all_day' && (filter === 'mornings' || filter === 'nights'));

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save. Check your connection and try again.');
  return data;
}

// Phone photos are large: shrink to 1600px JPEG before uploading
async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

function Thumb({ item, className }: { item: MenuItem; className?: string }) {
  const Icon = item.station === 'bar' ? Wine : UtensilsCrossed;
  return item.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.photo_url} alt="" loading="lazy" className={cn('object-cover bg-neutral-100', className)} />
  ) : (
    <span className={cn('flex items-center justify-center bg-neutral-100 text-neutral-300', className)}>
      <Icon size={22} strokeWidth={1.5} />
    </span>
  );
}

export function MenuView({ initialItems, role, setupNeeded }: { initialItems: MenuItem[]; role: Role; setupNeeded: boolean }) {
  const isManager = role === 'manager';
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => inFilter(i, filter))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.section.toLowerCase().includes(q) || i.ingredients.some((g) => g.name.toLowerCase().includes(q)))
      .sort((a, b) => a.sort - b.sort);
  }, [items, filter, query]);

  // Sections in menu order (first item decides the order)
  const sections = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of visible) map.set(item.section, [...(map.get(item.section) ?? []), item]);
    return Array.from(map.entries());
  }, [visible]);

  const sectionNames = useMemo(() => Array.from(new Set([...items].sort((a, b) => a.sort - b.sort).map((i) => i.section))), [items]);
  const missing = items.filter((i) => !hasRecipe(i)).length;
  const opened = items.find((i) => i.id === openId) ?? null;

  function saved(item: MenuItem) {
    setItems((list) => (list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item]).filter((i) => i.active));
  }

  if (setupNeeded) {
    return (
      <>
        <h1 className="font-display text-3xl mb-6">Menu &amp; Recipes</h1>
        <div className="bg-white border border-neutral-200 rounded-xl p-5 text-sm text-neutral-600">
          {isManager ? (
            <>
              <p className="font-medium text-ink mb-1">One-time setup needed</p>
              <p>
                Open Supabase → SQL Editor, paste the file <code className="text-xs bg-neutral-100 px-1 rounded">supabase/menu.sql</code> and press Run.
                Then reload this page.
              </p>
            </>
          ) : (
            <p>The menu isn&apos;t set up yet. Ask a manager.</p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-3xl">Menu &amp; Recipes</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {items.length} items{isManager && missing > 0 && <span className="text-amber-700"> · {missing} still need a recipe</span>}
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setEditing('new')}
            className="shrink-0 flex items-center gap-1.5 px-4 h-11 rounded-xl bg-gold text-ink text-sm font-medium"
          >
            <Plus size={16} strokeWidth={2} />
            Add
          </button>
        )}
      </header>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dishes, drinks or ingredients"
          className={cn(inputClass, 'pl-9')}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'shrink-0 px-4 h-10 rounded-full text-sm font-medium border',
              filter === f.key ? 'bg-ink text-cream border-ink' : 'bg-white text-neutral-600 border-neutral-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sections.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">Nothing matches.</div>
      ) : (
        <div className="space-y-6">
          {sections.map(([section, list]) => (
            <section key={section}>
              <h2 className={cn(headingClass, 'px-1')}>
                {section}
                <span className="normal-case tracking-normal text-neutral-400"> · {MENU_LABELS[list[0].menu]}</span>
              </h2>
              <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
                {list.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setOpenId(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-neutral-50 active:bg-neutral-50"
                  >
                    <Thumb item={item} className="w-14 h-14 rounded-lg shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[15px] font-medium truncate">{item.name}</span>
                        <span className="text-sm tabular-nums text-neutral-600 shrink-0">{formatPrice(item.price)}</span>
                      </span>
                      <span className="block text-xs text-neutral-500 truncate mt-0.5">{item.ingredients.map((g) => g.name).join(', ')}</span>
                      {isManager && !hasRecipe(item) && <span className="block text-[11px] text-amber-700 mt-0.5">Recipe to add</span>}
                    </span>
                    <ChevronRight size={16} className="text-neutral-300 shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {opened && !editing && (
        <Sheet onClose={() => setOpenId(null)}>
          <ItemDetail item={opened} canEdit={isManager} onEdit={() => setEditing(opened)} onClose={() => setOpenId(null)} />
        </Sheet>
      )}

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <ItemForm
            item={editing === 'new' ? null : editing}
            defaultMenu={filter === 'all' ? 'mornings' : filter}
            sectionNames={sectionNames}
            onCancel={() => setEditing(null)}
            onSaved={(item) => {
              saved(item);
              setEditing(null);
              setOpenId(item.active ? item.id : null);
            }}
          />
        </Sheet>
      )}
    </>
  );
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50 sm:px-4" onClick={onClose}>
      <div
        className="bg-cream w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ItemDetail({ item, canEdit, onEdit, onClose }: { item: MenuItem; canEdit: boolean; onEdit: () => void; onClose: () => void }) {
  const steps = (item.steps ?? '').split('\n').map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  const updated = new Date(item.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Aruba' });

  return (
    <div>
      <div className="relative">
        <Thumb item={item} className="w-full aspect-[4/3] sm:rounded-t-2xl rounded-t-2xl" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-ink shadow"
        >
          <X size={18} />
        </button>
      </div>
      <div className="p-5 space-y-5">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl">{item.name}</h2>
            <span className="text-lg tabular-nums shrink-0">{formatPrice(item.price)}</span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {item.section} · {MENU_LABELS[item.menu]} · {STATION_LABELS[item.station]}
          </p>
          {item.description && <p className="text-[15px] text-neutral-700 mt-3 italic">{item.description}</p>}
        </div>

        <div>
          <h3 className={headingClass}>Ingredients</h3>
          {item.ingredients.length === 0 ? (
            <p className="text-sm text-neutral-400">None listed yet.</p>
          ) : (
            <ul className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
              {item.ingredients.map((g, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[15px]">
                  <span>{g.name}</span>
                  <span className="text-neutral-500 tabular-nums shrink-0">{formatQty(g.qty, g.unit)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className={headingClass}>How to make it</h3>
          {steps.length === 0 ? (
            <p className="text-sm text-neutral-400">Steps not added yet.</p>
          ) : (
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-snug">
                  <span className="w-6 h-6 rounded-full bg-ink text-cream text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {item.notes && (
          <div>
            <h3 className={headingClass}>Notes</h3>
            <p className="text-[15px] whitespace-pre-line">{item.notes}</p>
          </div>
        )}
        {item.allergens && (
          <div>
            <h3 className={headingClass}>Allergens</h3>
            <p className="text-[15px] text-red-700">{item.allergens}</p>
          </div>
        )}

        <p className="text-[11px] text-neutral-400">
          Updated {updated}
          {item.updated_by && ` by ${item.updated_by}`}
        </p>

        {canEdit && (
          <button onClick={onEdit} className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium">
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function ItemForm({
  item,
  defaultMenu,
  sectionNames,
  onCancel,
  onSaved,
}: {
  item: MenuItem | null;
  defaultMenu: MenuName;
  sectionNames: string[];
  onCancel: () => void;
  onSaved: (item: MenuItem) => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item?.price === null || item?.price === undefined ? '' : String(item.price));
  const [menu, setMenu] = useState<MenuName>(item?.menu ?? defaultMenu);
  const [station, setStation] = useState<Station>(item?.station ?? (defaultMenu === 'drinks' ? 'bar' : 'kitchen'));
  const [section, setSection] = useState(item?.section ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [ingredients, setIngredients] = useState<(Omit<Ingredient, 'qty'> & { qty: string })[]>(
    (item?.ingredients ?? []).map((g) => ({ ...g, qty: g.qty === null ? '' : String(g.qty) }))
  );
  const [steps, setSteps] = useState(item?.steps ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [allergens, setAllergens] = useState(item?.allergens ?? '');
  const [photoUrl, setPhotoUrl] = useState(item?.photo_url ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : photoUrl), [photoFile, photoUrl]);

  const choice = (on: boolean) =>
    cn('py-2.5 rounded-xl text-sm font-medium transition', on ? 'bg-ink text-cream' : 'bg-white border border-neutral-200 text-neutral-600');
  const setIngredient = (i: number, patch: Partial<{ name: string; qty: string; unit: string }>) =>
    setIngredients((list) => list.map((g, n) => (n === i ? { ...g, ...patch } : g)));

  async function save(remove = false) {
    setSaving(true);
    setError(null);
    try {
      const payload = remove
        ? { active: false }
        : {
            name,
            price: price.trim() === '' ? null : price,
            menu,
            station,
            section,
            description,
            ingredients: ingredients.map((g) => ({ ...g, qty: g.qty.trim() === '' ? null : g.qty })),
            steps,
            notes,
            allergens,
            photo_url: photoUrl,
          };
      let result: MenuItem = item ? await send('/api/menu', 'PUT', { id: item.id, ...payload }) : await send('/api/menu', 'POST', payload);
      if (photoFile && !remove) {
        const form = new FormData();
        form.append('file', await shrinkPhoto(photoFile), 'photo.jpg');
        form.append('itemId', result.id);
        const res = await fetch('/api/menu/photo', { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`Saved, but the photo didn't upload: ${data.error || 'try again'}`);
        result = data;
      }
      onSaved(result);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-xl">{item ? 'Edit item' : 'Add item'}</h2>
        <button onClick={onCancel} aria-label="Close" className="w-10 h-10 -mr-2 flex items-center justify-center text-neutral-400 hover:text-ink">
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelClass}>Photo</label>
          <div className="flex items-center gap-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="w-24 h-24 rounded-xl object-cover bg-neutral-100" />
            ) : (
              <span className="w-24 h-24 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-300">
                <ImagePlus size={26} strokeWidth={1.5} />
              </span>
            )}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => fileInput.current?.click()} className="px-4 h-10 rounded-xl bg-white border border-neutral-200 text-sm font-medium">
                {preview ? 'Change photo' : 'Add photo'}
              </button>
              {preview && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoUrl(null);
                  }}
                  className="px-4 h-10 rounded-xl text-sm text-red-600"
                >
                  Remove photo
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && setPhotoFile(e.target.files[0])}
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Price ($)</label>
            <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Menu</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['mornings', 'all_day', 'nights', 'drinks'] as MenuName[]).map((m) => (
              <button key={m} type="button" onClick={() => setMenu(m)} className={choice(menu === m)}>
                {MENU_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Made at</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['kitchen', 'bar'] as Station[]).map((s) => (
                <button key={s} type="button" onClick={() => setStation(s)} className={choice(station === s)}>
                  {STATION_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Section</label>
            <input type="text" list="menu-sections" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Bagels" className={cn(inputClass, 'py-2.5')} />
            <datalist id="menu-sections">
              {sectionNames.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <label className={labelClass}>Menu description (what guests read)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={cn(inputClass, 'resize-none')} />
        </div>

        <div>
          <label className={labelClass}>Ingredients</label>
          <div className="space-y-2">
            {ingredients.map((g, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 p-2 bg-white border border-neutral-200 rounded-xl">
                <input
                  type="text"
                  value={g.name}
                  onChange={(e) => setIngredient(i, { name: e.target.value })}
                  placeholder="Ingredient"
                  className="w-full sm:w-auto sm:flex-1 min-w-0 px-2 py-2 text-base rounded-lg border border-transparent focus:border-gold focus:outline-none"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={g.qty}
                  onChange={(e) => setIngredient(i, { qty: e.target.value })}
                  placeholder="Amount"
                  className="flex-1 min-w-0 sm:flex-none sm:w-20 px-2 py-2 text-base rounded-lg bg-neutral-50 border border-neutral-200 focus:border-gold focus:outline-none"
                />
                <input
                  type="text"
                  list="menu-units"
                  value={g.unit}
                  onChange={(e) => setIngredient(i, { unit: e.target.value })}
                  placeholder="Unit"
                  className="flex-1 min-w-0 sm:flex-none sm:w-24 px-2 py-2 text-base rounded-lg bg-neutral-50 border border-neutral-200 focus:border-gold focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIngredients((list) => list.filter((_, n) => n !== i))}
                  aria-label={`Remove ${g.name || 'ingredient'}`}
                  className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <datalist id="menu-units">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => setIngredients((list) => [...list, { name: '', qty: '', unit: '' }])}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-600"
            >
              <Plus size={15} />
              Add ingredient
            </button>
          </div>
        </div>

        <div>
          <label className={labelClass}>How to make it</label>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={5}
            placeholder={'One step per line, e.g.\nHeat the pan to medium.\nPour 1 ladle of batter.'}
            className={cn(inputClass, 'resize-y')}
          />
        </div>

        <div>
          <label className={labelClass}>Notes (plating, garnish, extras)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(inputClass, 'resize-none')} />
        </div>

        <div>
          <label className={labelClass}>Allergens</label>
          <input type="text" value={allergens} onChange={(e) => setAllergens(e.target.value)} placeholder="e.g. gluten, dairy, nuts" className={inputClass} />
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-800">{error}</div>}

        <button
          onClick={() => save()}
          disabled={saving || !name.trim() || !section.trim()}
          className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : item ? 'Save' : 'Add to menu'}
        </button>
        {item && (
          <button
            onClick={() => confirm(`Remove ${item.name} from the menu?`) && save(true)}
            disabled={saving}
            className="w-full py-3 text-sm text-red-600"
          >
            Remove from menu
          </button>
        )}
      </div>
    </div>
  );
}
