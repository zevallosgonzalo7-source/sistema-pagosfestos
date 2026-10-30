# FESTOS V29.42.12 — Fix Clientes / Agente retenedor

- Corrige `Cannot read properties of null (reading 'trim')` al editar clientes existentes.
- Normaliza campos opcionales `null` antes de abrir el formulario.
- Blindaje de nombre, documento, categoría y contactos con `String(... || '')` antes de `trim()`.
- `agente_retenedor` se guarda como booleano en `clientes`.
- No requiere SQL adicional si ya se ejecutó V29.42.10.
