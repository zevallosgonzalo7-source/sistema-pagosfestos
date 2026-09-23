# V29.14 · Enlaces de Dashboard y permisos

- Cotizaciones: creación rápida de Clientes solo visible para HEAD ADMIN, ADMIN y DESARROLLADOR SOFTWARE cuando también tienen `gestionar_clientes`. El handler comprueba el permiso de nuevo. MAR no puede usar el atajo.
- Supabase: aplicar la migración opcional `supabase/V29_14_RESTRINGIR_ALTA_CLIENTES.sql` **solo si ya ejecutaste V29_02**; añade comprobación de rol a INSERT y mantiene los demás permisos vigentes. No ejecutar V29_02 sin probar el login de los cuatro usuarios.
- Datos: la app conserva técnicamente los nombres `ejecutivo`, `fecha_pedido` y `fecha_inicio` de la base, sin migrarlos ni reescribir valores. Los rótulos de vistas usan «Ejecutivo comercial» y «Fecha de pedido». La fecha de inicio operativo permanece en Centro de trabajo como hito distinto del pedido.
- Dashboard: al pulsar por estado, categoría, ejecutivo comercial o vencimiento abre Proyectos y aplica el período seleccionado, los filtros actuales del Dashboard y el criterio pulsado. Limpiar filtros restaura el listado completo. Vencimientos consideran solo proyectos EN PROCESO con fecha_entrega.
- Gráfico de meses: al colocar cursor/foco en cada punto se muestra valor y cambio absoluto/porcentual respecto al mes previo. Si el período anterior fue cero, no se presenta porcentaje indefinido.
- No se insertan, modifican ni renumeran proyectos; no se toca PRY.
- La vista de cotizaciones, navegación y tests se deben probar con cuentas MAR y administradoras en la Supabase real.

- En Centro de trabajo se retira el editor separado de fecha de inicio del proyecto: queda visible Fecha de pedido y solo se edita Fecha de entrega; el campo legado `fecha_inicio` no se escribe ni borra.
- La entrada manual a Proyectos deja de repetir filtros antiguos del Dashboard.
