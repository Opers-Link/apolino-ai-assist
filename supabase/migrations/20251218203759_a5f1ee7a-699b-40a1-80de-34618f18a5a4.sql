-- Remove the weak authentication policy that allows any authenticated user to see all profiles
-- The existing policies already properly restrict access to profile owners and admins/gerentes

DROP POLICY IF EXISTS "Require auth for profile access" ON public.profiles;