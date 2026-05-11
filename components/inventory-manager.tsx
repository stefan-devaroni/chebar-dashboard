'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Plus, X, Search, ShoppingCart, Package, ChevronDown, ChevronUp, Truck, Pencil, Trash2 } from 'lucide-react';

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

type ViewMode = 'all' | 'order' | 'low';

export function InventoryManager({
  initialItems,
  initialSuppliers,
}: {
  initialItems: InventoryItem[];
  initialSuppliers: Supplier[];
}) {
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingStock, setEditingStock] = useState<string | null>(null);
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
    if (viewMode === 'order') {
      result = result.filter((i) => i.current_stock < i.par_stock);
    }
    if (viewMode === 'low') {
      result = result.filter((i) => i.par_stock > 0 && i.current_stock <= i.par_stock * 0.5);
    }
    return result;
  }, [items, search, categoryFilter, viewMode]);

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

  const needsOrder = items.filter((i) => i.current_stock < i.par_stock);

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  async function updateStock(id: string, currentStock: number) {
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, current_stock: currentStock }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
    setEditingStock(null);
  }

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

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-neutral-200 rounded p-4">
          <div className="flex items-center gap-2 text-neutral-500 mb-1">
            <Package size={14} strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-widest">Total items</span>
          </div>
          <span className="font-display text-2xl">{items.length}</span>
        </div>
        <div className={cn('border rounded p-4', needsOrder.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-neutral-200')}>
          <div className="flex items-center gap-2 text-neutral-500 mb-1">
            <ShoppingCart size={14} strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-widest">Needs ordering</span>
          </div>
          <span className="font-display text-2xl">{needsOrder.length}</span>
        </div>
        <div className="bg-white border border-neutral-200 rounded p-4">
          <div className="flex items-center gap-2 text-neutral-500 mb-1">
            <Truck size={14} strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-widest">Suppliers</span>
          </div>
          <span className="font-display text-2xl">{suppliers.length}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
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
        <div className="flex gap-1 text-xs">
          {([['all', 'All'], ['order', 'Needs order'], ['low', 'Low stock']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setViewMode(k)}
              className={cn(
                'px-3 py-1.5 uppercase tracking-widest rounded transition',
                viewMode === k ? 'bg-ink text-cream' : 'text-neutral-600 hover:bg-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddSupplier(true)}
          className="flex items-center gap-1.5 border border-neutral-300 text-neutral-700 px-3 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-white transition"
        >
          <Truck size={12} strokeWidth={2} />
          Supplier
        </button>
        <button
          onClick={() => { setEditingItem(null); setShowAddItem(true); }}
          className="flex items-center gap-1.5 bg-gold text-ink px-4 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-gold/80 transition"
        >
          <Plus size={14} strokeWidth={2} />
          Add item
        </button>
      </div>

      {/* Inventory table grouped by category */}
      {grouped.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded p-10 text-center">
          <p className="text-sm text-neutral-500">
            {items.length === 0
              ? 'No inventory items yet. Run the seed SQL or add items above.'
              : 'No items match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, catItems]) => {
            const collapsed = collapsedCategories.has(category);
            return (
              <section key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 mb-2 w-full text-left"
                >
                  {collapsed
                    ? <ChevronDown size={14} className="text-neutral-400" />
                    : <ChevronUp size={14} className="text-neutral-400" />}
                  <h3 className="text-xs uppercase tracking-widest text-neutral-500">
                    {CATEGORIES[category] ?? category}
                  </h3>
                  <span className="text-xs text-neutral-400">({catItems.length})</span>
                </button>

                {!collapsed && (
                  <div className="bg-white border border-neutral-200 rounded overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100 text-xs uppercase tracking-widest text-neutral-500">
                          <th className="text-left px-4 py-2.5 font-normal">Item</th>
                          <th className="text-left px-3 py-2.5 font-normal w-20">Unit</th>
                          <th className="text-center px-3 py-2.5 font-normal w-16">Par</th>
                          <th className="text-center px-3 py-2.5 font-normal w-20">Current</th>
                          <th className="text-center px-3 py-2.5 font-normal w-16">Order</th>
                          <th className="text-left px-3 py-2.5 font-normal w-32">Supplier</th>
                          <th className="px-3 py-2.5 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {catItems.map((item) => {
                          const deficit = Math.max(0, item.par_stock - item.current_stock);
                          const isLow = item.par_stock > 0 && item.current_stock < item.par_stock;
                          const isCritical = item.par_stock > 0 && item.current_stock <= item.par_stock * 0.5;

                          return (
                            <tr
                              key={item.id}
                              className={cn(
                                'border-b border-neutral-50 last:border-b-0 group',
                                isCritical && 'bg-red-50/50',
                                isLow && !isCritical && 'bg-amber-50/50'
                              )}
                            >
                              <td className="px-4 py-2.5">
                                <span className="font-medium">{item.name}</span>
                                {item.unit_size && (
                                  <span className="text-xs text-neutral-500 ml-1.5">({item.unit_size})</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-neutral-600">{item.unit}</td>
                              <td className="px-3 py-2.5 text-center text-neutral-600">{item.par_stock}</td>
                              <td className="px-3 py-2.5 text-center">
                                {editingStock === item.id ? (
                                  <input
                                    type="number"
                                    min="0"
                                    defaultValue={item.current_stock}
                                    autoFocus
                                    onBlur={(e) => updateStock(item.id, parseFloat(e.target.value) || 0)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') updateStock(item.id, parseFloat(e.currentTarget.value) || 0);
                                      if (e.key === 'Escape') setEditingStock(null);
                                    }}
                                    className="w-16 text-center bg-cream border border-neutral-200 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:border-gold"
                                  />
                                ) : (
                                  <button
                                    onClick={() => setEditingStock(item.id)}
                                    className={cn(
                                      'font-medium px-2 py-0.5 rounded transition',
                                      isCritical ? 'text-red-700 bg-red-100' :
                                      isLow ? 'text-amber-700 bg-amber-100' :
                                      'text-neutral-700 hover:bg-neutral-100'
                                    )}
                                  >
                                    {item.current_stock}
                                  </button>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {deficit > 0 ? (
                                  <span className="text-red-700 font-medium">{deficit}</span>
                                ) : (
                                  <span className="text-green-600">--</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-neutral-500 truncate max-w-[120px]">
                                {item.supplier?.name ?? '--'}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                  <button
                                    onClick={() => { setEditingItem(item); setShowAddItem(true); }}
                                    className="p-1 text-neutral-400 hover:text-ink transition"
                                  >
                                    <Pencil size={12} strokeWidth={1.5} />
                                  </button>
                                  <button
                                    onClick={() => deleteItem(item.id)}
                                    className="p-1 text-neutral-400 hover:text-red-600 transition"
                                  >
                                    <Trash2 size={12} strokeWidth={1.5} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

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
                {['each', 'bottle', 'can', 'case', 'box', 'bag', 'lb', 'gallon', 'quart', 'pint', 'jar', 'container', 'pack', 'sleeve', 'roll', 'flat', 'loaf', 'dozen', 'head', 'bunch', 'wheel', 'tub', 'batch'].map((u) => (
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
