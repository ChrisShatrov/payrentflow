-- Create a helper function to check if user is admin (avoids RLS recursion)
-- This function uses SECURITY DEFINER to bypass RLS when checking the profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Use SECURITY DEFINER to bypass RLS and check the profiles table directly
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all tenant profiles" ON profiles;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = profiles.id);

-- Allow admins to view all tenant profiles (using helper function to avoid recursion)
CREATE POLICY "Admins can view all tenant profiles"
  ON profiles FOR SELECT
  USING (
    public.is_admin()
    OR auth.uid() = profiles.id
  );

