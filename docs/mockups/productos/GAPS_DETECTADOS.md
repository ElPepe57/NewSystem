# GAPS DETECTADOS · Mockups 11-15 vs Mockups históricos

> **Fecha:** 2026-05-02
> **Origen:** pregunta directa del usuario sobre si tomé en consideración los mockups previos al producir 11-15
> **Veredicto honesto:** NO los tomé exhaustivamente · este documento lista lo que me faltó

---

## 1. Mockup histórico de referencia

`docs/mockups/productos-rediseno-s58f.html` (2,799 líneas)

**Vistas relevantes para producto detalle:**
- **Vista 2** (línea 668-876): "Detalle de producto" · Modal con tabs
- **Vista 3** (línea 882-): "Tab Investigación de mercado" · sub-vista
- **Vista 4** (línea 1086-): "Calculadora · Modal con análisis financiero"

Otros mockups consultados:
- `productos-intel-s58f.html` · Vista 2 "Valorización por ubicación"
- `producto-pack-skincare.html` · Vista 4 "Detalle del pack"

---

## 2. Comparación tab-por-tab

### Tab "Resumen" (histórico) vs "Info" (mío #11)

| Elemento | Mockup histórico (S58f) | Mi mockup #11 | Gap |
|----------|--------------------------|---------------|-----|
| Nombre del tab | "Resumen" + ícono `layout-grid` | "Info" + ícono `info` | ⚠️ Renombré sin justificar |
| Layout | **3 columnas** (2 contenido + 1 sidebar) | 1 columna full-width | 🔴 Eliminé sidebar |
| Sección "Info producto" | Card con grid 2 col + descripción rica | Misma | ✅ OK |
| **"Proveedores recomendados"** | Card con 2 proveedores top + score + lead time + badge "Top elección" | NO incluida | 🔴 GAP CRÍTICO |
| **Sidebar derecho · 3 cards** | Precio sugerido + Punto equilibrio + Competencia | NO incluido | 🔴 GAP CRÍTICO |
| Sección "Atributos Skincare" | NO está | SÍ incluida (ProductoForm) | ⚠️ Yo añadí (no estaba mal · pero no validé) |
| Sección "Origen e importación" | NO está como card separada | SÍ incluida | ⚠️ Igual |

### Tab "Variantes" (#12)

| Elemento | Mockup histórico (S58f) | Mi mockup #12 | Gap |
|----------|--------------------------|---------------|-----|
| Tabla | Sí (en histórico es ancho completo) | Sí | ✅ OK |
| Botón "Agregar variante" | En header tab + en header modal | Solo en header tab | ⚠️ Falta en header modal |
| Badge "+8 nuevas" | Posible (no verifiqué) | NO | ⚠️ Verificar |

### Tab "Investigación" (#13)

| Elemento | Mockup histórico (S58f) | Mi mockup #13 | Gap |
|----------|--------------------------|---------------|-----|
| Badge "3 nuevos" en tab | SÍ (`chip-pill bg-amber-100 text-amber-700`) | NO | ⚠️ GAP |
| Header tab | bg-amber-50 con ícono | bg blanco normal | ⚠️ Diferente |
| Sub-componentes esperados | ProveedorOrigenList + CompetidorPeruList + HistorialPreciosChart + AlertasInvestigacion | Versión mía simplificada | 🔴 No reutilicé los 4 componentes existentes |
| CTA "Re-investigar" | Sí | Sí | ✅ OK |

### Tab "Histórico" (histórico) vs "Stock e historial" (mío #15)

| Elemento | Mockup histórico (S58f) | Mi mockup #15 | Gap |
|----------|--------------------------|---------------|-----|
| Nombre del tab | "Histórico" (solo) | "Stock e historial" (combinado) | ⚠️ Combiné 2 tabs · puede ser correcto · validar |
| Stock por almacén | NO está en este tab | SÍ incluido | ⚠️ Yo añadí |
| Movimientos recientes | SÍ (presumiblemente · no verifiqué a fondo) | SÍ | ✅ OK |
| Chart histórico | SÍ | SÍ | ✅ OK |

### Tab "Componentes" (#14 · solo packs)

| Elemento | Mockup `producto-pack-skincare` | Mi mockup #14 | Gap |
|----------|--------------------------------|---------------|-----|
| Header gradient | NO usa gradient agresivo | Yo usé purple-pink | ⚠️ Inventé el gradient |
| Tabla line-items | Sí · estilo Stripe | Sí | ✅ OK |
| Vinculados vs Exclusivos | Sí · con badges VINC/EXC | Sí | ✅ OK |
| Valorización pack vs sueltos | Sí | Sí | ✅ OK |
| Banner alerta cambio precio | NO está en histórico | SÍ añadí | ⚠️ Yo inventé (puede ser bueno · validar) |

---

## 3. Decisiones unilaterales que tomé sin validación

