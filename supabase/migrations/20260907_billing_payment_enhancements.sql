-- Billing, penalties, payment verification, advance payments, proof uploads, and read receipts.

alter table public.billings
  add column if not exists base_amount numeric(12,2);

update public.billings
set base_amount = greatest(coalesce(amount_due, 0), 0)
where base_amount is null;

alter table public.billings
  alter column base_amount set default 0,
  alter column base_amount set not null;

create unique index if not exists uq_billings_vendor_month
  on public.billings(vendor_id, billing_month)
  where vendor_id is not null;

alter table public.violations
  add column if not exists billing_id uuid references public.billings(id) on delete set null;

create index if not exists idx_violations_billing_id on public.violations(billing_id);

alter table public.payments
  add column if not exists verification_status text not null default 'pending',
  add column if not exists proof_path text,
  add column if not exists payment_group_id uuid not null default gen_random_uuid(),
  add column if not exists internal_reference text,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists rejection_reason text;

update public.payments
set
  verification_status = 'verified',
  verified_at = coalesce(updated_at, created_at),
  internal_reference = coalesce(internal_reference, 'PAY-' || to_char(created_at, 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 8)))
where verification_status = 'pending';

alter table public.payments
  alter column internal_reference set default ('PAY-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  alter column internal_reference set not null;

alter table public.payments drop constraint if exists payments_verification_status_check;
alter table public.payments
  add constraint payments_verification_status_check
  check (verification_status in ('pending', 'verified', 'rejected', 'voided'));

create unique index if not exists uq_payments_internal_reference on public.payments(internal_reference);
create index if not exists idx_payments_verification_status on public.payments(verification_status, payment_date desc);
create index if not exists idx_payments_group_id on public.payments(payment_group_id);

alter table public.notifications
  add column if not exists read_at timestamptz;

update public.notifications set read_at = created_at where is_read and read_at is null;

create or replace function public.apply_billing_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.base_amount = greatest(coalesce(new.base_amount, 0), 0);
  new.penalties = greatest(coalesce(new.penalties, 0), 0);
  new.amount_due = new.base_amount + new.penalties;
  new.amount_paid = greatest(coalesce(new.amount_paid, 0), 0);
  new.status = case
    when new.amount_paid >= new.amount_due then 'paid'::public.billing_status
    when new.amount_paid > 0 then 'partial'::public.billing_status
    when new.due_date < current_date then 'overdue'::public.billing_status
    else 'unpaid'::public.billing_status
  end;
  return new;
end;
$$;

create or replace function public.sync_billing_totals_from_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_billing_id uuid;
  old_billing_id uuid;
  paid_total numeric(12,2);
begin
  target_billing_id := case when tg_op = 'DELETE' then old.billing_id else new.billing_id end;
  old_billing_id := case when tg_op = 'UPDATE' then old.billing_id else null end;

  select coalesce(sum(amount), 0) into paid_total
  from public.payments
  where billing_id = target_billing_id and verification_status = 'verified';
  update public.billings set amount_paid = paid_total where id = target_billing_id;

  if old_billing_id is not null and old_billing_id is distinct from target_billing_id then
    select coalesce(sum(amount), 0) into paid_total
    from public.payments
    where billing_id = old_billing_id and verification_status = 'verified';
    update public.billings set amount_paid = paid_total where id = old_billing_id;
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.link_violation_to_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_month date := date_trunc('month', new.violation_date)::date;
  target_rate numeric(12,2);
  target_due_date date;
begin
  select monthly_rate into target_rate
  from public.stalls
  where vendor_id = new.vendor_id and status = 'occupied'
  order by updated_at desc
  limit 1;

  target_due_date := (target_month + interval '1 month - 1 day')::date;
  insert into public.billings (vendor_id, billing_month, base_amount, amount_due, due_date, penalties, notes)
  values (new.vendor_id, target_month, coalesce(target_rate, 0), coalesce(target_rate, 0), target_due_date, 0, 'Generated from violation billing')
  on conflict (vendor_id, billing_month) where vendor_id is not null do nothing;

  select id into new.billing_id
  from public.billings
  where vendor_id = new.vendor_id and billing_month = target_month;
  return new;
end;
$$;

create or replace function public.recalculate_violation_penalties()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  prior_id uuid;
begin
  target_id := case when tg_op = 'DELETE' then old.billing_id else new.billing_id end;
  prior_id := case when tg_op = 'UPDATE' then old.billing_id else null end;
  update public.billings b
  set penalties = coalesce((select sum(v.penalty_amount) from public.violations v where v.billing_id = b.id and v.status <> 'cancelled'), 0)
  where b.id = target_id;
  if prior_id is not null and prior_id is distinct from target_id then
    update public.billings b
    set penalties = coalesce((select sum(v.penalty_amount) from public.violations v where v.billing_id = b.id and v.status <> 'cancelled'), 0)
    where b.id = prior_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists link_violation_to_billing_before_write on public.violations;
create trigger link_violation_to_billing_before_write
before insert or update of vendor_id, violation_date on public.violations
for each row execute function public.link_violation_to_billing();

drop trigger if exists recalculate_violation_penalties_after_write on public.violations;
create trigger recalculate_violation_penalties_after_write
after insert or update or delete on public.violations
for each row execute function public.recalculate_violation_penalties();

-- Link and recalculate historical violations as part of the upgrade.
update public.violations
set violation_date = violation_date
where billing_id is null;

create or replace function public.guard_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount <= 0 then raise exception 'Payment amount must be greater than zero.'; end if;
  if not exists (select 1 from public.billings b where b.id = new.billing_id and b.vendor_id = new.vendor_id) then
    raise exception 'Payment billing record does not belong to the selected vendor.';
  end if;
  if new.amount > (select greatest(b.amount_due - b.amount_paid, 0) from public.billings b where b.id = new.billing_id) then
    raise exception 'Payment amount cannot exceed the current billing balance.';
  end if;
  if lower(new.payment_method) = 'gcash' and nullif(trim(new.receipt_number), '') is null then
    raise exception 'GCash payments require a reference number.';
  end if;

  if auth.uid() is null or auth.role() = 'service_role' or public.is_back_office() then
    return new;
  end if;
  if not public.owns_vendor(new.vendor_id) then raise exception 'You can only record payments for your own vendor account.'; end if;
  if new.submitted_by_vendor is not true or new.recorded_by is not null then
    raise exception 'Vendor payment entries must be marked as vendor-submitted only.';
  end if;
  if new.verification_status <> 'pending' then raise exception 'Vendor payments must be submitted for verification.'; end if;
  if lower(new.payment_method) = 'gcash' and nullif(trim(new.proof_path), '') is null then
    raise exception 'Vendor GCash payments require proof of payment.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_payment_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  verified_total numeric(12,2);
  billing_total numeric(12,2);
begin
  if new.verification_status = 'verified' and old.verification_status <> 'verified' then
    select coalesce(sum(p.amount), 0) into verified_total
    from public.payments p
    where p.billing_id = new.billing_id and p.verification_status = 'verified' and p.id <> new.id;
    select b.amount_due into billing_total from public.billings b where b.id = new.billing_id for update;
    if verified_total + new.amount > billing_total then
      raise exception 'Verifying this payment would exceed the billing amount due.';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_payment_verification_before_update
before update of verification_status on public.payments
for each row execute function public.guard_payment_verification();

create or replace function public.sync_notification_read_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_read and (old.is_read is false or new.read_at is null) then new.read_at = timezone('utc', now()); end if;
  if not new.is_read then new.read_at = null; end if;
  return new;
end;
$$;

create trigger sync_notification_read_at_before_update
before update of is_read on public.notifications
for each row execute function public.sync_notification_read_at();

create or replace function public.prepare_vendor_advance_billings(start_billing_id uuid, month_count integer)
returns table (billing_id uuid, billing_month date, remaining numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_vendor_id uuid;
  start_month date;
  monthly_rate numeric(12,2);
  month_offset integer;
  target_month date;
begin
  if month_count < 1 or month_count > 12 then raise exception 'Advance payment must cover between 1 and 12 months.'; end if;
  select b.vendor_id, b.billing_month into target_vendor_id, start_month from public.billings b where b.id = start_billing_id;
  if target_vendor_id is null or not public.owns_vendor(target_vendor_id) then raise exception 'Billing record is not available for this vendor.'; end if;
  select s.monthly_rate into monthly_rate from public.stalls s where s.vendor_id = target_vendor_id and s.status = 'occupied' order by s.updated_at desc limit 1;
  if monthly_rate is null then select b.base_amount into monthly_rate from public.billings b where b.id = start_billing_id; end if;

  for month_offset in 0..month_count - 1 loop
    target_month := (start_month + make_interval(months => month_offset))::date;
    insert into public.billings (vendor_id, billing_month, base_amount, amount_due, due_date, penalties, notes)
    values (target_vendor_id, target_month, monthly_rate, monthly_rate, (target_month + interval '1 month - 1 day')::date, 0, 'Generated for advance payment')
    on conflict (vendor_id, billing_month) where vendor_id is not null do nothing;
  end loop;

  return query
  select b.id, b.billing_month, greatest(b.amount_due - b.amount_paid, 0)
  from public.billings b
  where b.vendor_id = target_vendor_id
    and b.billing_month >= start_month
    and b.billing_month < (start_month + make_interval(months => month_count))::date
  order by b.billing_month;
end;
$$;

grant execute on function public.prepare_vendor_advance_billings(uuid, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "payment_proofs_insert_owner" on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "payment_proofs_select_owner" on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "payment_proofs_select_staff" on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and public.is_back_office());
create policy "payment_proofs_delete_owner" on storage.objects for delete to authenticated
using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.system_settings (key, value)
values
  ('payment_methods', '{"methods":["Cash","GCash"]}'::jsonb),
  ('pickup_information', '{"enabled":false,"schedule":"","location":"","contact":"","instructions":""}'::jsonb)
on conflict (key) do nothing;

create policy "system_settings_read_authenticated"
on public.system_settings for select to authenticated
using (true);
