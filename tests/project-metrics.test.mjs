import test from 'node:test';
import assert from 'node:assert/strict';
import { cotizacionDeProyecto, valorDeProyecto, costoDeProyecto, utilidadDeProyecto } from '../src/projectMetrics.js';
const p = {id: 'p1', nombre:'Evento', valor_base:0, valor_venta:0};
const qs = [
 {id:'1', project_id:'p1', created_at:'2026-09-01T00:00:00', subtotal:1295, costo_estimado:500, ganancia_estimada:795},
 {id:'2', project_id:'p1', created_at:'2026-09-30T00:00:00', subtotal:1000, costo_estimado:400, ganancia_estimada:600}
];
test('no depende del orden de carga de cotizaciones',()=>{
 assert.equal(cotizacionDeProyecto(p,qs).id,'2');
 assert.equal(cotizacionDeProyecto(p,[...qs].reverse()).id,'2');
 assert.equal(valorDeProyecto(p,qs),1000);
 assert.equal(valorDeProyecto(p,[...qs].reverse()),1000);
});
test('prioriza valores registrados en proyectos',()=>{
 assert.equal(valorDeProyecto({...p,valor_base:300},qs),300);
 assert.equal(valorDeProyecto({...p,valor_venta:800},qs),800);
});
test('métricas relacionadas usan misma cotización',()=>{
 assert.equal(costoDeProyecto(p,qs),400);
 assert.equal(utilidadDeProyecto(p,qs),600);
});
test('prioriza la relación por id ante coincidencia de nombre',()=>{
 assert.equal(cotizacionDeProyecto(p,[...qs,{id:'3',proyecto_nombre:'Evento',created_at:'2026-10-01',subtotal:9000}]).id,'2');
});
