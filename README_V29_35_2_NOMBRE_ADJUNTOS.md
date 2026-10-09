# FESTOS V29.35.2 — NOMBRE AUTOMÁTICO DE ADJUNTOS

Cambio principal:
- Los archivos adjuntos de Registro de Compras se renombran automáticamente al subirlos a Supabase Storage usando:
  Proveedor + Número de documento + Fecha.

Ejemplo:
- Proveedor: ENTEL PERÚ S.A.
- Número de documento: F001-000245
- Fecha: 2026-10-09

Nombre guardado:
ENTEL_PERU_SA_F001-000245_2026-10-09.pdf

Organización en Storage:
- PDF:        <compraId>/pdf/<nombre>
- XML:        <compraId>/xml/<nombre>
- COTIZACIÓN: <compraId>/cotizacion/<nombre>

Esto evita colisiones si PDF y COTIZACIÓN tienen la misma extensión.

Notas:
- Se conserva la extensión original del archivo.
- Se eliminan tildes y caracteres problemáticos para Storage.
- Si falta Proveedor, Número de documento o Fecha se usa un texto de respaldo.
- No requiere SQL nuevo.
