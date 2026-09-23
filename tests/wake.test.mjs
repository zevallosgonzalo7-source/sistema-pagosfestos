import test from 'node:test';
import assert from 'node:assert/strict';
import { wakeIntent, sleepIntent } from '../src/voice/wakeWord.js';
import { parseRecordQuestion } from '../src/voice/recordIntents.js';

test('solo la frase específica activa FESTOS', () => {
  assert.deepEqual(wakeIntent('Hola Festos, abre proyectos'), { wake:true, command:'abre proyectos' });
  assert.deepEqual(wakeIntent('Ola festo'), { wake:true, command:'' });
  assert.deepEqual(wakeIntent('¡Hola, Festos!'), { wake:true, command:'' });
  assert.deepEqual(wakeIntent('Hola pesto abre proyectos'), { wake:true, command:'abre proyectos' });
  assert.equal(wakeIntent('Hola, abre proyectos').wake, false);
  assert.equal(wakeIntent('Hola, estamos en la oficina').wake, false);
  assert.equal(wakeIntent('Ahora con procesaciones').wake, false);
  assert.equal(sleepIntent('Hasta luego Festos'), true);
});
test('búsqueda de registro por código sin construir SQL desde la voz', () => {
  assert.deepEqual(parseRecordQuestion('Cuál es la utilidad del proyecto PRY-202609-055'), { kind:'project',target:'PRY-202609-055',byCode:true });
  assert.deepEqual(parseRecordQuestion('Dime el teléfono del proveedor ACME'), {kind:'provider',target:'acme'});
  assert.equal(parseRecordQuestion('Elimina todos los proyectos'), null);
});
