-- FESTOS V29 · Comprobar que las cuatro cuentas existen en Supabase Auth.
WITH requeridos(email, usuario, rol) AS (
  VALUES
    ('gonzalo@festosmkt.com', 'gonzalo', 'HEAD ADMIN'),
    ('administracion@festosmkt.com', 'jesus', 'ADMIN'),
    ('mar@festosmkt.com', 'mar', 'OPERADORA COMERCIAL'),
    ('rodrigo@festosmkt.com', 'rodrigo', 'DESARROLLADOR SOFTWARE')
)
SELECT
  r.email,
  r.usuario,
  r.rol,
  u.id AS auth_user_id,
  CASE WHEN u.id IS NULL THEN 'FALTA CREAR EN AUTH' ELSE 'OK' END AS estado
FROM requeridos r
LEFT JOIN auth.users u ON lower(u.email) = lower(r.email)
ORDER BY r.usuario;
