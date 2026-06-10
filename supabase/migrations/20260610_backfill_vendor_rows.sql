-- Backfill missing vendor records for existing vendor profiles.
-- This is idempotent and only inserts rows that do not already exist.
insert into public.vendors (profile_id, business_name, business_type, address)
select
  p.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'business_name', ''), p.full_name, 'New Vendor'),
  nullif(u.raw_user_meta_data ->> 'business_type', ''),
  nullif(u.raw_user_meta_data ->> 'address', '')
from public.profiles p
left join public.vendors v
  on v.profile_id = p.id
left join auth.users u
  on u.id = p.id
where p.role = 'vendor'::public.user_role
  and v.id is null
on conflict (profile_id) do update
set
  business_name = excluded.business_name,
  business_type = coalesce(excluded.business_type, public.vendors.business_type),
  address = coalesce(excluded.address, public.vendors.address);
