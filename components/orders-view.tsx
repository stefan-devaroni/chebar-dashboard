'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Copy, Mail, MessageCircle,
  Package, Phone, RotateCcw, Send, Trash2, X,
} from 'lucide-react';
import { DeliveryChecklist } from '@/components/delivery-checklist';
import {
  buildMissingMessage, buildOrderMessage, getSupplierStatus, groupBySupplier, openMissing, shortDate,
  whatsappNumber, NO_SUPPLIER, type Delivery, type OrderItem, type PurchaseOrder, type SupplierContact,
} from '@/lib/purchasing';

type Section = { order: PurchaseOrder; supplierId: string; supplierName: string; items: OrderItem[] };

const sectionHeading = 'flex items-center gap-2 text-xs uppercase tracking-widest font-medium px-1 mb-2';
const primaryBtn = 'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-medium transition';
const secondaryBtn = 'flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium border border-neutral-300 bg-white text-neutral-700 transition active:bg-neutral-50';

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function OrdersView({
  initialOrders,
  suppliers,
}: {
  initialOrders: PurchaseOrder[];
  suppliers: SupplierContact[];
}) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);
  const [sendTarget, setSendTarget] = useState<Section | null>(null);
  const [checkingKey, setCheckingKey] = useState<string | null>(null);
  const [openReceived, setOpenReceived] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const supplierById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const contactFor = (sid: string) => (sid === NO_SUPPLIER ? undefined : supplierById[sid]);
  const keyOf = (orderId: string, supplierId: string) => `${orderId}:${supplierId}`;

  function replaceOrder(updated: PurchaseOrder) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  async function refresh() {
    const res = await fetch('/api/orders');
    if (res.ok) setOrders(await res.json());
  }

  async function send(method: 'PUT' | 'DELETE', body: Record<string, unknown>, failMessage: string) {
    const res = await fetch('/api/orders', {
      method,
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

  async function setStatus(order: PurchaseOrder, supplierId: string, status: 'draft' | 'sent') {
    const updated = await send('PUT', { id: order.id, supplier_id: supplierId, supplier_status: status }, 'Could not update the order.');
    if (updated) replaceOrder(updated);
  }

  async function removeSection(s: Section) {
    if (!confirm(`Remove the ${s.supplierName} part of this order?`)) return;
    const result = await send('PUT', { id: s.order.id, remove_supplier: s.supplierId }, 'Could not remove it.');
    if (!result) return;
    if (result.deleted) setOrders((prev) => prev.filter((o) => o.id !== s.order.id));
    else replaceOrder(result);
  }

  async function undoReceive(s: Section) {
    if (!confirm(`Undo the ${s.supplierName} check-in? It goes back to "waiting for delivery".`)) return;
    const updated = await send('PUT', { id: s.order.id, supplier_id: s.supplierId, undo_receive: true }, 'Could not undo the check-in.');
    if (updated) {
      replaceOrder(updated);
      setOpenReceived(null);
    }
  }

  async function resolveMissing(order: PurchaseOrder, supplierId: string, resolution: 'reordered' | 'dismissed') {
    const updated = await send('PUT', { id: order.id, supplier_id: supplierId, resolve_missing: resolution }, 'Could not update.');
    if (!updated) return;
    // Re-ordering adds to (or creates) a draft order
    if (resolution === 'reordered') await refresh();
    else replaceOrder(updated);
  }

  async function archiveReceived(ids: string[]) {
    const previous = orders;
    const stamp = new Date().toISOString();
    setOrders((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, archived_at: stamp } : o)));
    if (!(await send('PUT', { ids, archived: true }, 'Could not clear the list. Please try again.'))) setOrders(previous);
  }

  async function deleteOrder(id: string) {
    if (!confirm('Delete this order permanently? This cannot be undone.')) return;
    const previous = orders;
    setOrders((prev) => prev.filter((o) => o.id !== id));
    if (!(await send('DELETE', { id }, 'Could not delete the order. Please try again.'))) setOrders(previous);
  }

  // Split every open order into per-supplier sections by stage
  const active = orders.filter((o) => !o.archived_at);
  const toSend: Section[] = [];
  const waiting: Section[] = [];
  const received: (Section & { delivery?: Delivery })[] = [];
  for (const order of active) {
    for (const [supplierId, { supplierName, items }] of groupBySupplier(order.items)) {
      const s = { order, supplierId, supplierName, items };
      const status = getSupplierStatus(order, supplierId);
      if (status === 'draft') toSend.push(s);
      else if (status === 'sent') waiting.push(s);
      else received.push({ ...s, delivery: order.deliveries?.[supplierId] });
    }
  }
  const issues = openMissing(orders);
  const history = orders.filter((o) => o.archived_at);
  const fullyReceivedIds = active
    .filter((o) => groupBySupplier(o.items).every(([sid]) => getSupplierStatus(o, sid) === 'received'))
    .map((o) => o.id);
  const nothingOpen = issues.length + toSend.length + waiting.length + received.length === 0;

  return (
    <div className="space-y-8 max-w-2xl">
      {nothingOpen && (
        <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center">
          <Package size={32} className="mx-auto text-neutral-300 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-neutral-600">No open orders.</p>
          <p className="text-xs text-neutral-400 mt-1">On Purchasing, tap + on what you need, then &ldquo;Add to order&rdquo;.</p>
        </div>
      )}

      {/* 1. Not delivered */}
      {issues.length > 0 && (
        <section>
          <h2 className={cn(sectionHeading, 'text-red-700')}>
            <AlertTriangle size={14} strokeWidth={2} />
            Not delivered
          </h2>
          <div className="space-y-3">
            {issues.map(({ order, supplierId, supplierName, delivery }) => {
              const message = buildMissingMessage(contactFor(supplierId), supplierName, delivery);
              const wa = whatsappNumber(contactFor(supplierId)?.phone);
              return (
                <div key={keyOf(order.id, supplierId)} className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-medium text-red-900">{supplierName}</p>
                  <p className="text-xs text-red-800/80 mb-3">
                    Checked in {shortDate(delivery.received_at)}{delivery.received_by ? ` by ${delivery.received_by}` : ''}
                  </p>
                  <ul className="bg-white border border-red-100 rounded-lg divide-y divide-red-50 mb-3">
                    {delivery.missing.map((m) => (
                      <li key={m.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="text-sm min-w-0">{m.name}</span>
                        <span className="text-sm font-bold text-red-700 shrink-0">{m.qty} {m.unit}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`https://wa.me/${wa ?? ''}?text=${encodeURIComponent(message)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(primaryBtn, 'bg-[#25D366] text-white mb-2')}
                  >
                    <MessageCircle size={18} strokeWidth={2} />
                    Message supplier
                  </a>
                  <div className="flex gap-2">
                    <button onClick={() => resolveMissing(order, supplierId, 'reordered')} className={secondaryBtn}>
                      Add to next order
                    </button>
                    <button onClick={() => resolveMissing(order, supplierId, 'dismissed')} className={secondaryBtn}>
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. To send */}
      {toSend.length > 0 && (
        <section>
          <h2 className={cn(sectionHeading, 'text-amber-700')}>To send ({toSend.length})</h2>
          <div className="space-y-3">
            {toSend.map((s) => (
              <div key={keyOf(s.order.id, s.supplierId)} className="bg-white border border-neutral-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.supplierName}</p>
                    <p className="text-xs text-neutral-500">{s.items.length} item{s.items.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => removeSection(s)}
                    aria-label={`Remove ${s.supplierName} from this order`}
                    className="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center text-neutral-300 hover:text-red-600 shrink-0"
                  >
                    <Trash2 size={17} strokeWidth={1.5} />
                  </button>
                </div>
                <ItemList items={s.items} />
                <button onClick={() => setSendTarget(s)} className={cn(primaryBtn, 'bg-ink text-cream')}>
                  <Send size={17} strokeWidth={2} />
                  Send order
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Waiting for delivery */}
      {waiting.length > 0 && (
        <section>
          <h2 className={cn(sectionHeading, 'text-blue-700')}>Waiting for delivery ({waiting.length})</h2>
          <div className="space-y-3">
            {waiting.map((s) => {
              const key = keyOf(s.order.id, s.supplierId);
              const isChecking = checkingKey === key;
              return (
                <div key={key} className={cn('bg-white border rounded-xl p-4', isChecking ? 'border-blue-300' : 'border-neutral-200')}>
                  <p className="font-medium truncate">{s.supplierName}</p>
                  <p className="text-xs text-neutral-500 mb-3">
                    Ordered {shortDate(s.order.created_at)} · {s.items.length} item{s.items.length !== 1 ? 's' : ''}
                  </p>
                  {isChecking ? (
                    <DeliveryChecklist
                      orderId={s.order.id}
                      supplierId={s.supplierId}
                      supplierName={s.supplierName}
                      items={s.items}
                      onCancel={() => setCheckingKey(null)}
                      onConfirmed={(updated) => { replaceOrder(updated); setCheckingKey(null); }}
                    />
                  ) : (
                    <>
                      <button onClick={() => setCheckingKey(key)} className={cn(primaryBtn, 'bg-blue-600 text-white')}>
                        <ClipboardCheck size={18} strokeWidth={2} />
                        Check delivery
                      </button>
                      <button
                        onClick={() => setStatus(s.order, s.supplierId, 'draft')}
                        className="w-full mt-2 py-2 text-xs text-neutral-400 hover:text-neutral-600"
                      >
                        Not sent yet? Move back to &ldquo;To send&rdquo;
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Received */}
      {received.length > 0 && (
        <section>
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className={cn(sectionHeading, 'text-green-700 mb-0 px-0')}>Received</h2>
            {fullyReceivedIds.length > 0 && (
              <button onClick={() => archiveReceived(fullyReceivedIds)} className="text-xs text-neutral-500 hover:text-ink py-1">
                Clear list
              </button>
            )}
          </div>
          <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
            {received.map((s) => {
              const key = keyOf(s.order.id, s.supplierId);
              const isOpen = openReceived === key;
              const missing = s.delivery?.missing.length ?? 0;
              return (
                <div key={key}>
                  <button
                    onClick={() => setOpenReceived(isOpen ? null : key)}
                    className="w-full flex items-center gap-3 px-4 py-3 min-h-[60px] text-left active:bg-neutral-50"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{s.supplierName}</span>
                      <span className="block text-xs text-neutral-500">
                        {s.delivery
                          ? `${shortDate(s.delivery.received_at)} ${timeOf(s.delivery.received_at)}${s.delivery.received_by ? ` · ${s.delivery.received_by}` : ''}`
                          : `Ordered ${shortDate(s.order.created_at)}`}
                      </span>
                    </span>
                    {missing > 0 ? (
                      <span className="flex items-center gap-1 text-xs text-amber-700 shrink-0"><AlertTriangle size={14} /> {missing} missing</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-green-700 shrink-0"><CheckCircle2 size={14} /> Complete</span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      {s.delivery ? (
                        <ul className="border border-neutral-200 rounded-lg divide-y divide-neutral-100 mb-3">
                          {s.delivery.lines.map((l) => (
                            <li key={l.name} className={cn('flex items-center justify-between gap-3 px-3 py-2.5', l.received < l.ordered && 'bg-amber-50')}>
                              <span className="text-sm min-w-0">{l.name}</span>
                              <span className={cn('text-sm font-bold tabular-nums shrink-0', l.received < l.ordered ? 'text-amber-700' : 'text-green-700')}>
                                {l.received}/{l.ordered} {l.unit}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mb-3"><ItemList items={s.items} /></div>
                      )}
                      <button onClick={() => undoReceive(s)} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink py-2">
                        <RotateCcw size={14} strokeWidth={2} />
                        Undo check-in
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-neutral-500 hover:text-ink px-1 py-2"
          >
            {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            History ({history.length})
          </button>
          {showHistory && (
            <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden mt-2">
              {history.map((o) => {
                const names = groupBySupplier(o.items).map(([, g]) => g.supplierName).join(', ');
                return (
                  <div key={o.id} className="flex items-center gap-3 pl-4 pr-2 py-3 min-h-[56px]">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{shortDate(o.created_at)}</span>
                      <span className="block text-xs text-neutral-500 truncate">{names}</span>
                    </span>
                    <button
                      onClick={() => deleteOrder(o.id)}
                      aria-label="Delete order"
                      className="w-10 h-10 flex items-center justify-center text-neutral-300 hover:text-red-600 shrink-0"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {sendTarget && (
        <SendSheet
          section={sendTarget}
          supplier={contactFor(sendTarget.supplierId)}
          onClose={() => setSendTarget(null)}
          onSent={async () => {
            await setStatus(sendTarget.order, sendTarget.supplierId, 'sent');
            setSendTarget(null);
          }}
        />
      )}
    </div>
  );
}

function ItemList({ items }: { items: OrderItem[] }) {
  return (
    <ul className="border border-neutral-200 rounded-lg divide-y divide-neutral-100 mb-3">
      {items.map((item) => (
        <li key={item.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="text-sm min-w-0">
            {item.name}
            {item.unit_size && <span className="text-xs text-neutral-500 ml-1.5">({item.unit_size})</span>}
          </span>
          <span className="text-sm font-bold shrink-0">{item.toBuy} {item.unit}</span>
        </li>
      ))}
    </ul>
  );
}

// Step-by-step: pick how to send, then confirm it was sent
function SendSheet({
  section,
  supplier,
  onClose,
  onSent,
}: {
  section: Section;
  supplier: SupplierContact | undefined;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const message = buildOrderMessage(supplier, section.supplierName, section.items);
  const wa = whatsappNumber(supplier?.phone);

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50 sm:px-4" onClick={onClose}>
      <div
        className="bg-cream w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl">Send to {section.supplierName}</h2>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 flex items-center justify-center text-neutral-400 hover:text-ink">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <p className="text-sm text-neutral-500 mb-5">1. Choose how to send the order</p>

        <div className="space-y-2 mb-6">
          <a
            href={`https://wa.me/${wa ?? ''}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(primaryBtn, 'bg-[#25D366] text-white')}
          >
            <MessageCircle size={18} strokeWidth={2} />
            WhatsApp
          </a>
          <div className="flex gap-2">
            {supplier?.email && (
              <a
                href={`mailto:${supplier.email}?subject=${encodeURIComponent(`Order from Che Bar — ${shortDate(section.order.created_at)}`)}&body=${encodeURIComponent(message)}`}
                className={secondaryBtn}
              >
                <Mail size={16} strokeWidth={2} />
                Email
              </a>
            )}
            {supplier?.phone && (
              <a href={`tel:${supplier.phone.replace(/[^\d+]/g, '')}`} className={secondaryBtn}>
                <Phone size={16} strokeWidth={2} />
                Call
              </a>
            )}
            <button
              onClick={() => { navigator.clipboard.writeText(message); setCopied(true); }}
              className={cn(secondaryBtn, copied && 'border-green-500 text-green-700')}
            >
              {copied ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={2} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {!wa && (
            <p className="text-xs text-neutral-500 px-1 pt-1">
              No phone number saved for this supplier — WhatsApp will ask you to pick the contact. Add it on Purchasing → Edit items &amp; suppliers.
            </p>
          )}
        </div>

        <p className="text-sm text-neutral-500 mb-2">2. When it&apos;s sent:</p>
        <button
          onClick={async () => { setSaving(true); await onSent(); }}
          disabled={saving}
          className={cn(primaryBtn, 'bg-ink text-cream disabled:opacity-60')}
        >
          <Check size={18} strokeWidth={2} />
          {saving ? 'Saving…' : "I've sent it"}
        </button>
      </div>
    </div>
  );
}
