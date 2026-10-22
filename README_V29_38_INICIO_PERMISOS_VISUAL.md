# FESTOS V29.38 - Inicio + permisos + pulido visual

## Cambios incluidos
- Nuevo módulo **Inicio** como pantalla oficial de entrada.
- Toda sesión válida aterriza en `Inicio`.
- Bienvenida personalizada con saludo según hora, nombre y cargo.
- KPIs reales: Cotizaciones, Compras del mes, Proveedores y Proyectos activos.
- Accesos rápidos y actividad reciente.
- Inicio agregado como primer acceso del sidebar.
- Filtros de Cotizaciones reorganizados y unificados visualmente.
- Nueva Cotización se cierra haciendo clic fuera o con `ESC`.
- Overlays editables principales admiten cierre por fondo; `ESC` intenta cerrar el overlay activo.
- Roles y permisos rediseñados con switches interactivos.
- DESARROLLADOR SOFTWARE habilitado en frontend para gestionar permisos.
- Nueva tipografía: Inter + Plus Jakarta Sans.
- Manual actualizado a `Manual_Usuario_FESTOS_V32.pdf`.

## IMPORTANTE - Supabase
Para que DESARROLLADOR SOFTWARE pueda guardar permisos de verdad, ejecutar una vez en Supabase SQL Editor:

`supabase/FESTOS_V29_38_DESARROLLADOR_PERMISOS.sql`

La migración amplía las políticas RLS de `profiles` a HEAD ADMIN y DESARROLLADOR SOFTWARE. El trigger existente sigue protegiendo la cuenta HEAD ADMIN.

## Prueba local
```powershell
npm install
npm run dev
```

Validar:
1. Iniciar sesión -> debe abrir Inicio.
2. Abrir Nueva Cotización -> clic fuera y ESC deben cerrarla.
3. Revisar filtros de Cotizaciones en laptop y móvil.
4. Ejecutar SQL V29.38 y probar Roles y Permisos con DESARROLLADOR SOFTWARE.
5. Abrir Manual desde el sidebar y confirmar V32.
