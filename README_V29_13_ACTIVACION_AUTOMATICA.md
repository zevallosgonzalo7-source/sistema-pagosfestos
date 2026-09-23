# FESTOS V29.13 · «Hola Festos» sin botón de activación

## Qué se corrigió

- Se eliminó el botón redondo que iniciaba o apagaba manualmente la conversación.
- Después del login y de la animación de bienvenida, FESTOS intenta iniciar automáticamente la escucha en **modo espera**. Cuando muestra un punto verde y «Di Hola Festos», ya está a la espera. No ejecuta órdenes ni consulta datos empresariales hasta detectar la frase de activación.
- Di «Hola Festos» para iniciar la conversación o «Hola Festos, abre Proyectos» en una sola frase. Tras la respuesta se reanuda la escucha. «Hasta luego Festos» vuelve al modo espera.
- El punto de estado es informativo, no un botón de activación. El botón pequeño de chat solo abre el estado, las opciones de privacidad y la entrada por texto; no es necesario tocarlo para hablar.
- Si antes se desactivó explícitamente la escucha automática en **este equipo y usuario**, se respeta esa elección. Se puede reactivar desde Opciones.
- El reconocimiento admite algunas transcripciones frecuentes del nombre propio («Hola Festos», «Hola Festo», «Hola Pestos», etc.), pero el modelo local puede equivocarse y no hay garantía de activación en todas las condiciones acústicas.

## Privacidad y permisos

- El modo de espera usa el micrófono continuamente mientras la sesión de FESTOS está abierta, hasta que desactives «Escuchar Hola Festos automáticamente», cierres la app o cierres sesión. Consume CPU y batería.
- Los fragmentos en espera se transcriben localmente en la app de escritorio para buscar la frase, no se envían a un proveedor externo. No se guardan como registros de conversaciones ajenas.
- La primera vez el sistema o navegador **puede pedir permiso para el micrófono**. Si se bloquea, FESTOS mostrará «Micrófono no disponible»: abre el panel pequeño para ver el motivo, concede el permiso en el sistema/navegador y desactiva/reactiva la opción. Los navegadores pueden impedir escuchar en segundo plano o exigir un gesto de usuario inicial. No se puede eludir ese permiso.
- El estado «Preparando escucha…» **no significa que ya te esté oyendo**. Espera «Di Hola Festos» antes de probar la frase.

## Instalación y prueba

1. Haz copia de `sistema-pagosv2`, sustituye sus archivos por los de este ZIP sin borrar `public/voice-assets` ni tu propio contenido local necesario. Comprueba que `package.json` esté en la raíz de la carpeta.
2. `npm install` y `npm run desktop:dev`. El modelo de voz Base es el mismo de V29.12; si `npm run voice:check` falla, ejecuta `npm run voice:prepare` desde tu equipo de desarrollo.
3. Abre FESTOS, espera a que termine la bienvenida y aparece el estado verde «FESTOS · Di Hola Festos»; no pulses el micrófono (ya no existe). Pronuncia con claridad «Hola Festos», espera la respuesta y di «Abre Proyectos».
4. Di «Hasta luego Festos»: vuelve a espera. Di «Hola Festos, cuál es la utilidad proyectada»: consulta con tu sesión/permiso.
5. Si aparece «Micrófono no disponible» abre las opciones pequeñas, revisa los permisos y reactiva la escucha desde allí. Si está verde pero no entiende la frase, el problema puede estar en la transcripción local. Prueba en una habitación silenciosa y envía la frase transcrita que aparezca al hablar, si la interfaz muestra alguna.

No hay SQL nuevo, no se cambian proyectos, cotizaciones, datos, PRY ni roles. No se añaden claves privadas ni servicios de pago. Esta versión **aún requiere prueba real en Windows/Chrome/Safari**: los test de comandos no verifican la precisión acústica del reconocimiento ni los permisos del SO.
