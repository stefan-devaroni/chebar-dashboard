'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Minus, Plus, AlertTriangle, CheckCheck } from 'lucide-react';
import type { OrderItem, PurchaseOrder } from '@/lib/purchasing';

// Check off one supplier's delivery: tap a row = all of it arrived; −/+ for short quantities.
export function DeliveryChecklist({
  orderId,
  supplierId,
  supplierName,
  items,
  onCancel,
  onConfirmed,
}: {
  orderId: string;
  supplierId: string;
  supplierName: string;
  items: OrderItem[];
  onCancel: () => void;
  onConfirmed: (order: PurchaseOrder) => void;
}) {
  // received qty per item name; undefined = not checked yet
  const [received, setReceived] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkedCount = items.filter((i) => received[i.name] !== undefined).length;
  const shortItems = items.filter((i) => (received[i.name] ?? 0) < i.toBuy);
  const allChecked = checkedCount === items.length;

  function toggle(item: OrderItem) {
    setReceived((prev) => {
      const next = { ...prev };
      if (next[item.name] === undefined) next[item.name] = item.toBuy;
      else delete next[item.name];
      return next;
    });
  }

  function adjust(item: OrderItem, delta: number) {
    setReceived((prev) => ({
      ...prev,
      [item.name]: Math.max(0, Math.min(item.toBuy, (prev[item.name] ?? item.toBuy) + delta)),
    }));
  }

  function checkAll() {
    setReceived(Object.fromEntries(items.map((i) => [i.name, i.toBuy])));
  }

  async function confirm() {
    if (checkedCount === 0 && !window.confirm(`Nothing from ${supplierName} was received?`)) return;
    if (shortItems.length > 0 && checkedCount > 0 &&
        !window.confirm(`${shortItems.length} item${shortItems.length !== 1 ? 's' : ''} missing or short. Confirm delivery anyway?`)) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/orders/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        supplierId,
        received: items.map((i) => ({ name: i.name, qty: received[i.name] ?? 0 })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Could not save. Check your connection and try again.');
      return;
    }
    onConfirmed(data as PurchaseOrder);
  }

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-sm font-medium', allChecked && shortItems.length === 0 ? 'text-green-700' : 'text-blue-700')}>
          {checkedCount} of {items.length} checked
        </span>
        {!allChecked && (
          <button
            onClick={checkAll}
            className="flex items-center gap-1 text-xs uppercase tracking-widest text-blue-700 hover:text-blue-900 transition"
          >
            <CheckCheck size={14} strokeWidth={2} />
            Check all
          </button>
        )}
      </div>
      <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden mb-3">
        <div
          className={cn('h-full rounded-full transition-all', allChecked && shortItems.length === 0 ? 'bg-green-500' : 'bg-blue-500')}
          style={{ width: `${(checkedCount / items.length) * 100}%` }}
        />
      </div>

      {/* Items */}
      <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100 mb-3">
        {items.map((item) => {
          const qty = received[item.name];
          const checked = qty !== undefined;
          const short = checked && qty < item.toBuy;
          return (
            <div
              key={item.name}
              className={cn('flex items-center gap-3 px-3 min-h-[56px] transition', checked && !short && 'bg-green-50/70', short && 'bg-amber-50')}
            >
              <button
                onClick={() => toggle(item)}
                className="flex-1 min-w-0 flex items-center gap-3 py-3 text-left"
                aria-label={checked ? `Uncheck ${item.name}` : `${item.name} received`}
              >
                <span className={cn(
                  'w-7 h-7 rounded-md border-2 flex items-center justify-center shrink-0 transition',
                  checked ? (short ? 'bg-amber-500 border-amber-500' : 'bg-green-500 border-green-500') : 'border-neutral-300 bg-white'
                )}>
                  {checked && <Check size={16} strokeWidth={3} className="text-white" />}
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-sm font-medium truncate', checked && !short && 'text-green-800')}>{item.name}</span>
                  <span className="block text-xs text-neutral-500">
                    Ordered {item.toBuy} {item.unit}{item.unit_size ? ` · ${item.unit_size}` : ''}
                  </span>
                </span>
              </button>

              {checked && (
                <div className="flex items-center shrink-0 border border-neutral-200 rounded-lg overflow-hidden bg-white">
                  <button
                    onClick={() => adjust(item, -1)}
                    aria-label={`Fewer ${item.name}`}
                    className="w-9 h-9 flex items-center justify-center text-neutral-500 active:bg-neutral-100"
                  >
                    <Minus size={16} strokeWidth={2} />
                  </button>
                  <span className={cn('w-12 text-center text-sm font-bold tabular-nums', short ? 'text-amber-700' : 'text-green-700')}>
                    {qty}/{item.toBuy}
                  </span>
                  <button
                    onClick={() => adjust(item, 1)}
                    disabled={qty >= item.toBuy}
                    aria-label={`More ${item.name}`}
                    className="w-9 h-9 flex items-center justify-center text-neutral-500 active:bg-neutral-100 disabled:opacity-30"
                  >
                    <Plus size={16} strokeWidth={2} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary + actions */}
      {checkedCount > 0 && shortItems.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700 mb-3">
          <AlertTriangle size={13} strokeWidth={2} className="shrink-0" />
          {shortItems.length} item{shortItems.length !== 1 ? 's' : ''} missing or short — the owner will be notified.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={confirm}
          disabled={saving}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium uppercase tracking-widest transition disabled:opacity-50',
            allChecked && shortItems.length === 0 ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-ink text-cream hover:bg-neutral-800'
          )}
        >
          <Check size={16} strokeWidth={2} />
          {saving ? 'Saving...' : 'Confirm delivery'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-3 border border-neutral-300 text-neutral-600 rounded-lg text-sm uppercase tracking-widest hover:bg-neutral-50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
