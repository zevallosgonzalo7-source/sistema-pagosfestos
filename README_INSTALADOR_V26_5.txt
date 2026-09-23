FESTOS V26.5 - Correccion del generador de instalador Windows

El archivo original usaba npm ci con un package-lock.json desactualizado:
el manifiesto del proyecto incluye Electron, electron-builder, concurrently y wait-on,
pero el lockfile no los tenia como dependencias directas. npm ci exige coincidencia
exacta y por eso mostraba el texto de ayuda de npm en lugar de instalar.

SOLUCION:
1) Extraiga este ZIP en una carpeta nueva.
2) Abra festos_v25_win/CREAR_INSTALADOR_WINDOWS.cmd.
3) El script usa npm install --include=dev para actualizar el lockfile local.
4) Si termina correctamente, revise release/FESTOS-Gestion-Empresarial-Setup-1.0.0.exe.
5) Pruebe el instalador y confirme que inicio de sesion y pantallas funcionan antes
   de distribuirlo. Compartir el ZIP del proyecto NO es compartir el instalador.

Si ya esta trabajando en una carpeta extraida de V26.4, tambien puede abrir PowerShell
en esa carpeta y ejecutar: npm install --include=dev ; npm run desktop:build
(Ejecute el segundo comando solo si el primero termina sin errores.)

No copie archivos .env ni credenciales privadas a la distribucion.
