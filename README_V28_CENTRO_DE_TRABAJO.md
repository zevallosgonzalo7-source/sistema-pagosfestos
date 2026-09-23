# FESTOS V28 — Centro de trabajo · Versión de aplicación 1.2.0

Base: V27.3 con iconos lineales y los arreglos de tooltips anteriores.

## Funciones ya implementadas

- Nuevo módulo **Centro de trabajo** en el menú lateral, con vistas Mi espacio, Kanban, Calendario, Documentos y Actividad.
- Mi espacio: proyectos visibles para el usuario, total sin IGV, cotizaciones en revisión (si tiene permiso) y entregas reales cuando existan fechas de entrega. Accesos rápidos a los módulos existentes.
- Lista compacta: vista de tabla con orden por fecha de registro, nombre o valor, y filtros recordados localmente.
- Kanban: muestra proyectos por sus tres estados y permite actualizar el estado desde la tarjeta únicamente si el perfil tiene permiso para gestionar proyectos. Espera la respuesta de Supabase antes de notificar el cambio. No escribe ni regenera el código PRY.
- Calendario: distingue claramente fechas de **registro** y **entrega**; nunca inventa un vencimiento usando `created_at`. Permite navegar por meses y abrir fichas de proyecto.
- Ficha lateral: descripción, cliente, ejecutivo, LOB, estado, cotización vinculada, valor sin IGV y edición de fechas cuando las columnas existan.
- Proyectos: formulario y ficha muestran las fechas de inicio y entrega **solo** cuando detectan que la migración opcional fue aplicada a la tabla.
- Preferencias: filtros del Centro de trabajo guardados localmente por usuario y dispositivo. No se comparten con otros equipos.
- Cotizaciones: recuperación de formulario nuevo sin guardar en Supabase, con copia temporal local aislada por usuario, hasta 7 días. La copia se descarta tras guardar con éxito. No sustituye los borradores guardados en Supabase ni funciona entre dispositivos.
- `Ctrl + K`: accesos rápidos a Inicio, Dashboard general y Centro de trabajo; comandos Nuevo proyecto y Nueva cotización visibles solo con permiso, y búsqueda de registros de módulos con permiso de lectura.
- Dashboard proyectos: seguimiento de entregas registradas, proyectos vencidos y próximos 7 días. Dashboard ventas permanece solo visual, sin integración a datos.
- Indicador de conexión renombrado «Red disponible»: no asegura por sí mismo el acceso a Supabase.

## Activación de fechas: OPCIONAL

El Centro de trabajo funciona sin nuevos cambios de base de datos, pero **no** podrá registrar ni alertar vencimientos hasta tener fechas reales:

1. Respalda los datos de Supabase y comprueba tus permisos.
2. Revisa y ejecuta `supabase/V28_FECHAS_PROYECTOS_OPCIONAL.sql` en el SQL Editor.
3. Verifica que existan `fecha_inicio` y `fecha_entrega`.
4. Recarga FESTOS. En Proyectos o en la ficha lateral registra fechas REALES. Las 55 filas importadas conservarán las fechas vacías hasta que las completes.

## Secciones preparadas, NO habilitadas como funciones completas

- **Documentos**: la pantalla explica que no se pueden subir documentos privados todavía. No se ha creado un bucket público; antes de habilitar hay que migrar el login actual basado en RPC/localStorage a un mecanismo de sesión autenticada verificable por Supabase, crear Storage privado y políticas RLS revisadas.
- **Actividad**: fechas de creación y estados actuales que ya existen en la base de datos. No es una bitácora compartida de ediciones; la auditoría anterior se guarda localmente por dispositivo. Un historial compartido necesita tabla dedicada y controles de acceso en el servidor.
- **Actualizaciones automáticas de escritorio**: no habilitadas. Es necesario definir dónde se publican instaladores y metadatos de actualización, configurar firma de código y la política de instalación. No basta con agregar un botón.
- **Control de acceso por rol**: los permisos visibles actuales siguen condicionados por la implementación anterior. No deben considerarse una frontera de seguridad del servidor hasta verificar autenticación real y RLS/policies de Supabase. No subir datos confidenciales a un supuesto Storage privado sin esa revisión.

## Compilar en Windows (fuera de OneDrive)

Descomprime el ZIP en `C:\FESTOS_V28` (debe haber `package.json` directamente en esa carpeta), cierra FESTOS/Electron y ejecuta en PowerShell:

```powershell
cd C:\FESTOS_V28
npm install
npm run desktop:dev
```

Después de probar Kanban y el Centro de trabajo:

```powershell
npm run desktop:build
```

El instalador de Windows debería quedar en `release/FESTOS-Gestion-Empresarial-Setup-1.2.0.exe`. Debes compilar y probar ese ejecutable en tu PC; este ZIP **NO** contiene un instalador ya compilado.

No ejecutes `npm audit fix --force` sin revisar las actualizaciones: puede introducir cambios incompatibles. Revisar las dependencias reportadas por `npm audit` antes de distribuir a más personas.

## Revisión antes de distribuir

Probar con usuario con permiso y otro sin permiso para editar proyectos; comprobar que la escritura restringida falla también en Supabase (no solo en React). Confirmar que `PRY-AAAA-MM-###` sigue generándose en Supabase y que los importes siguen representando VALOR SIN IGV. Probar las cotizaciones nuevas, aprobadas y el flujo de generación de proyectos después de cada cambio de versión.
