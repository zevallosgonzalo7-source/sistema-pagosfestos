-- ============================================================
-- FESTOS V29.34.8
-- REGISTRO DE COMPRAS
-- BOLETA CON IGV SIN CREDITO FISCAL + LOB OPCIONAL
-- ============================================================

-- 1) Separar "aplica IGV" de "genera crédito fiscal"
alter table public.compras
  add column if not exists genera_credito_fiscal boolean not null default false;

comment on column public.compras.aplicar_igv is
'Indica si el comprobante aplica IGV. FACTURA y BOLETA aplican IGV.';

comment on column public.compras.genera_credito_fiscal is
'Indica si el IGV genera crédito fiscal. Solo FACTURA genera crédito fiscal.';

comment on column public.compras.igv_monto is
'Monto de IGV incluido en el precio de compra cuando corresponde.';

-- 2) LOB deja de ser obligatorio en Registro de Compras
alter table public.compras
  alter column lob drop not null;

-- 3) Corregir reglas actuales según tipo de comprobante
update public.compras
set
  aplicar_igv = case
    when upper(trim(coalesce(tipo_comprobante, ''))) in ('FACTURA', 'BOLETA')
      then true
    else false
  end,
  genera_credito_fiscal = case
    when upper(trim(coalesce(tipo_comprobante, ''))) = 'FACTURA'
      then true
    else false
  end;

-- 4) Corregir BOLETAS ya registradas:
--    llevan IGV en el precio, pero ese IGV NO es crédito fiscal.
update public.compras
set
  igv_monto = round(coalesce(monto_base, 0) * 0.18, 2),
  monto = round(coalesce(monto_base, 0) * 1.18, 2)
where upper(trim(coalesce(tipo_comprobante, ''))) = 'BOLETA'
  and monto_base is not null;

-- 5) Refrescar esquema de Supabase/PostgREST
notify pgrst, 'reload schema';
