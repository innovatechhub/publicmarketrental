-- Add vendor_id directly to billings so records can be created without a leases table
alter table public.billings
  add column if not exists vendor_id uuid references public.vendors(id) on delete cascade;

-- Make lease_id optional since we're moving to vendor_id
alter table public.billings
  alter column lease_id drop not null;

-- Create index for vendor-based billing lookups
create index if not exists idx_billings_vendor_id on public.billings(vendor_id);

-- Update RLS policy to allow vendor access via vendor_id (no leases table required)
drop policy if exists "billings_select_owner_or_back_office" on public.billings;

create policy "billings_select_owner_or_back_office" on public.billings
for select using (
  exists (
    select 1
    from public.vendors v
    where v.id = vendor_id
      and v.profile_id = auth.uid()
  )
  or public.is_back_office()
);
