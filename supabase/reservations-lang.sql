-- Guest language for bookings (Nov 2026). Safe to run more than once.
-- Bookings made on chebararuba.com/es/reservar/ are stored with lang 'es', so the
-- confirmation, change and cancellation emails go out in Spanish. Everything else
-- (staff bookings, older bookings) stays 'en'.

alter table reservations add column if not exists lang text not null default 'en';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservations_lang_check') then
    alter table reservations add constraint reservations_lang_check check (lang in ('en', 'es'));
  end if;
end $$;

-- book_reservation gets p_lang. It has a default, so a call without it (the dashboard
-- before this change) still works. The old 11-argument version is dropped first:
-- with both versions present, a call without p_lang would be ambiguous.
drop function if exists book_reservation(date, text, int, int, text, text, text, text, text, text, text);

create or replace function book_reservation(
  p_date date,
  p_time text,
  p_party int,
  p_max_per_slot int,
  p_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_manage_token text,
  p_client_ref text,
  p_ip_hash text,
  p_lang text default 'en'
) returns reservations
language plpgsql
as $$
declare
  r reservations;
  booked int;
begin
  perform pg_advisory_xact_lock(hashtext('reservations:' || p_date::text));

  if p_client_ref is not null then
    select * into r from reservations where client_ref = p_client_ref;
    if found then
      return r;
    end if;
  end if;

  select coalesce(sum(party_size), 0) into booked
    from reservations
   where date = p_date
     and status in ('confirmed', 'seated')
     -- staff may enter e.g. 18:15; it counts toward the 18:00 half hour
     and (split_part(time, ':', 1)::int * 60 + split_part(time, ':', 2)::int) / 30
       = (split_part(p_time, ':', 1)::int * 60 + split_part(p_time, ':', 2)::int) / 30;

  if booked + p_party > p_max_per_slot then
    raise exception 'slot_full';
  end if;

  insert into reservations (date, time, party_size, name, phone, email, notes, source, manage_token, client_ref, ip_hash, lang)
  values (p_date, p_time, p_party, p_name, p_phone, p_email, p_notes, 'online', p_manage_token, p_client_ref, p_ip_hash,
          case when p_lang = 'es' then 'es' else 'en' end)
  returning * into r;

  return r;
end;
$$;

revoke all on function book_reservation(date, text, int, int, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function book_reservation(date, text, int, int, text, text, text, text, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
