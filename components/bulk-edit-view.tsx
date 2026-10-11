'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ChevronLeft, Search, Check } from 'lucide-react';
import { unitOptions } from '@/lib/units';

function EditableCell({ value, field, itemId, onSave, className }: {
  value: string;
  field: string;
  itemId: string;
  onSave: (id: string, field: string, value: string | null) => void;
  className?: string;
}) {
  const [local, setLocal] = useState(value ?? '');
  const ref = useRef<HTMLInputElement>(null);

  function handleBlur() {
    const trimmed = local.trim();
    if (trimmed !== (value ?? '')) onSave(itemId, field, trimmed || null);
  }

  return (
    <input
      ref={ref}
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === 'Enter') ref.current?.blur(); }}
      className={cn(
        'border border-transparent hover:border-neutral-200 focus:border-gold rounded px-1.5 py-1 bg-transparent focus:bg-white focus:outline-none transition w-full',
        className
      )}
    />
  );
}

interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
  unit_size: string | null;
  station: string;
  supplier_id: string | null;
  backup_supplier_id: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

const CATEGORIES: Record<string, string> = {
  'produce': 'Produce',
  'dairy': 'Dairy & Cheese',
  'meat': 'Meat & Protein',
  'seafood': 'Seafood',
  'bakery': 'Bakery & Dough',
  'dry-goods': 'Dry Goods & Pantry',
  'condiments-sauces': 'Condiments & Sauces',
  'beverages-alcohol': 'Alcohol',
  'beverages-non-alcohol': 'Non-Alcoholic Beverages',
  'bar-supplies': 'Bar Supplies',
  'paper-goods': 'Paper Goods & Supplies',
  'other': 'Other',
};

const STATIONS = [
  { value: 'bar', label: 'Bar' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'both', label: 'Both' },
];

// Tables on wide screens; on phones, 16px fields so iPhones don't zoom in on tap
const cellSelect = 'w-full bg-white border border-neutral-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50 cursor-pointer';
const mobileSelect = 'w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-gold';
const mobileLabel = 'text-[10px] uppercase tracking-widest text-neutral-400 block mb-1';

