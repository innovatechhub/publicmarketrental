alter table public.payments drop constraint if exists payments_verification_status_check;
alter table public.payments
  add constraint payments_verification_status_check
  check (verification_status in ('pending', 'verified', 'rejected'));
