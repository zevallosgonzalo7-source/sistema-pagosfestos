# FESTOS - Carga masiva de comprobantes (corregido)

Este paquete contiene la prueba real con los 5 PDFs y el CSV de Compras.

## Correcciones incluidas

- Normaliza tildes para Supabase Storage: `CATÓLICA DEL PERÚ` -> `CATOLICA DEL PERU`.
- Continúa con el siguiente archivo si uno falla.
- Detecta archivos que ya existen y no los duplica.
- Mantiene `UPDATE_DATABASE=false` para no tocar la tabla de compras todavía.
- Incluye `.gitignore` para proteger `.env`, PDFs y ZIP de facturas.

## Uso

1. Abre esta carpeta en VS Code.
2. Ejecuta:

```powershell
npm install
copy .env.example .env
```

3. Abre `.env` y coloca tus datos reales de Supabase.
4. Para subir los 5 PDFs usa:

```env
DRY_RUN=false
UPDATE_DATABASE=false
```

5. Ejecuta:

```powershell
npm run cargar
```

## Dónde se guardan

Bucket: `compras-adjuntos`

Ruta:

`compras/AÑO/MES/AÑOMES_RAZONSOCIAL_NUMERODOCUMENTO.pdf`

Ejemplo:

`compras/2026/10/202610_PONTIFICIA UNIVERSIDAD CATOLICA DEL PERU_F062-31285.pdf`

## IMPORTANTE

- No publiques `.env` ni la clave Service Role / Secret Key.
- No hagas `git add .` con documentos reales sin revisar primero.
- Este paquete NO actualiza todavía la tabla de compras; solo Storage.
