-- Vendor-submitted payments now require an uploaded proof for every method:
-- a GCash screenshot, or a photo of the official receipt for cash payments.
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
  if nullif(trim(new.proof_path), '') is null then
    raise exception 'Vendor payments require an uploaded proof of payment or receipt photo.';
  end if;
  return new;
end;
$$;
