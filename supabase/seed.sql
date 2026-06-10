-- =============================================================
-- Seed: demo data for Culasi Public Market
-- Password for all accounts: culasi123
--
-- HOW TO RUN IN SUPABASE SQL EDITOR:
--   Step 1: Run supabase/seed_users.sql  (creates auth.users)
--   Step 2: Run this file                (creates all app data)
--
-- HOW TO RUN VIA CLI:
--   supabase db seed  (runs seed_users.sql then seed.sql)
-- =============================================================

-- -------------------------------------------------------
-- 1. Profiles (idempotent — handles reseed without trigger)
-- -------------------------------------------------------
with seeded_auth_users as (
  select
    u.id, u.email,
    coalesce(u.raw_app_meta_data, '{}'::jsonb) as app_meta,
    coalesce(u.raw_user_meta_data, '{}'::jsonb) as user_meta
  from auth.users u
  where u.email in (
    'superadmin@culasi.gov.ph','admin@culasi.gov.ph','finance@culasi.gov.ph',
    'vendor@culasi.gov.ph','vendor2@culasi.gov.ph','vendor3@culasi.gov.ph',
    'vendor4@culasi.gov.ph','vendor5@culasi.gov.ph'
  )
)
insert into public.profiles (id, full_name, email, phone, role)
select
  s.id,
  coalesce(s.user_meta ->> 'full_name', split_part(s.email, '@', 1)),
  s.email,
  s.user_meta ->> 'phone',
  case
    when coalesce(s.app_meta ->> 'role', '') in ('super_admin','admin','finance','vendor')
    then (s.app_meta ->> 'role')::public.user_role
    else 'vendor'::public.user_role
  end
from seeded_auth_users s
on conflict (id) do update set
  full_name = excluded.full_name,
  email     = excluded.email,
  phone     = excluded.phone,
  role      = excluded.role;

-- -------------------------------------------------------
-- 2. Staff rows
-- -------------------------------------------------------
insert into public.staff (profile_id)
select p.id from public.profiles p
where p.email in ('superadmin@culasi.gov.ph','admin@culasi.gov.ph','finance@culasi.gov.ph')
on conflict (profile_id) do nothing;

update public.staff s
set position_title = case p.role
  when 'super_admin' then 'Market Superintendent'
  when 'admin'       then 'Market Administrator'
  when 'finance'     then 'Finance Officer'
end
from public.profiles p
where s.profile_id = p.id
  and p.email in ('superadmin@culasi.gov.ph','admin@culasi.gov.ph','finance@culasi.gov.ph')
  and s.position_title is null;

-- -------------------------------------------------------
-- 3. Vendor rows
-- -------------------------------------------------------
with vendor_accounts as (
  select
    p.id,
    coalesce(u.raw_user_meta_data, '{}'::jsonb) as user_meta
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.email in (
    'vendor@culasi.gov.ph','vendor2@culasi.gov.ph','vendor3@culasi.gov.ph',
    'vendor4@culasi.gov.ph','vendor5@culasi.gov.ph'
  )
)
insert into public.vendors (profile_id, business_name, business_type, address)
select
  v.id,
  coalesce(v.user_meta ->> 'business_name', 'New Vendor'),
  nullif(v.user_meta ->> 'business_type', ''),
  nullif(v.user_meta ->> 'address', '')
from vendor_accounts v
on conflict (profile_id) do update set
  business_name = excluded.business_name,
  business_type = coalesce(excluded.business_type, public.vendors.business_type),
  address       = coalesce(excluded.address,        public.vendors.address);

-- -------------------------------------------------------
-- 4. Market sections (idempotent)
-- -------------------------------------------------------
insert into public.market_sections (code, name, description, sort_order) values
  ('dry_goods',    'Dry Goods',    'General merchandise, clothing, and non-perishable goods', 1),
  ('wet_market',   'Wet Market',   'Fresh meat, poultry, and seafood products',                2),
  ('vegetables',   'Vegetables',   'Fresh vegetables and root crops',                          3),
  ('fish_aisle',   'Fish Aisle',   'Fresh and dried fish and marine products',                 4),
  ('mixed',        'Mixed Section','Mixed stalls — assorted goods and services',               5),
  ('second_floor', 'Second Floor', 'Second floor stalls — main and annex buildings',           6),
  ('annex',        'Annex',        'Annex building ground floor stalls',                       7)
on conflict (code) do nothing;

-- -------------------------------------------------------
-- 5. Document requirements (idempotent)
-- -------------------------------------------------------
insert into public.document_requirements (code, name, description, is_required, has_expiry, sort_order) values
  ('barangay_clearance', 'Barangay Clearance', 'Barangay-level business clearance requirement',    true, true, 1),
  ('police_clearance',   'Police Clearance',   'Police clearance for vendor compliance screening', true, true, 2),
  ('health_clearance',   'Health Clearance',   'Health clearance for market operations',           true, true, 3),
  ('dti_registration',   'DTI Registration',   'Department of Trade and Industry registration',    true, true, 4),
  ('business_permit',    'Business Permit',    'Local government business permit',                 true, true, 5)
on conflict (code) do nothing;

