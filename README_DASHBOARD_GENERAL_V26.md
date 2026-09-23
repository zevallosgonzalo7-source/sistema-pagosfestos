# FESTOS Gestión Empresarial · V26 Dashboard General

Cambios principales:

- El menú **Análisis Ejecutivo** ahora se llama **Dashboard general**.
- Dashboard general contiene dos vistas seleccionables:
  - **Dashboard proyectos**
  - **Dashboard ventas**
- **Dashboard proyectos** consulta únicamente:
  - `cotizaciones`
  - `proyectos`
  - `clientes`
  - `proveedores`
- Se eliminó la dependencia del dashboard con `pagos`.
- Dashboard proyectos incluye filtros por período, ejecutivo y LOB, KPIs, evolución mensual, estado de proyectos, estado de cotizaciones, valor por ejecutivo, valor por LOB, top clientes, top proyectos y distribución de proveedores por categoría.
- El valor de proyecto usa **Valor venta sin IGV** (`valor_base` / `valor_venta`) y usa el subtotal de la cotización vinculada solo como respaldo para registros históricos incompletos.
- **Dashboard ventas** queda diseñado visualmente pero no consume ni calcula datos reales todavía.

## Validación realizada

Se verificó sintaxis JSX de `src/modules/ExecutiveDashboard.jsx` y `src/App.jsx` con TypeScript en modo `--noEmit`.

No se realizó un build Vite completo en este entorno porque la instalación de dependencias no terminó dentro del tiempo disponible.
