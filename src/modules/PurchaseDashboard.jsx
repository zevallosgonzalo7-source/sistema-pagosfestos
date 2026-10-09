import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import FestosIcon from '../FestosIcon';

const money = value => `S/. ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hasAttachment = c => !!(c?.pdf_factura_path || c?.xml_factura_path || c?.ctz_path);

export function PurchaseDashboard({ onOpenPurchases = () => {} }) {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('compras')
      .select('id,fecha_compra,monto,monto_base,igv_monto,genera_credito_fiscal,categoria_gasto,ceco,lob,proveedor_nombre,pdf_factura_path,xml_factura_path,ctz_path');
    if (err) setError(err.message);
    else setCompras(data || []);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    const ch = supabase.channel(`festos-dashboard-compras-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras' }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const resumen = useMemo(() => ({
    valor: compras.reduce((s,c) => s + Number(c.monto_base ?? c.monto ?? 0), 0),
    credito: compras.reduce((s,c) => s + (c.genera_credito_fiscal ? Number(c.igv_monto || 0) : 0), 0),
    precio: compras.reduce((s,c) => s + Number(c.monto || 0), 0),
    sinAdjunto: compras.filter(c => !hasAttachment(c)).length
  }), [compras]);

  const topBy = key => {
    const map = new Map();
    compras.forEach(c => {
      const k = String(c[key] || 'Sin clasificar');
      map.set(k, (map.get(k) || 0) + Number(c.monto_base ?? c.monto ?? 0));
    });
    return [...map.entries()].sort((a,b) => b[1]-a[1]).slice(0,6);
  };
  const gastos = topBy('categoria_gasto');
  const cecos = topBy('ceco');
  const max = Math.max(1, ...gastos.map(x=>x[1]), ...cecos.map(x=>x[1]));

  return <div className="purchase-dashboard">
    <div className="section-header">
      <div>
        <h3 className="section-title"><FestosIcon name="LayoutDashboard" size={21}/> Dashboard compras</h3>
        <p className="panel-note">Vista de prueba conectada al Registro de Compras.</p>
      </div>
      <button className="btn-secondary" type="button" onClick={cargar}><FestosIcon name="RefreshCw" size={16}/> Actualizar</button>
    </div>

    {error && <div className="glass-card purchase-dashboard-error">{error}</div>}
    {loading ? <div className="glass-card purchase-dashboard-loading">Cargando compras…</div> : <>
      <div className="purchase-summary-grid">
        <div className="glass-card purchase-kpi"><span>Valor compra</span><strong>{money(resumen.valor)}</strong><small>Total sin IGV</small></div>
        <div className="glass-card purchase-kpi"><span>Crédito fiscal</span><strong>{money(resumen.credito)}</strong><small>Solo facturas</small></div>
        <div className="glass-card purchase-kpi"><span>Precio de compra</span><strong>{money(resumen.precio)}</strong><small>Total final</small></div>
        <button type="button" className="glass-card purchase-kpi purchase-kpi-alert purchase-kpi-filter" onClick={onOpenPurchases}><span>Compras sin adjunto</span><strong>{resumen.sinAdjunto}</strong><small>Abrir Registro de Compras</small></button>
      </div>

      <div className="purchase-dashboard-grid">
        <div className="glass-card purchase-dashboard-panel">
          <div className="purchase-dashboard-panel-head"><strong>Valor por categoría de gasto</strong><small>Top 6</small></div>
          <div className="purchase-dashboard-bars">
            {gastos.length ? gastos.map(([label,value]) => <div className="purchase-dashboard-bar-row" key={label}><div><span>{label}</span><strong>{money(value)}</strong></div><i style={{width:`${Math.max(4,(value/max)*100)}%`}}/></div>) : <p className="empty-hint">Sin datos.</p>}
          </div>
        </div>
        <div className="glass-card purchase-dashboard-panel">
          <div className="purchase-dashboard-panel-head"><strong>Valor por CeCo</strong><small>Top 6</small></div>
          <div className="purchase-dashboard-bars">
            {cecos.length ? cecos.map(([label,value]) => <div className="purchase-dashboard-bar-row" key={label}><div><span>{label}</span><strong>{money(value)}</strong></div><i style={{width:`${Math.max(4,(value/max)*100)}%`}}/></div>) : <p className="empty-hint">Sin datos.</p>}
          </div>
        </div>
      </div>
    </>}
  </div>;
}
