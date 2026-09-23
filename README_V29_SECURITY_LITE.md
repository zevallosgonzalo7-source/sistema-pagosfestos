# FESTOS V29 · Security Lite

Esta versión cambia el acceso de FESTOS a **Supabase Auth con correo + contraseña** y prepara la base para cerrar el acceso anónimo mediante RLS.

## Cuentas corporativas

| Usuario | Correo | Rol |
|---|---|---|
| GONZALO | gonzalo@festosmkt.com | HEAD ADMIN |
| JESUS | administracion@festosmkt.com | ADMIN |
| MAR | mar@festosmkt.com | OPERADORA COMERCIAL |
| RODRIGO | rodrigo@festosmkt.com | DESARROLLADOR SOFTWARE |

FESTOS **no almacena ni conoce** las contraseñas. No escriba contraseñas en archivos SQL, código o documentación.

## Orden seguro de migración

### 1. Crear las 4 cuentas en Supabase Auth
En Supabase:

1. Authentication → Users.
2. Add user / Create new user.
3. Crear cada correo de la tabla anterior.
4. Asignar una contraseña temporal de al menos 8 caracteres.
5. Marcar/usar la opción de confirmar el usuario al crearlo si el panel la ofrece.
6. Entregar la contraseña temporal directamente a cada persona; cada usuario puede cambiarla desde **Mi perfil** en V29.

No elimine todavía `usuarios_sistema` ni el login antiguo.

### 2. Ejecutar Fase 1
Ejecutar completo:

`supabase/V29_01_AUTH_PROFILES_PREPARAR.sql`

Al final deben aparecer **4 filas** en `public.profiles`.

### 3. Probar V29 antes de cerrar V28
En una carpeta de build:

```powershell
npm install
npm run desktop:dev
```

Probar primero con `gonzalo@festosmkt.com` y después con las demás cuentas.

Comprobar:
- Login por correo.
- Clientes / Proveedores / Proyectos / Cotizaciones.
- Aprobación de cotización para un usuario autorizado.
- Eliminación de proyecto solo para HEAD ADMIN.
- Cambio de contraseña desde Mi perfil.
- Roles y Permisos visible solo para HEAD ADMIN.

### 4. Ejecutar Fase 2
Solo después de que V29 funcione:

`supabase/V29_02_ACTIVAR_RLS_SEGURA.sql`

Esta fase:
- elimina políticas abiertas antiguas;
- revoca acceso `anon` a las tablas de FESTOS;
- permite acceso usando JWT de Supabase Auth;
- aplica permisos del perfil en la base de datos;
- deshabilita RPC antiguas de login/usuarios;
- elimina las versiones inseguras de `aprobar_cotizacion(uuid,text)` y `eliminar_proyecto_gonzalo(uuid,text)`.

**Después de Fase 2 las versiones V28 y anteriores dejan de ser compatibles. Actualice los 4 equipos a V29.**

### 5. Limpieza opcional
Cuando los cuatro usuarios ya trabajen correctamente con V29 durante un tiempo prudente, ejecutar:

`supabase/V29_03_LIMPIAR_LOGIN_LEGACY_OPCIONAL.sql`

Eso elimina la tabla antigua `usuarios_sistema`, que contenía las credenciales del login legado, y `roles_permisos`, ya sustituida por `profiles`.

## Cambios de seguridad incluidos

- Supabase Auth con correo + contraseña.
- Sesión JWT persistente y autorrenovable.
- Perfiles ligados a `auth.users.id`.
- Cuenta desactivada = sin acceso a datos por RLS.
- Permisos reales consultados desde `profiles`.
- Aprobación de cotizaciones valida permisos en el servidor.
- Eliminación de proyectos valida HEAD ADMIN en el servidor.
- Contraseña propia se cambia con `supabase.auth.updateUser`.
- El panel de Roles ya no puede ver ni cambiar contraseñas ajenas.
- El frontend nunca usa `service_role`.
- Electron mantiene `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true` y limita aperturas externas/permisos.

## Rollback durante la Fase 1
Mientras **no** haya ejecutado Fase 2, el login viejo puede seguir funcionando con V28. Esto permite probar V29 sin bloquear al equipo.

Después de Fase 2, si existe un problema, corrija V29/RLS antes de volver a producción; no vuelva a abrir políticas `using (true)` para `anon` como solución permanente.
