-- Online reservations (Oct 2026). Safe to run more than once.
-- Guests book on chebararuba.com/reserve/ through the dashboard's public API;
-- staff see and manage bookings on /dashboard/reservations.
-- Dates and times are Aruba local time (UTC-4, no daylight saving).

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  party_size int not null check (party_size between 1 and 100),
  name text not null,
  phone text,
  email text,
  notes text,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'seated', 'no_show', 'cancelled')),
  source text not null default 'online' check (source in ('online', 'staff')),
  manage_token text unique,   -- guest's change/cancel link
  client_ref text unique,     -- makes a double-tapped "Book" create one booking
  ip_hash text,               -- hashed IP, only used to rate-limit the public form
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservations_date_time_idx on reservations (date, time);
create index if not exists reservations_ip_recent_idx on reservations (ip_hash, created_at);

create table if not exists reservation_settings (
  id int primary key default 1 check (id = 1),
  online_enabled boolean not null default true,
  max_guests_per_slot int not null default 20,
  max_party_online int not null default 8,
  first_time text not null default '07:30',
  last_time text not null default '21:30',
  min_notice_minutes int not null default 60,
  max_days_ahead int not null default 60,
  closed_dates date[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into reservation_settings (id) values (1) on conflict (id) do nothing;

-- Guest names and phone numbers: no direct access with the public/anon key or
-- a plain logged-in session. Only the dashboard server (service role) reads them.
alter table reservations enable row level security;
alter table reservation_settings enable row level security;
revoke all on reservations from anon, authenticated;
revoke all on reservation_settings from anon, authenticated;

-- Books a table only if the half hour still has room. The per-day lock stops
-- two guests from both taking the last seats at the same moment.
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
  p_ip_hash text
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

  insert into reservations (date, time, party_size, name, phone, email, notes, source, manage_token, client_ref, ip_hash)
  values (p_date, p_time, p_party, p_name, p_phone, p_email, p_notes, 'online', p_manage_token, p_client_ref, p_ip_hash)
  returning * into r;

  return r;
end;
$$;

revoke all on function book_reservation(date, text, int, int, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function book_reservation(date, text, int, int, text, text, text, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
