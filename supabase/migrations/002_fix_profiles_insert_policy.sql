-- Fix: Add missing INSERT policy for profiles table
-- This allows users to create their own profile during signup

CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

