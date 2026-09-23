# FESTOS Gestión Empresarial — Windows V25

Esta versión parte de V24 y agrega la capa Electron para convertir FESTOS en una aplicación de escritorio Windows.

## Desarrollo

```bash
npm install
npm run desktop:dev
```

## Generar instalador Windows

```bash
npm run desktop:build
```

El instalador aparecerá en `release/` con el nombre:

`FESTOS-Gestion-Empresarial-Setup-1.0.0.exe`

También existe una versión portable:

```bash
npm run desktop:build:portable
```

## Importante

La aplicación sigue usando el mismo React/Vite y Supabase. Electron solamente añade la ventana de escritorio.
No se modificaron las tablas de Supabase en esta etapa.

La primera compilación descarga Electron y Electron Builder, por lo que requiere conexión a Internet.
