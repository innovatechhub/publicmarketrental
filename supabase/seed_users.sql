-- =============================================================
-- Step 1 of 2: Create auth users
-- Run this FIRST in the Supabase SQL Editor.
-- Password for all accounts: culasi123
-- =============================================================

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
