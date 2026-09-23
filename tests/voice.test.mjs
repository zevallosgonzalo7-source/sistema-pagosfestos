import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretVoiceCommand, extractVoiceFields, speechNumber, matchVoiceClient } from '../src/voice/commands.js';

test('navega a módulos sin crear registros', () => {
  assert.deepEqual(interpretVoiceCommand('abre cotizaciones'), { action: 'navigate', target: 'cotizaciones' });
  assert.deepEqual(interpretVoiceCommand('Dashboard general'), { action: 'navigate', target: 'analisis' });
  assert.deepEqual(interpretVoiceCommand('abre dashboard ventas'), { action: 'navigate', target: 'analisis_ventas' });
  assert.deepEqual(interpretVoiceCommand('proyectos'), { action: 'navigate', target: 'proyectos' });
  assert.deepEqual(interpretVoiceCommand('abre mi perfil'), { action: 'navigate', target: 'perfil' });
  assert.deepEqual(interpretVoiceCommand('muestra las notificaciones'), { action: 'navigate', target: 'notificaciones' });
  assert.deepEqual(interpretVoiceCommand('abre roles'), { action: 'navigate', target: 'roles' });
});
test('crea un borrador de proyecto a partir de una frase', () => {
  const parsed = interpretVoiceCommand('Crea un proyecto cliente Xiaomi proyecto Stand feria ejecutivo Mar valor de venta doce mil soles');
  assert.deepEqual(parsed, { action: 'draft', kind: 'project', startNew: true, fields: { client_name: 'Xiaomi', project_name: 'Stand feria', executive: 'MAR', sale_value: 12000 } });
});
test('crea un borrador de cotización con item, cantidad y costos', () => {
  const parsed = interpretVoiceCommand('Nueva cotización cliente Xiaomi proyecto Feria item tres banners cantidad 3 valor unitario 250 costo unitario 150');
  assert.equal(parsed.action, 'draft');
  assert.equal(parsed.kind, 'quote');
  assert.deepEqual(parsed.fields, { client_name: 'Xiaomi', project_name: 'Feria', item_description: 'tres banners', quantity: 3, unit_price: 250, unit_cost: 150 });
});
test('dictado adicional y nuevos items', () => {
  assert.deepEqual(interpretVoiceCommand('cantidad 2 valor unitario 200','quote').fields, { quantity: 2, unit_price: 200 });
  assert.equal(interpretVoiceCommand('agrega item rotulos cantidad dos','quote').fields.append_item, true);
  assert.deepEqual(extractVoiceFields('categoría Desarrollos especiales estado finalizado', 'project'), { lob: 'Desarrollos especiales', status: 'FINALIZADO' });
});
test('interpreta números dictados sin permitir números negativos ni inventar montos', () => {
  assert.equal(speechNumber('doce mil soles'), 12000);
  assert.equal(speechNumber('1,250.50 soles'), 1250.5);
  assert.equal(speechNumber('veinticinco'),25);
  assert.equal(speechNumber('quinientos'),500);
  assert.equal(speechNumber('dato desconocido'),null);
});
test('el cliente tiene que coincidir con un único registro existente', () => {
  const clientes=[{id:'1',nombre:'Xiaomi Perú',estado:true},{id:'2',nombre:'Xiaomi SAC',estado:true},{id:'3',nombre:'Sony Perú',estado:true}];
  assert.deepEqual(matchVoiceClient(clientes,'Sony'), {status:'matched', id:'3', name:'Sony Perú'});
  assert.equal(matchVoiceClient(clientes,'Xiaomi').status,'ambiguous');
  assert.equal(matchVoiceClient(clientes,'Cliente inventado').status,'missing');
});
test('las acciones irreversibles no se ejecutan mediante voz', () => {
  for(const command of ['guarda la cotización','elimina el proyecto','aprueba la cotización','envía a revisión']) assert.equal(interpretVoiceCommand(command).action, 'confirm-required');
});

// V29.7: comandos sociales, calendario y consultas del Dashboard.
const { answerSmallTalk } = await import('../src/voice/smallTalk.js');
const { classifyDashboardQuestion, dashboardPeriod } = await import('../src/voice/dashboardIntents.js');
test('responde con el nombre al saludo y ofrece conversación básica', () => {
  const date = new Date(2026, 8, 23, 9, 5);
  assert.match(answerSmallTalk('Hola', 'GONZALO', date), /Buenos días, GONZALO/);
  assert.match(answerSmallTalk('qué hora es', 'GONZALO', date), /9:05/);
  assert.match(answerSmallTalk('qué día es hoy', 'GONZALO', date), /s(?:ep|et)iembre/);
  assert.match(answerSmallTalk('qué puedes hacer', 'MAR', date), /Dashboard/);
});
test('reconoce todas las secciones consultables del dashboard proyectos', () => {
  const samples = {
    'dame un resumen del dashboard': 'summary',
    'cuál es la utilidad proyectada': 'profit',
    'cuánto es el costo estimado': 'cost',
    'cuál es el margen proyectado': 'margin',
    'cuántos proyectos finalizados tenemos': 'projects',
    'dime estado de proyectos': 'status',
    'cuántas cotizaciones aprobadas hay': 'quotes',
    'cuántos clientes hay': 'clients',
    'cuántos proveedores activos hay': 'providers',
    'cuál es el valor por línea de negocio': 'lob',
    'participación por ejecutivo': 'executives',
    'valor de proyectos por mes': 'monthly',
    'cuáles son los principales proyectos por valor': 'topProject',
    'cuáles son los top clientes por proyectos': 'topClients',
    'distribución por categoría de proveedores': 'providerCategories',
    'cuántos proyectos vencidos hay': 'overdue',
    'cuántas próximas entregas hay': 'due',
    'cuál es la venta proyectada de Mar': 'sales',
    'dashboard ventas': 'unconnected',
  };
  for (const [question, expected] of Object.entries(samples)) assert.equal(classifyDashboardQuestion(question), expected, question);
});
test('filtros de tiempo por defecto y mes anterior', () => {
  assert.deepEqual(dashboardPeriod('utilidad total', new Date(2026, 8, 23)), {start:'2026-01-01',end:'2026-09-23',label:'del año 2026'});
  assert.deepEqual(dashboardPeriod('utilidad mes pasado', new Date(2026, 0, 5)), {start:'2025-12-01',end:'2025-12-31',label:'del mes pasado'});
});

test('catálogo de nueve categorías y una categoría general por cotización', async () => {
  const { CATEGORIAS_FESTOS } = await import('../src/categories.js');
  assert.equal(CATEGORIAS_FESTOS.length, 9);
  assert.equal(new Set(CATEGORIAS_FESTOS).size, 9);
  assert.deepEqual(extractVoiceFields('categoría del ítem Desarrollos especiales', 'quote'), { lob: 'Desarrollos especiales' });
  assert.deepEqual(extractVoiceFields('categoría general Material POP', 'quote'), { lob: 'Material POP' });
});
