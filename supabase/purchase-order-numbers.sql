-- Purchase order numbers (Oct 2026). Run once in Supabase > SQL Editor. Safe to run more than once.
-- Each supplier's part of an order gets its own number (PO-1001, PO-1002, ...) the first time its
-- PDF is made. Stored per supplier: po_numbers = { "<supplier id>": { "number": "PO-1001", "issued_at": "..." } }

alter table purchase_orders add column if not exists po_numbers jsonb not null default '{}'::jsonb;

create sequence if not exists purchase_order_number_seq start 1001;

-- Returns the supplier's existing number, or gives it the next one (atomic: the row is locked)
create or replace function assign_po_number(p_order uuid, p_supplier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing jsonb;
  assigned jsonb;
begin
  select po_numbers -> p_supplier into existing from purchase_orders where id = p_order for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if existing is not null then
    return existing;
  end if;
  assigned := jsonb_build_object('number', 'PO-' || nextval('purchase_order_number_seq'), 'issued_at', now());
  update purchase_orders
     set po_numbers = coalesce(po_numbers, '{}'::jsonb) || jsonb_build_object(p_supplier, assigned)
   where id = p_order;
  return assigned;
end;
$$;

revoke all on function assign_po_number(uuid, text) from public, anon, authenticated;
grant execute on function assign_po_number(uuid, text) to service_role;

notify pgrst, 'reload schema';
