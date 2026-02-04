-- Fix wrong tenant_id: ensure tenant profile exists, then set unit to it.
-- The FK error means profile 7bbad346-... is missing from profiles.
-- Run ALL statements below in order in Supabase Dashboard → SQL Editor.
--
-- Tenant: Kirill Shatrov, shatrovchris+tenant11@gmail.com
-- Profile id must match their auth.uid() (Supabase Auth → Users).

-- 1. Remove any other profile with this email (so we can insert the one with auth.uid())
DELETE FROM profiles
WHERE email = 'shatrovchris+tenant11@gmail.com'
  AND id != '7bbad346-f6e8-4239-83a5-2a53b0bbfc3f';

-- 2. Insert tenant profile (id = their auth.uid())
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  '7bbad346-f6e8-4239-83a5-2a53b0bbfc3f',
  'shatrovchris+tenant11@gmail.com',
  'Kirill Shatrov',
  'tenant'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- 3. Fix the unit (run ONE of these depending on which unit is theirs)

-- Unit 008 @ Testy Luxe Apartments:
UPDATE units
SET tenant_id = '7bbad346-f6e8-4239-83a5-2a53b0bbfc3f'
WHERE id = 'ed862267-048d-4e44-9848-383fafdf0ed9';

-- Unit 008 @ Shatrov Test Apartments (uncomment and run instead if that's the correct unit):
-- UPDATE units
-- SET tenant_id = '7bbad346-f6e8-4239-83a5-2a53b0bbfc3f'
-- WHERE id = '51598751-8c59-4328-9500-57eabca24393';
