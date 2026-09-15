-- =============================================================================
-- FULL DATABASE RESTORE — Culasi Public Market
-- =============================================================================
-- Paste this entire file into the SQL Editor of a brand-new Supabase project
-- and run it once. It rebuilds everything your app needs from scratch:
--   1. Extensions, enum types, helper functions
--   2. Tables (final shape, after all migrations applied)
--   3. Indexes, updated_at triggers, business-logic triggers
--   4. Row Level Security + policies
--   5. Storage buckets + storage policies
--   6. Reference/config seed data (sections, document requirements, settings)
--   7. Demo seed data (8 demo accounts, stalls, leases, billings, payments)
--
-- IMPORTANT NOTE ABOUT `leases` AND `lease_renewal_requests`:
-- These two tables were used throughout the app (vendor-service.ts) and are
-- referenced by triggers/policies in supabase/migrations/20260322_rls_hardening.sql,
-- but a `create table` statement for them was never committed to this repo —
-- they must have been created directly in the old Supabase dashboard and lost
-- when that account became unrecoverable. The definitions below are
-- reconstructed from every usage of these tables found in the codebase
-- (columns, RLS-guard trigger logic, unique index). Please double-check them
-- against your own memory of the old schema after import — if the old tables
-- had extra columns that nothing in the app code referenced, those won't be
-- reproduced here since there was no way to recover them.
--
-- Demo login password for every seeded account below: culasi123
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS, ENUM TYPES, HELPER FUNCTIONS
-- =============================================================================

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


-- =============================================================================
-- 2. TABLES
-- =============================================================================

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

