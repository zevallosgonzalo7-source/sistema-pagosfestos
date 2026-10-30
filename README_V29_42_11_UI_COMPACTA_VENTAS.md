# FESTOS V29.42.11 · UI compacta Registro de Ventas

Cambios:
- Oculta “S/ 0.00 pendiente” cuando el pago comercial ya está completo.
- Mantiene el pendiente solo cuando realmente existe saldo.
- El bloque tributario de Registrar venta queda compacto.
- Se elimina “Agente retenedor” de la vista de Registrar venta; sigue usándose internamente desde Clientes.
- Se eliminan textos explicativos largos de la regla tributaria.
- En Clientes, Agente retenedor queda como selector limpio sin texto auxiliar.

No requiere SQL nuevo.