export function BulkEditView({ items: initialItems, suppliers }: { items: Item[]; suppliers: Supplier[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (onlyMissing) result = result.filter((i) => !i.supplier_id);
    return result;
  }, [items, search, onlyMissing]);

  const grouped = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const item of filtered) (map[item.category] ??= []).push(item);
    const order = Object.keys(CATEGORIES);
    return Object.entries(map).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  }, [filtered]);

  async function updateItem(id: string, field: string, value: string | null) {
    setSaving((prev) => new Set(prev).add(id));
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
      setSaved((prev) => new Set(prev).add(id));
      setTimeout(() => setSaved((prev) => { const n = new Set(prev); n.delete(id); return n; }), 1500);
    } else {
      alert('Could not save that change. Please try again.');
    }
    setSaving((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  const unassigned = items.filter((i) => !i.supplier_id).length;

  const supplierOptions = (placeholder: string) => (
    <>
      <option value="">{placeholder}</option>
      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </>
  );

  return (
    <div>
      <header className="mb-5">
        <Link href="/dashboard/purchasing" className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-neutral-500 hover:text-ink transition mb-3">
          <ChevronLeft size={14} strokeWidth={1.5} />
          Purchasing
        </Link>
        <h1 className="font-display text-3xl">Ingredient list</h1>
        <p className="text-sm text-neutral-500 mt-1">Every change saves automatically.</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-3 py-3 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold"
          />
        </div>
        {unassigned > 0 && (
          <button
            onClick={() => setOnlyMissing(!onlyMissing)}
            className={cn(
              'px-4 py-3 rounded-xl text-sm font-medium transition',
              onlyMissing ? 'bg-red-600 text-white' : 'bg-red-50 border border-red-200 text-red-700'
            )}
          >
            {onlyMissing ? 'Show all items' : `${unassigned} without a supplier`}
          </button>
        )}
      </div>

      {grouped.length === 0 && (
        <p className="bg-white border border-neutral-200 rounded-xl p-10 text-center text-sm text-neutral-500">Nothing matches.</p>
      )}

      {/* Wide screens: one table per type */}
      <div className="hidden lg:block">
        {grouped.map(([category, catItems]) => (
          <div key={category} className="mb-6">
            <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-medium mb-2 px-1">
              {CATEGORIES[category] || category} <span className="text-neutral-400">({catItems.length})</span>
            </h2>
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs uppercase tracking-widest text-neutral-400">
                    <th className="text-left px-4 py-2.5 font-normal w-[24%]">Item</th>
                    <th className="text-left px-2 py-2.5 font-normal w-[12%]">Delivered as</th>
                    <th className="text-left px-2 py-2.5 font-normal w-[11%]">Size</th>
                    <th className="text-left px-2 py-2.5 font-normal w-[10%]">Used by</th>
                    <th className="text-left px-2 py-2.5 font-normal w-[19%]">Supplier</th>
                    <th className="text-left px-2 py-2.5 font-normal w-[19%]">Backup supplier</th>
                    <th className="w-[5%]"></th>
                  </tr>
                </thead>
                <tbody>
                  {catItems.map((item) => (
                    <tr key={item.id} className={cn(
                      'border-b border-neutral-50 last:border-b-0 transition-colors',
                      saved.has(item.id) ? 'bg-teal-50/50' : !item.supplier_id && 'bg-red-50/40',
                    )}>
                      <td className="px-3 py-1.5">
                        <EditableCell value={item.name} field="name" itemId={item.id} onSave={updateItem} className="font-medium text-sm" />
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} className={cellSelect}>
                          {unitOptions(item.unit).map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <EditableCell value={item.unit_size ?? ''} field="unit_size" itemId={item.id} onSave={updateItem} className="text-sm text-neutral-600" />
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={item.station} onChange={(e) => updateItem(item.id, 'station', e.target.value)} className={cellSelect}>
                          {STATIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={item.supplier_id ?? ''}
                          onChange={(e) => updateItem(item.id, 'supplier_id', e.target.value || null)}
                          className={cn(cellSelect, !item.supplier_id && 'border-red-300 text-red-600')}
                        >
                          {supplierOptions('— Choose supplier —')}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={item.backup_supplier_id ?? ''}
                          onChange={(e) => updateItem(item.id, 'backup_supplier_id', e.target.value || null)}
                          className={cellSelect}
                        >
                          {supplierOptions('— None —')}
                        </select>
                      </td>
                      <td className="px-2 text-center">
                        {saving.has(item.id) && <span className="text-xs text-neutral-400">…</span>}
                        {saved.has(item.id) && <Check size={15} className="text-teal-600 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Phones: one card per item */}
      <div className="lg:hidden space-y-6">
        {grouped.map(([category, catItems]) => (
          <section key={category}>
            <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-medium mb-2 px-1">
              {CATEGORIES[category] || category} <span className="text-neutral-400">({catItems.length})</span>
            </h2>
            <div className="space-y-2">
              {catItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'bg-white border rounded-xl p-3 transition-colors',
                    saved.has(item.id) ? 'border-teal-300 bg-teal-50/50' : !item.supplier_id ? 'border-red-200' : 'border-neutral-200',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <EditableCell value={item.name} field="name" itemId={item.id} onSave={updateItem} className="font-medium text-base" />
                    {saving.has(item.id) && <span className="text-xs text-neutral-400 shrink-0">Saving…</span>}
                    {saved.has(item.id) && <span className="flex items-center gap-1 text-xs text-teal-700 shrink-0"><Check size={14} /> Saved</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className={mobileLabel}>Delivered as</label>
                      <select value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} className={mobileSelect}>
                        {unitOptions(item.unit).map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={mobileLabel}>Size</label>
                      <EditableCell
                        value={item.unit_size ?? ''}
                        field="unit_size"
                        itemId={item.id}
                        onSave={updateItem}
                        className="!border-neutral-200 bg-white rounded-xl px-3 py-2.5 text-base"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className={mobileLabel}>Used by</label>
                      <select value={item.station} onChange={(e) => updateItem(item.id, 'station', e.target.value)} className={mobileSelect}>
                        {STATIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={mobileLabel}>Supplier</label>
                      <select
                        value={item.supplier_id ?? ''}
                        onChange={(e) => updateItem(item.id, 'supplier_id', e.target.value || null)}
                        className={cn(mobileSelect, !item.supplier_id && 'border-red-300 text-red-600')}
                      >
                        {supplierOptions('— Choose supplier —')}
                      </select>
                    </div>
                    <div>
                      <label className={mobileLabel}>Backup supplier</label>
                      <select
                        value={item.backup_supplier_id ?? ''}
                        onChange={(e) => updateItem(item.id, 'backup_supplier_id', e.target.value || null)}
                        className={mobileSelect}
                      >
                        {supplierOptions('— None —')}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