-- RECONSTRUCTED (see note at top of file)
create table public.leases (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  stall_id uuid not null references public.stalls(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  monthly_rate numeric(12,2) not null default 0,
  status public.lease_status not null default 'draft',
  renewal_status public.renewal_status not null default 'not_due',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- RECONSTRUCTED (see note at top of file)
create table public.lease_renewal_requests (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status public.renewal_request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
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


-- =============================================================================
-- 3. INDEXES
-- =============================================================================

create index idx_profiles_role on public.profiles(role);
create index idx_vendors_profile_id on public.vendors(profile_id);
create index idx_stalls_section_status on public.stalls(section_id, status);
create index idx_stalls_vendor_id on public.stalls(vendor_id);
create index idx_leases_vendor_id on public.leases(vendor_id);
create index idx_leases_stall_id on public.leases(stall_id);
create unique index idx_renewal_requests_pending_unique on public.lease_renewal_requests(lease_id) where status = 'pending';
create index idx_applications_vendor_status on public.applications(vendor_id, status);
create index idx_documents_application_status on public.application_documents(application_id, verification_status);
create index idx_payments_vendor_date on public.payments(vendor_id, payment_date desc);
create unique index uq_billings_vendor_month on public.billings(vendor_id, billing_month) where vendor_id is not null;
create index idx_billings_vendor_id on public.billings(vendor_id);
create index idx_payments_verification_status on public.payments(verification_status, payment_date desc);
create index idx_payments_group_id on public.payments(payment_group_id);
create unique index uq_payments_internal_reference on public.payments(internal_reference);
create index idx_violations_billing_id on public.violations(billing_id);
create index idx_notifications_user_read on public.notifications(user_id, is_read);
create index idx_support_requests_vendor_status on public.stall_support_requests(vendor_id, status);


-- =============================================================================
-- 4. updated_at TRIGGERS
-- =============================================================================

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
create trigger set_leases_updated_at before update on public.leases
for each row execute function public.set_updated_at();
create trigger set_lease_renewal_requests_updated_at before update on public.lease_renewal_requests
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


-- =============================================================================
-- 5. BUSINESS LOGIC FUNCTIONS (final versions)
-- =============================================================================

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

create trigger sync_billing_totals_after_payment_insert
after insert on public.payments
for each row execute function public.sync_billing_totals_from_payments();

create trigger sync_billing_totals_after_payment_update
after update on public.payments
for each row execute function public.sync_billing_totals_from_payments();

create trigger sync_billing_totals_after_payment_delete
after delete on public.payments
for each row execute function public.sync_billing_totals_from_payments();

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

create trigger link_violation_to_billing_before_write
before insert or update of vendor_id, violation_date on public.violations
for each row execute function public.link_violation_to_billing();

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

create trigger recalculate_violation_penalties_after_write
after insert or update or delete on public.violations
for each row execute function public.recalculate_violation_penalties();

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

create trigger guard_payment_insert_before_write
before insert on public.payments
for each row execute function public.guard_payment_insert();

create or replace function public.mark_lease_renewal_in_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leases
  set renewal_status = 'in_progress'::public.renewal_status
  where id = new.lease_id;

  return new;
end;
$$;

create trigger set_lease_renewal_status_after_request_insert
after insert on public.lease_renewal_requests
for each row execute function public.mark_lease_renewal_in_progress();

create or replace function public.guard_lease_renewal_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.role() = 'service_role' or public.is_back_office() then
    return new;
  end if;

  if new.requested_by <> auth.uid() or not public.owns_vendor(new.vendor_id) then
    raise exception 'You can only request renewal for your own vendor account.';
  end if;

  if not exists (
    select 1
    from public.leases
    where id = new.lease_id
      and vendor_id = new.vendor_id
  ) then
    raise exception 'The selected lease does not belong to your vendor account.';
  end if;

  if new.status <> 'pending'::public.renewal_request_status
    or new.reviewed_by is not null
    or new.reviewed_at is not null then
    raise exception 'Renewal requests must start as pending and unreviewed.';
  end if;

  return new;
end;
$$;

create trigger guard_lease_renewal_request_insert_before_write
before insert on public.lease_renewal_requests
for each row execute function public.guard_lease_renewal_request_insert();

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


-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.staff enable row level security;
alter table public.market_sections enable row level security;
alter table public.stalls enable row level security;
alter table public.leases enable row level security;
alter table public.lease_renewal_requests enable row level security;
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

create policy "leases_select_owner_or_back_office" on public.leases
for select using (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
);

create policy "leases_manage_back_office" on public.leases
for all using (public.is_back_office())
with check (public.is_back_office());

create policy "lease_renewal_requests_select_owner_or_back_office" on public.lease_renewal_requests
for select using (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
);

create policy "lease_renewal_requests_insert_owner_or_back_office" on public.lease_renewal_requests
for insert with check (
  vendor_id in (select id from public.vendors where profile_id = auth.uid())
  or public.is_back_office()
);

create policy "lease_renewal_requests_update_back_office" on public.lease_renewal_requests
for update using (public.is_back_office())
with check (public.is_back_office());

create policy "lease_renewal_requests_delete_back_office" on public.lease_renewal_requests
for delete using (public.is_back_office());

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
    from public.vendors v
    where v.id = vendor_id
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


-- =============================================================================
-- 7. STORAGE BUCKETS + POLICIES
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-documents',
  'vendor-documents',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']
)
on conflict (id) do nothing;

create policy "vendor_documents_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vendor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vendor_documents_select_owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vendor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vendor_documents_select_staff"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vendor-documents'
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin', 'finance')
    )
  );

create policy "vendor_documents_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vendor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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


-- =============================================================================
-- 8. REFERENCE / CONFIG SEED DATA
-- =============================================================================

insert into public.market_sections (code, name, description, sort_order)
values
  ('dry_goods',    'Dry Goods',    'General merchandise, clothing, and non-perishable goods', 1),
  ('wet_market',   'Wet Market',   'Fresh meat, poultry, and seafood products',                2),
  ('vegetables',   'Vegetables',   'Fresh vegetables and root crops',                          3),
  ('fish_aisle',   'Fish Aisle',   'Fresh and dried fish and marine products',                 4),
  ('mixed',        'Mixed Section','Mixed stalls — assorted goods and services',               5),
  ('second_floor', 'Second Floor', 'Second floor stalls — main and annex buildings',           6),
  ('annex',        'Annex',        'Annex building ground floor stalls',                       7)
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
  ('pickup_information', '{"enabled":false,"schedule":"","location":"","contact":"","instructions":""}'::jsonb),
  ('market_name',       '"Culasi Public Market"'),
  ('late_penalty_rate', '0.05'),
  ('billing_due_day',   '10'),
  ('lease_term_months', '12')