-- -------------------------------------------------------
-- 6. Stalls — real stall numbers from the building blueprint
--    Ground Floor Main:  562–648, 655–717
--    Second Floor Main:  718–782
--    Annex Ground Floor: 1–12, 35–39, 40–62, 100–120, 240–248, 751
--    Annex Second Floor: 13–24, 63–86, 249–258
--    Mixed Section:      359–561
-- -------------------------------------------------------
insert into public.stalls (section_id, stall_number, stall_type, size_label, monthly_rate, status)
select s.id, v.stall_number, v.stall_type, v.size_label, v.monthly_rate, v.status::public.stall_status
from public.market_sections s
join (values

  -- ── GROUND FLOOR MAIN – upper rows (562–648) ──────────────────────────
  ('dry_goods','562','Standard','3x3m',1800.00,'available'),
  ('dry_goods','563','Standard','3x3m',1800.00,'available'),
  ('dry_goods','564','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','565','Standard','3x3m',1800.00,'available'),
  ('dry_goods','566','Standard','3x3m',1800.00,'available'),
  ('dry_goods','567','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','568','Standard','3x3m',1800.00,'available'),
  ('dry_goods','569','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','570','Standard','3x3m',1800.00,'available'),
  ('dry_goods','571','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','572','Standard','3x3m',1800.00,'available'),
  ('dry_goods','573','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','574','Standard','3x3m',1800.00,'available'),
  ('dry_goods','575','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','576','Standard','3x3m',1800.00,'available'),
  ('dry_goods','577','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','578','Corner',  '4x4m',2200.00,'occupied'),
  ('dry_goods','579','Standard','3x3m',1800.00,'available'),
  ('dry_goods','580','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','581','Standard','3x3m',1800.00,'available'),
  ('dry_goods','582','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','583','Standard','3x3m',1800.00,'available'),
  ('dry_goods','584','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','585','Standard','3x3m',1800.00,'available'),
  ('dry_goods','586','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','587','Standard','3x3m',1800.00,'available'),
  ('dry_goods','588','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','589','Standard','3x3m',1800.00,'available'),
  ('dry_goods','590','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','591','Standard','3x3m',1800.00,'available'),
  ('dry_goods','592','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','593','Standard','3x3m',1800.00,'available'),
  ('dry_goods','594','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','595','Standard','3x3m',1800.00,'available'),
  ('dry_goods','596','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','597','Standard','3x3m',1800.00,'available'),
  ('dry_goods','598','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','599','Standard','3x3m',1800.00,'available'),
  ('dry_goods','600','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','601','Standard','3x3m',1800.00,'available'),
  ('dry_goods','602','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','603','Standard','3x3m',1800.00,'available'),
  ('dry_goods','604','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','605','Standard','3x3m',1800.00,'available'),
  ('dry_goods','606','Corner',  '4x4m',2200.00,'occupied'),
  ('dry_goods','607','Standard','3x3m',1800.00,'available'),
  ('dry_goods','608','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','609','Standard','3x3m',1800.00,'available'),
  ('dry_goods','610','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','611','Standard','3x3m',1800.00,'available'),
  ('dry_goods','612','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','613','Standard','3x3m',1800.00,'available'),
  ('dry_goods','614','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','615','Standard','3x3m',1800.00,'available'),
  ('dry_goods','616','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','617','Standard','3x3m',1800.00,'available'),
  ('dry_goods','618','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','619','Standard','3x3m',1800.00,'available'),
  ('dry_goods','620','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','621','Standard','3x3m',1800.00,'available'),
  ('dry_goods','622','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','623','Standard','3x3m',1800.00,'available'),
  ('dry_goods','624','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','625','Standard','3x3m',1800.00,'available'),
  ('dry_goods','626','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','627','Standard','3x3m',1800.00,'available'),
  ('dry_goods','628','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','629','Standard','3x3m',1800.00,'available'),
  ('dry_goods','630','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','631','Standard','3x3m',1800.00,'available'),
  ('dry_goods','632','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','633','Standard','3x3m',1800.00,'available'),
  ('dry_goods','634','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','635','Standard','3x3m',1800.00,'available'),
  ('dry_goods','636','Corner',  '4x4m',2200.00,'occupied'),
  ('dry_goods','637','Standard','3x3m',1800.00,'available'),
  ('dry_goods','638','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','639','Standard','3x3m',1800.00,'available'),
  ('dry_goods','640','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','641','Standard','3x3m',1800.00,'available'),
  ('dry_goods','642','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','643','Standard','3x3m',1800.00,'available'),
  ('dry_goods','644','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','645','Standard','3x3m',1800.00,'available'),
  ('dry_goods','646','Standard','3x3m',1800.00,'occupied'),
  ('dry_goods','647','Standard','3x3m',1800.00,'available'),
  ('dry_goods','648','Standard','3x3m',1800.00,'occupied'),

  -- ── GROUND FLOOR MAIN – canteen/middle area (655–669) ─────────────────
  ('wet_market','655','Canteen','2x3m',1200.00,'occupied'),
  ('wet_market','656','Canteen','2x3m',1200.00,'occupied'),
  ('wet_market','657','Canteen','2x3m',1200.00,'available'),
  ('wet_market','658','Canteen','2x3m',1200.00,'occupied'),
  ('wet_market','659','Canteen','2x3m',1200.00,'available'),
  ('wet_market','660','Canteen','2x3m',1200.00,'occupied'),
  ('wet_market','661','Canteen','2x3m',1200.00,'available'),
  ('wet_market','662','Canteen','2x3m',1200.00,'occupied'),
  ('wet_market','663','Canteen','2x3m',1200.00,'available'),
  ('wet_market','664','Canteen','2x3m',1200.00,'occupied'),
  ('wet_market','665','Canteen','2x3m',1200.00,'available'),
  ('wet_market','666','Canteen','2x3m',1200.00,'occupied'),
  ('wet_market','667','Canteen','2x3m',1200.00,'available'),
  ('wet_market','668','Canteen','2x3m',1200.00,'occupied'),
  ('wet_market','669','Canteen','2x3m',1200.00,'available'),

  -- ── GROUND FLOOR MAIN – lower rows (670–717) ──────────────────────────
  ('wet_market','670','Standard','3x3m',1800.00,'occupied'),
  ('wet_market','671','Standard','3x3m',1800.00,'available'),
  ('wet_market','672','Standard','3x3m',1800.00,'occupied'),
  ('wet_market','673','Standard','3x3m',1800.00,'available'),
  ('wet_market','674','Standard','3x3m',1800.00,'occupied'),
  ('wet_market','675','Standard','3x3m',1800.00,'available'),
  ('wet_market','676','Standard','3x3m',1800.00,'occupied'),
  ('wet_market','677','Standard','3x3m',1800.00,'available'),
  ('wet_market','678','Standard','3x3m',1800.00,'occupied'),
  ('wet_market','679','Standard','3x3m',1800.00,'available'),
  ('wet_market','680','Standard','3x3m',1800.00,'occupied'),
  ('wet_market','681','Standard','3x3m',1800.00,'available'),
  ('wet_market','682','Standard','3x3m',1800.00,'occupied'),
  ('wet_market','683','Standard','3x3m',1800.00,'available'),
  ('wet_market','684','Standard','3x3m',1800.00,'occupied'),
  ('wet_market','685','Standard','3x3m',1800.00,'available'),
  ('wet_market','686','Standard','3x3m',1800.00,'occupied'),
  ('wet_market','687','Standard','3x3m',1800.00,'available'),
  ('wet_market','688','Standard','3x3m',1800.00,'occupied'),
  ('wet_market','689','Large',  '4x4m',2200.00,'available'),
  ('wet_market','690','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','691','Large',  '4x4m',2200.00,'available'),
  ('wet_market','692','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','693','Large',  '4x4m',2200.00,'available'),
  ('wet_market','694','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','695','Large',  '4x4m',2200.00,'available'),
  ('wet_market','696','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','697','Large',  '4x4m',2200.00,'available'),
  ('wet_market','698','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','699','Large',  '4x4m',2200.00,'available'),
  ('wet_market','700','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','701','Large',  '4x4m',2200.00,'available'),
  ('wet_market','702','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','703','Large',  '4x4m',2200.00,'available'),
  ('wet_market','704','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','705','Large',  '4x4m',2200.00,'available'),
  ('wet_market','706','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','707','Large',  '4x4m',2200.00,'available'),
  ('wet_market','708','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','709','Large',  '4x4m',2200.00,'available'),
  ('wet_market','710','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','711','Large',  '4x4m',2200.00,'available'),
  ('wet_market','712','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','713','Large',  '4x4m',2200.00,'available'),
  ('wet_market','714','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','715','Large',  '4x4m',2200.00,'available'),
  ('wet_market','716','Large',  '4x4m',2200.00,'occupied'),
  ('wet_market','717','Large',  '4x4m',2200.00,'available'),

  -- ── SECOND FLOOR MAIN (718–782) ───────────────────────────────────────
  ('second_floor','718','Standard','3x3m',1600.00,'available'),
  ('second_floor','719','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','720','Standard','3x3m',1600.00,'available'),
  ('second_floor','721','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','722','Standard','3x3m',1600.00,'available'),
  ('second_floor','723','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','724','Standard','3x3m',1600.00,'available'),
  ('second_floor','725','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','726','Standard','3x3m',1600.00,'available'),
  ('second_floor','727','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','728','Standard','3x3m',1600.00,'available'),
  ('second_floor','729','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','730','Standard','3x3m',1600.00,'available'),
  ('second_floor','731','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','732','Standard','3x3m',1600.00,'available'),
  ('second_floor','733','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','734','Standard','3x3m',1600.00,'available'),
  ('second_floor','735','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','736','Standard','3x3m',1600.00,'available'),
  ('second_floor','737','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','738','Standard','3x3m',1600.00,'available'),
  ('second_floor','739','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','740','Standard','3x3m',1600.00,'available'),
  ('second_floor','741','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','742','Standard','3x3m',1600.00,'available'),
  ('second_floor','743','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','744','Standard','3x3m',1600.00,'available'),
  ('second_floor','745','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','746','Standard','3x3m',1600.00,'available'),
  ('second_floor','747','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','748','Standard','3x3m',1600.00,'available'),
  ('second_floor','749','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','750','Standard','3x3m',1600.00,'available'),
  ('second_floor','751','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','752','Standard','3x3m',1600.00,'available'),
  ('second_floor','753','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','754','Standard','3x3m',1600.00,'available'),
  ('second_floor','755','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','756','Standard','3x3m',1600.00,'available'),
  ('second_floor','757','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','758','Standard','3x3m',1600.00,'available'),
  ('second_floor','759','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','760','Standard','3x3m',1600.00,'available'),
  ('second_floor','761','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','762','Standard','3x3m',1600.00,'available'),
  ('second_floor','763','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','764','Standard','3x3m',1600.00,'available'),
  ('second_floor','765','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','766','Standard','3x3m',1600.00,'available'),
  ('second_floor','767','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','768','Standard','3x3m',1600.00,'available'),
  ('second_floor','769','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','770','Standard','3x3m',1600.00,'available'),
  ('second_floor','771','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','772','Standard','3x3m',1600.00,'available'),
  ('second_floor','773','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','774','Standard','3x3m',1600.00,'available'),
  ('second_floor','775','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','776','Standard','3x3m',1600.00,'available'),
  ('second_floor','777','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','778','Standard','3x3m',1600.00,'available'),
  ('second_floor','779','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','780','Standard','3x3m',1600.00,'available'),
  ('second_floor','781','Standard','3x3m',1600.00,'occupied'),
  ('second_floor','782','Standard','3x3m',1600.00,'available'),

  -- ── ANNEX GROUND FLOOR – left wing (1–12, 751) ───────────────────────
  ('annex','1', 'Standard','3x3m',1500.00,'available'),
  ('annex','2', 'Standard','3x3m',1500.00,'occupied'),
  ('annex','3', 'Standard','3x3m',1500.00,'available'),
  ('annex','4', 'Standard','3x3m',1500.00,'occupied'),
  ('annex','5', 'Standard','3x3m',1500.00,'available'),
  ('annex','6', 'Standard','3x3m',1500.00,'occupied'),
  ('annex','7', 'Standard','3x3m',1500.00,'available'),
  ('annex','8', 'Standard','3x3m',1500.00,'occupied'),
  ('annex','9', 'Standard','3x3m',1500.00,'available'),
  ('annex','10','Standard','3x3m',1500.00,'occupied'),
  ('annex','11','Standard','3x3m',1500.00,'available'),
  ('annex','12','Corner',  '4x4m',1800.00,'occupied'),

  -- ── ANNEX GROUND FLOOR – bottom left (35–39) ─────────────────────────
  ('annex','35','Standard','3x3m',1500.00,'available'),
  ('annex','36','Standard','3x3m',1500.00,'occupied'),
  ('annex','37','Standard','3x3m',1500.00,'available'),
  ('annex','38','Standard','3x3m',1500.00,'occupied'),
  ('annex','39','Standard','3x3m',1500.00,'available'),

  -- ── ANNEX GROUND FLOOR – right wing (40–62) ──────────────────────────
  ('annex','40','Standard','3x3m',1500.00,'occupied'),
  ('annex','41','Standard','3x3m',1500.00,'available'),
  ('annex','42','Standard','3x3m',1500.00,'occupied'),
  ('annex','43','Standard','3x3m',1500.00,'available'),
  ('annex','44','Standard','3x3m',1500.00,'occupied'),
  ('annex','45','Standard','3x3m',1500.00,'available'),
  ('annex','46','Standard','3x3m',1500.00,'occupied'),
  ('annex','47','Standard','3x3m',1500.00,'available'),
  ('annex','48','Standard','3x3m',1500.00,'occupied'),
  ('annex','49','Standard','3x3m',1500.00,'available'),
  ('annex','50','Standard','3x3m',1500.00,'occupied'),
  ('annex','51','Standard','3x3m',1500.00,'available'),
  ('annex','52','Standard','3x3m',1500.00,'occupied'),
  ('annex','53','Standard','3x3m',1500.00,'available'),
  ('annex','54','Standard','3x3m',1500.00,'occupied'),
  ('annex','55','Standard','3x3m',1500.00,'available'),
  ('annex','56','Standard','3x3m',1500.00,'occupied'),
  ('annex','57','Standard','3x3m',1500.00,'available'),
  ('annex','58','Standard','3x3m',1500.00,'occupied'),
  ('annex','59','Standard','3x3m',1500.00,'available'),
  ('annex','60','Standard','3x3m',1500.00,'occupied'),
  ('annex','61','Standard','3x3m',1500.00,'available'),
  ('annex','62','Corner',  '4x4m',1800.00,'occupied'),

  -- ── ANNEX GROUND FLOOR – center rows (100–120) ───────────────────────
  ('annex','100','Standard','3x3m',1500.00,'available'),
  ('annex','101','Standard','3x3m',1500.00,'occupied'),
  ('annex','102','Standard','3x3m',1500.00,'available'),
  ('annex','103','Standard','3x3m',1500.00,'occupied'),
  ('annex','104','Standard','3x3m',1500.00,'available'),
  ('annex','105','Standard','3x3m',1500.00,'occupied'),
  ('annex','106','Standard','3x3m',1500.00,'available'),
  ('annex','107','Standard','3x3m',1500.00,'occupied'),
  ('annex','108','Standard','3x3m',1500.00,'available'),
  ('annex','109','Standard','3x3m',1500.00,'occupied'),
  ('annex','110','Standard','3x3m',1500.00,'available'),
  ('annex','111','Standard','3x3m',1500.00,'occupied'),
  ('annex','112','Standard','3x3m',1500.00,'available'),
  ('annex','113','Standard','3x3m',1500.00,'occupied'),
  ('annex','114','Standard','3x3m',1500.00,'available'),
  ('annex','115','Standard','3x3m',1500.00,'occupied'),
  ('annex','116','Standard','3x3m',1500.00,'available'),
  ('annex','117','Standard','3x3m',1500.00,'occupied'),
  ('annex','118','Standard','3x3m',1500.00,'available'),
  ('annex','119','Standard','3x3m',1500.00,'occupied'),
  ('annex','120','Standard','3x3m',1500.00,'available'),

  -- ── ANNEX GROUND FLOOR – bottom row (240–248) ────────────────────────
  ('annex','240','Standard','3x3m',1500.00,'available'),
  ('annex','241','Standard','3x3m',1500.00,'occupied'),
  ('annex','242','Standard','3x3m',1500.00,'available'),
  ('annex','243','Standard','3x3m',1500.00,'occupied'),
  ('annex','244','Standard','3x3m',1500.00,'available'),
  ('annex','245','Standard','3x3m',1500.00,'occupied'),
  ('annex','246','Standard','3x3m',1500.00,'available'),
  ('annex','247','Standard','3x3m',1500.00,'occupied'),
  ('annex','248','Standard','3x3m',1500.00,'available'),

  -- ── ANNEX SECOND FLOOR – left wing (13–24) ───────────────────────────
  ('second_floor','13','Standard','3x3m',1400.00,'available'),
  ('second_floor','14','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','15','Standard','3x3m',1400.00,'available'),
  ('second_floor','16','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','17','Standard','3x3m',1400.00,'available'),
  ('second_floor','18','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','19','Standard','3x3m',1400.00,'available'),
  ('second_floor','20','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','21','Standard','3x3m',1400.00,'available'),
  ('second_floor','22','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','23','Standard','3x3m',1400.00,'available'),
  ('second_floor','24','Corner', '4x4m',1700.00,'occupied'),

  -- ── ANNEX SECOND FLOOR – right wing (63–86) ──────────────────────────
  ('second_floor','63','Standard','3x3m',1400.00,'available'),
  ('second_floor','64','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','65','Standard','3x3m',1400.00,'available'),
  ('second_floor','66','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','67','Standard','3x3m',1400.00,'available'),
  ('second_floor','68','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','69','Standard','3x3m',1400.00,'available'),
  ('second_floor','70','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','71','Standard','3x3m',1400.00,'available'),
  ('second_floor','72','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','73','Standard','3x3m',1400.00,'available'),
  ('second_floor','74','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','75','Standard','3x3m',1400.00,'available'),
  ('second_floor','76','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','77','Standard','3x3m',1400.00,'available'),
  ('second_floor','78','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','79','Standard','3x3m',1400.00,'available'),
  ('second_floor','80','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','81','Standard','3x3m',1400.00,'available'),
  ('second_floor','82','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','83','Standard','3x3m',1400.00,'available'),
  ('second_floor','84','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','85','Standard','3x3m',1400.00,'available'),
  ('second_floor','86','Corner', '4x4m',1700.00,'occupied'),

  -- ── ANNEX SECOND FLOOR – bottom row (249–258) ────────────────────────
  ('second_floor','249','Standard','3x3m',1400.00,'available'),
  ('second_floor','250','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','251','Standard','3x3m',1400.00,'available'),
  ('second_floor','252','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','253','Standard','3x3m',1400.00,'available'),
  ('second_floor','254','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','255','Standard','3x3m',1400.00,'available'),
  ('second_floor','256','Standard','3x3m',1400.00,'occupied'),
  ('second_floor','257','Standard','3x3m',1400.00,'available'),
  ('second_floor','258','Standard','3x3m',1400.00,'occupied'),

  -- ── MIXED SECTION (359–561) ──────────────────────────────────────────
  ('mixed','359','Standard','3x2m',1300.00,'available'),
  ('mixed','360','Standard','3x2m',1300.00,'occupied'),
  ('mixed','361','Standard','3x2m',1300.00,'available'),
  ('mixed','362','Standard','3x2m',1300.00,'occupied'),
  ('mixed','363','Standard','3x2m',1300.00,'available'),
  ('mixed','364','Standard','3x2m',1300.00,'occupied'),
  ('mixed','365','Standard','3x2m',1300.00,'available'),
  ('mixed','366','Standard','3x2m',1300.00,'occupied'),
  ('mixed','367','Standard','3x2m',1300.00,'available'),
  ('mixed','368','Standard','3x2m',1300.00,'occupied'),
  ('mixed','369','Standard','3x2m',1300.00,'available'),
  ('mixed','370','Corner',  '4x3m',1600.00,'occupied'),
  ('mixed','371','Standard','3x2m',1300.00,'available'),
  ('mixed','372','Standard','3x2m',1300.00,'occupied'),
  ('mixed','373','Standard','3x2m',1300.00,'available'),
  ('mixed','374','Standard','3x2m',1300.00,'occupied'),
  ('mixed','375','Standard','3x2m',1300.00,'available'),
  ('mixed','376','Standard','3x2m',1300.00,'occupied'),
  ('mixed','377','Standard','3x2m',1300.00,'available'),
  ('mixed','378','Standard','3x2m',1300.00,'occupied'),
  ('mixed','379','Standard','3x2m',1300.00,'available'),
  ('mixed','380','Standard','3x2m',1300.00,'occupied'),
  ('mixed','381','Standard','3x2m',1300.00,'available'),
  ('mixed','382','Standard','3x2m',1300.00,'occupied'),
  ('mixed','383','Standard','3x2m',1300.00,'available'),
  ('mixed','384','Standard','3x2m',1300.00,'occupied'),
  ('mixed','385','Standard','3x2m',1300.00,'available'),
  ('mixed','386','Standard','3x2m',1300.00,'occupied'),
  ('mixed','387','Standard','3x2m',1300.00,'available'),
  ('mixed','388','Standard','3x2m',1300.00,'occupied'),
  ('mixed','389','Standard','3x2m',1300.00,'available'),
  ('mixed','390','Standard','3x2m',1300.00,'occupied'),
  ('mixed','391','Standard','3x2m',1300.00,'available'),
  ('mixed','392','Standard','3x2m',1300.00,'occupied'),
  ('mixed','393','Standard','3x2m',1300.00,'available'),
  ('mixed','394','Standard','3x2m',1300.00,'occupied'),
  ('mixed','395','Standard','3x2m',1300.00,'available'),
  ('mixed','396','Standard','3x2m',1300.00,'occupied'),
  ('mixed','397','Standard','3x2m',1300.00,'available'),
  ('mixed','398','Standard','3x2m',1300.00,'occupied'),
  ('mixed','399','Standard','3x2m',1300.00,'available'),
  ('mixed','400','Standard','3x2m',1300.00,'occupied'),
  ('mixed','401','Standard','3x2m',1300.00,'available'),
  ('mixed','402','Standard','3x2m',1300.00,'occupied'),
  ('mixed','403','Standard','3x2m',1300.00,'available'),
  ('mixed','404','Standard','3x2m',1300.00,'occupied'),
  ('mixed','405','Standard','3x2m',1300.00,'available'),
  ('mixed','406','Standard','3x2m',1300.00,'occupied'),
  ('mixed','407','Standard','3x2m',1300.00,'available'),
  ('mixed','408','Standard','3x2m',1300.00,'occupied'),
  ('mixed','409','Standard','3x2m',1300.00,'available'),
  ('mixed','410','Standard','3x2m',1300.00,'occupied'),
  ('mixed','411','Standard','3x2m',1300.00,'available'),
  ('mixed','412','Standard','3x2m',1300.00,'occupied'),
  ('mixed','413','Standard','3x2m',1300.00,'available'),
  ('mixed','414','Standard','3x2m',1300.00,'occupied'),
  ('mixed','415','Standard','3x2m',1300.00,'available'),
  ('mixed','416','Standard','3x2m',1300.00,'occupied'),
  ('mixed','417','Standard','3x2m',1300.00,'available'),
  ('mixed','418','Standard','3x2m',1300.00,'occupied'),
  ('mixed','419','Standard','3x2m',1300.00,'available'),
  ('mixed','420','Standard','3x2m',1300.00,'occupied'),
  ('mixed','421','Standard','3x2m',1300.00,'available'),
  ('mixed','422','Standard','3x2m',1300.00,'occupied'),
  ('mixed','423','Standard','3x2m',1300.00,'available'),
  ('mixed','424','Standard','3x2m',1300.00,'occupied'),
  ('mixed','425','Standard','3x2m',1300.00,'available'),
  ('mixed','426','Standard','3x2m',1300.00,'occupied'),
  ('mixed','427','Standard','3x2m',1300.00,'available'),
  ('mixed','428','Standard','3x2m',1300.00,'occupied'),
  ('mixed','429','Standard','3x2m',1300.00,'available'),
  ('mixed','430','Standard','3x2m',1300.00,'occupied'),
  ('mixed','431','Standard','3x2m',1300.00,'available'),
  ('mixed','432','Standard','3x2m',1300.00,'occupied'),
  ('mixed','433','Standard','3x2m',1300.00,'available'),
  ('mixed','434','Standard','3x2m',1300.00,'occupied'),
  ('mixed','435','Standard','3x2m',1300.00,'available'),
  ('mixed','436','Standard','3x2m',1300.00,'occupied'),
  ('mixed','437','Standard','3x2m',1300.00,'available'),
  ('mixed','438','Standard','3x2m',1300.00,'occupied'),
  ('mixed','439','Standard','3x2m',1300.00,'available'),
  ('mixed','440','Standard','3x2m',1300.00,'occupied'),
  ('mixed','441','Standard','3x2m',1300.00,'available'),
  ('mixed','442','Standard','3x2m',1300.00,'occupied'),
  ('mixed','443','Standard','3x2m',1300.00,'available'),
  ('mixed','444','Standard','3x2m',1300.00,'occupied'),
  ('mixed','445','Standard','3x2m',1300.00,'available'),
  ('mixed','446','Standard','3x2m',1300.00,'occupied'),
  ('mixed','447','Standard','3x2m',1300.00,'available'),
  ('mixed','448','Standard','3x2m',1300.00,'occupied'),
  ('mixed','449','Standard','3x2m',1300.00,'available'),
  ('mixed','450','Standard','3x2m',1300.00,'occupied'),
  ('mixed','451','Standard','3x2m',1300.00,'available'),
  ('mixed','452','Standard','3x2m',1300.00,'occupied'),
  ('mixed','453','Standard','3x2m',1300.00,'available'),
  ('mixed','454','Standard','3x2m',1300.00,'occupied'),
  ('mixed','455','Standard','3x2m',1300.00,'available'),
  ('mixed','456','Standard','3x2m',1300.00,'occupied'),
  ('mixed','457','Standard','3x2m',1300.00,'available'),
  ('mixed','458','Standard','3x2m',1300.00,'occupied'),
  ('mixed','459','Standard','3x2m',1300.00,'available'),
  ('mixed','460','Standard','3x2m',1300.00,'occupied'),
  ('mixed','461','Standard','3x2m',1300.00,'available'),
  ('mixed','462','Standard','3x2m',1300.00,'occupied'),
  ('mixed','463','Standard','3x2m',1300.00,'available'),
  ('mixed','464','Standard','3x2m',1300.00,'occupied'),
  ('mixed','465','Standard','3x2m',1300.00,'available'),
  ('mixed','466','Standard','3x2m',1300.00,'occupied'),
  ('mixed','467','Standard','3x2m',1300.00,'available'),
  ('mixed','468','Standard','3x2m',1300.00,'occupied'),
  ('mixed','469','Standard','3x2m',1300.00,'available'),
  ('mixed','470','Standard','3x2m',1300.00,'occupied'),
  ('mixed','471','Standard','3x2m',1300.00,'available'),
  ('mixed','472','Standard','3x2m',1300.00,'occupied'),
  ('mixed','473','Standard','3x2m',1300.00,'available'),
  ('mixed','474','Standard','3x2m',1300.00,'occupied'),
  ('mixed','475','Standard','3x2m',1300.00,'available'),
  ('mixed','476','Standard','3x2m',1300.00,'occupied'),
  ('mixed','477','Standard','3x2m',1300.00,'available'),
  ('mixed','478','Standard','3x2m',1300.00,'occupied'),
  ('mixed','479','Standard','3x2m',1300.00,'available'),
  ('mixed','480','Standard','3x2m',1300.00,'occupied'),
  ('mixed','481','Standard','3x2m',1300.00,'available'),
  ('mixed','482','Standard','3x2m',1300.00,'occupied'),
  ('mixed','483','Standard','3x2m',1300.00,'available'),
  ('mixed','484','Standard','3x2m',1300.00,'occupied'),
  ('mixed','485','Standard','3x2m',1300.00,'available'),
  ('mixed','486','Standard','3x2m',1300.00,'occupied'),
  ('mixed','487','Standard','3x2m',1300.00,'available'),
  ('mixed','488','Standard','3x2m',1300.00,'occupied'),
  ('mixed','489','Standard','3x2m',1300.00,'available'),
  ('mixed','490','Standard','3x2m',1300.00,'occupied'),
  ('mixed','491','Standard','3x2m',1300.00,'available'),
  ('mixed','492','Standard','3x2m',1300.00,'occupied'),
  ('mixed','493','Standard','3x2m',1300.00,'available'),
  ('mixed','494','Standard','3x2m',1300.00,'occupied'),
  ('mixed','495','Standard','3x2m',1300.00,'available'),
  ('mixed','496','Standard','3x2m',1300.00,'occupied'),
  ('mixed','497','Standard','3x2m',1300.00,'available'),
  ('mixed','498','Standard','3x2m',1300.00,'occupied'),
  ('mixed','499','Standard','3x2m',1300.00,'available'),
  ('mixed','500','Standard','3x2m',1300.00,'occupied'),
  ('mixed','501','Standard','3x2m',1300.00,'available'),
  ('mixed','502','Standard','3x2m',1300.00,'occupied'),
  ('mixed','503','Standard','3x2m',1300.00,'available'),
  ('mixed','504','Standard','3x2m',1300.00,'occupied'),
  ('mixed','505','Standard','3x2m',1300.00,'available'),
  ('mixed','506','Standard','3x2m',1300.00,'occupied'),
  ('mixed','507','Standard','3x2m',1300.00,'available'),
  ('mixed','508','Standard','3x2m',1300.00,'occupied'),
  ('mixed','509','Standard','3x2m',1300.00,'available'),
  ('mixed','510','Standard','3x2m',1300.00,'occupied'),
  ('mixed','511','Standard','3x2m',1300.00,'available'),
  ('mixed','512','Standard','3x2m',1300.00,'occupied'),
  ('mixed','513','Standard','3x2m',1300.00,'available'),
  ('mixed','514','Standard','3x2m',1300.00,'occupied'),
  ('mixed','515','Standard','3x2m',1300.00,'available'),
  ('mixed','516','Standard','3x2m',1300.00,'occupied'),
  ('mixed','517','Standard','3x2m',1300.00,'available'),
  ('mixed','518','Standard','3x2m',1300.00,'occupied'),
  ('mixed','519','Standard','3x2m',1300.00,'available'),
  ('mixed','520','Standard','3x2m',1300.00,'occupied'),
  ('mixed','521','Standard','3x2m',1300.00,'available'),
  ('mixed','522','Standard','3x2m',1300.00,'occupied'),
  ('mixed','523','Standard','3x2m',1300.00,'available'),
  ('mixed','524','Standard','3x2m',1300.00,'occupied'),
  ('mixed','525','Standard','3x2m',1300.00,'available'),
  ('mixed','526','Standard','3x2m',1300.00,'occupied'),
  ('mixed','527','Standard','3x2m',1300.00,'available'),
  ('mixed','528','Standard','3x2m',1300.00,'occupied'),
  ('mixed','529','Standard','3x2m',1300.00,'available'),
  ('mixed','530','Standard','3x2m',1300.00,'occupied'),
  ('mixed','531','Standard','3x2m',1300.00,'available'),
  ('mixed','532','Standard','3x2m',1300.00,'occupied'),
  ('mixed','533','Standard','3x2m',1300.00,'available'),
  ('mixed','534','Standard','3x2m',1300.00,'occupied'),
  ('mixed','535','Standard','3x2m',1300.00,'available'),
  ('mixed','536','Standard','3x2m',1300.00,'occupied'),
  ('mixed','537','Standard','3x2m',1300.00,'available'),
  ('mixed','538','Standard','3x2m',1300.00,'occupied'),
  ('mixed','539','Standard','3x2m',1300.00,'available'),
  ('mixed','540','Standard','3x2m',1300.00,'occupied'),
  ('mixed','541','Standard','3x2m',1300.00,'available'),
  ('mixed','542','Standard','3x2m',1300.00,'occupied'),
  ('mixed','543','Standard','3x2m',1300.00,'available'),
  ('mixed','544','Standard','3x2m',1300.00,'occupied'),
  ('mixed','545','Standard','3x2m',1300.00,'available'),
  ('mixed','546','Standard','3x2m',1300.00,'occupied'),
  ('mixed','547','Standard','3x2m',1300.00,'available'),
  ('mixed','548','Standard','3x2m',1300.00,'occupied'),
  ('mixed','549','Standard','3x2m',1300.00,'available'),
  ('mixed','550','Standard','3x2m',1300.00,'occupied'),
  ('mixed','551','Standard','3x2m',1300.00,'available'),
  ('mixed','552','Standard','3x2m',1300.00,'occupied'),
  ('mixed','553','Standard','3x2m',1300.00,'available'),
  ('mixed','554','Standard','3x2m',1300.00,'occupied'),
  ('mixed','555','Standard','3x2m',1300.00,'available'),
  ('mixed','556','Standard','3x2m',1300.00,'occupied'),
  ('mixed','557','Standard','3x2m',1300.00,'available'),
  ('mixed','558','Standard','3x2m',1300.00,'occupied'),
  ('mixed','559','Standard','3x2m',1300.00,'available'),
  ('mixed','560','Standard','3x2m',1300.00,'occupied'),
  ('mixed','561','Standard','3x2m',1300.00,'available')

) as v(section_code, stall_number, stall_type, size_label, monthly_rate, status)
  on s.code = v.section_code
