insert into public.document_requirements (code, name, description, is_required, has_expiry, sort_order)
values ('business_permit', 'Business Permit', 'Local government business permit', true, true, 5)
on conflict (code) do nothing;
