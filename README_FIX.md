# CSSFESTOS - correccion JSX y filtro de categorias

Se corrigio el cierre JSX de `src/modules/BusinessModules.jsx` que provocaba el error de Vite `Expected corresponding JSX closing tag for 'form'`.

Clientes mantiene el filtro por categoria, fecha y condicion de pago.

Para la columna categoria en Supabase, ejecutar `supabase/clientes_categoria.sql` si aun no se hizo.