on conflict (section_id, stall_number) do nothing;

-- -------------------------------------------------------
-- 7. Applications
-- -------------------------------------------------------
with v1 as (select id from public.vendors where profile_id = (select id from public.profiles where email = 'vendor@culasi.gov.ph')),
     stall_ref as (select id from public.stalls where stall_number = '562'),
     reviewer  as (select id from public.profiles where email = 'admin@culasi.gov.ph')
insert into public.applications
  (vendor_id, preferred_stall_id, application_type, business_type, preferred_section, preferred_stall_type,
   status, submitted_at, reviewed_by, reviewed_at, remarks)
select v1.id, stall_ref.id, 'online', 'Dry Goods', 'dry_goods', 'Standard',
  'assigned', now() - interval '60 days', reviewer.id, now() - interval '55 days',
  'Approved and stall assigned. Documents complete.'
from v1, stall_ref, reviewer
where not exists (select 1 from public.applications a where a.vendor_id = v1.id);

with v2 as (select id from public.vendors where profile_id = (select id from public.profiles where email = 'vendor2@culasi.gov.ph')),
     stall_ref as (select id from public.stalls where stall_number = '670'),
     reviewer  as (select id from public.profiles where email = 'admin@culasi.gov.ph')
insert into public.applications
  (vendor_id, preferred_stall_id, application_type, business_type, preferred_section, preferred_stall_type,
   status, submitted_at, reviewed_by, reviewed_at, remarks)
