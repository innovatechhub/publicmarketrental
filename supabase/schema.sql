create extension if not exists pgcrypto;

create type public.user_role as enum ('super_admin', 'admin', 'finance', 'vendor');
create type public.application_status as enum (
  'draft',
  'submitted',
  'under_review',
  'approved',
  'needs_resubmission',
  'rejected',
  'assigned',
  'active',
  'expired'
);
create type public.document_status as enum ('pending', 'verified', 'rejected', 'needs_resubmission');
create type public.stall_status as enum ('available', 'reserved', 'occupied', 'under_maintenance', 'inactive');
create type public.billing_status as enum ('unpaid', 'partial', 'paid', 'overdue');
create type public.lease_status as enum ('draft', 'active', 'expired', 'terminated');
create type public.renewal_status as enum ('not_due', 'due_soon', 'in_progress', 'renewed', 'expired');
create type public.support_request_status as enum ('open', 'in_review', 'resolved');
create type public.renewal_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  role public.user_role not null default 'vendor',
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null,
  business_type text,
  address text,
  barangay text,
  permit_number text,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  position_title text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.market_sections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.stalls (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.market_sections(id) on delete restrict,
  stall_number text not null,
  stall_type text not null,
  size_label text,
  monthly_rate numeric(12,2) not null default 0,
  status public.stall_status not null default 'available',
  notes text,
  vendor_id uuid references public.vendors(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (section_id, stall_number)
);

create table public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_required boolean not null default true,
  has_expiry boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  preferred_stall_id uuid references public.stalls(id) on delete set null,
  application_type text not null check (application_type in ('online', 'walk_in')),
  business_type text,
  preferred_section text,
  preferred_stall_type text,
  status public.application_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  remarks text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  requirement_id uuid not null references public.document_requirements(id) on delete restrict,
  file_url text not null,
  file_name text not null,
  verification_status public.document_status not null default 'pending',
  remarks text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  expiry_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (application_id, requirement_id)
);

