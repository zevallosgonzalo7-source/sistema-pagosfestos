import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app = readFileSync(new URL('../src/App.jsx', import.meta.url),'utf8');
const dash = readFileSync(new URL('../src/modules/ExecutiveDashboard.jsx',import.meta.url),'utf8');
const projects = readFileSync(new URL('../src/modules/BusinessModules.jsx',import.meta.url),'utf8');
const operations = readFileSync(new URL('../src/modules/OperationsCenter.jsx',import.meta.url),'utf8');
const sql = readFileSync(new URL('../supabase/V29_14_RESTRINGIR_ALTA_CLIENTES.sql',import.meta.url),'utf8');

test('el permiso para crear clientes sigue las tres categorías de rol y se pasa a Cotizaciones y Clientes',()=>{
 assert.match(app, /\['HEAD ADMIN', 'ADMIN', 'DESARROLLADOR SOFTWARE'\]/);
 assert.match(app,/puedeCrearCliente=\{puedeRegistrarCliente\}/);
 assert.match(app,/puedeGestionar=\{puedeRegistrarCliente\}/);
 assert.match(projects,/if \(!puedeCrearCliente\)/);
 assert.match(projects,/\{puedeCrearCliente && <button/);
});
test('política adicional comprueba auth.uid, rol y permiso sin tocar proyectos',()=>{
 assert.match(sql,/p\.user_id = auth\.uid\(\)/);
 assert.match(sql,/p\.rol_label IN \('HEAD ADMIN', 'ADMIN', 'DESARROLLADOR SOFTWARE'\)/);
 assert.match(sql,/festos_has_permission\('gestionar_clientes'\)/);
 assert.doesNotMatch(sql,/UPDATE\s+public\.proyectos|DELETE\s+FROM\s+public\.proyectos|ALTER\s+TABLE\s+public\.proyectos/i);
});
test('Dashboard envía estado, ejecutivo, categoría y entrega al listado de proyectos con período',()=>{
 for(const name of ['onOpenProjects={abrirProyectosFiltrados}', 'filtroDesdeDashboard={proyectosDesdeDashboard}']) assert.ok(app.includes(name));
 for(const key of ["entrega: 'VENCIDOS'", "entrega: 'PROXIMOS_7'", "estado: ({", 'onPick={ejecutivo => irAProyectos({ ejecutivo })}', 'onPick={categoria => irAProyectos({ categoria })}']) assert.ok(dash.includes(key),key);
 for(const key of ['setFechaDesde(filtroDesdeDashboard.desde', 'setFechaHasta(filtroDesdeDashboard.hasta', 'setFiltroEstado(filtroDesdeDashboard.estado','setFiltroCargador(filtroDesdeDashboard.ejecutivo','setFiltroLob(filtroDesdeDashboard.categoria','setFiltroEntrega(filtroDesdeDashboard.entrega']) assert.ok(projects.includes(key),key);
 assert.match(app,/if \(id === 'proyectos'\) setProyectosDesdeDashboard\(null\)/);
});
test('No aparece Inicio duplicado en el detalle; se usa Fecha de pedido',()=>{
 assert.doesNotMatch(projects,/<span>Inicio<\/span>/);
 assert.doesNotMatch(operations,/<label>Inicio(?: operativo)?<input/);
 assert.match(projects,/<span>Fecha de pedido<\/span>/);
 assert.match(operations,/<span>Fecha de pedido<\/span>/);
 assert.match(operations,/\.update\(\{ fecha_entrega: dateDraft\.entrega \|\| null \}\)/);
});
test('Gráfico mensual muestra solo el monto cerca del punto y nunca interrumpe la línea con círculos blancos',()=>{
 assert.match(dash,/ed-trend-tooltip/);
 assert.match(dash,/ed-dot-hit/);
 assert.match(dash,/ed-dot-active/);
 assert.doesNotMatch(dash,/changeLabel/);
});

test('Meses clicables filtran Proyectos por fecha de pedido y conservan ejecutivo/categoría',()=>{
 assert.match(dash,/onClick=\{\(\) => abrirMes\(m\.key\)\}/);
 assert.match(dash,/onPickMonth=\{abrirMes\}/);
 assert.match(dash,/onPick=\{abrirMes\}/);
 assert.match(dash,/dashboardPeriodBounds\('month', \{ year: anio, month: mesElegido \}\)/);
 assert.match(dash,/irAProyectos\(\{ desde: rangoMes\.desde, hasta: rangoMes\.hasta \}\)/);
 assert.match(projects,/setFechaDesde\(filtroDesdeDashboard\.desde/);
 assert.match(projects,/setFechaHasta\(filtroDesdeDashboard\.hasta/);
});

test('FESTOS voz no se monta ni solicita acceso a micrófono visualmente',()=>{
 assert.doesNotMatch(app, /<FestosVoiceAssistant\b/);
 assert.doesNotMatch(app, /import \{ FestosVoiceAssistant \}/);
});
test('El Dashboard agrupa categorías actuales y muestra conteo incluso con valor cero',()=>{
 assert.match(dash,/categoriaDelProyecto\(p\)/);
 assert.match(dash,/count: projects\.filter/);
 assert.match(dash,/CATEGORIAS_FESTOS/);
});
