'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Truck, ClipboardCheck, CheckCircle2, AlertTriangle, PackageOpen } from 'lucide-react';
import { DeliveryChecklist } from '@/components/delivery-checklist';
import { pendingDeliveries, recentCheckIns, shortDate, type PurchaseOrder } from '@/lib/purchasing';

// Employee view: deliveries waiting to be checked in, and what was checked in lately.
export function DeliveriesView({ initialOrders }: { initialOrders: PurchaseOrder[] }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);
  const [checkingKey, setCheckingKey] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<{ supplierName: string; missing: number } | null>(null);

  const pending = pendingDeliveries(orders);
  const recent = recentCheckIns(orders);

  function handleConfirmed(updated: PurchaseOrder, supplierId: string, supplierName: string) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setCheckingKey(null);
    setLastSaved({ supplierName, missing: updated.deliveries?.[supplierId]?.missing.length ?? 0 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {lastSaved && (
        <div className={cn(
          'flex items-start gap-2 rounded-lg px-4 py-3 text-sm',
          lastSaved.missing === 0 ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-amber-50 border border-amber-200 text-amber-800'
        )}>
          {lastSaved.missing === 0
            ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
          <span>
            {lastSaved.supplierName} delivery saved.
            {lastSaved.missing > 0 && ` ${lastSaved.missing} item${lastSaved.missing !== 1 ? 's' : ''} missing — the owner has been notified.`}
          </span>
        </div>
      )}

      <section>
        <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-medium mb-3">
          Waiting for delivery ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
            <PackageOpen size={30} className="mx-auto text-neutral-300 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-neutral-600">No deliveries expected right now.</p>
            <p className="text-xs text-neutral-400 mt-1">
              If a delivery arrives that isn&apos;t listed here, ask a manager to mark the order as sent.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(({ order, supplierId, supplierName, items }) => {
              const key = `${order.id}:${supplierId}`;
              const isChecking = checkingKey === key;
              return (
                <div key={key} className={cn('bg-white border rounded-xl p-4', isChecking ? 'border-blue-300' : 'border-neutral-200')}>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Truck size={18} className="text-blue-500 shrink-0" strokeWidth={1.5} />
                      <div className="min-w-0">
                        <h3 className="font-medium truncate">{supplierName}</h3>
                        <p className="text-xs text-neutral-500">
                          Ordered {shortDate(order.created_at)} · {items.length} item{items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                  {!isChecking && (
                    <button
                      onClick={() => { setCheckingKey(key); setLastSaved(null); }}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-xl text-base font-medium hover:bg-blue-700 transition"
                    >
                      <ClipboardCheck size={18} strokeWidth={2} />
                      Check delivery
                    </button>
                  )}
                  {isChecking && (
                    <DeliveryChecklist
                      orderId={order.id}
                      supplierId={supplierId}
                      supplierName={supplierName}
                      items={items}
                      onCancel={() => setCheckingKey(null)}
                      onConfirmed={(updated) => handleConfirmed(updated, supplierId, supplierName)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-medium mb-3">Checked in recently</h2>
          <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
            {recent.map(({ order, supplierId, supplierName, delivery }) => (
              <div key={`${order.id}:${supplierId}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{supplierName}</p>
                  <p className="text-xs text-neutral-500">
                    {shortDate(delivery.received_at)}{' '}
                    {new Date(delivery.received_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {delivery.received_by ? ` · ${delivery.received_by}` : ''}
                  </p>
                </div>
                {delivery.missing.length === 0 ? (
                  <span className="flex items-center gap-1 text-xs text-green-700 shrink-0">
                    <CheckCircle2 size={14} /> All received
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-700 shrink-0">
                    <AlertTriangle size={14} /> {delivery.missing.length} missing
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
