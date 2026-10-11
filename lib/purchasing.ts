// Shared purchase-order types and helpers (client + server).

export interface OrderItem {
  name: string;
  unit: string;
  unit_size: string | null;
  toBuy: number;
  supplier_name: string;
  supplier_id: string | null;
}

export interface DeliveryLine {
  name: string;
  unit: string;
  unit_size: string | null;
  ordered: number;
  received: number;
}

export interface MissingItem {
  name: string;
  unit: string;
  unit_size: string | null;
  qty: number;
}

// Result of checking in one supplier's delivery
export interface Delivery {
  received_at: string;
  received_by: string | null;
  lines: DeliveryLine[];
  missing: MissingItem[];
  resolved_at?: string | null;
  resolution?: 'reordered' | 'dismissed' | null;
}

export interface PurchaseOrder {
  id: string;
  created_at: string;
  status: 'draft' | 'sent' | 'received';
  notes: string | null;
  items: OrderItem[];
  supplier_statuses: Record<string, string> | null;
  archived_at?: string | null;
  deliveries?: Record<string, Delivery> | null;
}

export interface SupplierContact {
  id: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export const NO_SUPPLIER = '__none__';

export function supplierKey(item: { supplier_id: string | null }): string {
  return item.supplier_id ?? NO_SUPPLIER;
}

export function groupBySupplier(items: OrderItem[]): [string, { supplierName: string; items: OrderItem[] }][] {
  const map: Record<string, { supplierName: string; items: OrderItem[] }> = {};
  for (const item of items) {
    const key = supplierKey(item);
    if (!map[key]) map[key] = { supplierName: item.supplier_name || 'No supplier assigned', items: [] };
    map[key].items.push(item);
  }
  return Object.entries(map).sort(([a], [b]) => {
    if (a === NO_SUPPLIER) return 1;
    if (b === NO_SUPPLIER) return -1;
    return map[a].supplierName.localeCompare(map[b].supplierName);
  });
}

export function getSupplierStatus(order: PurchaseOrder, supplierId: string): string {
  return order.supplier_statuses?.[supplierId] ?? order.status ?? 'draft';
}

// Every supplier in the order gets an explicit status entry (missing ones are drafts)
export function fillSupplierStatuses(statuses: Record<string, string>, items: OrderItem[]): Record<string, string> {
  const all = { ...statuses };
  for (const item of items) all[supplierKey(item)] ??= 'draft';
  return all;
}

// Overall order status from per-supplier statuses (every supplier in the order counts)
export function deriveOverallStatus(
  statuses: Record<string, string>,
  items: OrderItem[]
): 'draft' | 'sent' | 'received' {
  const values = Object.values(fillSupplierStatuses(statuses, items));
  if (values.length > 0 && values.every((s) => s === 'received')) return 'received';
  if (values.every((s) => s === 'sent' || s === 'received')) return 'sent';
  return 'draft';
}

// Unresolved "not delivered" issues across orders
export function openMissing(orders: PurchaseOrder[]) {
  const out: { order: PurchaseOrder; supplierId: string; supplierName: string; delivery: Delivery }[] = [];
  for (const order of orders) {
    for (const [sid, delivery] of Object.entries(order.deliveries ?? {})) {
      if (delivery.missing.length > 0 && !delivery.resolved_at) {
        const supplierName = order.items.find((i) => supplierKey(i) === sid)?.supplier_name || 'No supplier assigned';
        out.push({ order, supplierId: sid, supplierName, delivery });
      }
    }
  }
  return out;
}

// Supplier sections that were sent and are waiting to be checked in
export function pendingDeliveries(orders: PurchaseOrder[]) {
  const out: { order: PurchaseOrder; supplierId: string; supplierName: string; items: OrderItem[] }[] = [];
  for (const order of orders) {
    if (order.archived_at) continue;
    for (const [sid, { supplierName, items }] of groupBySupplier(order.items)) {
      if (getSupplierStatus(order, sid) === 'sent') out.push({ order, supplierId: sid, supplierName, items });
    }
  }
  return out;
}

// How many supplier sections are waiting to be sent / delivered
export function stageCounts(orders: PurchaseOrder[]) {
  let toSend = 0;
  let waiting = 0;
  for (const order of orders) {
    if (order.archived_at) continue;
    for (const [sid] of groupBySupplier(order.items)) {
      const status = getSupplierStatus(order, sid);
      if (status === 'draft') toSend++;
      else if (status === 'sent') waiting++;
    }
  }
  return { toSend, waiting };
}

// Deliveries checked in within the last `hours`, newest first
export function recentCheckIns(orders: PurchaseOrder[], hours = 48) {
  const since = Date.now() - hours * 3600 * 1000;
  const out: { order: PurchaseOrder; supplierId: string; supplierName: string; delivery: Delivery }[] = [];
  for (const order of orders) {
    for (const [sid, delivery] of Object.entries(order.deliveries ?? {})) {
      if (new Date(delivery.received_at).getTime() < since) continue;
      const supplierName = order.items.find((i) => supplierKey(i) === sid)?.supplier_name || 'No supplier assigned';
      out.push({ order, supplierId: sid, supplierName, delivery });
    }
  }
  return out.sort((a, b) => b.delivery.received_at.localeCompare(a.delivery.received_at));
}

export function formatQty(item: { unit: string; unit_size: string | null; name: string }, qty: number): string {
  return `${qty} ${item.unit} ${item.name}${item.unit_size ? ` (${item.unit_size})` : ''}`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function buildOrderMessage(supplier: SupplierContact | undefined, supplierName: string, items: OrderItem[]): string {
  const greeting = supplier?.contact_name ? `Hi ${supplier.contact_name},` : `Hi ${supplierName},`;
  const lines = items.map((i) => `• ${formatQty(i, i.toBuy)}`).join('\n');
  return `${greeting}\n\nNew order from Che Bar (Paseo Herencia, Palm Beach):\n\n${lines}\n\nThank you!`;
}

export function buildMissingMessage(supplier: SupplierContact | undefined, supplierName: string, delivery: Delivery): string {
  const greeting = supplier?.contact_name ? `Hi ${supplier.contact_name},` : `Hi ${supplierName},`;
  const lines = delivery.missing.map((m) => `• ${formatQty(m, m.qty)}`).join('\n');
  return `${greeting}\n\nOur delivery on ${shortDate(delivery.received_at)} was missing:\n\n${lines}\n\nCan you bring these with the next delivery? Thank you!`;
}

// wa.me needs the full international number; 7-digit numbers are Aruban locals
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 7) digits = '297' + digits;
  return digits.length >= 8 ? digits : null;
}
