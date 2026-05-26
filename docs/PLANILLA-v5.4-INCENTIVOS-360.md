# PLANILLA v5.4 · Sistema de incentivos + ciclo de vida + cost analytics 360

**Fecha:** 2026-05-26  
**Detonante:** feedback del user post v5.3 · pedidos: sin CTS · agregar baja · variación salarial · sistema de incentivos por rol · cost analytics 360  
**Reemplaza:** v5.3 que tenía "Vacaciones & CTS"

---

## 1 · Cambios sobre v5.3

| Aspecto v5.3 | Decisión v5.4 |
|---|---|
| Tab "Vacaciones & CTS" | ❌ Renombrar a **"Vacaciones & Gratificaciones"** · eliminar CTS |
| Beneficios sociales | ❌ Vita Skin NO paga · simplificar |
| Solo "alta" implícita (asignar rol) | ✅ Agregar **"baja de empleado"** con wizard de liquidación |
| Sueldo fijo sin historial | ✅ Agregar **histórico salarial** por empleado |
| Sin incentivos estructurados | ✅ NUEVO · **sistema de incentivos por rol** (4 tipos) |
| Sin cost analytics | ✅ NUEVO · **Análisis & Costos** con cross-links 360 |

## 2 · Estructura final v5.4 · 5 sub-tabs operativos

```
[Boletas del mes] [Adelantos] [Incentivos & Comisiones] [Vacaciones & Gratificaciones] [Análisis & Reportes]
```

(Tab "Empleados" sigue eliminado · gestión en /usuarios filtrado · canon D-P5)

---

## 3 · Sistema de Incentivos · arquitectura

### 3.1 · Principios

> **"Un esquema · muchos empleados · cálculo automático mensual"**

1. **Esquemas flexibles** · admin configura · sistema calcula
2. **Por rol o individual** · esquema aplica a "todos los vendedores" O a "Ana Rodríguez específicamente"
3. **Métricas trackeables** · cada esquema referencia datos del sistema (ventas · OCs · cobros · etc.)
4. **Auditoría completa** · cada cálculo guarda quién aprobó · cuándo · qué métricas usó
5. **Reflejo en boletas** · bono calculado se descuenta a boleta del mes como bonificación

### 3.2 · Cuatro tipos de incentivo

#### **Tipo A · Comisión sobre ventas** (rol vendedor)
```typescript
{
  tipo: 'comision',
  aplicableA: { roles: ['vendedor'] },
  configuracion: {
    aplicarSobre: 'venta_total' | 'utilidad_bruta',
    modelo: 'lineal' | 'escalonado',
    porcentaje: 3,  // si lineal
    escalas: [
      { desdeMonto: 0, hastaMonto: 50000, porcentaje: 2 },
      { desdeMonto: 50000, hastaMonto: 100000, porcentaje: 4 },
      { desdeMonto: 100000, porcentaje: 6 },
    ]
  }
}
```

#### **Tipo B · Bono por meta** (rol logística/compras/almacén)
```typescript
{
  tipo: 'bono_meta',
  aplicableA: { roles: ['comprador', 'almacenero'] },
  configuracion: {
    metricaTracked: 'oc_recibidas_en_tiempo' | 'rotacion_stock' | 'entregas_a_tiempo',
    objetivoMensual: 95,  // % o número absoluto
    bonoSiCumple: 800,   // S/ dividido entre el equipo
    bonoMaximoSiSupera: 1200,  // si >98%
  }
}
```

#### **Tipo C · Bono por KPI** (rol finanzas · gerente)
```typescript
{
  tipo: 'bono_kpi',
  aplicableA: { roles: ['finanzas', 'gerente'] },
  configuracion: {
    metricaTracked: 'cobros_vencidos_porcentaje' | 'margen_neto_mes',
    formula: 'metricaTracked <= 5',  // condición a cumplir
    bonoSiCumple: 500,
  }
}
```