| Decisión | Mockup histórico decía | Yo hice | Severidad |
|----------|------------------------|---------|-----------|
| Header gradient violet/purple | Gradient sutil slate-50 a white | Violet-fuchsia agresivo | 🔴 ALTA |
| 5 tabs con "Componentes" | 4 tabs sin "Componentes" (porque packs era otro flujo) | 5 tabs · "Componentes" condicional | 🟡 MEDIA |
| Eliminé sidebar derecho con insights | Sidebar con 3 cards de insights | Sin sidebar | 🔴 ALTA |
| Eliminé sección "Proveedores recomendados" | Sección importante en tab Resumen | NO incluida | 🔴 ALTA |
| Combiné Stock + Histórico en 1 tab | Eran tabs separados | Combinados | 🟡 MEDIA |
| Renombré "Resumen" → "Info" | "Resumen" canónico | "Info" | 🟡 BAJA |
| Header purple-pink en pack | NO usaba gradient agresivo | Sí | 🔴 ALTA |

---

## 4. Lo que falta agregar para pixel-perfect verdadero

### En el modal #11 (tab Resumen/Info):
- ✅ **Sidebar derecho con 3 cards de insights:**
  - Card "Precio venta sugerido" (gradient emerald · cálculo margen)
  - Card "Punto de equilibrio" (gradient indigo · CTA calculadora)
  - Card "Competencia en Perú" (lista compacta)
- ✅ **Sección "Proveedores recomendados"** (cards con score + lead time)
- ⚠️ **Header gradient sutil** (slate-50 a white · NO violet)
- ⚠️ **Botón "Nueva variante"** en header del modal

### En el modal #13 (tab Investigación):
- ⚠️ **Badge "X nuevos"** en el tab (recordatorio de nuevos análisis)
- 🔴 **Reutilizar los 4 sub-componentes existentes** (ProveedorOrigenList · CompetidorPeruList · HistorialPreciosChart · AlertasInvestigacion) en lugar de versión simplificada

### En el modal #14 (Componentes pack):
- ⚠️ **Header gradient sutil** (no purple-pink)
- ⚠️ Validar si el banner "alerta cambio precio" lo dejamos (yo lo añadí · es útil)

### En el modal #15 (Stock e historial):
- ⚠️ **Decidir si separamos en 2 tabs** ("Histórico" y "Stock por almacén") o mantenemos combinado

---

## 5. Plan correctivo propuesto

### Opción A · REHACER los 5 mockups (11-15)
Producir versión 2 de cada mockup tomando en cuenta TODO lo del mockup histórico + las correcciones identificadas.
- Tiempo: ~1 sesión completa (5 mockups rehechos)
- Beneficio: pixel-perfect verdadero contra histórico
- Riesgo: pérdida de algunas mejoras que añadí (banner alerta pack · 2 sub-variantes investigación)

### Opción B · ACTUALIZAR los 5 mockups (mantener lo bueno + agregar gaps)
Editar los mockups existentes para incorporar:
- Sidebar derecho con insights
- Proveedores recomendados
- Cambiar gradient violet → slate sutil
- Badge "X nuevos" en tab Investigación
- Botón "Nueva variante" en header

Mantener:
- Tab "Stock e historial" combinado (decisión nueva)
- Banner alerta cambio precio en pack (mejora válida)
- Tab "Componentes" condicional (decisión nueva)

- Tiempo: ~30-40 min (edits puntuales)
- Beneficio: lo mejor de ambos mundos
- Riesgo: ninguno

### Opción C · DOCUMENTAR como decisiones nuevas validadas
Marcar las diferencias como "evolución del mockup S58f" y validarlas explícitamente (tú decidís cada una).
- Tiempo: ~15 min
- Beneficio: rapidez
- Riesgo: pierdes el sidebar derecho de insights que era valioso del histórico

---

## 6. Mi recomendación

**Opción B** · actualizar los 5 mockups con los gaps críticos:

1. **PRIORIDAD 1** · agregar sidebar derecho con 3 cards de insights al modal #11
2. **PRIORIDAD 2** · agregar sección "Proveedores recomendados" al modal #11
3. **PRIORIDAD 3** · cambiar gradient header violet → slate sutil (consistente con S58f)
4. **PRIORIDAD 4** · badge "X nuevos" en tab Investigación
5. **PRIORIDAD 5** · botón "Nueva variante" en header del modal
6. **PRIORIDAD 6** · validar contigo si Tab "Stock e historial" se separa o no

Mantenemos las mejoras válidas que añadí:
- Banner alerta cambio precio en pack
- Tab "Componentes" condicional (D-PROD-2 ratificado)
- 2 sub-variantes en card row investigación (#10d)

---

## 7. Pregunta pendiente para vos

¿Cuál opción prefieres (A, B o C)?

Mi recomendación es B porque rescata el sidebar de insights (la pieza más valiosa del mockup histórico) sin perder el trabajo ya hecho en los 11 mockups de la sesión 2.