select v2.id, stall_ref.id, 'online', 'Fish/Seafood', 'wet_market', 'Standard',
  'assigned', now() - interval '45 days', reviewer.id, now() - interval '40 days',
  'Approved. Health clearance verified.'
from v2, stall_ref, reviewer
where not exists (select 1 from public.applications a where a.vendor_id = v2.id);

with v3 as (select id from public.vendors where profile_id = (select id from public.profiles where email = 'vendor3@culasi.gov.ph')),
     stall_ref as (select id from public.stalls where stall_number = '359'),
     reviewer  as (select id from public.profiles where email = 'admin@culasi.gov.ph')
insert into public.applications
  (vendor_id, preferred_stall_id, application_type, business_type, preferred_section, preferred_stall_type,
   status, submitted_at, reviewed_by, reviewed_at, remarks)
select v3.id, stall_ref.id, 'walk_in', 'Dry Goods', 'mixed', 'Standard',
  'active', now() - interval '90 days', reviewer.id, now() - interval '85 days',
  'Walk-in application. All requirements satisfied.'
from v3, stall_ref, reviewer
where not exists (select 1 from public.applications a where a.vendor_id = v3.id);

with v4 as (select id from public.vendors where profile_id = (select id from public.profiles where email = 'vendor4@culasi.gov.ph'))
insert into public.applications
  (vendor_id, application_type, business_type, preferred_section, preferred_stall_type, status, submitted_at)