#### **Tipo D · Bono fijo** (cualquier rol · pago puntual)
```typescript
{
  tipo: 'bono_fijo',
  aplicableA: { usuariosEspecificos: ['uid_gerente'] },
  configuracion: {
    monto: 5000,
    moneda: 'PEN',
    frecuencia: 'unico' | 'anual_diciembre',  // bono navidad · etc.
  }
}
```

### 3.3 · Cálculo automático mensual

Cada fin de mes (o on-demand):

```
Para cada esquemaIncentivo activo:
  Para cada empleado que aplica:
    1. Pull métricas del sistema (queries Firestore a /ventas, /oc, /finanzas/cc, etc.)
    2. Calcular bono según configuracion
    3. Crear CalculoIncentivoMes (estado: pendiente)
    4. Admin/gerente revisa · aprueba o rechaza
    5. Al aprobar → se agrega como bonificación a la boleta del mes
```

### 3.4 · Ejemplos prácticos

**Ejemplo 1 · Ana Rodríguez (vendedora)**
- Esquema activo: "Comisión vendedor escalonada" (Tipo A)
- En mayo facturó S/ 65,000
- Cálculo:
  - Primeros 50K → 2% = S/ 1,000
  - Siguientes 15K → 4% = S/ 600
  - **Bono total mayo: S/ 1,600** (se suma a su boleta como bonificación)

**Ejemplo 2 · Equipo logística (Diego + Pedro)**
- Esquema activo: "Meta logística OC en tiempo" (Tipo B)
- En mayo: 96 de 100 OC llegaron en tiempo = 96%
- Cumple meta de 95% → bono S/ 800 dividido entre 2 = S/ 400 c/u
- (Si fuese >98% serían S/ 600 c/u)

**Ejemplo 3 · María García (finanzas)**
- Esquema activo: "Control cartera vencida" (Tipo C)
- En mayo: cartera vencida = 3.5% (objetivo <5%)
- Cumple → bono S/ 500
- **Bono mayo: S/ 500**

**Ejemplo 4 · Gerente José LP**
- Esquema activo: "Bono navidad gerencia" (Tipo D)
- En diciembre se paga automáticamente
- Bono fijo: S/ 5,000

---

## 4 · Baja de empleado · ciclo de vida completo

### 4.1 · Estados del empleado

```
activo → suspendido → activo  (vuelta atrás · ej. licencia médica larga)
activo → baja
```

**Tipos de baja:**
- `renuncia_voluntaria`
- `despido_justificado`
- `despido_arbitrario` (con indemnización)
- `termino_contrato_plazo_fijo`
- `jubilacion`
- `cese_acuerdo_mutuo`
- `fallecimiento`

### 4.2 · Wizard de baja · 4 pasos

**Paso 1 · Motivo y fecha**
- Selector de tipo de baja
- Fecha efectiva de salida
- Notas (opcional)

**Paso 2 · Cálculo automático de liquidación**
Sistema calcula:
- Sueldo proporcional del mes (días trabajados / 30)
- Vacaciones no gozadas (días pendientes × sueldo/30)
- Gratificación proporcional (si aplica · julio/diciembre prorrateado)
- Indemnización (si despido arbitrario · según ley)
- Adelantos pendientes a descontar
- Otros descuentos

**Paso 3 · Revisión y ajustes**
- Admin puede ajustar montos manualmente con justificación
- Muestra subtotal · descuentos · neto a pagar

**Paso 4 · Confirmación**
- Genera boleta especial "Liquidación · [Nombre]"
- Cambia estado del empleado a "baja"
- Quita rol planilla del UserProfile
- Registra fecha de salida en datosLaborales
- Genera carta de salida (PDF)
- Notifica a contabilidad para asiento

### 4.3 · Post-baja

- Empleado queda en /usuarios estado=`baja` (no eliminado)
- Datos laborales se mantienen como historial
- No aparece en boletas mensuales futuras
- Aparece en reportes anuales/históricos

