# HANDOFF - Reestructuracion visual BusinessMN v2

> Mensaje de alineamiento para Claude.
> Objetivo: evitar implementaciones prematuras y construir un mapa compartido antes de tocar mas modulos.
> Fecha: 2026-05-06.

---

## Mensaje para Claude

Claude, antes de implementar cualquier cambio, necesitamos hacer una pausa de alineamiento.

Estamos en una etapa de reestructuracion visual y UX del ERP BusinessMN v2. No queremos arrancar modificando codigo todavia.

Primero necesitamos confirmar juntos:

1. Que estamos intentando lograr con esta reestructuracion.
2. Que papel cumple Productos como primer modulo mejor aterrizado.
3. Que documentos son realmente canonicos y cuales son historicos.
4. Que patrones visuales ya estan validados.
5. Que partes del sistema todavia no estan completamente revisadas.
6. Como deberiamos ordenar el trabajo antes de tocar mas modulos.

Contexto importante:

- El ERP tiene mucha historia y muchos documentos.
- Hay mockups HTML en `docs/mockups/`.
- Productos es el modulo que el usuario siente mas aterrizado hasta ahora.
- No se debe asumir que todo el sistema ya fue revisado al 100%.
- No se deben implementar acciones automaticas basadas en una lectura parcial.
- Primero se necesita un mapa compartido de intencion, alcance y fuentes de verdad.

---

## Archivos minimos a revisar antes de opinar

Revisar como minimo:

- `CLAUDE.md`
- `docs/START_HERE_DESIGN.md`
- `docs/DESIGN_CANONICO_FINAL.md`
- `docs/mockups/CANONICO_MASTER.html`
- `docs/mockups/productos/INVENTARIO.md`
- mockups HTML de `docs/mockups/productos/`
- estructura real de `src/pages/Productos/`
- estructura real de `src/design-system/`

Si aparece otro documento importante para entender la evolucion visual, mencionarlo y explicar por que lo revisaste.

---

## Regla de trabajo

Despues de revisar, NO implementar.

Primero entregar un reporte de alineamiento con esta estructura:

## 1. Lo que entiendo que queremos hacer

Explica con tus palabras cual es el objetivo de esta reestructuracion visual.

## 2. Rol de Productos

Explica por que Productos parece ser el primer modulo mejor aterrizado y que patrones concretos aporta al resto del ERP.

## 3. Fuentes de verdad detectadas

Lista documentos y archivos clasificados asi:

- Canonico vigente
- Referencia visual
- Aterrizaje por modulo
- Implementacion viva
- Historico / superseded

## 4. Riesgos de avanzar sin ordenar

Identifica riesgos de implementar sin aclarar primero el canon:

- duplicacion visual,
- modulos con responsabilidades mezcladas,
- estilos legacy,
- contradicciones entre docs,
- gaps entre mockup y codigo,
- componentes compartidos inmaduros.

## 5. Preguntas para el usuario

Haz maximo 10 preguntas.

Deben ser preguntas estrategicas, no detalles pequenos de CSS.

## 6. Propuesta de metodologia

Propon como trabajar modulo por modulo:

- como elegir el siguiente modulo,
- como auditarlo,
- como compararlo contra Productos,
- como decidir si necesita mockups nuevos,
- cuando pasar a implementacion,
- como validar desktop/mobile.

---

## Limites explicitos

No modificar archivos.

No implementar.

No generar un plan cerrado todavia.

No decidir solo si encuentras contradicciones entre documentos, codigo o memoria de sesiones anteriores. Senala la contradiccion y pregunta al usuario.

Primero confirmar que entendiste el proceso y que estamos mirando el sistema con la misma intencion.

---

## Prompt corto que puede usar el usuario

```md
Claude, antes de implementar, lee:

- `docs/START_HERE_DESIGN.md`
- `docs/HANDOFF_REESTRUCTURACION_VISUAL.md`

No modifiques archivos todavia. Primero entregame el reporte de alineamiento pedido ahi.
```