select v4.id, 'online', 'Meat/Poultry', 'wet_market', 'Standard',
  'under_review', now() - interval '5 days'
from v4
where not exists (select 1 from public.applications a where a.vendor_id = v4.id);

with v5 as (select id from public.vendors where profile_id = (select id from public.profiles where email = 'vendor5@culasi.gov.ph'))
insert into public.applications
  (vendor_id, application_type, business_type, preferred_section, preferred_stall_type, status)
select v5.id, 'online', 'General Merchandise', 'dry_goods', 'Standard', 'draft'
from v5
where not exists (select 1 from public.applications a where a.vendor_id = v5.id);

-- -------------------------------------------------------
-- 8. Leases
-- -------------------------------------------------------
insert into public.leases
  (vendor_id, stall_id, start_date, end_date, monthly_rate, status, renewal_status, created_by)
select v.id, st.id,
  (current_date - interval '60 days')::date,
  (current_date + interval '305 days')::date,
  1800.00, 'active', 'not_due',
  (select id from public.profiles where email = 'admin@culasi.gov.ph')
from public.vendors v
join public.stalls st on st.stall_number = '562'
where v.profile_id = (select id from public.profiles where email = 'vendor@culasi.gov.ph')
  and not exists (select 1 from public.leases l where l.vendor_id = v.id);

