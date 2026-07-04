'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Plus, X, Search, ShoppingCart, Package, ChevronDown, ChevronRight, Truck, Pencil, Trash2, ClipboardList, FileText } from 'lucide-react';

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
  const [showOrderSheet, setShowOrderSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingField, setEditingField] = useState<{ id: string; field: 'par_stock' | 'current_stock' } | null>(null);
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
      result = result.filter((i) => i.par_stock > 0 && i.current_stock < i.par_stock);
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

  const needsOrder = items.filter((i) => i.par_stock > 0 && i.current_stock < i.par_stock);

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  async function updateField(id: string, field: string, value: any) {
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
    setEditingField(null);
  }

  async function updateSupplier(id: string, field: 'supplier_id' | 'backup_supplier_id', value: string) {
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
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
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-neutral-200 rounded p-4">
          <div className="flex items-center gap-2 text-neutral-500 mb-1">
            <Package size={14} strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-widest">Items</span>
          </div>
          <span className="font-display text-2xl">{items.length}</span>
        </div>
        <div className={cn('border rounded p-4', needsOrder.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-neutral-200')}>
          <div className="flex items-center gap-2 text-neutral-500 mb-1">
            <ShoppingCart size={14} strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-widest">To order</span>
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
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
        <div className="flex gap-1 text-xs">
          {([['all', 'All'], ['order', 'To order'], ['low', 'Low']] as const).map(([k, label]) => (
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
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {needsOrder.length > 0 && (
          <button
            onClick={() => setShowOrderSheet(true)}
            className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-red-700 transition"
          >
            <ClipboardList size={14} strokeWidth={2} />
            Generate order ({needsOrder.length} items)
          </button>
        )}
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

      {/* Inventory table grouped by category */}
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
            const catNeedsOrder = catItems.filter((i) => i.par_stock > 0 && i.current_stock < i.par_stock).length;
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
                  {catNeedsOrder > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                      {catNeedsOrder} to order
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
                            <th className="text-left px-4 py-2.5 font-normal">Item</th>
                            <th className="text-center px-2 py-2.5 font-normal w-16">Par</th>
                            <th className="text-center px-2 py-2.5 font-normal w-20">Actual</th>
                            <th className="text-center px-2 py-2.5 font-normal w-16">Buy</th>
                            <th className="text-left px-2 py-2.5 font-normal w-36">Supplier</th>
                            <th className="text-left px-2 py-2.5 font-normal w-36">Backup</th>
                            <th className="px-2 py-2.5 w-14"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {catItems.map((item) => (
                            <DesktopRow
                              key={item.id}
                              item={item}
                              suppliers={suppliers}
                              editingField={editingField}
                              setEditingField={setEditingField}
                              updateField={updateField}
                              updateSupplier={updateSupplier}
                              onEdit={() => { setEditingItem(item); setShowAddItem(true); }}
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
                          editingField={editingField}
                          setEditingField={setEditingField}
                          updateField={updateField}
                          updateSupplier={updateSupplier}
                          onEdit={() => { setEditingItem(item); setShowAddItem(true); }}
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

      {/* Order sheet modal — grouped by supplier */}
      {showOrderSheet && (
        <OrderSheetModal
          items={needsOrder}
          suppliers={suppliers}
          onClose={() => setShowOrderSheet(false)}
        />
      )}
    </div>
  );
}

function DesktopRow({
  item, suppliers, editingField, setEditingField, updateField, updateSupplier, onEdit, onDelete,
}: {
  item: InventoryItem;
  suppliers: Supplier[];
  editingField: { id: string; field: 'par_stock' | 'current_stock' } | null;
  setEditingField: (f: { id: string; field: 'par_stock' | 'current_stock' } | null) => void;
  updateField: (id: string, field: string, value: any) => void;
  updateSupplier: (id: string, field: 'supplier_id' | 'backup_supplier_id', value: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deficit = Math.max(0, item.par_stock - item.current_stock);
  const isLow = item.par_stock > 0 && item.current_stock < item.par_stock;
  const isCritical = item.par_stock > 0 && item.current_stock <= item.par_stock * 0.5;

  return (
    <tr className={cn(
      'border-b border-neutral-50 last:border-b-0 group',
      isCritical && 'bg-red-50/50',
      isLow && !isCritical && 'bg-amber-50/50'
    )}>
      <td className="px-4 py-2">
        <span className="font-medium">{item.name}</span>
        {item.unit_size && <span className="text-xs text-neutral-500 ml-1.5">({item.unit_size})</span>}
        <span className="text-xs text-neutral-400 ml-1.5">/ {item.unit}</span>
      </td>
      <td className="px-2 py-2 text-center">
        {editingField?.id === item.id && editingField.field === 'par_stock' ? (
          <input type="number" min="0" step="0.5" defaultValue={item.par_stock} autoFocus
            onBlur={(e) => updateField(item.id, 'par_stock', parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => { if (e.key === 'Enter') updateField(item.id, 'par_stock', parseFloat(e.currentTarget.value) || 0); if (e.key === 'Escape') setEditingField(null); }}
            className="w-16 text-center bg-cream border border-gold rounded px-1 py-0.5 text-sm focus:outline-none" />
        ) : (
          <button onClick={() => setEditingField({ id: item.id, field: 'par_stock' })}
            className="text-neutral-600 hover:bg-neutral-100 px-2 py-0.5 rounded transition">{item.par_stock}</button>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        {editingField?.id === item.id && editingField.field === 'current_stock' ? (
          <input type="number" min="0" step="0.5" defaultValue={item.current_stock} autoFocus
            onBlur={(e) => updateField(item.id, 'current_stock', parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => { if (e.key === 'Enter') updateField(item.id, 'current_stock', parseFloat(e.currentTarget.value) || 0); if (e.key === 'Escape') setEditingField(null); }}
            className="w-16 text-center bg-cream border border-gold rounded px-1 py-0.5 text-sm focus:outline-none" />
        ) : (
          <button onClick={() => setEditingField({ id: item.id, field: 'current_stock' })}
            className={cn('font-medium px-2 py-0.5 rounded transition',
              isCritical ? 'text-red-700 bg-red-100' : isLow ? 'text-amber-700 bg-amber-100' : 'text-neutral-700 hover:bg-neutral-100'
            )}>{item.current_stock}</button>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        {deficit > 0 ? <span className="text-red-700 font-bold">{deficit}</span> : <span className="text-green-600 text-xs">OK</span>}
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
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={onEdit} className="p-1 text-neutral-400 hover:text-ink transition" title="Edit details">
            <Pencil size={12} strokeWidth={1.5} />
          </button>
          <button onClick={onDelete} className="p-1 text-neutral-400 hover:text-red-600 transition" title="Delete">
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function MobileCard({
  item, suppliers, editingField, setEditingField, updateField, updateSupplier, onEdit, onDelete,
}: {
  item: InventoryItem;
  suppliers: Supplier[];
  editingField: { id: string; field: 'par_stock' | 'current_stock' } | null;
  setEditingField: (f: { id: string; field: 'par_stock' | 'current_stock' } | null) => void;
  updateField: (id: string, field: string, value: any) => void;
  updateSupplier: (id: string, field: 'supplier_id' | 'backup_supplier_id', value: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deficit = Math.max(0, item.par_stock - item.current_stock);
  const isLow = item.par_stock > 0 && item.current_stock < item.par_stock;
  const isCritical = item.par_stock > 0 && item.current_stock <= item.par_stock * 0.5;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      'bg-white border rounded px-2.5 py-2.5',
      isCritical ? 'border-red-200 bg-red-50/30' :
      isLow ? 'border-amber-200 bg-amber-50/30' :
      'border-neutral-200'
    )}>
      {/* Top row: name + numbers */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button onClick={() => setExpanded(!expanded)} className="text-left w-full">
            <span className="font-medium text-sm block truncate">{item.name}</span>
            <span className="text-xs text-neutral-400">{item.unit}{item.unit_size ? ` (${item.unit_size})` : ''}</span>
          </button>
        </div>

        {/* Par / Actual / Buy compact row */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Par */}
          <div className="text-center w-10">
            <div className="text-[9px] uppercase tracking-wider text-neutral-400">Par</div>
            {editingField?.id === item.id && editingField.field === 'par_stock' ? (
              <input type="number" min="0" step="0.5" defaultValue={item.par_stock} autoFocus
                onBlur={(e) => updateField(item.id, 'par_stock', parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') updateField(item.id, 'par_stock', parseFloat(e.currentTarget.value) || 0); if (e.key === 'Escape') setEditingField(null); }}
                className="w-10 text-center bg-cream border border-gold rounded px-0.5 py-0.5 text-sm focus:outline-none" />
            ) : (
              <button onClick={() => setEditingField({ id: item.id, field: 'par_stock' })}
                className="text-sm text-neutral-600 px-1 py-0.5 rounded hover:bg-neutral-100">{item.par_stock}</button>
            )}
          </div>

          {/* Actual */}
          <div className="text-center w-12">
            <div className="text-[9px] uppercase tracking-wider text-neutral-400">Have</div>
            {editingField?.id === item.id && editingField.field === 'current_stock' ? (
              <input type="number" min="0" step="0.5" defaultValue={item.current_stock} autoFocus
                onBlur={(e) => updateField(item.id, 'current_stock', parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') updateField(item.id, 'current_stock', parseFloat(e.currentTarget.value) || 0); if (e.key === 'Escape') setEditingField(null); }}
                className="w-12 text-center bg-cream border border-gold rounded px-0.5 py-0.5 text-sm font-medium focus:outline-none" />
            ) : (
              <button onClick={() => setEditingField({ id: item.id, field: 'current_stock' })}
                className={cn('text-sm font-bold px-1.5 py-0.5 rounded transition',
                  isCritical ? 'text-red-700 bg-red-100' : isLow ? 'text-amber-700 bg-amber-100' : 'text-neutral-700 bg-neutral-100'
                )}>{item.current_stock}</button>
            )}
          </div>

          {/* Buy */}
          <div className="text-center w-10">
            <div className="text-[9px] uppercase tracking-wider text-neutral-400">Buy</div>
            {deficit > 0 ? (
              <span className="text-sm font-bold text-red-700">{deficit}</span>
            ) : (
              <span className="text-[10px] text-green-600">OK</span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded section: supplier + actions */}
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
            <button onClick={onEdit} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-ink transition">
              <Pencil size={11} strokeWidth={1.5} /> Edit
            </button>
            <button onClick={onDelete} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-red-600 transition">
              <Trash2 size={11} strokeWidth={1.5} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Supplier hint when collapsed */}
      {!expanded && item.supplier && (
        <div className="mt-1 text-[10px] text-neutral-400 truncate">{item.supplier.name}</div>
      )}
    </div>
  );
}

function OrderSheetModal({
  items,
  suppliers,
  onClose,
}: {
  items: InventoryItem[];
  suppliers: Supplier[];
  onClose: () => void;
}) {
  const supplierMap = useMemo(() => {
    const map: Record<string, { supplierName: string; items: (InventoryItem & { toBuy: number })[] }> = {};

    for (const item of items) {
      const deficit = Math.max(0, item.par_stock - item.current_stock);
      if (deficit <= 0) continue;

      const supplierId = item.supplier_id ?? '__none__';

      if (!map[supplierId]) {
        map[supplierId] = {
          supplierName: item.supplier?.name ?? 'No supplier assigned',
          items: [],
        };
      }
      map[supplierId].items.push({ ...item, toBuy: deficit });
    }

    const sorted = Object.entries(map).sort(([a], [b]) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return map[a].supplierName.localeCompare(map[b].supplierName);
    });

    return sorted;
  }, [items]);

  function copySupplierList(supplierItems: (InventoryItem & { toBuy: number })[], supplierName: string): void {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    let text = `Order for ${supplierName} — ${today}\n`;
    text += '─'.repeat(40) + '\n';
    for (const item of supplierItems) {
      text += `${item.toBuy} ${item.unit}  ${item.name}`;
      if (item.unit_size) text += ` (${item.unit_size})`;
      text += '\n';
    }
    navigator.clipboard.writeText(text);
  }

  function copyFullOrder() {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    let text = `Che Bar — Purchase Order — ${today}\n`;
    text += '═'.repeat(40) + '\n\n';

    for (const [, { supplierName, items: sItems }] of supplierMap) {
      text += `▸ ${supplierName}\n`;
      text += '─'.repeat(40) + '\n';
      for (const item of sItems) {
        text += `  ${item.toBuy} ${item.unit}  ${item.name}`;
        if (item.unit_size) text += ` (${item.unit_size})`;
        text += '\n';
      }
      text += '\n';
    }

    navigator.clipboard.writeText(text);
  }

  const totalItems = items.filter((i) => i.par_stock - i.current_stock > 0).length;

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-cream border border-neutral-200 rounded-lg w-full max-w-2xl shadow-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="font-display text-xl">Purchase Order</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {totalItems} items to order from {supplierMap.length} supplier{supplierMap.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyFullOrder}
              className="flex items-center gap-1.5 bg-ink text-cream px-3 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition"
            >
              <FileText size={12} strokeWidth={2} />
              Copy all
            </button>
            <button onClick={onClose} className="text-neutral-400 hover:text-ink transition p-1">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-6">
          {supplierMap.map(([supplierId, { supplierName, items: sItems }]) => (
            <div key={supplierId}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-neutral-400" />
                  <h3 className="font-medium text-sm">
                    {supplierName}
                  </h3>
                  <span className="text-xs text-neutral-400">({sItems.length} items)</span>
                </div>
                <button
                  onClick={() => copySupplierList(sItems, supplierName)}
                  className="text-xs text-gold hover:text-gold/80 uppercase tracking-widest transition"
                >
                  Copy list
                </button>
              </div>
              <div className="bg-white border border-neutral-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-xs uppercase tracking-widest text-neutral-400">
                      <th className="text-left px-4 py-2 font-normal">Item</th>
                      <th className="text-center px-3 py-2 font-normal w-16">Buy</th>
                      <th className="text-left px-3 py-2 font-normal w-16">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sItems.map((item) => (
                      <tr key={item.id} className="border-b border-neutral-50 last:border-b-0">
                        <td className="px-4 py-2">
                          {item.name}
                          {item.unit_size && (
                            <span className="text-xs text-neutral-500 ml-1.5">({item.unit_size})</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-red-700">{item.toBuy}</td>
                        <td className="px-3 py-2 text-neutral-500">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
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
