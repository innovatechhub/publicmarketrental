-- Stall map: one row per stall number, and a row for every stall on the map.
--
-- The admin stall map looks stalls up by number, and numbers are unique across
-- the whole market. Earlier seeds inserted some numbers under two sections.
--
-- 1. Merge duplicate stall numbers into one row. The row kept is the one with a
--    vendor, then the occupied one, then the one outside Wet Market (the copy
--    the heat-map seed added), then the oldest. Anything pointing at a removed
--    row (applications, billings, leases, ...) is repointed to the kept row.
-- 2. Add any stall drawn on the map that has no row yet.

do $$
declare
  ref record;
begin
  create temp table stall_dedupe on commit drop as
  select st.id,
         first_value(st.id) over (
           partition by st.stall_number
           order by (st.vendor_id is not null) desc,
                    (st.status = 'occupied') desc,
                    (sec.code <> 'wet_market') desc,
                    st.created_at, st.id
         ) as keep_id
  from public.stalls st
  join public.market_sections sec on sec.id = st.section_id;

  delete from stall_dedupe where id = keep_id;

  for ref in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.stalls'::regclass
  loop
    execute format('update %s t set %I = d.keep_id from stall_dedupe d where t.%I = d.id', ref.tbl, ref.col, ref.col);
  end loop;

  delete from public.stalls st using stall_dedupe d where st.id = d.id;
end $$;

insert into public.market_sections (code, name, description, sort_order) values
  ('dry_goods',    'Dry Goods',    'General merchandise, clothing, and non-perishable goods', 1),
  ('wet_market',   'Wet Market',   'Fresh meat, poultry, and seafood products',                2),
  ('mixed',        'Mixed Section','Mixed stalls — assorted goods and services',               5),
  ('second_floor', 'Second Floor', 'Second floor stalls — main and annex buildings',           6),
  ('annex',        'Annex',        'Annex building ground floor stalls',                       7)
on conflict (code) do nothing;

insert into public.stalls (section_id, stall_number, stall_type, size_label, monthly_rate, status)
select s.id, n::text, 'Standard', v.size_label, v.monthly_rate, 'available'::public.stall_status
from (values
  -- Annex ground floor
  ('annex',          1,  12, '3x3m', 1500.00),
  ('annex',         35,  62, '3x3m', 1500.00),
  ('annex',        170, 195, '3x3m', 1500.00),
  ('annex',        240, 248, '3x3m', 1500.00),
  ('annex',        751, 751, '3x3m', 1500.00),
  -- Annex second floor
  ('second_floor',  13,  24, '3x3m', 1400.00),
  ('second_floor',  63,  85, '3x3m', 1400.00),
  ('second_floor', 249, 258, '3x3m', 1400.00),
  -- Mixed section
  ('mixed',        359, 561, '3x2m', 1300.00),
  -- Main ground floor
  ('dry_goods',    562, 648, '3x3m', 1800.00),
  ('wet_market',   649, 717, '3x3m', 1800.00),
  -- Main second floor
  ('second_floor', 718, 750, '3x3m', 1600.00)
) as v(section_code, first_no, last_no, size_label, monthly_rate)
cross join lateral generate_series(v.first_no, v.last_no) as n
join public.market_sections s on s.code = v.section_code
where not exists (select 1 from public.stalls x where x.stall_number = n::text);