on conflict (key) do nothing;


-- =============================================================================
-- 9. DEMO SEED DATA
-- Password for every demo account below: culasi123
-- =============================================================================

-- 9a. Demo auth users
do $$
declare
  acct record;
begin
  for acct in
    select
      email, app_role, full_name, phone,
      business_name, business_type, address
    from (values
      ('superadmin@culasi.gov.ph'::text, 'super_admin'::text, 'Marilou Ramos'::text,    '0917 800 0001'::text, null::text,                    null::text,                   null::text),
      ('admin@culasi.gov.ph',            'admin',              'Arvin Estrellado',        '0917 800 0002',       null,                          null,                         null),
      ('finance@culasi.gov.ph',          'finance',            'Jocelyn Pineda',          '0917 800 0003',       null,                          null,                         null),
      ('vendor@culasi.gov.ph',           'vendor',             'Leah Fernandez',          '0917 800 0004',       'Leah''s Native Produce',      'Vegetables',                 'Culasi, Antique'),
      ('vendor2@culasi.gov.ph',          'vendor',             'Ramon Delgado',           '0917 800 0005',       'Delgado Fish Trading',        'Fish/Seafood',               'Poblacion, Culasi'),
      ('vendor3@culasi.gov.ph',          'vendor',             'Gloria Santos',           '0917 800 0006',       'Santos Dry Goods',            'Dry Goods',                  'Barangay 1, Culasi'),
      ('vendor4@culasi.gov.ph',          'vendor',             'Rodrigo Banes',           '0917 800 0007',       'Banes Meat Shop',             'Meat/Poultry',               'Barangay 2, Culasi'),
      ('vendor5@culasi.gov.ph',          'vendor',             'Cynthia Lim',             '0917 800 0008',       'Lim Sari-Sari Store',         'General Merchandise',        'Barangay 3, Culasi')
    ) as t(email, app_role, full_name, phone, business_name, business_type, address)
  loop
    if not exists (select 1 from auth.users u where u.email = acct.email) then
      insert into auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
      ) values (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        acct.email,
        crypt('culasi123', gen_salt('bf')),
        now(),
        jsonb_build_object(
          'provider',  'email',
          'providers', jsonb_build_array('email'),
          'role',      acct.app_role
        ),
        jsonb_strip_nulls(jsonb_build_object(
          'full_name',     acct.full_name,
          'phone',         acct.phone,
          'business_name', acct.business_name,
          'business_type', acct.business_type,
          'address',       acct.address
        )),
        now(),
        now(),
        '', '', '', ''
      );
    end if;
  end loop;
end;
$$;

-- 9b. Profiles (idempotent — handles reseed without trigger)
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

-- 9c. Staff rows
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

-- 9d. Vendor rows
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

-- 9e. Stalls — real stall numbers from the building blueprint
--    Ground Floor Main:  562–648, 655–717
--    Second Floor Main:  718–782
--    Annex Ground Floor: 1–12, 35–39, 40–62, 100–120, 240–248, 751
--    Annex Second Floor: 13–24, 63–86, 249–258
--    Mixed Section:      359–561
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

-- 9f. Extra Wet Market stall numbers used by the admin heat map
insert into public.stalls (section_id, stall_number, stall_type, size_label, monthly_rate, status)
select
  s.id,
  v.stall_number,
  'Standard',
  '3x3m',
  1800.00,
  'available'::public.stall_status
