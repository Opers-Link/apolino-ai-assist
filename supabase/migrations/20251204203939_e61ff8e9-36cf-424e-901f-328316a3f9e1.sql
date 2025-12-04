-- Update user role to admin
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '5ad186fd-61c6-4eef-8a51-d191832d4988';