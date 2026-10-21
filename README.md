# FESTOS — Carga masiva final de facturas

Este cargador usa la estructura REAL confirmada en FESTOS:

`{ID_DE_COMPRA}/pdf/{AÑOMES_RAZONSOCIAL_NUMERODOCUMENTO}.pdf`

Después de subir el PDF, actualiza automáticamente:

`public.compras.pdf_factura_path`

con la misma ruta. Así el adjunto aparece y abre desde FESTOS.

## IMPORTANTE

Esta carpeta es independiente del proyecto principal. NO reemplaces el `package.json` de FESTOS.
Puedes guardar esta carpeta dentro del repositorio como una herramienta, pero entra a esta carpeta antes de usar npm.

## Archivos incluidos

- `cargar_facturas.cjs`: carga + vinculación automática.
- `verificar_carga.cjs`: comprueba Storage + `pdf_factura_path`.
- `Data para COMPRAS Y PROVEEDORES(REG(1).csv`: CSV actual usado para el cruce.
- `FACTURAS.zip`: contiene los 5 PDFs de prueba actuales. Para la carga total, REEMPLÁZALO por el ZIP con todos los adjuntos.
- `.env.example`: configuración segura de ejemplo.
- `.gitignore`: evita subir claves y documentos.

## PASO 1 — instalar

Abre PowerShell dentro de ESTA carpeta:

```powershell
npm install
copy .env.example .env
```

Abre `.env` y coloca tu URL y tu Secret/Service Role Key reales.

## PASO 2 — prueba antes de tocar nada

Deja:

```env
DRY_RUN=true
UPDATE_DATABASE=true
```

Ejecuta:

```powershell
npm run probar
```

No subirá ni modificará nada. Generará `resultado_carga.csv` mostrando:

- PDF original
- documento encontrado
- ID de la compra
- nombre final
- ruta exacta que usará en Storage

Revisa que no existan `SIN COINCIDENCIA`, `NO EXISTE EN BD` o `DOCUMENTO DUPLICADO EN BD`.

## PASO 3 — carga real

Reemplaza `FACTURAS.zip` por el ZIP con TODOS los PDFs.

Cambia en `.env`:

```env
DRY_RUN=false
UPDATE_DATABASE=true
VERIFY_AFTER_UPLOAD=true
```

Ejecuta:

```powershell
npm run cargar
```

Por cada PDF el script hará:

1. Buscarlo en el CSV.
2. Normalizar el número de documento (ej. `F005-895` = `F005-00000895`).
3. Encontrar la compra real en `public.compras`.
4. Obtener `compras.id`.
5. Subir a `{id}/pdf/NOMBRE.pdf` dentro de `compras-adjuntos`.
6. Verificar que el archivo exista.
7. Actualizar `compras.pdf_factura_path` con esa ruta exacta.
8. Continuar con el siguiente aunque uno falle.
9. Generar `resultado_carga.csv`.

## PASO 4 — verificar

Después de la carga:

```powershell
npm run verificar
```

Comprobará que cada ruta del reporte existe en Storage y coincide con `pdf_factura_path`.

## Seguridad

- Nunca publiques `.env`.
- No subas `FACTURAS.zip` a GitHub.
- No borres los archivos provisionales antiguos `compras/2026/10/...` hasta terminar y verificar la carga correcta.
- El script NO borra archivos ni compras.
- Si encuentra más de una compra con el mismo documento, la deja para revisión en vez de adivinar.

## Nombre final

Ejemplo:

`202610_PONTIFICIA_UNIVERSIDAD_CATOLICA_DEL_PERU_F062-31285.pdf`

Ruta completa de ejemplo:

`1656c6e1-67a7-49f4-80b7-f52d0ad55bdd/pdf/202610_PONTIFICIA_UNIVERSIDAD_CATOLICA_DEL_PERU_F062-31285.pdf`