insert into public.leases
  (vendor_id, stall_id, start_date, end_date, monthly_rate, status, renewal_status, created_by)
select v.id, st.id,
  (current_date - interval '45 days')::date,
  (current_date + interval '320 days')::date,
  1800.00, 'active', 'not_due',
  (select id from public.profiles where email = 'admin@culasi.gov.ph')
from public.vendors v
join public.stalls st on st.stall_number = '670'
where v.profile_id = (select id from public.profiles where email = 'vendor2@culasi.gov.ph')
  and not exists (select 1 from public.leases l where l.vendor_id = v.id);

insert into public.leases
  (vendor_id, stall_id, start_date, end_date, monthly_rate, status, renewal_status, created_by)
select v.id, st.id,
  (current_date - interval '335 days')::date,
  (current_date + interval '30 days')::date,
  1300.00, 'active', 'due_soon',
  (select id from public.profiles where email = 'admin@culasi.gov.ph')
from public.vendors v
join public.stalls st on st.stall_number = '359'
where v.profile_id = (select id from public.profiles where email = 'vendor3@culasi.gov.ph')
  and not exists (select 1 from public.leases l where l.vendor_id = v.id);

-- -------------------------------------------------------
-- 9. Billings
-- -------------------------------------------------------
insert into public.billings (lease_id, billing_month, amount_due, due_date)
select l.id,
  date_trunc('month', current_date - (n || ' months')::interval)::date,
  l.monthly_rate,
  (date_trunc('month', current_date - (n || ' months')::interval) + interval '10 days')::date
