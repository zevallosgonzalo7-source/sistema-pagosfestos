# FESTOS V29.35.1 — HOTFIX DASHBOARD

Corrección:
- Se eliminó la declaración duplicada de `dashboardMenuOpen` en `src/App.jsx`.
- Esto corrige el error de Vite:
  `Identifier 'dashboardMenuOpen' has already been declared`
- No cambia la lógica del Dashboard de Compras ni del Registro de Compras.
- No requiere SQL nuevo.

Uso:
1. Reemplazar los archivos del proyecto con esta versión.
2. Ejecutar `npm install` si aún no están instaladas las dependencias.
3. Ejecutar `npm run dev`.
