# FESTOS 1.3.3 · Asistente de voz flotante (versión inicial)

## Lo nuevo

Un botón flotante de micrófono abajo a la derecha permite hablar sin abrir otra pantalla. El asistente escucha **una indicación por pulsación** y abre módulos o prepara/actualiza formularios de proyectos y cotizaciones. Su icono secundario permite ver el texto reconocido o escribir una instrucción. No es un chatbot generativo: interpreta órdenes definidas mediante reglas locales; no hace consultas a un modelo de IA ni cobra por tokens.

El reconocimiento de voz utiliza `SpeechRecognition`/`webkitSpeechRecognition` cuando el motor del navegador/Chromium lo ofrece. **La disponibilidad en Electron/Windows/macOS no está garantizada**, pues el motor depende del sistema, versión y servicio de voz configurado. Si el reconocimiento falla, el panel muestra una explicación y permite escribir; en Windows puedes usar **Win + H** tras enfocar ese campo para dictar con las herramientas del sistema. Para voz fiable en todos los equipos será necesario integrar posteriormente un proveedor de transcripción en backend, con su configuración, política de privacidad y posible costo.

## Pruebas rápidas

1. Inicia sesión en FESTOS y espera a que termine la bienvenida.
2. Pulsa una vez el botón verde de micrófono abajo a la derecha; permite su acceso si se solicita.
3. Di una frase clara, por ejemplo:
   - «Abre proyectos».
   - «Crea un proyecto cliente Xiaomi proyecto Stand para feria ejecutivo Mar valor de venta doce mil».
   - «Nueva cotización cliente Xiaomi proyecto Stand para feria item lona cantidad dos valor unitario cuatrocientos costo unitario doscientos».
   - Dentro de la cotización: «Agrega item banner cantidad 3 valor unitario 150 costo unitario 75».
   - Dentro del proyecto o cotización: «Cliente Sony», «Proyecto Campaña de verano», «Descripción montaje y desmontaje».
   - «Abre dashboard», «Abre clientes», «Abre centro de trabajo».
4. FESTOS abre el módulo y completa los campos reconocidos. Puedes seguir dictando tras pulsar de nuevo el micrófono.
5. Revisa cliente, cantidades, importes, costos y demás datos, y guarda **manualmente** con el botón habitual de la app.

## Límites de esta versión

- Los nombres de clientes se relacionan **solo con clientes existentes y con coincidencia única**. Si hay varias coincidencias o ninguna, debes seleccionar el cliente manualmente.
- El dictado NO registra clientes nuevos, NO guarda automáticamente, NO aprueba, NO cambia estados de cotizaciones, NO elimina ni envía documentos.
- Los cálculos de IGV y rentabilidad continúan en el formulario normal; el dictado no sustituye sus validaciones.
- El valor de venta en Proyectos se interpreta **sin IGV** y se almacena como `valor_base`/`valor_venta` en proyectos manuales. Se añadió ese campo opcional al formulario manual; si lo dejas vacío no sobreescribe los valores existentes.
- El reconocimiento puede enviar audio al proveedor de voz del navegador o sistema operativo, sujeto a sus condiciones. FESTOS no guarda archivos de audio con esta función. No dictes contraseñas ni información que no debas compartir con el proveedor de voz.
- Los comandos se interpretan localmente, pero el proveedor de reconocimiento de voz depende del entorno. Las frases libres fuera del catálogo no se entienden aún como lo haría un modelo de lenguaje.

## Instalación

Usa este ZIP como **proyecto completo**, en una carpeta de pruebas fuera de OneDrive, por ejemplo `C:\\FESTOS_BUILD`. Extrae el contenido de forma que exista `C:\\FESTOS_BUILD\\package.json`. Cierra FESTOS antes de sustituir archivos. Guarda respaldo de la versión anterior antes de sobrescribir.

```powershell
cd C:\FESTOS_BUILD
npm install
npm run desktop:dev
```

Si quieres probar el parser sin arrancar Electron:

```powershell
npm run test:voice
```

**No hace falta ejecutar SQL nuevo** por este cambio de voz. Las fases de Supabase Auth/RLS preparadas para V29 deben estar configuradas como corresponda a tu instalación; este ZIP no las activa ni las modifica.

El código fue comprobado mediante pruebas del parser y validación sintáctica de los JSX; **no equivale a una prueba real del reconocimiento de voz ni a un build instalado de Electron**. Valida primero en tu PC antes de generar y compartir un nuevo instalador.