from public.market_sections s
join (
  values
    ('1'), ('2'), ('3'), ('4'), ('5'), ('6'),
    ('7'), ('8'), ('9'), ('10'), ('11'), ('12'),
    ('36'), ('37'), ('38'), ('39'), ('40'), ('41'),
    ('42'), ('43'), ('44'), ('45'), ('46'), ('47'),
    ('48'), ('49'), ('50'), ('51'), ('52'), ('53'),
    ('54'), ('55'), ('56'), ('57'), ('58'), ('59'),
    ('60'),
    ('170'), ('171'), ('172'), ('173'), ('174'), ('175'),
    ('176'), ('177'), ('178'), ('179'), ('180'), ('181'),
    ('182'), ('183'), ('184'), ('185'), ('186'), ('187'),
    ('188'), ('189'), ('190'), ('191'), ('192'), ('193'),
    ('194'), ('195'),
    ('240'), ('241'), ('242'), ('243'),
    ('245'), ('246'), ('247'), ('248'),
    ('562'), ('563'), ('564'), ('565'), ('566'), ('567'),
    ('568'), ('569'), ('570'), ('571'), ('572'), ('573'),
    ('574'), ('575'), ('576'), ('577'), ('578'), ('579'),
    ('580'), ('581'), ('582'), ('583'), ('584'), ('585'),
    ('586'), ('587'), ('588'), ('589'), ('590'), ('591'),
    ('592'), ('593'), ('594'), ('595'), ('596'), ('597'),
    ('598'), ('599'), ('600'), ('601'), ('602'), ('603'),
    ('604'), ('605'), ('606'), ('607'), ('608'), ('609'),
    ('610'), ('611'), ('612'), ('613'), ('614'), ('615'),
    ('616'), ('617'), ('618'), ('619'), ('620'), ('621'),
    ('622'), ('623'), ('624'), ('625'), ('626'), ('627'),
    ('628'), ('629'), ('630'), ('631'), ('632'), ('633'),
    ('634'), ('635'), ('636'), ('637'), ('638'), ('639'),
    ('640'), ('641'), ('642'), ('643'), ('644'), ('645'),
    ('646'), ('647'), ('648'), ('649'),
    ('662'), ('663'), ('664'), ('665'), ('666'), ('667'),
    ('668'), ('669'), ('670'), ('671'), ('672'), ('673'),
    ('674'), ('675'), ('676'), ('677'), ('678'), ('679'),
    ('680'), ('681'), ('682'), ('683'), ('684'), ('685'),
    ('686'), ('687'), ('688'), ('689'), ('690'), ('691'),
    ('692'), ('693'), ('694'), ('695'), ('696'), ('697'),
    ('698'), ('699'), ('700'), ('701'), ('702'), ('703'),
    ('704'), ('705'), ('706'), ('707'), ('708'), ('709'),
    ('710'), ('711'), ('712'), ('713'), ('714'), ('715'),
    ('716'), ('717')
) as v(stall_number) on true
where s.code = 'wet_market'
on conflict (section_id, stall_number) do nothing;

-- 9g. Applications
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

-- 9h. Leases
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

-- 9i. Billings
-- NOTE: vendor_id is populated directly on each row (not just lease_id) so
-- these demo billings are visible under the final billings_select_owner_or_back_office
-- policy, which checks vendor_id rather than joining through leases. base_amount
-- (not just amount_due) is set because apply_billing_status recomputes
-- amount_due as base_amount + penalties on every insert.
insert into public.billings (lease_id, vendor_id, billing_month, base_amount, amount_due, due_date)
select l.id, l.vendor_id,
  date_trunc('month', current_date - (n || ' months')::interval)::date,
  l.monthly_rate, l.monthly_rate,
  (date_trunc('month', current_date - (n || ' months')::interval) + interval '10 days')::date
from public.leases l
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
cross join generate_series(0, 2) as n
where p.email = 'vendor@culasi.gov.ph' and l.status = 'active'
on conflict do nothing;

insert into public.billings (lease_id, vendor_id, billing_month, base_amount, amount_due, due_date)
select l.id, l.vendor_id,
  date_trunc('month', current_date - (n || ' months')::interval)::date,
  l.monthly_rate, l.monthly_rate,
  (date_trunc('month', current_date - (n || ' months')::interval) + interval '10 days')::date
