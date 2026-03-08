/*
  # Auto-create Profiles on User Signup

  1. Changes
    - Create profiles for existing users who don't have one
    - Add trigger to automatically create profile when auth.users row is created
    - This ensures every user always has a profile
  
  2. Security
    - Trigger runs with security definer to bypass RLS
    - Only creates profile, doesn't modify existing ones
*/

-- Create profiles for existing users who don't have one
INSERT INTO profiles (id, username, wallet_balance)
SELECT 
  au.id,
  COALESCE(au.email, 'user_' || substr(au.id::text, 1, 8)) as username,
  100.00 as wallet_balance
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- Create function to automatically create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, wallet_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'user_' || substr(NEW.id::text, 1, 8)),
    100.00
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
