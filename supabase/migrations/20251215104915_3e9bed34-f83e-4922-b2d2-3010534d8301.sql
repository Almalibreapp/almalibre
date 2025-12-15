-- Drop existing restrictive policies on maquinas
DROP POLICY IF EXISTS "Users can delete their own machines" ON public.maquinas;
DROP POLICY IF EXISTS "Users can insert their own machines" ON public.maquinas;
DROP POLICY IF EXISTS "Users can update their own machines" ON public.maquinas;
DROP POLICY IF EXISTS "Users can view their own machines" ON public.maquinas;

-- Recreate policies as PERMISSIVE (default)
CREATE POLICY "Users can view their own machines" 
ON public.maquinas 
FOR SELECT 
TO authenticated
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert their own machines" 
ON public.maquinas 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update their own machines" 
ON public.maquinas 
FOR UPDATE 
TO authenticated
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can delete their own machines" 
ON public.maquinas 
FOR DELETE 
TO authenticated
USING (auth.uid() = usuario_id);

-- Also fix profiles policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);