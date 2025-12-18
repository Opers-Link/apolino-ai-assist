-- Add explicit policy to block anonymous access to profiles
-- This ensures only authenticated users can view profile data

CREATE POLICY "Require auth for profile access" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);