from public.leases l
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
cross join generate_series(0, 1) as n
where p.email = 'vendor2@culasi.gov.ph' and l.status = 'active'
on conflict do nothing;

insert into public.billings (lease_id, vendor_id, billing_month, base_amount, amount_due, due_date)
select l.id, l.vendor_id,
  date_trunc('month', current_date - (n || ' months')::interval)::date,
  l.monthly_rate, l.monthly_rate,
  (date_trunc('month', current_date - (n || ' months')::interval) + interval '10 days')::date
from public.leases l
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
cross join generate_series(0, 10) as n
where p.email = 'vendor3@culasi.gov.ph' and l.status = 'active'
on conflict do nothing;

-- 9j. Payments
-- NOTE: verification_status is set to 'verified' directly (rather than left at
-- the 'pending' default) so these demo payments actually count toward
-- billings.amount_paid under the final sync_billing_totals_from_payments()
-- trigger, which only sums verified payments.
insert into public.payments
  (billing_id, vendor_id, amount, payment_date, payment_method, receipt_number, submitted_by_vendor, recorded_by, verification_status, verified_by, verified_at)
select b.id, v.id, b.amount_due,
  b.billing_month + interval '7 days', 'gcash',
  'RCP-' || to_char(b.billing_month, 'YYYYMM') || '-' || substring(v.id::text, 1, 4),
  false, (select id from public.profiles where email = 'finance@culasi.gov.ph'),
  'verified', (select id from public.profiles where email = 'finance@culasi.gov.ph'), timezone('utc', now())
from public.billings b
join public.leases l on l.id = b.lease_id
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
where p.email = 'vendor@culasi.gov.ph'
  and b.billing_month < date_trunc('month', current_date)
  and not exists (select 1 from public.payments py where py.billing_id = b.id);

insert into public.payments
  (billing_id, vendor_id, amount, payment_date, payment_method, receipt_number, submitted_by_vendor, recorded_by, verification_status, verified_by, verified_at)
select b.id, v.id, b.amount_due,
  b.billing_month + interval '5 days', 'cash',
  'RCP-' || to_char(b.billing_month, 'YYYYMM') || '-' || substring(v.id::text, 1, 4),
  false, (select id from public.profiles where email = 'finance@culasi.gov.ph'),
  'verified', (select id from public.profiles where email = 'finance@culasi.gov.ph'), timezone('utc', now())
from public.billings b
join public.leases l on l.id = b.lease_id
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
where p.email = 'vendor2@culasi.gov.ph'
  and b.billing_month < date_trunc('month', current_date)
  and not exists (select 1 from public.payments py where py.billing_id = b.id);

insert into public.payments
  (billing_id, vendor_id, amount, payment_date, payment_method, receipt_number, submitted_by_vendor, recorded_by, verification_status, verified_by, verified_at)
select b.id, v.id,
  case
    when b.billing_month = date_trunc('month', current_date - interval '3 months')::date
    then b.amount_due * 0.5
    else b.amount_due
  end,
  b.billing_month + interval '8 days', 'bank_transfer',
  'RCP-' || to_char(b.billing_month, 'YYYYMM') || '-' || substring(v.id::text, 1, 4),
  false, (select id from public.profiles where email = 'finance@culasi.gov.ph'),
  'verified', (select id from public.profiles where email = 'finance@culasi.gov.ph'), timezone('utc', now())
from public.billings b
join public.leases l on l.id = b.lease_id
join public.vendors v on v.id = l.vendor_id
join public.profiles p on p.id = v.profile_id
where p.email = 'vendor3@culasi.gov.ph'
  and b.billing_month < date_trunc('month', current_date)
  and not exists (select 1 from public.payments py where py.billing_id = b.id);

-- 9k. Violations
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

-- 9l. Notifications
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

-- =============================================================================
-- END OF FILE
-- =============================================================================
