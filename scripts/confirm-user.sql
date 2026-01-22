-- Script to manually confirm a user account in Supabase
-- Run this in Supabase Dashboard → SQL Editor

-- Replace 'user@example.com' with the actual email address
-- This will confirm the user's email and allow them to log in

UPDATE auth.users 
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'user@example.com'
  AND email_confirmed_at IS NULL;

-- Verify the update
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'user@example.com';
