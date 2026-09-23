-- ============================================================
-- FESTOS V29 SECURITY LITE · FASE 3 OPCIONAL
-- BORRAR CREDENCIALES DEL LOGIN ANTIGUO
-- ============================================================
-- EJECUTA SOLO cuando los 4 usuarios ya hayan iniciado sesión con V29
-- y Fase 2 esté funcionando correctamente.
-- Esta fase elimina la tabla que contenía las contraseñas antiguas.
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.verificar_login(text,text);
DROP FUNCTION IF EXISTS public.listar_usuarios();
DROP FUNCTION IF EXISTS public.crear_usuario(text,text,text,text);
DROP FUNCTION IF EXISTS public.cambiar_password(text,text,text);
DROP FUNCTION IF EXISTS public.set_estado_usuario(text,boolean,text);
DROP FUNCTION IF EXISTS public.eliminar_usuario(text);

DROP TABLE IF EXISTS public.usuarios_sistema;

-- roles_permisos ya no se usa en V29; profiles es la fuente de verdad.
DROP TABLE IF EXISTS public.roles_permisos;

NOTIFY pgrst, 'reload schema';
COMMIT;
