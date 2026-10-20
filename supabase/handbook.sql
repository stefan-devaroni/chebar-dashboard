-- Employee handbook (Oct 2026). Safe to run more than once.
-- Chapters with sections; managers write and edit them in the dashboard,
-- all staff can read them. Sections start empty with a note of what goes there.

create table if not exists handbook_chapters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists handbook_sections (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references handbook_chapters(id) on delete cascade,
  title text not null,
  body text not null default '',
  hint text,
  sort int not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);

create index if not exists handbook_sections_chapter_idx on handbook_sections (chapter_id, sort);

alter table handbook_chapters enable row level security;
alter table handbook_sections enable row level security;
revoke all on handbook_chapters from anon, authenticated;
revoke all on handbook_sections from anon, authenticated;

-- Proposed table of contents, only on the first run
do $$
declare c uuid;
begin
  if exists (select 1 from handbook_chapters) then
    return;
  end if;

  insert into handbook_chapters (title, sort) values ('Welcome to Che Bar', 1) returning id into c;
  insert into handbook_sections (chapter_id, title, hint, sort) values
    (c, 'Our story', 'How Che Bar started, where we are (Paseo Herencia, Palm Beach) and what Mornings and Nights are.', 1),
    (c, 'What we stand for', 'Warm, honest, unhurried, worth the money — and what that looks like on a shift.', 2),
    (c, 'Who is who', 'Owners, managers and who to ask for what.', 3);

  insert into handbook_chapters (title, sort) values ('Working here', 2) returning id into c;
  insert into handbook_sections (chapter_id, title, hint, sort) values
    (c, 'Shifts and the schedule', 'How the schedule is made, where to see it, swapping shifts.', 1),
    (c, 'Time off and vacation', 'How to request time off in the dashboard and how much notice to give.', 2),
    (c, 'Arriving, breaks and staff meals', 'When to arrive, how breaks work, what staff can eat and drink.', 3),
    (c, 'Pay, tips and payslips', 'Pay days, how tips are shared, where payslips come from.', 4),
    (c, 'Uniform and appearance', 'What to wear, hair, nails, jewelry, name tags.', 5),
    (c, 'Phones and personal items', 'Where phones and bags go during a shift.', 6);

  insert into handbook_chapters (title, sort) values ('How we serve', 3) returning id into c;
  insert into handbook_sections (chapter_id, title, hint, sort) values
    (c, 'Greeting and seating', 'Greeting every guest, seating, walk-ins and reservations.', 1),
    (c, 'Taking the order', 'Knowing the menu, recommending, entering orders in Revel, asking about allergies.', 2),
    (c, 'Serving food and drinks', 'Timing, who runs food and drinks, checking back with the table.', 3),
    (c, 'The bill and goodbye', 'Bringing the bill, payment, tips and saying goodbye.', 4),
    (c, 'Mornings service', 'Breakfast from 7:30 AM to 3 PM: coffee, juice, mimosas, pancakes.', 5),
    (c, 'Nights service', 'Happy hour 5–7 PM, pizza from 6 PM, live music Thursday and Sunday.', 6),
    (c, 'Reservations and walk-ins', 'Using the Bookings tab, holding tables, no-shows.', 7),
    (c, 'When a guest is unhappy', 'Listen, fix it, tell the manager; who can comp what.', 8),
    (c, 'Reviews', 'How and when to ask for a review; the QR review cards.', 9);

  insert into handbook_chapters (title, sort) values ('Bar', 4) returning id into c;
  insert into handbook_sections (chapter_id, title, hint, sort) values
    (c, 'Drink recipes', 'All drink recipes are in the Menu & Recipes tab.', 1),
    (c, 'Pouring and measuring', 'Pour sizes and how drinks are measured.', 2),
    (c, 'Serving alcohol responsibly', 'Age checks, guests who have had too much, when to stop serving.', 3),
    (c, 'Bar opening and closing', 'Covered by the daily checklists in the dashboard.', 4);

  insert into handbook_chapters (title, sort) values ('Kitchen', 5) returning id into c;
  insert into handbook_sections (chapter_id, title, hint, sort) values
    (c, 'Food safety and hygiene', 'Hand washing, gloves, keeping raw and ready food apart.', 1),
    (c, 'Labeling, dating and storage', 'Labels, use-by dates, first in first out.', 2),
    (c, 'Temperatures', 'Fridge and freezer ranges, cooking temperatures.', 3),
    (c, 'Allergies in the kitchen', 'How allergy orders are made and marked.', 4),
    (c, 'Recipes and plating', 'Follow the recipe and photo in the Menu & Recipes tab.', 5),
    (c, 'Deliveries and stock', 'Checking deliveries in the dashboard, telling the manager what is running low.', 6);

  insert into handbook_chapters (title, sort) values ('Cash and the POS', 6) returning id into c;
  insert into handbook_sections (chapter_id, title, hint, sort) values
    (c, 'Using Revel', 'Logging in, entering orders, splitting checks, the two iPads.', 1),
    (c, 'Cash handling', 'Drawers, counting, never leaving cash unattended.', 2),
    (c, '3 PM shift handover', 'Z-reads, counting with three people, the 1% difference rule, the drop safe.', 3),
    (c, 'Voids, comps and discounts', 'Who can approve them and how to ring them in.', 4);

  insert into handbook_chapters (title, sort) values ('Cleaning', 7) returning id into c;
  insert into handbook_sections (chapter_id, title, hint, sort) values
    (c, 'Daily checklists', 'Opening, shift change and closing lists are in the Checklists tab.', 1),
    (c, 'Weekly cleaning', 'Deep-clean jobs and who does which day.', 2);

  insert into handbook_chapters (title, sort) values ('Safety and emergencies', 8) returning id into c;
  insert into handbook_sections (chapter_id, title, hint, sort) values
    (c, 'Fire and evacuation', 'Exits, fire extinguishers, where to meet outside.', 1),
    (c, 'Injuries and first aid', 'Where the first aid kit is and what to do.', 2),
    (c, 'Power or water outage', 'What to do and who to call.', 3),
    (c, 'Emergency numbers', 'Police, ambulance, fire, mall security, managers.', 4);

  insert into handbook_chapters (title, sort) values ('Rules and conduct', 9) returning id into c;
  insert into handbook_sections (chapter_id, title, hint, sort) values
    (c, 'Attendance and lateness', 'Calling in sick, being late, no-shows.', 1),
    (c, 'Respect at work', 'No harassment or discrimination, and how to report it.', 2),
    (c, 'Alcohol and drugs', 'The rules on and off shift.', 3),
    (c, 'Social media and photos', 'What staff can and cannot post about work.', 4),
    (c, 'Warnings and discipline', 'The warning levels and what leads to each one.', 5);
end $$;

notify pgrst, 'reload schema';
