'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Truck, FileText, Check, Clock, Package, ChevronDown, ChevronRight, ClipboardCheck, AlertTriangle,
  Copy, Archive, ArchiveRestore, Trash2, MessageCircle, Mail, Phone, RotateCcw, ShoppingCart, X,
} from 'lucide-react';
import { DeliveryChecklist } from '@/components/delivery-checklist';
import {
  buildMissingMessage, buildOrderMessage, formatQty, getSupplierStatus, groupBySupplier, openMissing, shortDate,
  whatsappNumber, NO_SUPPLIER, type OrderItem, type PurchaseOrder, type SupplierContact,
} from '@/lib/purchasing';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800',
  sent: 'bg-blue-100 text-blue-800',
  received: 'bg-green-100 text-green-800',
};

const btn = 'flex items-center gap-1.5 px-3 py-2 rounded text-xs uppercase tracking-widest transition';
const btnOutline = `${btn} border border-neutral-300 text-neutral-700 hover:bg-white`;

export function OrdersView({
  initialOrders,
  suppliers,
}: {
  initialOrders: PurchaseOrder[];
  suppliers: SupplierContact[];
}) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(
    initialOrders.find((o) => !o.archived_at)?.id ?? null
  );
  const [showArchived, setShowArchived] = useState(false);
  const [checkingKey, setCheckingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const supplierById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const keyOf = (orderId: string, supplierId: string) => `${orderId}:${supplierId}`;

  function replaceOrder(updated: PurchaseOrder) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  async function refresh() {
    const res = await fetch('/api/orders');
    if (res.ok) setOrders(await res.json());
  }

  async function putOrder(body: Record<string, unknown>, failMessage: string) {
    const res = await fetch('/api/orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(String(data.error ?? '').match(/archived_at|deliveries/)
        ? 'This needs a one-time database update first (supabase/purchasing-workflow.sql).'
        : failMessage);
      return null;
    }
    return data;
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }

  async function updateSupplierStatus(order: PurchaseOrder, supplierId: string, status: string) {
    const updated = await putOrder({ id: order.id, supplier_id: supplierId, supplier_status: status }, 'Could not update the order.');
    if (updated) replaceOrder(updated);
  }

  async function undoReceive(order: PurchaseOrder, supplierId: string, supplierName: string) {
    if (!confirm(`Undo the ${supplierName} check-in? It goes back to "sent" so it can be checked again.`)) return;
    const updated = await putOrder({ id: order.id, supplier_id: supplierId, undo_receive: true }, 'Could not undo the check-in.');
    if (updated) replaceOrder(updated);
  }

  async function resolveMissing(order: PurchaseOrder, supplierId: string, resolution: 'reordered' | 'dismissed') {
    const updated = await putOrder({ id: order.id, supplier_id: supplierId, resolve_missing: resolution }, 'Could not update.');
    if (!updated) return;
    // Re-ordering may have changed or created a draft order
    if (resolution === 'reordered') await refresh();
    else replaceOrder(updated);
  }

  function copyOrder(order: PurchaseOrder) {
    let text = `Che Bar — Purchase Order — ${shortDate(order.created_at)}\n${'═'.repeat(40)}\n\n`;
    for (const [, { supplierName, items }] of groupBySupplier(order.items)) {
      text += `▸ ${supplierName}\n${'─'.repeat(40)}\n`;
      for (const item of items) text += `  ${formatQty(item, item.toBuy)}\n`;
      text += '\n';
    }
    copy(text, `all:${order.id}`);
  }

  function getDisplayStatus(order: PurchaseOrder): string {
    const values = groupBySupplier(order.items).map(([sid]) => getSupplierStatus(order, sid));
    if (values.every((v) => v === 'received')) return 'received';
    if (values.every((v) => v === 'sent' || v === 'received')) return 'sent';
    if (values.some((v) => v === 'sent' || v === 'received')) return 'partial';
    return 'draft';
  }

  async function setArchived(ids: string[], archived: boolean) {
    const previous = orders;
    const stamp = archived ? new Date().toISOString() : null;
    setOrders((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, archived_at: stamp } : o)));
    const ok = await putOrder({ ids, archived }, 'Could not update the order. Please try again.');
    if (!ok) setOrders(previous);
  }

  async function deleteOrder(id: string) {
    if (!confirm('Delete this order permanently? This cannot be undone.')) return;
    const previous = orders;
    setOrders((prev) => prev.filter((o) => o.id !== id));
    const res = await fetch('/api/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      setOrders(previous);
      alert('Could not delete the order. Please try again.');
    }
  }

  const issues = openMissing(orders);
  const activeOrders = orders.filter((o) => !o.archived_at);
  const archivedOrders = orders.filter((o) => o.archived_at);
  const receivedIds = activeOrders.filter((o) => getDisplayStatus(o) === 'received').map((o) => o.id);

  function contactButtons(order: PurchaseOrder, supplierId: string, supplierName: string, items: OrderItem[]) {
    const supplier = supplierId === NO_SUPPLIER ? undefined : supplierById[supplierId];
    const message = buildOrderMessage(supplier, supplierName, items);
    const wa = whatsappNumber(supplier?.phone);
    const key = keyOf(order.id, supplierId);
    return (
      <>
        <a
          href={`https://wa.me/${wa ?? ''}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(btn, 'bg-[#25D366] text-white hover:bg-[#1fb957]')}
        >
          <MessageCircle size={13} strokeWidth={2} />
          WhatsApp
        </a>
        {supplier?.email && (
          <a
            href={`mailto:${supplier.email}?subject=${encodeURIComponent(`Order from Che Bar — ${shortDate(order.created_at)}`)}&body=${encodeURIComponent(message)}`}
            className={btnOutline}
          >
            <Mail size={13} strokeWidth={2} />
            Email
          </a>
        )}
        {supplier?.phone && (
          <a href={`tel:${supplier.phone.replace(/[^\d+]/g, '')}`} className={btnOutline}>
            <Phone size={13} strokeWidth={2} />
            Call
          </a>
        )}
        <button onClick={() => copy(message, key)} className={cn(btnOutline, copiedKey === key && 'border-green-500 text-green-700')}>
          {copiedKey === key ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={2} />}
          {copiedKey === key ? 'Copied' : 'Copy'}
        </button>
      </>
    );
  }

  function itemRows(items: OrderItem[]) {
    return (
      <div className="bg-white border border-neutral-200 rounded divide-y divide-neutral-100 mb-3">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm min-w-0">
              {item.name}
              {item.unit_size && <span className="text-xs text-neutral-500 ml-1.5">({item.unit_size})</span>}
            </span>
            <span className="text-sm font-bold text-ink shrink-0">{item.toBuy} {item.unit}</span>
          </div>
        ))}
      </div>
    );
  }

  function renderSupplierSection(order: PurchaseOrder, supplierId: string, supplierName: string, items: OrderItem[]) {
    const sStatus = getSupplierStatus(order, supplierId);
    const key = keyOf(order.id, supplierId);
    const delivery = order.deliveries?.[supplierId];
    const isChecking = checkingKey === key;

    return (
      <div key={supplierId} className={cn(
        'rounded-lg border p-3 sm:p-4',
        sStatus === 'received' ? 'bg-green-50/50 border-green-200' :
        sStatus === 'sent' ? 'bg-blue-50/50 border-blue-200' :
        'bg-cream border-neutral-200'
      )}>
        <div className="flex items-center gap-2 mb-3 min-w-0">
          <Truck size={14} className="text-neutral-400 shrink-0" />
          <h3 className="font-medium text-sm truncate">{supplierName}</h3>
          <span className="text-xs text-neutral-400 shrink-0">({items.length})</span>
          <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_COLORS[sStatus] ?? STATUS_COLORS.draft)}>
            {sStatus}
          </span>
        </div>

        {isChecking ? (
          <DeliveryChecklist
            orderId={order.id}
            supplierId={supplierId}
            supplierName={supplierName}
            items={items}
            onCancel={() => setCheckingKey(null)}
            onConfirmed={(updated) => { replaceOrder(updated); setCheckingKey(null); }}
          />
        ) : sStatus === 'received' && delivery ? (
          <>
            <p className="text-xs text-neutral-600 mb-2">
              Checked in{delivery.received_by ? ` by ${delivery.received_by}` : ''} · {shortDate(delivery.received_at)}{' '}
              {new Date(delivery.received_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            <div className="bg-white border border-neutral-200 rounded divide-y divide-neutral-100 mb-3">
              {delivery.lines.map((l) => {
                const short = l.received < l.ordered;
                return (
                  <div key={l.name} className={cn('flex items-center justify-between gap-3 px-3 py-2.5', short && 'bg-amber-50')}>
                    <span className="text-sm min-w-0">{l.name}</span>
                    <span className={cn('text-sm font-bold shrink-0 tabular-nums', short ? 'text-amber-700' : 'text-green-700')}>
                      {l.received}/{l.ordered} {l.unit}
                    </span>
                  </div>
                );
              })}
            </div>
            {delivery.missing.length > 0 && delivery.resolved_at && (
              <p className="text-xs text-neutral-500 mb-3">
                Missing items {delivery.resolution === 'reordered' ? 'added to the next order' : 'dismissed'} · {shortDate(delivery.resolved_at)}
              </p>
            )}
            <button onClick={() => undoReceive(order, supplierId, supplierName)} className={btnOutline}>
              <RotateCcw size={13} strokeWidth={2} />
              Undo check-in
            </button>
          </>
        ) : (
          <>
            {itemRows(items)}
            <div className="flex flex-wrap gap-2">
              {sStatus === 'draft' && (
                <>
                  {contactButtons(order, supplierId, supplierName, items)}
                  <button
                    onClick={() => updateSupplierStatus(order, supplierId, 'sent')}
                    className={cn(btn, 'bg-blue-600 text-white hover:bg-blue-700')}
                  >
                    <Check size={13} strokeWidth={2} />
                    Mark sent
                  </button>
                </>
              )}
              {sStatus === 'sent' && (
                <>
                  <button onClick={() => setCheckingKey(key)} className={cn(btn, 'bg-blue-600 text-white hover:bg-blue-700')}>
                    <ClipboardCheck size={13} strokeWidth={2} />
                    Check delivery
                  </button>
                  <button onClick={() => updateSupplierStatus(order, supplierId, 'draft')} className={btnOutline}>
                    <Clock size={13} strokeWidth={2} />
                    Back to draft
                  </button>
                </>
              )}
              {sStatus === 'received' && !delivery && (
                <button onClick={() => updateSupplierStatus(order, supplierId, 'sent')} className={btnOutline}>
                  <RotateCcw size={13} strokeWidth={2} />
                  Reopen
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderOrder(order: PurchaseOrder) {
    const isExpanded = expandedOrder === order.id;
    const grouped = groupBySupplier(order.items);
    const date = new Date(order.created_at);
    const displayStatus = getDisplayStatus(order);
    const statusLabel = displayStatus === 'partial' ? 'In progress' : displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);
    const statusColor = displayStatus === 'partial' ? 'bg-blue-50 text-blue-700' : STATUS_COLORS[displayStatus] ?? STATUS_COLORS.draft;

    return (
      <div key={order.id} className={cn('bg-white border border-neutral-200 rounded-lg overflow-hidden', order.archived_at && 'opacity-75')}>
        {/* Order header */}
        <div className="flex items-center">
          <button
            onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
            className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 text-left hover:bg-neutral-50 transition"
          >
            {isExpanded
              ? <ChevronDown size={16} className="text-neutral-400 shrink-0" />
              : <ChevronRight size={16} className="text-neutral-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{shortDate(order.created_at)}</span>
                <span className="text-xs text-neutral-400">
                  {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium', statusColor)}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {order.items.length} items from {grouped.length} supplier{grouped.length !== 1 ? 's' : ''}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-0.5 pr-2 sm:pr-3 shrink-0">
            <button
              onClick={() => setArchived([order.id], !order.archived_at)}
              title={order.archived_at ? 'Restore' : 'Archive'}
              aria-label={order.archived_at ? 'Restore order' : 'Archive order'}
              className="p-2 rounded text-neutral-400 hover:text-ink hover:bg-neutral-50 transition"
            >
              {order.archived_at ? <ArchiveRestore size={15} strokeWidth={1.5} /> : <Archive size={15} strokeWidth={1.5} />}
            </button>
            <button
              onClick={() => deleteOrder(order.id)}
              title="Delete"
              aria-label="Delete order"
              className="p-2 rounded text-neutral-400 hover:text-red-600 hover:bg-neutral-50 transition"
            >
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-neutral-100 px-4 py-4 sm:px-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => copyOrder(order)}
                className={cn(btn, 'bg-ink text-cream hover:bg-neutral-800')}
              >
                {copiedKey === `all:${order.id}` ? <Check size={12} strokeWidth={2} /> : <FileText size={12} strokeWidth={2} />}
                {copiedKey === `all:${order.id}` ? 'Copied' : 'Copy all'}
              </button>
            </div>
            {grouped.map(([sid, { supplierName, items }]) => renderSupplierSection(order, sid, supplierName, items))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Not delivered — needs the owner's attention */}
      {issues.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest text-red-700 font-medium">
            <AlertTriangle size={14} strokeWidth={2} />
            Not delivered ({issues.length})
          </h2>
          {issues.map(({ order, supplierId, supplierName, delivery }) => {
            const supplier = supplierId === NO_SUPPLIER ? undefined : supplierById[supplierId];
            const message = buildMissingMessage(supplier, supplierName, delivery);
            const wa = whatsappNumber(supplier?.phone);
            const key = `missing:${keyOf(order.id, supplierId)}`;
            return (
              <div key={key} className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm text-red-900">{supplierName}</h3>
                    <p className="text-xs text-red-800/80">
                      Checked in {shortDate(delivery.received_at)}{delivery.received_by ? ` by ${delivery.received_by}` : ''}
                    </p>
                  </div>
                </div>
                <ul className="bg-white border border-red-100 rounded divide-y divide-red-50 mb-3">
                  {delivery.missing.map((m) => (
                    <li key={m.name} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-sm min-w-0">{m.name}</span>
                      <span className="text-sm font-bold text-red-700 shrink-0">{m.qty} {m.unit}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`https://wa.me/${wa ?? ''}?text=${encodeURIComponent(message)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(btn, 'bg-[#25D366] text-white hover:bg-[#1fb957]')}
                  >
                    <MessageCircle size={13} strokeWidth={2} />
                    WhatsApp supplier
                  </a>
                  <button onClick={() => copy(message, key)} className={cn(btnOutline, copiedKey === key && 'border-green-500 text-green-700')}>
                    {copiedKey === key ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={2} />}
                    {copiedKey === key ? 'Copied' : 'Copy'}
                  </button>
                  <button onClick={() => resolveMissing(order, supplierId, 'reordered')} className={cn(btn, 'bg-ink text-cream hover:bg-neutral-800')}>
                    <ShoppingCart size={13} strokeWidth={2} />
                    Add to next order
                  </button>
                  <button onClick={() => resolveMissing(order, supplierId, 'dismissed')} className={btnOutline}>
                    <X size={13} strokeWidth={2} />
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {receivedIds.length > 0 && (
        <div className="flex justify-end">
          <button onClick={() => setArchived(receivedIds, true)} className={btnOutline}>
            <Archive size={12} strokeWidth={2} />
            Archive received ({receivedIds.length})
          </button>
        </div>
      )}

      {activeOrders.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded p-10 text-center">
          <Package size={32} className="mx-auto text-neutral-300 mb-3" />
          <p className="text-sm text-neutral-500">{orders.length === 0 ? 'No orders yet.' : 'No open orders.'}</p>
          <p className="text-xs text-neutral-400 mt-1">
            Go to Purchasing and click &ldquo;Generate Order&rdquo; to create one.
          </p>
        </div>
      )}

      {activeOrders.map(renderOrder)}

      {archivedOrders.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-neutral-500 hover:text-ink transition"
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived ({archivedOrders.length})
          </button>
          {showArchived && (
            <div className="space-y-4 mt-3">
              {archivedOrders.map(renderOrder)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
