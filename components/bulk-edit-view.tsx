'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ArrowLeft, Search, Check, ChevronDown } from 'lucide-react';

interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
  unit_size: string | null;
  par_stock: number;
  current_stock: number;
  station: string;
  supplier_id: string | null;
  backup_supplier_id: string | null;
  supplier: { id: string; name: string } | null;
  backup_supplier: { id: string; name: string } | null;
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
  { value: 'both', label: 'Both' },
  { value: 'bar', label: 'Bar' },
  { value: 'kitchen', label: 'Kitchen' },
];

export function BulkEditView({ items: initialItems, suppliers }: { items: Item[]; suppliers: Supplier[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [changeCount, setChangeCount] = useState(0);

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      result = result.filter((i) => i.category === categoryFilter);
    }
    return result;
  }, [items, search, categoryFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const item of filtered) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return Object.entries(map).sort(([a], [b]) => {
      const keys = Object.keys(CATEGORIES);
      return keys.indexOf(a) - keys.indexOf(b);
    });
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
      setChangeCount((c) => c + 1);
      setSaved((prev) => new Set(prev).add(id));
      setTimeout(() => setSaved((prev) => { const n = new Set(prev); n.delete(id); return n; }), 1500);
    }
    setSaving((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  const categories = [...new Set(items.map((i) => i.category))].sort((a, b) => {
    const keys = Object.keys(CATEGORIES);
    return keys.indexOf(a) - keys.indexOf(b);
  });

  const unassigned = items.filter((i) => !i.supplier_id).length;

  return (
    <div>
      <header className="mb-6">
        <button
          onClick={() => router.push('/dashboard/purchasing')}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink transition mb-3"
        >
          <ArrowLeft size={14} />
          Back to Purchasing
        </button>
        <h1 className="font-display text-3xl">Bulk Edit</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Assign suppliers, backup suppliers, and stations to all items.
          {unassigned > 0 && <span className="text-red-600 font-medium ml-1">{unassigned} items without a supplier.</span>}
        </p>
        {changeCount > 0 && (
          <p className="text-sm text-teal-700 mt-1">{changeCount} changes saved automatically.</p>
        )}
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
        </div>
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none w-full sm:w-auto pl-3 pr-8 py-2 border border-neutral-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold/50"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{CATEGORIES[c] || c}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block">
        {grouped.map(([category, catItems]) => (
          <div key={category} className="mb-6">
            <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-medium mb-2 px-1">
              {CATEGORIES[category] || category} <span className="text-neutral-400">({catItems.length})</span>
            </h2>
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs uppercase tracking-widest text-neutral-400">
                    <th className="text-left px-4 py-2.5 font-normal w-[30%]">Item</th>
                    <th className="text-center px-2 py-2.5 font-normal w-[6%]">Par</th>
                    <th className="text-center px-2 py-2.5 font-normal w-[7%]">Station</th>
                    <th className="text-left px-2 py-2.5 font-normal w-[25%]">Supplier</th>
                    <th className="text-left px-2 py-2.5 font-normal w-[25%]">Backup Supplier</th>
                    <th className="w-[7%] px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {catItems.map((item) => (
                    <tr key={item.id} className={cn(
                      'border-b border-neutral-50 last:border-b-0 transition-colors',
                      saved.has(item.id) && 'bg-teal-50/50',
                      !item.supplier_id && 'bg-red-50/30',
                    )}>
                      <td className="px-4 py-2">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-neutral-400 ml-1.5 text-xs">{item.unit}{item.unit_size ? ` (${item.unit_size})` : ''}</span>
                      </td>
                      <td className="px-2 py-2 text-center">{item.par_stock}</td>
                      <td className="px-2 py-2 text-center">
                        <select
                          value={item.station}
                          onChange={(e) => updateItem(item.id, 'station', e.target.value)}
                          className="appearance-none bg-transparent text-xs text-center border border-neutral-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-gold/50 cursor-pointer"
                        >
                          {STATIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={item.supplier_id ?? ''}
                          onChange={(e) => updateItem(item.id, 'supplier_id', e.target.value || null)}
                          className={cn(
                            'appearance-none w-full bg-transparent border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50 cursor-pointer',
                            item.supplier_id ? 'border-neutral-200' : 'border-red-300 text-red-500'
                          )}
                        >
                          <option value="">— Select supplier —</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={item.backup_supplier_id ?? ''}
                          onChange={(e) => updateItem(item.id, 'backup_supplier_id', e.target.value || null)}
                          className="appearance-none w-full bg-transparent border border-neutral-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50 cursor-pointer"
                        >
                          <option value="">— None —</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {saving.has(item.id) && <span className="text-xs text-neutral-400">...</span>}
                        {saved.has(item.id) && <Check size={14} className="text-teal-600 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {grouped.map(([category, catItems]) => (
          <div key={category}>
            <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-medium mb-2 px-1">
              {CATEGORIES[category] || category} <span className="text-neutral-400">({catItems.length})</span>
            </h2>
            <div className="space-y-2">
              {catItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'bg-white border rounded-lg p-3 transition-colors',
                    saved.has(item.id) ? 'border-teal-300 bg-teal-50/50' : !item.supplier_id ? 'border-red-200 bg-red-50/20' : 'border-neutral-200',
                  )}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <span className="font-medium text-sm">{item.name}</span>
                      <span className="text-neutral-400 text-xs ml-1.5">{item.unit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {saving.has(item.id) && <span className="text-xs text-neutral-400">Saving...</span>}
                      {saved.has(item.id) && <Check size={14} className="text-teal-600" />}
                      <select
                        value={item.station}
                        onChange={(e) => updateItem(item.id, 'station', e.target.value)}
                        className="appearance-none text-xs border border-neutral-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                      >
                        {STATIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-0.5">Supplier</label>
                      <select
                        value={item.supplier_id ?? ''}
                        onChange={(e) => updateItem(item.id, 'supplier_id', e.target.value || null)}
                        className={cn(
                          'appearance-none w-full border rounded px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gold/50',
                          item.supplier_id ? 'border-neutral-200' : 'border-red-300'
                        )}
                      >
                        <option value="">— Select supplier —</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-0.5">Backup Supplier</label>
                      <select
                        value={item.backup_supplier_id ?? ''}
                        onChange={(e) => updateItem(item.id, 'backup_supplier_id', e.target.value || null)}
                        className="appearance-none w-full border border-neutral-200 rounded px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                      >
                        <option value="">— None —</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