---

## 5 · Histórico salarial

### 5.1 · Por qué importa

- Auditoría de aumentos · quién aprobó · cuándo
- Análisis de retención (rotación si no hay aumentos)
- Compliance laboral
- Inputs para nuevas decisiones salariales

### 5.2 · Modelo

```typescript
HistorialSalarial {
  id: string
  userId: string
  sueldoAnterior: number
  sueldoNuevo: number
  porcentajeCambio: number  // +5% · -10% · etc.
  fechaEfectiva: Timestamp
  motivo: 'aumento_periodico' | 'promocion' | 'reajuste_negocio' | 'reduccion' | 'corrección'
  aprobadoPor: string  // uid admin/gerente
  notas?: string
  fechaRegistro: Timestamp
}
```

### 5.3 · Dónde vive

- **Ficha 360 modal · tab "Sub-perfiles"** · drill a "Histórico salarial" como sub-vista
- **Planilla · Análisis & Reportes** · variación salarial agregada del equipo (% promedio · top aumentos · etc.)

### 5.4 · Acción "Ajustar salario"

- Botón en Ficha 360 → modal "Ajustar salario"
- Inputs: nuevo monto · motivo · fecha efectiva · notas
- Se crea registro en HistorialSalarial
- Actualiza sueldoBase en datosLaborales
- Próxima boleta usa nuevo monto

---

## 6 · Vacaciones & Gratificaciones (SIN CTS)

### 6.1 · Vacaciones

Igual que v5.3:
- Acumulación según ley peruana (30 días por año · 1 día por cada 12 trabajados)
- Solicitudes con backup
- Aprobación admin
- Pago de vacaciones tomadas

### 6.2 · Gratificaciones (Perú)

Según ley peruana:
- **Gratificación Fiestas Patrias** · pago hasta 15 de julio
- **Gratificación Navidad** · pago hasta 15 de diciembre
- Equivalente a 1 sueldo bruto (sin descuentos esSalud)
- Proporcional si trabajó menos de 6 meses

### 6.3 · Sistema lo automatiza

- En junio (mes previo) · sistema calcula gratificación de julio
- Genera boleta especial "Gratificación · julio 2026"
- Pago directo a empleado
- Misma lógica en noviembre para diciembre

### 6.4 · NO incluye CTS

CTS = Compensación por Tiempo de Servicios (otro depósito legal en Perú · semestral)

**Vita Skin NO paga CTS** (decisión del negocio) · entonces:
- Eliminar UI de CTS de v5.3
- No calcular CTS automáticamente
- No mostrar acumulación CTS en KPIs

---

## 7 · Cost Analytics · análisis 360

### 7.1 · Tab "Análisis & Reportes" · nueva estructura

**Sección 1 · Costo total payroll**
- KPI: Payroll YTD · MoM · YoY
- Sparkline 12m
- % sobre ingresos del período (productividad)
- Alertas si % supera umbral configurable (ej. 35% del revenue es alto para Vita Skin)

**Sección 2 · Breakdown por área**
- Donut/tabla: Ventas · Marketing · Operaciones · Finanzas · Otros
- Costo absoluto + %
- Tendencia por área (creciente · estable · decreciente)

**Sección 3 · Breakdown por tipo de pago**
- Sueldo base · Bonificaciones · Comisiones · Gratificaciones · Liquidaciones
- Para ver dónde se concentra el costo

**Sección 4 · Cross-links 360** (lo más importante)