from public.leases l
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
cross join generate_series(0, 2) as n
where p.email = 'vendor@culasi.gov.ph' and l.status = 'active'
on conflict do nothing;

insert into public.billings (lease_id, billing_month, amount_due, due_date)
select l.id,
  date_trunc('month', current_date - (n || ' months')::interval)::date,
  l.monthly_rate,
  (date_trunc('month', current_date - (n || ' months')::interval) + interval '10 days')::date
from public.leases l
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
cross join generate_series(0, 1) as n
where p.email = 'vendor2@culasi.gov.ph' and l.status = 'active'
on conflict do nothing;

insert into public.billings (lease_id, billing_month, amount_due, due_date)
select l.id,
  date_trunc('month', current_date - (n || ' months')::interval)::date,
  l.monthly_rate,
  (date_trunc('month', current_date - (n || ' months')::interval) + interval '10 days')::date
from public.leases l
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
cross join generate_series(0, 10) as n
where p.email = 'vendor3@culasi.gov.ph' and l.status = 'active'
on conflict do nothing;

-- -------------------------------------------------------
-- 10. Payments
-- -------------------------------------------------------
insert into public.payments
  (billing_id, vendor_id, amount, payment_date, payment_method, receipt_number, submitted_by_vendor, recorded_by)
select b.id, v.id, b.amount_due,
  b.billing_month + interval '7 days', 'gcash',
  'RCP-' || to_char(b.billing_month, 'YYYYMM') || '-' || substring(v.id::text, 1, 4),
  false, (select id from public.profiles where email = 'finance@culasi.gov.ph')
