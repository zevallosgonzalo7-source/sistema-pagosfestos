# FESTOS V29.42.16 — Ajuste único del selector de ejecutivo en Reg. Ventas

Basado en V29.42.15. Únicamente se modificó el campo **Ejecutivo** del formulario de Registro de Ventas:

- Selector cerrado (no acepta nombres escritos).
- Opciones: **GONZALO** y **MARJORIE MUÑOZ**.
- Se eliminó la opción **MAR** del desplegable.
- Al editar una venta antigua con ejecutivo `MAR`, el formulario muestra **MARJORIE MUÑOZ**.
- Selección obligatoria, independiente del ejecutivo del proyecto.

No se modificaron otros módulos, SQL ni reglas de negocio. No requiere nueva migración respecto de V29.42.15.
