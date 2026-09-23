import { supabase } from '../supabaseClient';
import { parseRecordQuestion } from './recordIntents';

const pen = n => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(n) || 0);
const escapeLike = t => t.replace(/[%_\\]/g, '\\$&');
const slim = s => String(s || '').slice(0, 200);

export async function answerRecordQuestion(question, permissions) {
  const intent = parseRecordQuestion(question);
  if (!intent) return null;
  const config = {
    project: { table: 'proyectos', permission: 'ver_proyectos', field: 'nombre', cols: 'id,nombre,codigo,estado,ejecutivo,lob,fecha_pedido,valor_base,valor_venta,costo_estimado,utilidad_proyectada' },
    quote: { table: 'cotizaciones', permission: 'ver_cotizaciones', field: 'proyecto_nombre', cols: 'id,codigo,proyecto_nombre,estado,lob,subtotal,total' },
    client: { table: 'clientes', permission: 'ver_clientes', field: 'nombre', cols: 'id,nombre,ruc,tipo_pago' },
    provider: { table: 'proveedores', permission: 'ver_proveedores', field: 'nombre', cols: 'id,nombre,productos,condicion_pago,telefono' },
  }[intent.kind];
  if (!config) return null;
  if (!permissions[config.permission]) return 'No tienes permiso para consultar ese apartado.';
  if (!intent.target || intent.target.length < 3) return 'Dime el nombre o el código exacto del registro que quieres consultar.';
  let query = supabase.from(config.table).select(config.cols).limit(4);
  if (intent.byCode) query = query.ilike('codigo', intent.target);
  else query = query.ilike(config.field, `%${escapeLike(intent.target)}%`);
  const { data, error } = await query;
  if (error) throw new Error(`No pude consultar ${config.table}: ${error.message}`);
  if (!data?.length) return `No encontré ${intent.target} en ${config.table}. Puedes consultar el registro por su código exacto.`;
  if (data.length > 1) return `Encontré varios registros que coinciden con ${intent.target}. Indica un nombre más preciso o el código.`;
  const row = data[0];
  if (intent.kind === 'project') {
    const value = Number(row.valor_base) > 0 ? Number(row.valor_base) : Number(row.valor_venta || 0);
    return `Proyecto ${slim(row.nombre)}, código ${slim(row.codigo || 'sin código')}. Estado ${slim(row.estado || 'sin estado')}. Ejecutivo comercial ${slim(row.ejecutivo || 'no asignado')}. Categoría ${slim(row.lob || 'no asignada')}. Fecha de pedido ${slim(row.fecha_pedido || 'no registrada')}. Valor sin IGV ${pen(value)}. Costo estimado ${pen(row.costo_estimado)}. Utilidad proyectada ${row.utilidad_proyectada == null ? 'no registrada' : pen(row.utilidad_proyectada)}.`;
  }
  if (intent.kind === 'quote') return `Cotización ${slim(row.codigo || 'sin código')} para ${slim(row.proyecto_nombre || 'proyecto sin nombre')}. Estado ${slim(row.estado || 'sin estado')}. Categoría ${slim(row.lob || 'no asignada')}. Subtotal sin IGV ${pen(row.subtotal)}. Total con IGV ${pen(row.total)}.`;
  if (intent.kind === 'client') return `Cliente ${slim(row.nombre)}. Documento ${slim(row.ruc || 'no registrado')}. Condición de pago ${slim(row.tipo_pago || 'no registrada')}.`;
  return `Proveedor ${slim(row.nombre)}. Producto o servicio ${slim(row.productos || 'no registrado')}. Condición de pago ${slim(row.condicion_pago || 'no registrada')}. Teléfono ${slim(row.telefono || 'no registrado')}.`;
}
