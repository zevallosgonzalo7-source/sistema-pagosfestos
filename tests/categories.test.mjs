import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIAS_FESTOS, CATEGORIA_PENDIENTE, categoriaActual, categoriaDelProyecto } from '../src/categories.js';
test('9 categorías actuales, incluida Desarrollos especiales',()=>{
 assert.equal(CATEGORIAS_FESTOS.length,9);
 assert.equal(new Set(CATEGORIAS_FESTOS).size,9);
 assert.equal(categoriaActual(' desarrollos especiales '),'Desarrollos especiales');
 assert.equal(categoriaDelProyecto({lob:'DESARROLLOS ESPECIALES'}),'Desarrollos especiales');
 assert.equal(categoriaActual('material pop'),'Material POP');
});
test('No reclasificar valores LOB anteriores ni asumir un campo de la cotización',()=>{
 assert.equal(categoriaDelProyecto({lob:'Producción gráfica'}),CATEGORIA_PENDIENTE);
 assert.equal(categoriaDelProyecto({lob:'',cotizaciones:{lob:'Textil'}}),CATEGORIA_PENDIENTE);
});
