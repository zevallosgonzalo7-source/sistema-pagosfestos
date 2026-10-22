-- FESTOS V29.38 · HEAD ADMIN + DESARROLLADOR SOFTWARE pueden gestionar perfiles/permisos.
-- Mantiene protegida la cuenta HEAD ADMIN mediante el trigger existente.

CREATE OR REPLACE FUNCTION public.festos_can_manage_roles()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT p.activo = true
       AND upper(trim(COALESCE(p.rol_label, ''))) IN ('HEAD ADMIN', 'DESARROLLADOR SOFTWARE')
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  ), false);
$$;

REVOKE ALL ON FUNCTION public.festos_can_manage_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.festos_can_manage_roles() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "festos profiles select" ON public.profiles;
DROP POLICY IF EXISTS "festos profiles head admin update" ON public.profiles;
DROP POLICY IF EXISTS "festos profiles managers update" ON public.profiles;

CREATE POLICY "festos profiles select"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.festos_can_manage_roles());

CREATE POLICY "festos profiles managers update"
ON public.profiles FOR UPDATE TO authenticated
USING (public.festos_can_manage_roles())
WITH CHECK (public.festos_can_manage_roles());

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
