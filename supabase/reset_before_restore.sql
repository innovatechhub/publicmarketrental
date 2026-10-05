-- =============================================================================
-- RESET BEFORE RESTORE
-- =============================================================================
-- Run this ONCE if full_restore.sql fails partway through (e.g. "type ...
-- already exists"), to wipe out whatever it managed to create, before
-- re-running full_restore.sql from the top.
--
-- Safe to run even if some/most/none of these objects exist — everything is
-- IF EXISTS / CASCADE. It does NOT touch auth.users rows (your demo accounts
-- stay, or are simply absent) and does NOT touch the public schema itself,
-- so Supabase's own default grants on it are left alone.
-- =============================================================================

-- Storage policies + buckets
drop policy if exists "vendor_documents_insert" on storage.objects;
drop policy if exists "vendor_documents_select_owner" on storage.objects;
drop policy if exists "vendor_documents_select_staff" on storage.objects;
drop policy if exists "vendor_documents_delete" on storage.objects;
drop policy if exists "payment_proofs_insert_owner" on storage.objects;
drop policy if exists "payment_proofs_select_owner" on storage.objects;
drop policy if exists "payment_proofs_select_staff" on storage.objects;
drop policy if exists "payment_proofs_delete_owner" on storage.objects;

-- Buckets are left in place: Supabase blocks direct DELETE on storage tables
-- ("Use the Storage API instead"), and full_restore.sql's bucket inserts use
-- ON CONFLICT DO NOTHING, so pre-existing buckets are not a problem.

-- Trigger on auth.users (lives outside public schema, so it survives table drops below)
drop trigger if exists on_auth_user_created on auth.users;

-- Tables (CASCADE removes their policies, triggers, and indexes automatically)
drop table if exists public.activity_logs cascade;
drop table if exists public.notifications cascade;
drop table if exists public.violations cascade;
drop table if exists public.stall_support_requests cascade;
drop table if exists public.payments cascade;
drop table if exists public.billings cascade;
drop table if exists public.application_documents cascade;
drop table if exists public.applications cascade;
drop table if exists public.document_requirements cascade;
drop table if exists public.lease_renewal_requests cascade;
drop table if exists public.leases cascade;
drop table if exists public.stalls cascade;
drop table if exists public.market_sections cascade;
drop table if exists public.staff cascade;
drop table if exists public.vendors cascade;
drop table if exists public.profiles cascade;
drop table if exists public.system_settings cascade;

-- Functions
drop function if exists public.prepare_vendor_advance_billings(uuid, integer) cascade;
drop function if exists public.sync_notification_read_at() cascade;
drop function if exists public.guard_notification_update() cascade;
drop function if exists public.guard_stall_support_request_write() cascade;
drop function if exists public.guard_lease_renewal_request_insert() cascade;
drop function if exists public.mark_lease_renewal_in_progress() cascade;
drop function if exists public.guard_payment_insert() cascade;
drop function if exists public.guard_application_document_write() cascade;
drop function if exists public.guard_application_write() cascade;
drop function if exists public.guard_vendor_update() cascade;
drop function if exists public.guard_profile_update() cascade;
drop function if exists public.owns_application(uuid) cascade;
drop function if exists public.owns_vendor(uuid) cascade;
drop function if exists public.is_back_office() cascade;
drop function if exists public.is_super_admin() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.recalculate_violation_penalties() cascade;
drop function if exists public.link_violation_to_billing() cascade;
drop function if exists public.guard_payment_verification() cascade;
drop function if exists public.sync_billing_totals_from_payments() cascade;
drop function if exists public.apply_billing_status() cascade;
drop function if exists public.set_updated_at() cascade;

-- Enum types
drop type if exists public.renewal_request_status cascade;
drop type if exists public.support_request_status cascade;
drop type if exists public.renewal_status cascade;
drop type if exists public.lease_status cascade;
drop type if exists public.billing_status cascade;
drop type if exists public.stall_status cascade;
drop type if exists public.document_status cascade;
drop type if exists public.application_status cascade;
drop type if exists public.user_role cascade;

-- Demo auth users (optional — uncomment if you also want to remove the demo
-- logins so full_restore.sql recreates them cleanly with fresh IDs; leaving
-- this commented out is fine too, since that section of full_restore.sql
-- already skips accounts that already exist)
-- delete from auth.users where email in (
--   'superadmin@culasi.gov.ph','admin@culasi.gov.ph','finance@culasi.gov.ph',
--   'vendor@culasi.gov.ph','vendor2@culasi.gov.ph','vendor3@culasi.gov.ph',
--   'vendor4@culasi.gov.ph','vendor5@culasi.gov.ph'
-- );
