# FESTOS V29.33.6 · Calendario compartido + colores de cotizaciones

Base: V29.33.5.

## Calendario global
- Al iniciar sesión y después de la bienvenida, si existen actividades vigentes entre hoy y los próximos 7 días, aparece un aviso flotante durante 5 segundos.
- El aviso muestra hasta 3 actividades y permite abrir el Calendario global.
- Las actividades cuya `fecha_fin` ya pasó se consideran finalizadas automáticamente y se muestran en gris.
- Nuevo filtro de estado: Todas / Vigentes / Finalizadas.
- El resumen mensual muestra cuántas actividades están vigentes y cuántas finalizadas.
- El detalle de actividad muestra una etiqueta Vigente / Finalizada.
- No requiere SQL nuevo.

## Cotizaciones
Sombreado de tarjeta completa según estado:
- Borrador: gris.
- En Revisión: naranja.
- Aprobado: verde.

No se cambia lógica de cotizaciones, cálculos, permisos ni Supabase.
