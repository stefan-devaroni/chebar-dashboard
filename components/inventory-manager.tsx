'use client';

import { useState, useMemo, useRef, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Plus, Minus, X, Search, ChevronDown, ChevronRight, Truck, Trash2, ClipboardList } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  unit_size: string | null;
  par_stock: number;
  current_stock: number;
  supplier: { id: string; name: string } | null;
  backup_supplier: { id: string; name: string } | null;
  supplier_id: string | null;
  backup_supplier_id: string | null;
  station: 'bar' | 'kitchen' | 'both';
  last_counted_at: string | null;
  notes: string | null;
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

export function InventoryManager({
  initialItems,
  initialSuppliers,
}: {
  initialItems: InventoryItem[];
  initialSuppliers: Supplier[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [generatingOrder, setGeneratingOrder] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [buyQtys, setBuyQtys] = useState<Record<string, number>>({});
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      result = result.filter((i) => i.category === categoryFilter);
    }
    if (stationFilter !== 'all') {
      result = result.filter((i) => i.station === stationFilter || i.station === 'both');
    }
    return result;
  }, [items, search, categoryFilter, stationFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, InventoryItem[]> = {};
    for (const item of filtered) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return Object.entries(map).sort(([a], [b]) => {
      const keys = Object.keys(CATEGORIES);
      return keys.indexOf(a) - keys.indexOf(b);
    });
  }, [filtered]);

  const totalToBuy = Object.values(buyQtys).filter((v) => v > 0).length;

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  const setBuyQty = useCallback((id: string, delta: number) => {
    setBuyQtys((prev) => {
      const current = prev[id] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  }, []);

  const setBuyQtyDirect = useCallback((id: string, value: number) => {
    setBuyQtys((prev) => ({ ...prev, [id]: Math.max(0, value) }));
  }, []);

  const updateField = useCallback(async (id: string, field: string, value: any) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
  }, []);

  const updateSupplier = useCallback(async (id: string, field: 'supplier_id' | 'backup_supplier_id', value: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value || null } : i)));
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
  }, []);

  async function deleteItem(id: string) {
    if (!confirm('Remove this item from inventory?')) return;
    const res = await fetch('/api/inventory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  }

  async function handleSaveItem(data: any) {
    if (editingItem) {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingItem.id, ...data }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      }
    } else {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = await res.json();
        setItems((prev) => [...prev, created]);
      }
    }
    setShowAddItem(false);
    setEditingItem(null);
  }

  async function generateOrder() {
    const orderItems = items
      .filter((item) => (buyQtys[item.id] ?? 0) > 0)
      .map((item) => ({
        name: item.name,
        unit: item.unit,
        unit_size: item.unit_size,
        toBuy: buyQtys[item.id],
        supplier_name: item.supplier?.name ?? 'No supplier assigned',
        supplier_id: item.supplier_id,
      }));
    if (orderItems.length === 0) return;
    setGeneratingOrder(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: orderItems }),
    });
    if (res.ok) {
      setBuyQtys({});
      router.push('/dashboard/orders');
    }
    setGeneratingOrder(false);
  }

  async function handleSaveSupplier(data: any) {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const created = await res.json();
      setSuppliers((prev) => [...prev, created]);
    }
    setShowAddSupplier(false);
  }

  const generateOrderButton = (
    <button
      onClick={generateOrder}
      disabled={generatingOrder || totalToBuy === 0}
      className={cn(
        'flex items-center justify-center gap-1.5 w-full sm:w-auto px-5 py-2.5 rounded text-sm uppercase tracking-widest transition disabled:opacity-40',
        totalToBuy > 0
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-neutral-200 text-neutral-500'
      )}
    >
      <ClipboardList size={14} strokeWidth={2} />
      {generatingOrder ? 'Saving...' : totalToBuy > 0 ? `Generate order (${totalToBuy} items)` : 'Generate order'}
    </button>
  );

  return (
    <div>
      {/* Station filter */}
      <div className="flex gap-2 mb-4">
        {([['all', 'All items'], ['bar', 'Bar'], ['kitchen', 'Kitchen']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setStationFilter(k)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              stationFilter === k
                ? 'bg-ink text-cream'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search + category */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold"
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Top action bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {generateOrderButton}
        <button
          onClick={() => setShowAddSupplier(true)}
          className="flex items-center gap-1.5 border border-neutral-300 text-neutral-700 px-3 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-white transition"
        >
          <Truck size={12} strokeWidth={2} />
          Add supplier
        </button>
        <button
          onClick={() => { setEditingItem(null); setShowAddItem(true); }}
          className="flex items-center gap-1.5 bg-gold text-ink px-4 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-gold/80 transition"
        >
          <Plus size={14} strokeWidth={2} />
          Add item
        </button>
      </div>

      {/* Item list grouped by category */}
      {grouped.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded p-10 text-center">
          <p className="text-sm text-neutral-500">
            {items.length === 0
              ? 'No inventory items yet. Add items above.'
              : 'No items match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, catItems]) => {
            const collapsed = collapsedCategories.has(category);
            const catBuyCount = catItems.filter((i) => (buyQtys[i.id] ?? 0) > 0).length;
            return (
              <section key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 mb-2 w-full text-left"
                >
                  {collapsed
                    ? <ChevronRight size={14} className="text-neutral-400" />
                    : <ChevronDown size={14} className="text-neutral-400" />}
                  <h3 className="text-xs uppercase tracking-widest text-neutral-500">
                    {CATEGORIES[category] ?? category}
                  </h3>
                  <span className="text-xs text-neutral-400">({catItems.length})</span>
                  {catBuyCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                      {catBuyCount} to order
                    </span>
                  )}
                </button>

                {!collapsed && (
                  <>
                    {/* Desktop table */}
                    <div className="hidden lg:block bg-white border border-neutral-200 rounded overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-neutral-100 text-xs uppercase tracking-widest text-neutral-500">
                            <th className="text-left px-3 py-2.5 font-normal">Item</th>
                            <th className="text-center px-2 py-2.5 font-normal w-32">Buy</th>
                            <th className="text-left px-2 py-2.5 font-normal w-36">Supplier</th>
                            <th className="text-left px-2 py-2.5 font-normal w-36">Backup</th>
                            <th className="px-2 py-2.5 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {catItems.map((item) => (
                            <DesktopRow
                              key={item.id}
                              item={item}
                              suppliers={suppliers}
                              buyQty={buyQtys[item.id] ?? 0}
                              onBuyChange={setBuyQty}
                              updateField={updateField}
                              updateSupplier={updateSupplier}
                              onDelete={() => deleteItem(item.id)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden space-y-2">
                      {catItems.map((item) => (
                        <MobileCard
                          key={item.id}
                          item={item}
                          suppliers={suppliers}
                          buyQty={buyQtys[item.id] ?? 0}
                          onBuyChange={setBuyQty}
                          updateField={updateField}
                          updateSupplier={updateSupplier}
                          onDelete={() => deleteItem(item.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Bottom generate order button */}
      <div className="mt-6 flex justify-center">
        {generateOrderButton}
      </div>

      {/* Add/Edit item modal */}
      {showAddItem && (
        <ItemModal
          item={editingItem}
          suppliers={suppliers}
          onClose={() => { setShowAddItem(false); setEditingItem(null); }}
          onSave={handleSaveItem}
        />
      )}

      {/* Add supplier modal */}
      {showAddSupplier && (
        <SupplierModal
          onClose={() => setShowAddSupplier(false)}
          onSave={handleSaveSupplier}
        />
      )}
    </div>
  );
}

function InlineEdit({ value, field, itemId, onSave, type = 'text', className }: {
  value: string | number;
  field: string;
  itemId: string;
  onSave: (id: string, field: string, value: any) => void;
  type?: 'text' | 'number';
  className?: string;
}) {
  const [local, setLocal] = useState(String(value ?? ''));
  const ref = useRef<HTMLInputElement>(null);

  function handleBlur() {
    const trimmed = local.trim();
    const original = String(value ?? '');
    if (trimmed !== original) {
      onSave(itemId, field, type === 'number' ? (Number(trimmed) || 0) : (trimmed || null));
    }
  }

  return (
    <input
      ref={ref}
      type={type}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === 'Enter') ref.current?.blur(); }}
      className={cn(
        'border border-transparent hover:border-neutral-200 focus:border-gold rounded px-1.5 py-0.5 bg-transparent focus:bg-white focus:outline-none transition',
        className
      )}
    />
  );
}

const DesktopRow = memo(function DesktopRow({
  item, suppliers, buyQty, onBuyChange, updateField, updateSupplier, onDelete,
}: {
  item: InventoryItem;
  suppliers: Supplier[];
  buyQty: number;
  onBuyChange: (id: string, delta: number) => void;
  updateField: (id: string, field: string, value: any) => void;
  updateSupplier: (id: string, field: 'supplier_id' | 'backup_supplier_id', value: string) => void;
  onDelete: () => void;
}) {
  return (
    <tr className={cn(
      'border-b border-neutral-50 last:border-b-0 group',
      buyQty > 0 ? 'bg-red-50/40' : ''
    )}>
      <td className="px-3 py-1">
        <InlineEdit value={item.name} field="name" itemId={item.id} onSave={updateField} className="font-medium text-sm w-full" />
      </td>
      <td className="px-2 py-2 text-center">
        <div className="inline-flex items-center gap-0.5">
          <button onClick={() => onBuyChange(item.id, -1)}
            className="p-1 rounded hover:bg-neutral-100 text-neutral-400 hover:text-ink transition">
            <Minus size={14} strokeWidth={2} />
          </button>
          <span className={cn('font-bold px-2 min-w-[2.5rem] text-center tabular-nums',
            buyQty > 0 ? 'text-red-700' : 'text-neutral-300'
          )}>{buyQty}</span>
          <button onClick={() => onBuyChange(item.id, 1)}
            className="p-1 rounded hover:bg-neutral-100 text-neutral-400 hover:text-ink transition">
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>
      </td>
      <td className="px-2 py-2">
        <select value={item.supplier_id ?? ''} onChange={(e) => updateSupplier(item.id, 'supplier_id', e.target.value)}
          className="w-full bg-transparent border-0 text-xs text-neutral-600 py-0.5 focus:outline-none focus:ring-1 focus:ring-gold rounded cursor-pointer">
          <option value="">--</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <select value={item.backup_supplier_id ?? ''} onChange={(e) => updateSupplier(item.id, 'backup_supplier_id', e.target.value)}
          className="w-full bg-transparent border-0 text-xs text-neutral-400 py-0.5 focus:outline-none focus:ring-1 focus:ring-gold rounded cursor-pointer">
          <option value="">--</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <button onClick={onDelete} className="p-1 text-neutral-400 hover:text-red-600 transition opacity-0 group-hover:opacity-100" title="Delete">
          <Trash2 size={12} strokeWidth={1.5} />
        </button>
      </td>
    </tr>
  );
});

const MobileCard = memo(function MobileCard({
  item, suppliers, buyQty, onBuyChange, updateField, updateSupplier, onDelete,
}: {
  item: InventoryItem;
  suppliers: Supplier[];
  buyQty: number;
  onBuyChange: (id: string, delta: number) => void;
  updateField: (id: string, field: string, value: any) => void;
  updateSupplier: (id: string, field: 'supplier_id' | 'backup_supplier_id', value: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      'border rounded px-2 py-2.5',
      buyQty > 0 ? 'bg-red-50/40 border-red-200' : 'bg-white border-neutral-200'
    )}>
      {/* Row 1: name + buy stepper */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setExpanded(!expanded)} className="flex-1 min-w-0 text-left">
          <span className="font-medium text-sm block truncate">{item.name}</span>
          <span className="text-[10px] text-neutral-400 block truncate">
            {item.supplier ? item.supplier.name : ''}
            {item.supplier && item.unit ? ' · ' : ''}
            {item.unit}{item.unit_size ? ` (${item.unit_size})` : ''}
          </span>
        </button>
        <div className="inline-flex items-center border border-neutral-200 rounded-lg overflow-hidden shrink-0">
          <button onClick={() => onBuyChange(item.id, -1)}
            className="px-2 py-2 bg-neutral-50 active:bg-neutral-200 text-neutral-500 transition">
            <Minus size={16} strokeWidth={2} />
          </button>
          <span className={cn('px-1.5 py-2 min-w-[2rem] text-center text-base font-bold tabular-nums',
            buyQty > 0 ? 'text-red-700 bg-red-50' : 'text-neutral-300'
          )}>{buyQty}</span>
          <button onClick={() => onBuyChange(item.id, 1)}
            className="px-2 py-2 bg-neutral-50 active:bg-neutral-200 text-neutral-500 transition">
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Expanded: supplier dropdowns + delete */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-1">Supplier</label>
              <select value={item.supplier_id ?? ''} onChange={(e) => updateSupplier(item.id, 'supplier_id', e.target.value)}
                className="w-full bg-white border border-neutral-200 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-gold">
                <option value="">--</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-1">Backup</label>
              <select value={item.backup_supplier_id ?? ''} onChange={(e) => updateSupplier(item.id, 'backup_supplier_id', e.target.value)}
                className="w-full bg-white border border-neutral-200 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-gold">
                <option value="">--</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onDelete} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-red-600 transition">
              <Trash2 size={11} strokeWidth={1.5} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

function ItemModal({
  item,
  suppliers,
  onClose,
  onSave,
}: {
  item: InventoryItem | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? 'other');
  const [unit, setUnit] = useState(item?.unit ?? 'each');
  const [unitSize, setUnitSize] = useState(item?.unit_size ?? '');
  const [parStock, setParStock] = useState(item?.par_stock ?? 0);
  const [currentStock, setCurrentStock] = useState(item?.current_stock ?? 0);
  const [supplierId, setSupplierId] = useState(item?.supplier_id ?? '');
  const [backupSupplierId, setBackupSupplierId] = useState(item?.backup_supplier_id ?? '');
  const [station, setStation] = useState(item?.station ?? 'both');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      category,
      unit,
      unit_size: unitSize || null,
      par_stock: parStock,
      current_stock: currentStock,
      supplier_id: supplierId || null,
      backup_supplier_id: backupSupplierId || null,
      station,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-cream border border-neutral-200 rounded-lg w-full max-w-lg p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">{item ? 'Edit' : 'Add'} item</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-ink transition">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Item name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus required
              placeholder="e.g. Tomato sauce" className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
                {['each', 'bottle', 'can', 'case', 'box', 'bag', 'lb', 'gallon', 'quart', 'pint', 'jar', 'container', 'pack', 'sleeve', 'roll', 'flat', 'loaf', 'dozen', 'head', 'bunch', 'wheel', 'tub', 'batch', 'ball'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Unit size (optional)</label>
            <input type="text" value={unitSize} onChange={(e) => setUnitSize(e.target.value)}
              placeholder="e.g. 750ml, 25 lb, 24 ct" className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Par stock</label>
              <input type="number" min="0" step="0.5" value={parStock} onChange={(e) => setParStock(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Current stock</label>
              <input type="number" min="0" step="0.5" value={currentStock} onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Supplier</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Backup supplier</label>
              <select value={backupSupplierId} onChange={(e) => setBackupSupplierId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold">
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Station</label>
            <div className="flex gap-2">
              {([['both', 'Both'], ['bar', 'Bar'], ['kitchen', 'Kitchen']] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setStation(k)}
                  className={cn('flex-1 py-2 rounded text-xs uppercase tracking-widest transition',
                    station === k ? 'bg-ink text-cream' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400'
                  )}>{label}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-ink text-cream py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50">
              {saving ? 'Saving...' : item ? 'Update' : 'Add item'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 border border-neutral-300 rounded text-xs uppercase tracking-widest hover:bg-white transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SupplierModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), contact_name: contactName, phone, email });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-cream border border-neutral-200 rounded-lg w-full max-w-md p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">Add supplier</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-ink transition">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Company name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus required
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Contact person</label>
            <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded text-sm focus:outline-none focus:border-gold" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-ink text-cream py-2.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Add supplier'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 border border-neutral-300 rounded text-xs uppercase tracking-widest hover:bg-white transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
