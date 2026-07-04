'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Truck, FileText, Check, Clock, Package, ChevronDown, ChevronRight, ClipboardCheck, AlertTriangle } from 'lucide-react';

interface OrderItem {
  name: string;
  unit: string;
  unit_size: string | null;
  toBuy: number;
  supplier_name: string;
  supplier_id: string | null;
}

interface PurchaseOrder {
  id: string;
  created_at: string;
  status: 'draft' | 'sent' | 'received';
  notes: string | null;
  items: OrderItem[];
  supplier_statuses: Record<string, string> | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800',
  sent: 'bg-blue-100 text-blue-800',
  received: 'bg-green-100 text-green-800',
};

export function OrdersView({
  initialOrders,
  suppliers,
}: {
  initialOrders: PurchaseOrder[];
  suppliers: { id: string; name: string }[];
}) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(
    initialOrders.length > 0 ? initialOrders[0].id : null
  );
  // Track which supplier sections are in "checking delivery" mode
  // Key: "orderId:supplierId", value: Set of checked item indices
  const [checking, setChecking] = useState<Record<string, Set<number>>>({});

  const checkKey = (orderId: string, supplierId: string) => `${orderId}:${supplierId}`;

  const startChecking = useCallback((orderId: string, supplierId: string, itemCount: number) => {
    setChecking((prev) => ({ ...prev, [checkKey(orderId, supplierId)]: new Set() }));
  }, []);

  const toggleCheck = useCallback((orderId: string, supplierId: string, idx: number) => {
    setChecking((prev) => {
      const key = checkKey(orderId, supplierId);
      const current = new Set(prev[key] ?? []);
      if (current.has(idx)) current.delete(idx); else current.add(idx);
      return { ...prev, [key]: current };
    });
  }, []);

  const stopChecking = useCallback((orderId: string, supplierId: string) => {
    setChecking((prev) => {
      const next = { ...prev };
      delete next[checkKey(orderId, supplierId)];
      return next;
    });
  }, []);

  function getSupplierStatus(order: PurchaseOrder, supplierId: string): string {
    return order.supplier_statuses?.[supplierId] ?? order.status ?? 'draft';
  }

  async function updateSupplierStatus(orderId: string, supplierId: string, status: string) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const statuses = { ...(o.supplier_statuses ?? {}) };
        statuses[supplierId] = status;
        // Ensure all suppliers in the order have a status entry
        for (const item of o.items) {
          const sid = item.supplier_id ?? '__none__';
          if (!statuses[sid]) statuses[sid] = 'draft';
        }
        const allStatuses = Object.values(statuses);
        let overall: 'draft' | 'sent' | 'received' = 'draft';
        if (allStatuses.every((s) => s === 'received')) overall = 'received';
        else if (allStatuses.every((s) => s === 'sent' || s === 'received')) overall = 'sent';
        return { ...o, supplier_statuses: statuses, status: overall };
      })
    );

    const res = await fetch('/api/orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, supplier_id: supplierId, supplier_status: status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    }
  }

  function groupBySupplier(items: OrderItem[]) {
    const map: Record<string, { supplierName: string; items: OrderItem[] }> = {};
    for (const item of items) {
      const key = item.supplier_id ?? '__none__';
      if (!map[key]) {
        map[key] = { supplierName: item.supplier_name || 'No supplier assigned', items: [] };
      }
      map[key].items.push(item);
    }
    return Object.entries(map).sort(([a], [b]) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return map[a].supplierName.localeCompare(map[b].supplierName);
    });
  }

  function copyOrder(order: PurchaseOrder) {
    const date = new Date(order.created_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    const grouped = groupBySupplier(order.items);
    let text = `Che Bar — Purchase Order — ${date}\n`;
    text += '═'.repeat(40) + '\n\n';
    for (const [, { supplierName, items }] of grouped) {
      text += `▸ ${supplierName}\n`;
      text += '─'.repeat(40) + '\n';
      for (const item of items) {
        text += `  ${item.toBuy} ${item.unit}  ${item.name}`;
        if (item.unit_size) text += ` (${item.unit_size})`;
        text += '\n';
      }
      text += '\n';
    }
    navigator.clipboard.writeText(text);
  }

  function copySupplierSection(supplierName: string, items: OrderItem[], orderDate: string) {
    const date = new Date(orderDate).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    let text = `Order for ${supplierName} — ${date}\n`;
    text += '─'.repeat(40) + '\n';
    for (const item of items) {
      text += `${item.toBuy} ${item.unit}  ${item.name}`;
      if (item.unit_size) text += ` (${item.unit_size})`;
      text += '\n';
    }
    navigator.clipboard.writeText(text);
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded p-10 text-center">
        <Package size={32} className="mx-auto text-neutral-300 mb-3" />
        <p className="text-sm text-neutral-500">No orders yet.</p>
        <p className="text-xs text-neutral-400 mt-1">
          Go to Purchasing and click &ldquo;Generate Order&rdquo; to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const isExpanded = expandedOrder === order.id;
        const grouped = groupBySupplier(order.items);
        const date = new Date(order.created_at);
        const totalItems = order.items.length;
        const supplierCount = grouped.length;

        // Derive display status from supplier statuses
        const supplierStatusValues = grouped.map(([sid]) => getSupplierStatus(order, sid));
        let displayStatus = 'draft';
        if (supplierStatusValues.every((s) => s === 'received')) displayStatus = 'received';
        else if (supplierStatusValues.every((s) => s === 'sent' || s === 'received')) displayStatus = 'sent';
        else if (supplierStatusValues.some((s) => s === 'sent' || s === 'received')) displayStatus = 'partial';

        const statusLabel = displayStatus === 'partial' ? 'In progress' : displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);
        const statusColor = displayStatus === 'partial' ? 'bg-blue-50 text-blue-700' : STATUS_COLORS[displayStatus] ?? STATUS_COLORS.draft;

        return (
          <div key={order.id} className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            {/* Order header */}
            <button
              onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              className="w-full flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 text-left hover:bg-neutral-50 transition"
            >
              {isExpanded
                ? <ChevronDown size={16} className="text-neutral-400 shrink-0" />
                : <ChevronRight size={16} className="text-neutral-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium', statusColor)}>
                    {statusLabel}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {totalItems} items from {supplierCount} supplier{supplierCount !== 1 ? 's' : ''}
                </p>
              </div>
            </button>

            {/* Expanded order body */}
            {isExpanded && (
              <div className="border-t border-neutral-100 px-4 py-4 sm:px-5 space-y-5">
                {/* Copy all button */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => copyOrder(order)}
                    className="flex items-center gap-1.5 bg-ink text-cream px-3 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-800 transition"
                  >
                    <FileText size={12} strokeWidth={2} />
                    Copy all
                  </button>
                </div>

                {/* Supplier groups */}
                {grouped.map(([supplierId, { supplierName, items }]) => {
                  const sStatus = getSupplierStatus(order, supplierId);
                  const ck = checkKey(order.id, supplierId);
                  const checkedSet = checking[ck];
                  const isChecking = checkedSet !== undefined;
                  const checkedCount = checkedSet?.size ?? 0;
                  const allChecked = isChecking && checkedCount === items.length;
                  const missingCount = isChecking ? items.length - checkedCount : 0;

                  return (
                    <div key={supplierId} className={cn(
                      'rounded-lg border p-3 sm:p-4',
                      sStatus === 'received' ? 'bg-green-50/50 border-green-200' :
                      sStatus === 'sent' ? 'bg-blue-50/50 border-blue-200' :
                      'bg-cream border-neutral-200'
                    )}>
                      {/* Supplier header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Truck size={14} className="text-neutral-400 shrink-0" />
                          <h3 className="font-medium text-sm truncate">{supplierName}</h3>
                          <span className="text-xs text-neutral-400 shrink-0">({items.length})</span>
                          <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_COLORS[sStatus] ?? STATUS_COLORS.draft)}>
                            {sStatus}
                          </span>
                        </div>
                        <button
                          onClick={() => copySupplierSection(supplierName, items, order.created_at)}
                          className="text-xs text-gold hover:text-gold/80 uppercase tracking-widest transition shrink-0 ml-2"
                        >
                          Copy
                        </button>
                      </div>

                      {/* Checking progress bar */}
                      {isChecking && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={cn('font-medium', allChecked ? 'text-green-700' : 'text-blue-700')}>
                              {checkedCount}/{items.length} checked
                            </span>
                            {missingCount > 0 && checkedCount > 0 && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <AlertTriangle size={10} strokeWidth={2} />
                                {missingCount} not checked
                              </span>
                            )}
                          </div>
                          <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', allChecked ? 'bg-green-500' : 'bg-blue-500')}
                              style={{ width: `${items.length > 0 ? (checkedCount / items.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Items list */}
                      <div className="bg-white border border-neutral-200 rounded overflow-hidden mb-3">
                        {/* Desktop table */}
                        <table className="w-full text-sm hidden sm:table">
                          <thead>
                            <tr className="border-b border-neutral-100 text-xs uppercase tracking-widest text-neutral-400">
                              {isChecking && <th className="px-2 py-2 w-8"></th>}
                              <th className="text-left px-4 py-2 font-normal">Item</th>
                              <th className="text-center px-3 py-2 font-normal w-16">Qty</th>
                              <th className="text-left px-3 py-2 font-normal w-20">Unit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => {
                              const checked = checkedSet?.has(idx) ?? false;
                              return (
                                <tr
                                  key={idx}
                                  className={cn(
                                    'border-b border-neutral-50 last:border-b-0 transition',
                                    isChecking && checked ? 'bg-green-50/60' : '',
                                    isChecking && !checked ? 'cursor-pointer hover:bg-neutral-50' : ''
                                  )}
                                  onClick={isChecking ? () => toggleCheck(order.id, supplierId, idx) : undefined}
                                >
                                  {isChecking && (
                                    <td className="px-2 py-2 text-center">
                                      <div className={cn(
                                        'w-5 h-5 rounded border-2 flex items-center justify-center transition',
                                        checked ? 'bg-green-500 border-green-500' : 'border-neutral-300'
                                      )}>
                                        {checked && <Check size={12} strokeWidth={3} className="text-white" />}
                                      </div>
                                    </td>
                                  )}
                                  <td className={cn('px-4 py-2', isChecking && checked ? 'line-through text-neutral-400' : '')}>
                                    {item.name}
                                    {item.unit_size && <span className="text-xs text-neutral-500 ml-1.5">({item.unit_size})</span>}
                                  </td>
                                  <td className={cn('px-3 py-2 text-center font-bold', isChecking && checked ? 'text-green-600' : 'text-red-700')}>{item.toBuy}</td>
                                  <td className="px-3 py-2 text-neutral-500">{item.unit}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {/* Mobile list */}
                        <div className="sm:hidden divide-y divide-neutral-100">
                          {items.map((item, idx) => {
                            const checked = checkedSet?.has(idx) ?? false;
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  'px-3 py-2.5 flex items-center gap-3 transition',
                                  isChecking && checked ? 'bg-green-50/60' : '',
                                  isChecking && !checked ? 'active:bg-neutral-50' : ''
                                )}
                                onClick={isChecking ? () => toggleCheck(order.id, supplierId, idx) : undefined}
                              >
                                {isChecking && (
                                  <div className={cn(
                                    'w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition',
                                    checked ? 'bg-green-500 border-green-500' : 'border-neutral-300'
                                  )}>
                                    {checked && <Check size={14} strokeWidth={3} className="text-white" />}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className={cn('text-sm block truncate', isChecking && checked ? 'line-through text-neutral-400' : '')}>{item.name}</span>
                                  {item.unit_size && <span className="text-xs text-neutral-400">{item.unit_size}</span>}
                                </div>
                                <span className={cn('font-bold text-sm shrink-0 ml-2', isChecking && checked ? 'text-green-600' : 'text-red-700')}>
                                  {item.toBuy} {item.unit}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Per-supplier status buttons */}
                      <div className="flex flex-wrap gap-2">
                        {sStatus === 'draft' && (
                          <button
                            onClick={() => updateSupplierStatus(order.id, supplierId, 'sent')}
                            className="flex items-center gap-1.5 border border-blue-300 text-blue-700 px-3 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-blue-50 transition"
                          >
                            <Check size={12} strokeWidth={2} />
                            Mark sent
                          </button>
                        )}
                        {sStatus === 'sent' && !isChecking && (
                          <button
                            onClick={() => startChecking(order.id, supplierId, items.length)}
                            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-blue-700 transition"
                          >
                            <ClipboardCheck size={12} strokeWidth={2} />
                            Check delivery
                          </button>
                        )}
                        {sStatus === 'sent' && isChecking && (
                          <>
                            <button
                              onClick={() => { updateSupplierStatus(order.id, supplierId, 'received'); stopChecking(order.id, supplierId); }}
                              disabled={checkedCount === 0}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs uppercase tracking-widest transition',
                                allChecked
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40'
                              )}
                            >
                              <Check size={12} strokeWidth={2} />
                              {allChecked ? 'All received' : `Receive (${missingCount} missing)`}
                            </button>
                            <button
                              onClick={() => stopChecking(order.id, supplierId)}
                              className="flex items-center gap-1.5 border border-neutral-300 text-neutral-600 px-3 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-50 transition"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {sStatus === 'sent' && !isChecking && (
                          <button
                            onClick={() => updateSupplierStatus(order.id, supplierId, 'received')}
                            className="flex items-center gap-1.5 border border-green-300 text-green-700 px-3 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-green-50 transition"
                          >
                            <Check size={12} strokeWidth={2} />
                            Mark received
                          </button>
                        )}
                        {sStatus !== 'draft' && !isChecking && (
                          <button
                            onClick={() => updateSupplierStatus(order.id, supplierId, 'draft')}
                            className="flex items-center gap-1.5 border border-neutral-300 text-neutral-600 px-3 py-1.5 rounded text-xs uppercase tracking-widest hover:bg-neutral-50 transition"
                          >
                            <Clock size={12} strokeWidth={2} />
                            Back to draft
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
