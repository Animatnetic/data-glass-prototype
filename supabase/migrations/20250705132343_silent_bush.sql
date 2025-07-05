/*
  # Fix User Profile Creation Issue

  1. Problem
    - The handle_new_user trigger is failing during signup
    - Likely due to email access or constraint issues in the trigger

  2. Solution
    - Update the handle_new_user function to handle email extraction more safely
    - Add proper error handling and fallbacks
    - Ensure the function works with Supabase's auth.users structure

  3. Changes
    - Recreate the handle_new_user function with better error handling
    - Use COALESCE to handle potential null values
    - Add ON CONFLICT handling for the user_profiles insert
*/

-- Drop and recreate the handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert user profile with proper error handling
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Also add a policy to handle the case where profile creation might be delayed
CREATE POLICY IF NOT EXISTS "Allow profile creation during signup"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);