```
Cards de cross-link grandes:

┌──────────────────────────────────────────────────────┐
│ 💰 EN GASTOS                                          │
│ Cada boleta pagada crea un gasto categorizado.       │
│ Ver "Gastos · Planilla" filtrado en /gastos →        │
│ Total YTD: S/ 158,200 · 87 boletas                  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ 💵 EN TESORERÍA · CASH FLOW                           │
│ Egresos programados mensuales + gratificaciones.     │
│ Próximos 12m: S/ 396K proyectado.                   │
│ Ver en /finanzas/cash-flow →                         │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ 📊 EN CONTABILIDAD · P&L                              │
│ "Gastos de personal" como línea del estado de        │
│ resultados · separado por área operativa.            │
│ Ver en /contabilidad → Estado de Resultados →        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ 🎯 EN INVERSIONISTAS · IMPACTO ROI                    │
│ El payroll impacta el margen neto · y por ende       │
│ el ROI de los socios.                                │
│ Ver en /inversionistas → Salud financiera →          │
└──────────────────────────────────────────────────────┘
```

**Sección 5 · Reportes exportables**
- Payroll mensual (CSV/PDF)
- Payroll YTD por empleado
- Reporte incentivos pagados
- Reporte vacaciones consumidas

---

## 8 · Diagrama 360 · cómo planilla se conecta a todo el sistema

```
                  ┌────────────────────┐
                  │   /USUARIOS        │
                  │  (directorio       │
                  │   personas)        │
                  └────────┬───────────┘
                           │ rol planilla
                           │ + datosLaborales
                           ▼
            ┌──────────────────────────────────┐
            │       /PLANILLA (este módulo)    │
            │ ┌──────────────────────────────┐ │
            │ │ · Boletas (incluye bonos)    │ │
            │ │ · Adelantos                  │ │
            │ │ · Incentivos (4 tipos)       │ │     ┌─────────────────────┐
            │ │ · Vacaciones & Gratific.     │ │ ◄── │ /VENTAS             │
            │ │ · Análisis & Cost Analytics  │ │     │ → comisiones Tipo A │
            │ │ · Histórico salarial         │ │     └─────────────────────┘
            │ │ · Baja de empleado           │ │
            │ └──────────────────────────────┘ │     ┌─────────────────────┐
            └────┬─────────┬─────────┬─────────┘ ◄── │ /ORDENES-COMPRA     │
                 │         │         │               │ → bonos Tipo B      │
                 ▼         ▼         ▼               └─────────────────────┘
       ┌──────────┐ ┌─────────┐ ┌──────────────┐
       │ /GASTOS  │ │ /FINAN- │ │/CONTABILIDAD │   ┌─────────────────────┐
       │ crea     │ │  ZAS    │ │ P&L · gasto  │◄──│ /FINANZAS/CC        │
       │ gasto    │ │ cashflow│ │ de personal  │   │ → bonos Tipo C      │
       │ planilla │ │ egresos │ │ por área     │   │ (% cartera vencida) │
       └──────────┘ └─────────┘ └──────────────┘   └─────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ /INVERSIONISTAS │
                  │ impacto en ROI  │
                  │ + margen neto   │
                  └─────────────────┘
```

### 8.1 · Flujo de datos

**INPUT a /planilla** (data que consume):
- /users + /users/{uid}/private/datosLaborales (quién está en planilla)
- /ventas con campo `vendedorId` (para comisiones)
- /ordenesCompra con campo `compradorId` + estado entrega (para metas logística)
- /finanzas/cuentasCorrientes/aging (para KPI cartera vencida)
- /envios estado (para entregas a tiempo)

**OUTPUT de /planilla** (data que genera):
- /gastos (cada boleta paga genera 1+ gastos categorizados `gasto_planilla`)
- /movimientosFinancieros (cada pago = movimiento de tesorería)
- /audit_logs (toda acción registrada)

**NO se duplica data** · planilla siempre pulls fresh de los módulos.

---

## 9 · Decisiones canon (D-PLANILLA-v5.4)

