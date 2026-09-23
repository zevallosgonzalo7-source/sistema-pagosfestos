# FESTOS Gestión Empresarial · macOS

Esta carpeta está preparada para generar instaladores DMG de FESTOS V29 (1.3.0) para macOS.

## Arquitecturas

- Apple Silicon (M1, M2, M3, M4, etc.): `arm64`
- Mac Intel: `x64`

## Requisitos para compilar

La generación del `.dmg` debe ejecutarse en macOS. Instala Node.js LTS y abre Terminal en la carpeta donde está `package.json`.

### Primera vez

```bash
npm install
```

### Generar ambos instaladores

```bash
npm run desktop:build:mac
```

### Solo Apple Silicon

```bash
npm run desktop:build:mac:arm64
```

### Solo Intel

```bash
npm run desktop:build:mac:x64
```

Los archivos se generan en `release/` con nombres similares a:

- `FESTOS-Gestion-Empresarial-1.3.0-arm64.dmg`
- `FESTOS-Gestion-Empresarial-1.3.0-x64.dmg`

## Instalación

Abrir el `.dmg` y arrastrar FESTOS Gestión Empresarial a Applications.

## Firma de Apple

Estos builds internos pueden generarse sin una cuenta Apple Developer, pero macOS puede advertir que la app proviene de un desarrollador no identificado. Para distribución profesional sin esas advertencias conviene firmar y notarizar la app con Apple Developer ID.


## V29 Security Lite
Antes de iniciar sesión, configure Supabase Auth y ejecute las fases SQL indicadas en README_V29_SECURITY_LITE.md.
