# START HERE DESIGN - BusinessMN v2

> Instruccion prioritaria para cualquier trabajo visual, UX, wizard, mockup o refactor de interfaz.
> Estado: guia de alineamiento para la reestructuracion visual.
> Fecha: 2026-05-06.

---

## 1. Contexto actual

BusinessMN v2 esta en una etapa de reestructuracion visual y UX.

En esta etapa, la prioridad NO es crear funcionalidades nuevas ni redisenar por intuicion. La prioridad es ordenar el sistema visual del ERP, entender que patrones ya estan validados y evitar que cada modulo evolucione como una isla.

El modulo Productos es el primer modulo que el usuario siente mejor aterrizado. Debe usarse como referencia practica de madurez visual, estructura de estados, filtros, modales, wizards y experiencia mobile.

Antes de implementar cualquier cambio visual, Claude debe alinearse con el usuario.

---

## 2. Regla principal

No implementar directamente.

Primero se debe:

1. Entender el objetivo del rediseno.
2. Revisar las fuentes de verdad.
3. Clasificar que documentos son canonicos, secundarios o historicos.
4. Comparar el modulo/pantalla contra el canon vigente y contra Productos.
5. Detectar gaps y contradicciones.
6. Preguntar al usuario antes de proponer un plan cerrado.
7. Solo implementar despues de validacion explicita.

Si el usuario pide "redisenar", "alinear", "mejorar UI", "hacer pixel-perfect", "mockup", "wizard", "reestructurar diseno" o similar, activar este protocolo.

---

## 3. Fuentes de verdad en orden

### Canonico vigente

1. `docs/DESIGN_CANONICO_FINAL.md`
   - Constitucion visual vigente del sistema.
   - Reemplaza referencias previas S52/S54/S58 salvo excepcion declarada.

2. `docs/mockups/CANONICO_MASTER.html`
   - Referencia visual viva del canon.
   - Muestra componentes, variantes, anti-patterns y ejemplos.

### Aterrizaje por modulo

3. `docs/mockups/productos/INVENTARIO.md`
   - Inventario completo del modulo Productos.
   - Define el alcance de mockups, estados y flujos de Productos.

4. `docs/mockups/productos/*.html`
   - Mockups pixel-perfect especificos del modulo Productos.
   - Consultar cuando exista un patron equivalente: listado, filtros, card, modal detalle, wizard, empty state, loading, mobile, bulk actions, investigacion, pack, variantes, etc.

### Implementacion viva

5. `src/pages/Productos/`
6. `src/pages/Productos/components/`
7. `src/design-system/`

Estos archivos muestran que parte del canon ya se llevo a codigo y que partes siguen pendientes.

### Historico o secundario

8. `docs/DESIGN_PATTERNS.md`
9. Referencias S52/S54/S58 anteriores.
10. Secciones antiguas de `CLAUDE.md` marcadas como deprecated o superseded.

Estos documentos pueden explicar evolucion, pero no mandan sobre el canon vigente.

---

## 4. Orden de autoridad ante contradicciones

Si hay conflicto entre documentos o entre documento y codigo, usar este orden:

1. `docs/DESIGN_CANONICO_FINAL.md`
2. `docs/mockups/CANONICO_MASTER.html`
3. Mockup especifico validado del modulo.
4. `docs/mockups/productos/INVENTARIO.md` cuando aplique como patron de aterrizaje.
5. Implementacion viva en `src/`.
6. Documentacion historica.

Si la contradiccion afecta una decision de producto, UX, responsabilidad de modulo o patron visual, no decidir solo. Reportar la contradiccion y preguntar al usuario.

---

## 5. Productos como referencia practica

Productos aporta el modelo de modulo aterrizado:

- Header sobrio con proposito claro.
- KPI strip compacto y escaneable.
- Filtros visibles, chips activos, busqueda, ordenamiento y limpieza global.
- Listado denso y comparativo.
- Estados visuales explicitos: normal, hover, stock critico, investigacion vencida, pack, archivado.
- Mobile disenado como experiencia propia.
- Modal detalle como centro de verdad del producto.
- Tabs internas por responsabilidad.
- Wizards segun intencion real del usuario.
- Herramientas inteligentes que ayudan a decidir o ejecutar, no decoracion.
- Lucide icons como iconografia.
- Numeros con `tabular-nums`.
- Colores semanticos, no arbitrarios.

No copiar Productos literalmente en todos los modulos. Extraer patrones y adaptarlos a la responsabilidad real de cada modulo.

---

## 6. Protocolo obligatorio de alineamiento

Antes de implementar, entregar al usuario un reporte con:

### 1. Lo que entiendo que queremos hacer

Explicar con palabras propias el objetivo de la reestructuracion visual.

### 2. Rol de Productos

Explicar por que Productos funciona como primer modulo aterrizado y que patrones aporta.

### 3. Fuentes de verdad detectadas

Clasificar documentos y archivos como:

- Canonico vigente
- Referencia visual
- Aterrizaje por modulo
- Implementacion viva
- Historico / superseded

### 4. Riesgos de avanzar sin ordenar

Identificar riesgos reales:

- duplicacion visual,
- estilos legacy mezclados,
- contradicciones entre docs,
- gaps entre mockup y codigo,
- componentes compartidos inmaduros,
- modulos con responsabilidades mezcladas.

### 5. Preguntas para el usuario

Hacer maximo 10 preguntas estrategicas antes de cerrar plan.

### 6. Propuesta de metodologia

Explicar como trabajar modulo por modulo:

- como elegir el siguiente modulo,
- como auditarlo,
- como compararlo contra Productos,
- como decidir si necesita mockups nuevos,
- cuando pasar a implementacion,
- como validar desktop/mobile.

---

## 7. Reglas visuales duras

Respetar siempre:

- Header canonico F1.
- KPI strip F2.
- Filtros componibles F3.
- Cards por default; tablas solo con excepcion justificada.
- Wizards:
  - 1 paso = modal inline.
  - 3 pasos = stepper horizontal.
  - 4+ pasos = sidebar vertical.
- Modales detalle segun F6.
- `tabular-nums` en numeros.
- `lucide-react` como iconografia.
- `ChevronRight` como separador de breadcrumb.
- Botones con jerarquia clara.
- Neutrales en `slate`.
- Sin gradientes pesados.
- Sin emojis en chrome funcional de UI.
- Sin nuevos lenguajes visuales por modulo.
- Sin refactors fuera de alcance.

---

## 8. Criterio de exito

Una pantalla esta bien resuelta cuando responde:

1. Que necesita hacer el usuario aqui.
2. Que decision debe tomar.
3. Que modulo es dueno de la operacion.
4. Que informacion solo se muestra como lectura.
5. Que estados debe cubrir.
6. Como funciona en desktop y mobile.

Si la pantalla no responde eso, el diseno no esta terminado.