| ID | Decisión |
|---|---|
| **D-PL1** | Vita Skin NO paga CTS · módulo simplificado · solo gratificaciones (jul/dic) |
| **D-PL2** | 5 sub-tabs operativos: Boletas · Adelantos · **Incentivos** (NUEVO) · Vacaciones & Gratificaciones · **Análisis & Reportes** (NUEVO) |
| **D-PL3** | Sistema de incentivos con 4 tipos: comisión · bono_meta · bono_kpi · bono_fijo |
| **D-PL4** | Esquemas aplicables por rol o por usuario específico (override individual) |
| **D-PL5** | Cálculo de incentivos pulls data fresh de otros módulos · NO duplica |
| **D-PL6** | Baja de empleado con wizard 4 pasos · liquidación automática · soft-delete |
| **D-PL7** | Histórico salarial por empleado · audit trail de aumentos · drill desde Ficha 360 |
| **D-PL8** | Tab Análisis & Reportes con cross-links 360 a Gastos · Finanzas · Contabilidad · Inversionistas |
| **D-PL9** | Cada boleta paga genera gasto en /gastos automáticamente (categoría `gasto_planilla` · subcategoría por área) |
| **D-PL10** | Cash flow proyecta payroll mensual + gratificaciones automáticamente · 12 meses adelante |

---

## 10 · Plan de implementación · fases

### Fase 1 · Cleanup CTS + base v5.4 (~1h)
- Eliminar referencias CTS del tipo `Boleta`
- Renombrar tab "Vacaciones & CTS" → "Vacaciones & Gratificaciones"
- Cambiar canon mockup

### Fase 2 · Histórico salarial (~2h)
- Type `HistorialSalarial`
- Service CRUD
- Modal "Ajustar salario"
- Vista en Ficha 360 modal · tab Sub-perfiles · drill a histórico

### Fase 3 · Baja de empleado (~3h)
- Type/state `baja` + `motivoBaja` en datosLaborales
- Wizard 4 pasos · cálculo automático liquidación
- Service de liquidación
- Generación boleta especial
- Quita rol planilla del UserProfile

### Fase 4 · Sistema de incentivos · MVP (~4h)
- Types `EsquemaIncentivo` + `CalculoIncentivoMes`
- Service CRUD esquemas
- Service de cálculo automático (pulls de /ventas · /oc · /finanzas/cc)
- Tab Incentivos UI · lista esquemas + tabla cálculos del mes
- Modal "Nuevo esquema" wizard (4 tipos)
- Modal "Calcular bonos del mes" · CTA central
- Modal "Aprobar/Rechazar bono"
- Integración con boleta (bono aprobado → bonificación en boleta)

### Fase 5 · Tab Análisis & Cost Analytics (~3h)
- Service de agregaciones (payroll YTD · breakdown por área · etc.)
- Cards 4 cross-links 360
- Sparklines tendencia 12m
- Exports CSV/PDF
- Banner alerta si payroll/ingreso > umbral

### Fase 6 · Integración con otros módulos (~2h)
- En `pagarBoleta`: crear gasto en /gastos categorizado
- En `pagarBoleta`: crear movimiento financiero
- Cash-flow projection: agregar próximos pagos de planilla
- Contabilidad: gasto de personal por área

### Fase 7 · Validación + commit final (~1h)
- tsc + build OK
- Smoke test E2E
- Commit canon

**Tiempo total estimado: ~16h** distribuidos en 7 fases · 2-3 sesiones de trabajo

---

## 11 · Próximo paso · validación visual

Producir mockups actualizados v5.4 que muestren:

1. **`planilla-v5.4-completo.html`** · mockup integral · shell + 5 tabs + ~12 modales internos
2. Acto especial · sistema de incentivos detallado (los 4 tipos con ejemplos visuales)
3. Acto especial · baja de empleado wizard
4. Acto especial · cost analytics 360

No se toca código hasta que mockup v5.4 sea aprobado.

---

**Status:** análisis completo · pendiente mockup integral v5.4 + validación.  
**Autor:** Claude · 2026-05-26  
**Reemplaza decisiones:** v5.3 punto 6 (Vacaciones & CTS) · queda obsoleto.
