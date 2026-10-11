'use client';

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Plus, Minus, X, Search, Pencil, ArrowRight, Table2 } from 'lucide-react';
import { unitOptions } from '@/lib/units';

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

const STATIONS = [['bar', 'Bar'], ['kitchen', 'Kitchen'], ['all', 'All']] as const;

const DRAFT_KEY = 'chebar.purchasing.draft';

// 16px inputs: smaller text makes iPhones zoom in when the field is tapped
const inputClass = 'w-full px-3 py-3 bg-white border border-neutral-200 rounded-xl text-base focus:outline-none focus:border-gold';
const labelClass = 'block text-xs uppercase tracking-wider text-neutral-500 mb-1.5';

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
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [buyQtys, setBuyQtys] = useState<Record<string, number>>({});
  const [restored, setRestored] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [itemModal, setItemModal] = useState<{ item: InventoryItem | null } | null>(null);
  const [supplierModal, setSupplierModal] = useState<{ supplier: Supplier | null } | null>(null);
  const [sending, setSending] = useState(false);

  // Keep in-progress counts and the chosen station on this device, so leaving the
  // page halfway through the list doesn't lose them
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
      if (saved?.buyQtys) {
        // Drop counts for items that no longer exist
        const known = new Set(initialItems.map((i) => i.id));
        setBuyQtys(Object.fromEntries(Object.entries(saved.buyQtys as Record<string, number>).filter(([id]) => known.has(id))));
      }
      if (saved?.station) setStationFilter(saved.station);
    } catch {}
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ buyQtys, station: stationFilter }));
    } catch {}
  }, [restored, buyQtys, stationFilter]);

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (stationFilter !== 'all') {
      result = result.filter((i) => i.station === stationFilter || i.station === 'both');
    }
    return result;
  }, [items, search, stationFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, InventoryItem[]> = {};
    for (const item of filtered) (map[item.category] ??= []).push(item);
    const order = Object.keys(CATEGORIES);
    return Object.entries(map).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  }, [filtered]);

  const selectedCount = Object.values(buyQtys).filter((v) => v > 0).length;

  const changeQty = useCallback((id: string, delta: number) => {
    setBuyQtys((prev) => {
      const next = { ...prev };
      const qty = Math.max(0, (prev[id] ?? 0) + delta);
      if (qty === 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }, []);

  const openEdit = useCallback((item: InventoryItem) => setItemModal({ item }), []);

  async function sendToOrder() {
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
    setSending(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: orderItems }),
    });
    if (res.ok) {
      setBuyQtys({});
      router.push('/dashboard/orders');
    } else {
      setSending(false);
      alert('Could not add to the order. Check your connection and try again.');
    }
  }

  function clearAll() {
    if (confirm('Clear all quantities you entered?')) setBuyQtys({});
  }

  async function saveItem(data: Partial<InventoryItem>) {
    const existing = itemModal?.item;
    const res = await fetch('/api/inventory', {
      method: existing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existing ? { id: existing.id, ...data } : data),
    });
    if (!res.ok) {
      alert('Could not save the item. Please try again.');
      return;
    }
    const saved = await res.json();
    setItems((prev) => (existing ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]));
    setItemModal(null);
  }

  async function deleteItem(item: InventoryItem) {
    if (!confirm(`Remove "${item.name}" from the list?`)) return;
    const res = await fetch('/api/inventory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    });
    if (!res.ok) {
      alert('Could not remove the item. Please try again.');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    changeQty(item.id, -Infinity);
    setItemModal(null);
  }

  async function saveSupplier(data: Omit<Supplier, 'id'>) {
    const existing = supplierModal?.supplier;
    const res = await fetch('/api/suppliers', {
      method: existing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existing ? { id: existing.id, ...data } : data),
    });
    if (!res.ok) {
      alert('Could not save the supplier. Please try again.');
      return;
    }
    const saved = await res.json();
    setSuppliers((prev) =>
      (existing ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved]).sort((a, b) => a.name.localeCompare(b.name))
    );
    // Item rows show the supplier name
    if (existing) {
      setItems((prev) => prev.map((i) => (i.supplier_id === saved.id ? { ...i, supplier: { id: saved.id, name: saved.name } } : i)));
    }
    setSupplierModal(null);
  }

  return (
    <div>
      {/* Station */}
      <div className="grid grid-cols-3 bg-neutral-200/60 rounded-xl p-1 mb-3">
        {STATIONS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setStationFilter(k)}
            className={cn(
              'py-2.5 rounded-lg text-sm font-medium transition',
              stationFilter === k ? 'bg-white text-ink shadow-sm' : 'text-neutral-500'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search + edit toggle */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className={cn(inputClass, 'pl-11')}
          />
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={cn(
            'flex items-center gap-1.5 px-4 rounded-xl text-sm font-medium transition shrink-0',
            editMode ? 'bg-ink text-cream' : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-400'
          )}
        >
          {editMode ? 'Done' : <><Pencil size={15} strokeWidth={1.75} />Edit list</>}
        </button>
      </div>

      {editMode && (
        <p className="text-sm text-neutral-600 px-1 mb-3">
          Tap an item to change its supplier, backup supplier or how it's delivered.
        </p>
      )}

      {editMode && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setItemModal({ item: null })}
            className="flex items-center justify-center gap-1.5 bg-gold text-ink py-3 rounded-xl text-sm font-medium"
          >
            <Plus size={16} strokeWidth={2} />
            New item
          </button>
          <button
            onClick={() => setSupplierModal({ supplier: null })}
            className="flex items-center justify-center gap-1.5 border border-neutral-300 text-neutral-700 py-3 rounded-xl text-sm font-medium bg-white"
          >
            <Plus size={16} strokeWidth={2} />
            New supplier
          </button>
        </div>
      )}

      {editMode && (
        <Link
          href="/dashboard/purchasing/bulk-edit"
          className="flex items-center gap-2 px-1 mb-5 text-sm text-neutral-600 hover:text-ink"
        >
          <Table2 size={16} strokeWidth={1.75} />
          <span className="underline underline-offset-4">Edit everything in one table</span>
          <span className="text-neutral-400">— easiest on a computer</span>
        </Link>
      )}

      {/* Items by category */}
      {grouped.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center text-sm text-neutral-500">
          {items.length === 0 ? 'No items yet. Tap "Edit list" to add some.' : 'Nothing matches your search.'}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, catItems]) => {
            const picked = catItems.filter((i) => (buyQtys[i.id] ?? 0) > 0).length;
            return (
              <section key={category}>
                <div className="flex items-baseline justify-between px-1 mb-2">
                  <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-medium">
                    {CATEGORIES[category] ?? category}
                  </h2>
                  {picked > 0 && !editMode && <span className="text-xs font-medium text-ink">{picked} selected</span>}
                </div>
                <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
                  {catItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      qty={buyQtys[item.id] ?? 0}
                      editMode={editMode}
                      onChange={changeQty}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editMode && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-medium px-1 mb-2">Suppliers</h2>
          <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
            {suppliers.map((s) => (
              <button
                key={s.id}
                onClick={() => setSupplierModal({ supplier: s })}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[60px] text-left active:bg-neutral-50"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium">{s.name}</span>
                  <span className="block text-xs text-neutral-500 truncate">
                    {[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact info yet'}
                  </span>
                </span>
                <Pencil size={16} className="text-neutral-400 shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {editMode && (
        <div className="mt-8 flex justify-center">
          <button onClick={() => setEditMode(false)} className="px-6 py-3 rounded-xl text-sm font-medium bg-ink text-cream">
            Done editing
          </button>
        </div>
      )}

      {/* Always-visible send bar (sits above the phone tab bar) */}
      {!editMode && selectedCount > 0 && (
        <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] lg:bottom-6 mt-6 z-30">
          <div className="flex items-center gap-1 bg-ink rounded-2xl shadow-xl p-2">
            <button onClick={clearAll} className="px-3 py-3 text-sm text-neutral-400 hover:text-cream">
              Clear
            </button>
            <button
              onClick={sendToOrder}
              disabled={sending}
              className="flex-1 flex items-center justify-center gap-2 bg-gold text-ink rounded-xl py-3.5 text-base font-semibold disabled:opacity-60"
            >
              {sending ? 'Adding…' : `Add ${selectedCount} item${selectedCount !== 1 ? 's' : ''} to order`}
              {!sending && <ArrowRight size={18} strokeWidth={2} />}
            </button>
          </div>
        </div>
      )}

      {itemModal && (
        <ItemModal
          item={itemModal.item}
          suppliers={suppliers}
          onClose={() => setItemModal(null)}
          onSave={saveItem}
          onDelete={deleteItem}
        />
      )}

      {supplierModal && (
        <SupplierModal
          supplier={supplierModal.supplier}
          onClose={() => setSupplierModal(null)}
          onSave={saveSupplier}
        />
      )}
    </div>
  );
}

const ItemRow = memo(function ItemRow({
  item, qty, editMode, onChange, onEdit,
}: {
  item: InventoryItem;
  qty: number;
  editMode: boolean;
  onChange: (id: string, delta: number) => void;
  onEdit: (item: InventoryItem) => void;
}) {
  const picked = qty > 0;
  const meta = [item.unit_size ? `${item.unit} · ${item.unit_size}` : item.unit, item.supplier?.name].filter(Boolean).join(' · ');

  if (editMode) {
    return (
      <button
        onClick={() => onEdit(item)}
        className="w-full flex items-center gap-3 pl-4 pr-4 py-2 min-h-[60px] text-left hover:bg-neutral-50 active:bg-neutral-50 transition"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-medium leading-snug">{item.name}</span>
          <span className={cn('block text-xs truncate', item.supplier ? 'text-neutral-500' : 'text-red-600')}>
            {item.supplier ? meta : `${item.unit} · No supplier yet`}
          </span>
        </span>
        <Pencil size={16} strokeWidth={1.75} className="text-neutral-400 shrink-0" />
      </button>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 pl-4 pr-3 py-2 min-h-[60px] transition', picked && 'bg-gold/10')}>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[15px] leading-snug', picked ? 'font-semibold' : 'font-medium')}>{item.name}</p>
        <p className="text-xs text-neutral-500 truncate">{meta}</p>
      </div>
      {picked ? (
        <div className="flex items-center shrink-0">
          <button
            onClick={() => onChange(item.id, -1)}
            aria-label={`Less ${item.name}`}
            className="w-11 h-11 rounded-full border border-neutral-300 bg-white flex items-center justify-center active:bg-neutral-100"
          >
            <Minus size={18} strokeWidth={2} />
          </button>
          <span className="w-10 text-center text-lg font-bold tabular-nums">{qty}</span>
          <button
            onClick={() => onChange(item.id, 1)}
            aria-label={`More ${item.name}`}
            className="w-11 h-11 rounded-full bg-ink text-cream flex items-center justify-center active:opacity-80"
          >
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => onChange(item.id, 1)}
          aria-label={`Add ${item.name}`}
          className="w-11 h-11 rounded-full border-2 border-neutral-300 text-neutral-500 flex items-center justify-center active:bg-neutral-100 shrink-0"
        >
          <Plus size={20} strokeWidth={2} />
        </button>
      )}
    </div>
  );
});

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50 sm:px-4" onClick={onClose}>
      <div
        className="bg-cream w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 flex items-center justify-center text-neutral-400 hover:text-ink">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ItemModal({
  item,
  suppliers,
  onClose,
  onSave,
  onDelete,
}: {
  item: InventoryItem | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (data: Partial<InventoryItem>) => Promise<void>;
  onDelete: (item: InventoryItem) => Promise<void>;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? 'other');
  const [unit, setUnit] = useState(item?.unit ?? 'each');
  const [unitSize, setUnitSize] = useState(item?.unit_size ?? '');
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
      supplier_id: supplierId || null,
      backup_supplier_id: backupSupplierId || null,
      station,
    });
    setSaving(false);
  }

  return (
    <Sheet title={item ? 'Edit item' : 'New item'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Mozzarella" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Used by</label>
          <div className="grid grid-cols-3 gap-2">
            {([['bar', 'Bar'], ['kitchen', 'Kitchen'], ['both', 'Both']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setStation(k)}
                className={cn('py-3 rounded-xl text-sm font-medium transition', station === k ? 'bg-ink text-cream' : 'bg-white border border-neutral-200 text-neutral-600')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Type</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Delivered as</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass}>
              {unitOptions(item?.unit).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Size (optional)</label>
            <input type="text" value={unitSize} onChange={(e) => setUnitSize(e.target.value)} placeholder="e.g. 5 lb" className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>Backup supplier (optional)</label>
          <select value={backupSupplierId} onChange={(e) => setBackupSupplierId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : item ? 'Save' : 'Add item'}
        </button>
        {item && (
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="w-full py-3 text-sm text-red-600"
          >
            Remove from list
          </button>
        )}
      </form>
    </Sheet>
  );
}

function SupplierModal({
  supplier,
  onClose,
  onSave,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (data: Omit<Supplier, 'id'>) => Promise<void>;
}) {
  const [name, setName] = useState(supplier?.name ?? '');
  const [contactName, setContactName] = useState(supplier?.contact_name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      contact_name: contactName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: supplier?.notes ?? null,
    });
    setSaving(false);
  }

  return (
    <Sheet title={supplier ? 'Edit supplier' : 'New supplier'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Company name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Contact person</label>
          <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 583 1234" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full bg-ink text-cream py-3.5 rounded-xl text-base font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : supplier ? 'Save' : 'Add supplier'}
        </button>
      </form>
    </Sheet>
  );
}
