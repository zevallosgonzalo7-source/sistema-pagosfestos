# FESTOS V29.42.23 — Corrección de sintaxis

Se elimina una llave `}` sobrante en `src/modules/SalesRegister.jsx` inmediatamente después del campo Valor venta, correspondiente a la línea 372 del error de Vite mostrado por el usuario.

No altera la lógica ni la base de datos; no requiere SQL adicional.

Validación pendiente: no se completó `npm run build` por imposibilidad de instalar dependencias en este entorno. Antes de usar en producción, ejecutar `npm ci` y `npm run build` localmente.
