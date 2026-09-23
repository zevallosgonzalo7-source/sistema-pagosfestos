FESTOS V26.6 — PANTALLA DE INICIO WINDOWS

Al abrir el ejecutable, aparece una ventana de bienvenida animada con logo FESTOS.
La pantalla desaparece al terminar el primer render de React (con una espera mínima
de 0,9 s para que la animación sea perceptible). Si hay un problema de carga,
la animación no bloquea indefinidamente la aplicación.

El resto de los módulos, Supabase, Dashboard, inicio de sesión y permisos
permanecen sin cambios respecto de V26.5. No requiere SQL adicional.

GENERAR NUEVO INSTALADOR (en tu PC):
1. Descomprime este ZIP en una carpeta nueva fuera de OneDrive, por ejemplo
   C:\FESTOS_BUILD_V26_6\
2. En PowerShell, entra en la carpeta que contiene package.json y ejecuta:
   npm install
   npm run desktop:build
3. Verifica que el instalador aparezca en release y que la aplicación abra.
4. Comparte el .exe solo tras probar que inicia sesión y abre Dashboard general.

Se incluyó el icono build_icon.ico de 256x256 para evitar el error de la
versión ZIP anterior, en la que el icono tenía únicamente 128x128.

El nuevo instalador tiene versión 1.0.1 para distinguirlo de V26.5.
Archivo esperado: release\FESTOS-Gestion-Empresarial-Setup-1.0.1.exe