from public.billings b
join public.leases l on l.id = b.lease_id
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
where p.email = 'vendor@culasi.gov.ph'
  and b.billing_month < date_trunc('month', current_date)
  and not exists (select 1 from public.payments py where py.billing_id = b.id);

insert into public.payments
  (billing_id, vendor_id, amount, payment_date, payment_method, receipt_number, submitted_by_vendor, recorded_by)
select b.id, v.id, b.amount_due,
  b.billing_month + interval '5 days', 'cash',
  'RCP-' || to_char(b.billing_month, 'YYYYMM') || '-' || substring(v.id::text, 1, 4),
  false, (select id from public.profiles where email = 'finance@culasi.gov.ph')
from public.billings b
join public.leases l on l.id = b.lease_id
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
where p.email = 'vendor2@culasi.gov.ph'
  and b.billing_month < date_trunc('month', current_date)
  and not exists (select 1 from public.payments py where py.billing_id = b.id);

insert into public.payments
  (billing_id, vendor_id, amount, payment_date, payment_method, receipt_number, submitted_by_vendor, recorded_by)
select b.id, v.id,
  case
    when b.billing_month = date_trunc('month', current_date - interval '3 months')::date
    then b.amount_due * 0.5
    else b.amount_due
  end,
  b.billing_month + interval '8 days', 'bank_transfer',
  'RCP-' || to_char(b.billing_month, 'YYYYMM') || '-' || substring(v.id::text, 1, 4),
  false, (select id from public.profiles where email = 'finance@culasi.gov.ph')
from public.billings b
join public.leases l on l.id = b.lease_id
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
where p.email = 'vendor3@culasi.gov.ph'
  and b.billing_month < date_trunc('month', current_date)
  and not exists (select 1 from public.payments py where py.billing_id = b.id);

-- -------------------------------------------------------
-- 11. Violations
-- -------------------------------------------------------
insert into public.violations
  (vendor_id, stall_id, category, description, violation_date, penalty_amount, status, action_taken, recorded_by)
select v.id, st.id,
  'Cleanliness', 'Stall area not cleaned after market hours.',
  (current_date - interval '20 days')::date, 250.00,
  'resolved', 'Issued written warning; vendor complied next day.',
  (select id from public.profiles where email = 'admin@culasi.gov.ph')
from public.vendors v
join public.profiles p on p.id = v.profile_id
join public.stalls st on st.stall_number = '359'
where p.email = 'vendor3@culasi.gov.ph'
  and not exists (select 1 from public.violations vl where vl.vendor_id = v.id);

-- -------------------------------------------------------
-- 14. Notifications
-- -------------------------------------------------------
insert into public.notifications (user_id, title, message, type, is_read, link)
select p.id,
  'Application Approved',
  'Your stall application has been approved. Please coordinate with the market office to sign your lease.',
  'application_approved', false, '/vendor/applications'
from public.profiles p
where p.email = 'vendor@culasi.gov.ph'
  and not exists (select 1 from public.notifications n where n.user_id = p.id and n.type = 'application_approved');

insert into public.notifications (user_id, title, message, type, is_read, link)
select p.id,
  'Lease Renewal Due Soon',
  'Your lease expires in approximately 30 days. Please submit a renewal request.',
  'lease_due_soon', false, '/vendor/lease'
from public.profiles p
where p.email = 'vendor3@culasi.gov.ph'
  and not exists (select 1 from public.notifications n where n.user_id = p.id and n.type = 'lease_due_soon');

insert into public.notifications (user_id, title, message, type, is_read, link)
select p.id,
  'New Application Submitted',
  'Vendor Rodrigo Banes submitted a new stall application. Please review.',
  'new_application', false, '/admin/applications'
from public.profiles p
where p.email = 'admin@culasi.gov.ph'
  and not exists (select 1 from public.notifications n where n.user_id = p.id and n.type = 'new_application');

-- -------------------------------------------------------
-- 15. System settings
-- -------------------------------------------------------
insert into public.system_settings (key, value) values
  ('market_name',       '"Culasi Public Market"'),
  ('late_penalty_rate', '0.05'),
  ('billing_due_day',   '10'),
  ('lease_term_months', '12')
on conflict (key) do nothing;
