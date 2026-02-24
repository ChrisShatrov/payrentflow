-- Fix: Add missing INSERT policy for profiles table
-- This allows users to create their own profile during signup
-- Use DROP IF EXISTS so this is idempotent when 001 already created the policy

DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

