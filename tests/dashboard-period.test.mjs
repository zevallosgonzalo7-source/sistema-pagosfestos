import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardPeriodBounds, dateKey, dashboardDate, isInDashboardRange} from '../src/dashboardPeriod.js';
const now=new Date(2026,8,23,14,0,0);
const settings={year:2026,month:9,quarter:3,now};
test('normaliza fechas sin confundir Date local con texto ISO',()=>{
  assert.equal(dateKey(new Date(2026,8,1)), '2026-09-01');
  assert.equal(dateKey('2026-09-01T00:00:00Z'),'2026-09-01');
  assert.equal(dashboardDate({fecha_pedido:'2026-09-15',created_at:'2026-04-20T00:00:00Z'}),'2026-09-15');
  assert.equal(dashboardDate({created_at:'2026-09-02T00:00:00Z'}),'2026-09-02T00:00:00Z');
});
test('por mes incluye todo septiembre; excluye agosto y octubre',()=>{
  const range=dashboardPeriodBounds('month',settings);
  assert.deepEqual(range,{desde:'2026-09-01',hasta:'2026-09-30'});
  assert.equal(isInDashboardRange('2026-09-01',range),true);
  assert.equal(isInDashboardRange('2026-09-30',range),true);
  assert.equal(isInDashboardRange('2026-08-31',range),false);
  assert.equal(isInDashboardRange('2026-10-01',range),false);
});
test('por trimestre seleccionable incluye los 3 meses de Q3',()=>{
  const range=dashboardPeriodBounds('quarter',settings);
  assert.deepEqual(range,{desde:'2026-07-01',hasta:'2026-09-30'});
  assert.equal(isInDashboardRange('2026-08-11',range),true);
  assert.equal(isInDashboardRange('2026-06-30',range),false);
});
test('por año acepta un año anterior',()=>{
  const range=dashboardPeriodBounds('year',{...settings,year:2025});
  assert.deepEqual(range,{desde:'2025-01-01',hasta:'2025-12-31'});
  assert.equal(isInDashboardRange('2026-09-23',range),false);
});
test('rango personalizado, sin rango y sin fecha',()=>{
  const range=dashboardPeriodBounds('custom',{from:'2026-04-10',to:'2026-09-30'});
  assert.equal(isInDashboardRange('2026-04-09',range),false);
  assert.equal(isInDashboardRange('2026-08-11',range),true);
  assert.equal(isInDashboardRange(null,range),false);
  assert.equal(isInDashboardRange(null,dashboardPeriodBounds('all',settings)),true);
});
