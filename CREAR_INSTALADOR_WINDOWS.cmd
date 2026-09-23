@echo off
setlocal
cd /d "%~dp0"
title FESTOS - Crear instalador Windows

echo.
echo ================================================
echo  FESTOS - Crear instalador Windows
echo ================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no se encuentra en PATH.
  echo Instale Node.js LTS y vuelva a ejecutar este archivo.
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm no se encuentra en PATH.
  pause
  exit /b 1
)

echo [1/2] Instalando dependencias y actualizando package-lock.json...
echo Se usa npm install porque el lockfile original no incluye todas las dependencias de Electron.
call npm install --include=dev --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo ERROR: npm install fallo. Copie el PRIMER mensaje que empiece con npm ERR o npm error.
  pause
  exit /b 1
)

echo.
echo [2/2] Compilando FESTOS y generando el instalador...
call npm run desktop:build
if errorlevel 1 (
  echo.
  echo ERROR: No se pudo generar el instalador. Copie el primer error completo.
  pause
  exit /b 1
)

echo.
echo LISTO: revise la carpeta release.
echo Archivo esperado: FESTOS-Gestion-Empresarial-Setup-1.3.0.exe
explorer "%~dp0release"
pause