create table public.billings (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid references public.leases(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  billing_month date not null,
  base_amount numeric(12,2) not null default 0,
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  due_date date not null,
  status public.billing_status not null default 'unpaid',
  penalties numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid not null references public.billings(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null,
  payment_method text not null,
  receipt_number text,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected', 'voided')),
  proof_path text,
  payment_group_id uuid not null default gen_random_uuid(),
  internal_reference text not null unique default ('PAY-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  rejection_reason text,
  submitted_by_vendor boolean not null default false,
  recorded_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.stall_support_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  lease_id uuid references public.leases(id) on delete set null,
  stall_id uuid references public.stalls(id) on delete set null,
  subject text not null,
  detail text not null,
  status public.support_request_status not null default 'open',
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.violations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  stall_id uuid references public.stalls(id) on delete set null,
  billing_id uuid references public.billings(id) on delete set null,
  category text not null,
  description text not null,
  violation_date date not null,
  penalty_amount numeric(12,2) not null default 0,
  status text not null default 'open',
  action_taken text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  is_read boolean not null default false,
  read_at timestamptz,
  link text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_name text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_profiles_role on public.profiles(role);
create index idx_vendors_profile_id on public.vendors(profile_id);
create index idx_stalls_section_status on public.stalls(section_id, status);
create index idx_applications_vendor_status on public.applications(vendor_id, status);
create index idx_documents_application_status on public.application_documents(application_id, verification_status);
create index idx_payments_vendor_date on public.payments(vendor_id, payment_date desc);
create unique index uq_billings_vendor_month on public.billings(vendor_id, billing_month) where vendor_id is not null;
create index idx_payments_verification_status on public.payments(verification_status, payment_date desc);
create index idx_payments_group_id on public.payments(payment_group_id);
create index idx_violations_billing_id on public.violations(billing_id);
create index idx_notifications_user_read on public.notifications(user_id, is_read);
create index idx_support_requests_vendor_status on public.stall_support_requests(vendor_id, status);

create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger set_vendors_updated_at before update on public.vendors
for each row execute function public.set_updated_at();
create trigger set_staff_updated_at before update on public.staff
for each row execute function public.set_updated_at();
create trigger set_market_sections_updated_at before update on public.market_sections
for each row execute function public.set_updated_at();
create trigger set_stalls_updated_at before update on public.stalls
for each row execute function public.set_updated_at();
create trigger set_document_requirements_updated_at before update on public.document_requirements
for each row execute function public.set_updated_at();
create trigger set_applications_updated_at before update on public.applications
for each row execute function public.set_updated_at();
create trigger set_application_documents_updated_at before update on public.application_documents
for each row execute function public.set_updated_at();
create trigger set_billings_updated_at before update on public.billings
for each row execute function public.set_updated_at();
create trigger set_payments_updated_at before update on public.payments
for each row execute function public.set_updated_at();
create trigger set_violations_updated_at before update on public.violations
for each row execute function public.set_updated_at();
create trigger set_stall_support_requests_updated_at before update on public.stall_support_requests
for each row execute function public.set_updated_at();

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

create trigger apply_billing_status_before_write
before insert or update on public.billings
for each row execute function public.apply_billing_status();

create or replace function public.sync_billing_totals_from_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_billing_id uuid;
  paid_total numeric(12,2);
begin
  target_billing_id := coalesce(new.billing_id, old.billing_id);
  paid_total := coalesce((
    select sum(amount)
    from public.payments
    where billing_id = target_billing_id
      and verification_status = 'verified'
  ), 0);

  update public.billings
  set
    amount_paid = paid_total,
    status = case
      when paid_total >= amount_due then 'paid'::public.billing_status
      when paid_total > 0 then 'partial'::public.billing_status
      when due_date < current_date then 'overdue'::public.billing_status
      else 'unpaid'::public.billing_status
    end
  where id = target_billing_id;

  return coalesce(new, old);
end;
$$;

create trigger sync_billing_totals_after_payment_insert
after insert on public.payments
for each row execute function public.sync_billing_totals_from_payments();

create trigger sync_billing_totals_after_payment_update
after update on public.payments
for each row execute function public.sync_billing_totals_from_payments();

create trigger sync_billing_totals_after_payment_delete
after delete on public.payments
for each row execute function public.sync_billing_totals_from_payments();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role;
begin
  assigned_role := case
    when coalesce(new.raw_app_meta_data ->> 'role', '') in ('super_admin', 'admin', 'finance', 'vendor') then
      (new.raw_app_meta_data ->> 'role')::public.user_role
    else
      'vendor'::public.user_role
  end;

  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    assigned_role
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role;

  if assigned_role = 'vendor' then
    insert into public.vendors (profile_id, business_name, business_type, address)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'business_name', 'New Vendor'),
      new.raw_user_meta_data ->> 'business_type',
      new.raw_user_meta_data ->> 'address'
    )
    on conflict (profile_id) do update
    set
      business_name = excluded.business_name,
      business_type = coalesce(excluded.business_type, public.vendors.business_type),
      address = coalesce(excluded.address, public.vendors.address);
  else
    insert into public.staff (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'super_admin'
$$;

create or replace function public.is_back_office()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('super_admin', 'admin', 'finance')
$$;

create or replace function public.owns_vendor(target_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vendors
    where id = target_vendor_id
      and profile_id = auth.uid()
  )
$$;

create or replace function public.owns_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    join public.vendors v on v.id = a.vendor_id
    where a.id = target_application_id
      and v.profile_id = auth.uid()
  )
$$;

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_super_admin() then
    return new;
  end if;

  if old.id <> auth.uid() then
    raise exception 'You can only update your own profile.';
  end if;

  if new.id <> old.id
    or new.role <> old.role
    or new.created_at <> old.created_at then
    raise exception 'Protected profile fields cannot be changed from the client.';
  end if;

  return new;
end;
$$;

create trigger guard_profile_update_before_write
before update on public.profiles
for each row execute function public.guard_profile_update();

create or replace function public.guard_vendor_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_back_office() then
    return new;
  end if;

  if old.profile_id <> auth.uid() then
    raise exception 'You can only update your own vendor record.';
  end if;

  if new.id <> old.id
    or new.profile_id <> old.profile_id
    or new.status <> old.status
    or new.created_at <> old.created_at then
    raise exception 'Protected vendor fields cannot be changed from the client.';
  end if;

  return new;
end;
$$;

create trigger guard_vendor_update_before_write
before update on public.vendors
for each row execute function public.guard_vendor_update();

create or replace function public.guard_application_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_back_office() then
    return new;
  end if;

  if not public.owns_vendor(new.vendor_id) then
    raise exception 'You can only write applications for your own vendor account.';
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'submitted') then
      raise exception 'Invalid application status for vendor submission.';
    end if;

    if new.reviewed_by is not null
      or new.reviewed_at is not null
      or new.rejection_reason is not null
      or new.preferred_stall_id is not null then
      raise exception 'Admin-only application fields cannot be set by vendors.';
    end if;

    return new;
  end if;

  if new.vendor_id <> old.vendor_id
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.rejection_reason is distinct from old.rejection_reason
    or new.preferred_stall_id is distinct from old.preferred_stall_id
    or new.created_at <> old.created_at then
    raise exception 'Protected application fields cannot be changed from the client.';
  end if;

  if new.status is distinct from old.status
    and new.status not in ('draft', 'submitted') then
    raise exception 'Vendors can only save drafts or submit applications.';
  end if;

  return new;
end;
$$;

create trigger guard_application_before_write
before insert or update on public.applications
for each row execute function public.guard_application_write();

create or replace function public.guard_application_document_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_back_office() then
    return new;
  end if;

  if not public.owns_application(new.application_id) then
    raise exception 'You can only manage documents for your own applications.';
  end if;

  if new.verification_status <> 'pending'::public.document_status then
    raise exception 'Vendors can only submit documents with pending verification status.';
  end if;

  if new.verified_by is not null or new.verified_at is not null then
    raise exception 'Verification fields are reserved for back-office staff.';
  end if;

  if tg_op = 'UPDATE' and (
    new.application_id <> old.application_id
    or new.requirement_id <> old.requirement_id
    or new.created_at <> old.created_at
  ) then
    raise exception 'Protected document fields cannot be changed from the client.';
  end if;

  return new;
end;
$$;

create trigger guard_application_document_before_write
before insert or update on public.application_documents
for each row execute function public.guard_application_document_write();

create or replace function public.guard_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;
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

  if not public.owns_vendor(new.vendor_id) then
    raise exception 'You can only record payments for your own vendor account.';
  end if;
  if new.submitted_by_vendor is not true or new.recorded_by is not null then
    raise exception 'Vendor payment entries must be marked as vendor-submitted only.';
  end if;
  if new.verification_status <> 'pending' then
    raise exception 'Vendor payments must be submitted for verification.';
  end if;
  if lower(new.payment_method) = 'gcash' and nullif(trim(new.proof_path), '') is null then
    raise exception 'Vendor GCash payments require proof of payment.';
  end if;

  return new;
end;
$$;

create trigger guard_payment_insert_before_write
before insert on public.payments
for each row execute function public.guard_payment_insert();

create or replace function public.guard_stall_support_request_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_back_office() then
    return new;
  end if;

  if not public.owns_vendor(new.vendor_id) then
    raise exception 'You can only manage support requests for your own vendor account.';
  end if;

  if new.status <> 'open'::public.support_request_status
    or new.resolved_by is not null
    or new.resolved_at is not null then
    raise exception 'Support requests from vendors must start as open and unresolved.';
  end if;

  if new.lease_id is not null and not exists (
    select 1
    from public.leases
    where id = new.lease_id
      and vendor_id = new.vendor_id
  ) then
    raise exception 'The selected lease does not belong to your vendor account.';
  end if;

  if new.stall_id is not null and not exists (
    select 1
    from public.leases
    where vendor_id = new.vendor_id
      and stall_id = new.stall_id
      and (new.lease_id is null or id = new.lease_id)
  ) then
    raise exception 'The selected stall is not linked to your vendor account.';
  end if;

  if tg_op = 'UPDATE' and (
    new.vendor_id <> old.vendor_id
    or new.lease_id is distinct from old.lease_id
    or new.stall_id is distinct from old.stall_id
    or new.created_at <> old.created_at
  ) then
    raise exception 'Protected support request fields cannot be changed from the client.';
  end if;

  return new;
end;
$$;

create trigger guard_stall_support_request_before_write
before insert or update on public.stall_support_requests
for each row execute function public.guard_stall_support_request_write();

create or replace function public.guard_notification_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_back_office() then
    return new;
  end if;

  if old.user_id <> auth.uid() then
    raise exception 'You can only update your own notifications.';
  end if;

  if new.user_id <> old.user_id
    or new.title <> old.title
    or new.message <> old.message
    or new.type <> old.type
    or new.link is distinct from old.link
    or new.created_at <> old.created_at then
    raise exception 'Only the read state of a notification can be changed from the client.';
  end if;

  return new;
end;
$$;

create trigger guard_notification_update_before_write
before update on public.notifications
for each row execute function public.guard_notification_update();

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.staff enable row level security;
alter table public.market_sections enable row level security;
alter table public.stalls enable row level security;
alter table public.document_requirements enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.billings enable row level security;
alter table public.payments enable row level security;
alter table public.stall_support_requests enable row level security;
alter table public.violations enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.system_settings enable row level security;

create policy "profiles_select_self_or_back_office" on public.profiles
for select using (id = auth.uid() or public.is_back_office());

create policy "profiles_update_self_or_super_admin" on public.profiles
for update using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

create policy "profiles_insert_self" on public.profiles
for insert with check (id = auth.uid() and role = 'vendor'::public.user_role);

create policy "vendors_select_self_or_back_office" on public.vendors
for select using (profile_id = auth.uid() or public.is_back_office());

create policy "vendors_manage_back_office" on public.vendors
for all using (public.current_user_role() in ('super_admin', 'admin'))
with check (public.current_user_role() in ('super_admin', 'admin'));

create policy "vendors_insert_self" on public.vendors
for insert with check (profile_id = auth.uid() and status = 'active');

create policy "vendors_update_self_or_back_office" on public.vendors
for update using (profile_id = auth.uid() or public.current_user_role() in ('super_admin', 'admin'))
with check (profile_id = auth.uid() or public.current_user_role() in ('super_admin', 'admin'));

create policy "staff_select_self_or_super_admin" on public.staff
for select using (profile_id = auth.uid() or public.current_user_role() = 'super_admin');

create policy "staff_manage_super_admin" on public.staff
for all using (public.current_user_role() = 'super_admin')
with check (public.current_user_role() = 'super_admin');

create policy "market_sections_read_all_authenticated" on public.market_sections
for select using (auth.role() = 'authenticated');

create policy "market_sections_manage_admin" on public.market_sections
for all using (public.current_user_role() in ('super_admin', 'admin'))
with check (public.current_user_role() in ('super_admin', 'admin'));

create policy "stalls_read_all_authenticated" on public.stalls
for select using (auth.role() = 'authenticated');

create policy "stalls_manage_admin" on public.stalls
for all using (public.current_user_role() in ('super_admin', 'admin'))
with check (public.current_user_role() in ('super_admin', 'admin'));

create policy "document_requirements_read_authenticated" on public.document_requirements
for select using (auth.role() = 'authenticated');

create policy "document_requirements_manage_admin" on public.document_requirements
for all using (public.current_user_role() in ('super_admin', 'admin'))
with check (public.current_user_role() in ('super_admin', 'admin'));

create policy "applications_select_owner_or_back_office" on public.applications
for select using (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
);

create policy "applications_insert_vendor_or_admin" on public.applications
for insert with check (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.current_user_role() in ('super_admin', 'admin')
);

create policy "applications_update_owner_or_admin" on public.applications
for update using (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.current_user_role() in ('super_admin', 'admin')
)
with check (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.current_user_role() in ('super_admin', 'admin')
);

create policy "applications_delete_owner_or_admin" on public.applications
for delete using (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.current_user_role() in ('super_admin', 'admin')
);

create policy "documents_select_owner_or_back_office" on public.application_documents
for select using (
  application_id in (
    select a.id
    from public.applications a
    join public.vendors v on v.id = a.vendor_id
    where v.profile_id = auth.uid()
  )
  or public.is_back_office()
);

create policy "documents_manage_owner_or_admin" on public.application_documents
for all using (
  application_id in (
    select a.id
    from public.applications a
    join public.vendors v on v.id = a.vendor_id
    where v.profile_id = auth.uid()
  )
  or public.current_user_role() in ('super_admin', 'admin')
)
with check (
  application_id in (
    select a.id
    from public.applications a
    join public.vendors v on v.id = a.vendor_id
    where v.profile_id = auth.uid()
  )
  or public.current_user_role() in ('super_admin', 'admin')
);

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

create policy "billings_manage_back_office" on public.billings
for all using (public.is_back_office())
with check (public.is_back_office());

create policy "payments_select_owner_or_back_office" on public.payments
for select using (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
);

create policy "payments_manage_back_office" on public.payments
for all using (public.is_back_office())
with check (public.is_back_office());

create policy "payments_insert_owner_or_back_office" on public.payments
for insert with check (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
);

create policy "violations_select_owner_or_back_office" on public.violations
for select using (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
);

create policy "violations_manage_admin" on public.violations
for all using (public.current_user_role() in ('super_admin', 'admin'))
with check (public.current_user_role() in ('super_admin', 'admin'));

create policy "notifications_select_own" on public.notifications
for select using (user_id = auth.uid() or public.is_back_office());

create policy "notifications_manage_back_office" on public.notifications
for all using (public.is_back_office())
with check (public.is_back_office());

create policy "notifications_insert_own_or_back_office" on public.notifications
for insert with check (user_id = auth.uid() or public.is_back_office());

create policy "notifications_update_own_or_back_office" on public.notifications
for update using (user_id = auth.uid() or public.is_back_office())
with check (user_id = auth.uid() or public.is_back_office());

create policy "notifications_delete_own_or_back_office" on public.notifications
for delete using (user_id = auth.uid() or public.is_back_office());

create policy "stall_support_requests_select_owner_or_back_office" on public.stall_support_requests
for select using (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
);

create policy "stall_support_requests_insert_owner_or_back_office" on public.stall_support_requests
for insert with check (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
);

create policy "stall_support_requests_update_owner_or_back_office" on public.stall_support_requests
for update using (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
)
with check (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
);

create policy "stall_support_requests_delete_back_office" on public.stall_support_requests
for delete using (public.is_back_office());

create policy "activity_logs_read_back_office" on public.activity_logs
for select using (public.is_back_office());

create policy "activity_logs_insert_back_office" on public.activity_logs
for insert with check (public.is_back_office());

create policy "system_settings_manage_admin" on public.system_settings
for all using (public.current_user_role() in ('super_admin', 'admin'))
with check (public.current_user_role() in ('super_admin', 'admin'));

create policy "system_settings_read_authenticated" on public.system_settings
for select to authenticated using (true);

insert into public.market_sections (code, name, description, sort_order)
values
  ('dry_goods', 'Dry Goods', 'General merchandise, clothing, and non-perishable goods', 1),
  ('wet_market', 'Wet Market', 'Fresh meat, poultry, and seafood products', 2),
  ('vegetables', 'Vegetables', 'Fresh vegetables and root crops', 3),
  ('fish_aisle', 'Fish Aisle', 'Fresh and dried fish and marine products', 4)
on conflict (code) do nothing;

insert into public.document_requirements (code, name, description, is_required, has_expiry, sort_order)
values
  ('barangay_clearance', 'Barangay Clearance', 'Barangay-level business clearance requirement', true, true, 1),
  ('police_clearance', 'Police Clearance', 'Police clearance for vendor compliance screening', true, true, 2),
  ('health_clearance', 'Health Clearance', 'Health clearance for market operations', true, true, 3),
  ('dti_registration', 'DTI Registration', 'Department of Trade and Industry registration', true, true, 4),
  ('business_permit', 'Business Permit', 'Local government business permit', true, true, 5)
on conflict (code) do nothing;

insert into public.system_settings (key, value)
values
  ('payment_methods', '{"methods":["Cash","GCash"]}'::jsonb),
  ('pickup_information', '{"enabled":false,"schedule":"","location":"","contact":"","instructions":""}'::jsonb)
on conflict (key) do nothing;
