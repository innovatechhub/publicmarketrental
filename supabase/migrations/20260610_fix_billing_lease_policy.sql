drop policy if exists "billings_select_owner_or_back_office" on public.billings;

create policy "billings_select_owner_or_back_office" on public.billings
for select using (
  exists (
    select 1
    from public.leases l
    join public.vendors v on v.id = l.vendor_id
    where l.id = lease_id
      and v.profile_id = auth.uid()
  )
  or public.is_back_office()
);
