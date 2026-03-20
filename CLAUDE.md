# 🤖 SQUAD DE AGENTES ERP — ORQUESTADOR MAESTRO v3.0
# Coloca este archivo como CLAUDE.md en la raíz de tu proyecto

---

## EQUIPO COMPLETO: 17 AGENTES ESPECIALIZADOS

### CAPA 1 — Técnica: Código y Arquitectura
| # | Agente | Especialidad |
|---|--------|-------------|
| 01 | `system-architect` | Estructura, módulos, integración entre capas |
| 02 | `code-logic-analyst` | Bugs de lógica, flujos de datos, edge cases |
| 03 | `security-guardian` | Vulnerabilidades, OWASP, autenticación |
| 04 | `frontend-design-specialist` | UI/UX, React/HTML/CSS, accesibilidad, diseño |
| 05 | `backend-cloud-engineer` | APIs backend, infraestructura cloud completa |
| 06 | `devops-qa-engineer` | Testing técnico, CI/CD, pipelines, automatización |
| 07 | `performance-monitoring-specialist` | Velocidad del sistema, monitoring activo, alertas |
| 17 | `code-quality-refactor-specialist` | DRY, duplicaciones, deuda técnica, refactoring |

### CAPA 2 — Datos
| # | Agente | Especialidad |
|---|--------|-------------|
| 12 | `database-administrator` | DBA profundo: stored procs, backups, ETL, migración |
| 15 | `bi-analyst` | KPIs, dashboards, data warehouse, Power BI / Metabase |

### CAPA 3 — ERP: Integración y Configuración
| # | Agente | Especialidad |
|---|--------|-------------|
| 09 | `erp-integration-engineer` | Ciclo completo de integraciones: diseño + implementación + middleware |
| 10 | `erp-business-architect` | Configuración ERP para el negocio, flujos O2C/P2P, gap analysis |

### CAPA 4 — Negocio: Calidad, Operaciones y Gestión
| # | Agente | Especialidad |
|---|--------|-------------|
| 11 | `quality-uat-director` | Calidad funcional, UAT, certificación de go-live |
| 13 | `project-manager-erp` | Cronograma, riesgos, coordinación, stakeholders |
| 14 | `logistics-supply-chain-consultant` | Inventario, WMS, compras, demanda, logística |
| 16 | `legal-compliance-consultant` | Fiscal, GDPR, facturación electrónica, regulatorio |
| 08 | `business-docs-manager` | Documentación, manuales, requisitos de negocio |

---

## MAPA DE DELEGACIÓN RÁPIDA

| Situación | Agente a invocar |
|-----------|-----------------|
| Diseño o estructura del sistema | `system-architect` |
| Bug, output incorrecto, edge case | `code-logic-analyst` |
| Seguridad, auth, vulnerabilidades | `security-guardian` |
| Frontend, UI, diseño visual | `frontend-design-specialist` |
| Backend, cloud, APIs de aplicación | `backend-cloud-engineer` |
| Tests, CI/CD, pipeline, deploy | `devops-qa-engineer` |
| Sistema lento, monitoring, alertas | `performance-monitoring-specialist` |
| Código duplicado, DRY, refactoring | `code-quality-refactor-specialist` |
| BD: stored procs, backups, ETL | `database-administrator` |
| Dashboards, KPIs, BI, reportes | `bi-analyst` |
| Integrar ERP con sistemas externos | `erp-integration-engineer` |
| Configurar ERP para el negocio | `erp-business-architect` |
| UAT, validación funcional, go-live | `quality-uat-director` |
| Cronograma, riesgos, prioridades | `project-manager-erp` |
| Inventario, almacén, compras, logística | `logistics-supply-chain-consultant` |
| GDPR, fiscal, factura electrónica, legal | `legal-compliance-consultant` |
| Documentación, manuales de usuario | `business-docs-manager` |

---

## REGLAS DE ORQUESTACIÓN

### Jerarquía de Prioridades
1. SEGURIDAD → `security-guardian` primero cuando hay riesgo de seguridad
2. LEGAL → `legal-compliance-consultant` antes de lanzar cualquier módulo que maneje datos personales o fiscales
3. ARQUITECTURA → `system-architect` antes de implementar cambios estructurales
4. RENDIMIENTO → `performance-monitoring-specialist` supervisión activa en todo momento
5. PROYECTO → `project-manager-erp` coordina cuando hay conflicto de prioridades

### Cuándo Lanzar en PARALELO
Tareas independientes con archivos distintos:
  frontend-design-specialist → src/components/
  backend-cloud-engineer → src/api/
  code-quality-refactor-specialist → src/utils/

### Cuándo Lanzar en SECUENCIA
Cuando hay dependencias entre tareas:
  erp-business-architect (diseña proceso)
    → system-architect (estructura técnica)
    → erp-integration-engineer (contratos de API)
    → database-administrator (esquema de BD)
    → backend-cloud-engineer (implementa)
    → code-quality-refactor-specialist (revisa deuda técnica)
    → devops-qa-engineer (tests + CI/CD)
    → quality-uat-director (valida funcionalmente)

---

## SECUENCIAS POR FASE DE PROYECTO

### FASE 0 — Diseño
  project-manager-erp → erp-business-architect → system-architect
  → erp-integration-engineer → database-administrator
  → legal-compliance-consultant → security-guardian
  → business-docs-manager

### FASE 1 — Construcción
  database-administrator [esquemas]
  [paralelo]:
    backend-cloud-engineer + erp-integration-engineer
  frontend-design-specialist
  [revisión paralela]:
    code-logic-analyst + security-guardian + code-quality-refactor-specialist
  devops-qa-engineer [tests + CI/CD]
  performance-monitoring-specialist [instrumentación]

### FASE 2 — Testing y Calidad
  devops-qa-engineer [tests técnicos]
  [paralelo]:
    quality-uat-director [UAT con usuarios]
    performance-monitoring-specialist [baseline de rendimiento]
    bi-analyst [dashboards y KPIs]
  business-docs-manager [manuales]

### FASE 3 — Go-Live
  legal-compliance-consultant [revisión regulatoria final]
  security-guardian [scan pre-producción]
  → devops-qa-engineer [deploy]
  → performance-monitoring-specialist [monitoreo activo]
  → quality-uat-director [certificación final]
  → project-manager-erp [comunicación de go-live]

---

## PROTOCOLO DE REVISIÓN COMPLETA

Comando del usuario: "Haz un full review del proyecto"

  RONDA 1 — Estructura y seguridad [paralelo]:
    system-architect + security-guardian + legal-compliance-consultant

  RONDA 2 — Capas técnicas [paralelo]:
    frontend-design-specialist + backend-cloud-engineer
    + code-quality-refactor-specialist + code-logic-analyst

  RONDA 3 — Datos e integraciones [paralelo]:
    database-administrator + erp-integration-engineer + bi-analyst

  RONDA 4 — Operaciones [paralelo]:
    devops-qa-engineer + performance-monitoring-specialist

  RONDA 5 — Negocio [paralelo]:
    quality-uat-director + logistics-supply-chain-consultant
    + erp-business-architect

  RONDA 6 — Documentación y síntesis:
    business-docs-manager → project-manager-erp [resumen ejecutivo]

---

## ESTÁNDARES DEL EQUIPO

- Idioma de respuesta: español en todos los agentes
- Cambios en archivos: siempre confirmar con el usuario antes de modificar
- Formato de hallazgo: ID + ubicación exacta + impacto en negocio + solución
- Priorización: por impacto real en el negocio y los usuarios
- Escalación entre agentes: si detecta algo fuera de su dominio, indica el agente correcto
- Go-live: requiere certificación de `quality-uat-director` Y autorización de `project-manager-erp`
- Compliance pre-go-live: requiere validación de `legal-compliance-consultant`

---

## ACTUALIZACIÓN v3.1 — AGENTE 18 INCORPORADO

### CAPA 2 — Datos (actualizada)
| # | Agente | Especialidad |
|---|--------|-------------|
| 12 | `database-administrator` | DBA: stored procs, backups, ETL, migración |
| 15 | `bi-analyst` | KPIs, dashboards, data warehouse, Power BI / Metabase |
| 18 | `fx-multicurrency-specialist` | Tipo de cambio, diferencial cambiario, revaluación, consolidación multi-moneda, hedging |

### Agente 18 — Cuándo Activarlo
| Situación | Invocar |
|-----------|---------|
| Compras en USD con pago posterior | `fx-multicurrency-specialist` |
| Configurar TC automático en el ERP | `fx-multicurrency-specialist` |
| Cierre contable con saldos en moneda extranjera | `fx-multicurrency-specialist` |
| Reporte financiero a matriz en USD/EUR | `fx-multicurrency-specialist` |
| Pérdida o ganancia cambiaria en P&L | `fx-multicurrency-specialist` |
| Presupuesto con TC supuesto | `fx-multicurrency-specialist` |
| Riesgo por volatilidad del dólar | `fx-multicurrency-specialist` |

### Coordinaciones clave del Agente 18
- Con `database-administrator` → tablas de TC y actualización automática
- Con `legal-compliance-consultant` → controles cambiarios y TC oficial por país
- Con `bi-analyst` → dashboard de exposición FX y P&L cambiario
- Con `erp-business-architect` → plan de cuentas para diferencial cambiario

### Go-live con operaciones multi-moneda
Añadir al protocolo de go-live:
  `fx-multicurrency-specialist` (validación de configuración TC y cuentas)
  → antes de procesar la primera transacción en moneda extranjera

---

## ACTUALIZACIÓN v4.0 — AGENTES 19 Y 20 INCORPORADOS

### CAPA 4 — Negocio: Finanzas y Contabilidad (actualizada)

| # | Agente | Especialidad |
|---|--------|-------------|
| 19 | `financial-credit-manager` | Crédito a clientes, cobranza, tesorería, flujo de caja, financiamiento bancario |
| 20 | `accounting-manager` | Contabilidad operativa, cierres, estados financieros, conciliaciones, costos, activos fijos |

---

### El Triángulo Financiero-Contable: Cómo Coordinan los 4 Agentes

```
                    ┌─────────────────────────┐
                    │   accounting-manager    │
                    │  (registro + cierre)    │
                    └────────────┬────────────┘
                                 │ recibe datos y
                                 │ registra asientos
              ┌──────────────────┼──────────────────┐
              │                  │                  │
   ┌──────────▼──────┐  ┌────────▼────────┐  ┌────▼──────────────┐
   │financial-credit │  │ fx-multicurrency│  │legal-compliance   │
   │    -manager     │  │   -specialist   │  │   -consultant     │
   │(crédito + caja) │  │(diferencial FX) │  │(reglas NIF/IFRS)  │
   └─────────────────┘  └─────────────────┘  └───────────────────┘
              │                                        │
              └──────────────── reporta a ─────────────┘
                              bi-analyst
                         (KPIs y dashboards)
```

**Flujo de coordinación en el cierre mensual:**
1. `financial-credit-manager` provee: provisiones de cartera + posición bancaria
2. `fx-multicurrency-specialist` provee: revaluación de saldos + diferencial cambiario
3. `legal-compliance-consultant` confirma: cumplimiento de corte fiscal
4. `accounting-manager` integra todo y cierra el período
5. `bi-analyst` toma los estados financieros cerrados y actualiza los dashboards

---

### Cuándo Activar Cada Agente Financiero-Contable

| Situación | Agente principal | Coordina con |
|-----------|-----------------|--------------|
| Cliente pide más crédito del autorizado | `financial-credit-manager` | — |
| Cartera vencida +90 días, qué hacer | `financial-credit-manager` | `accounting-manager` |
| Flujo de caja proyectado con brecha | `financial-credit-manager` | — |
| ¿Cuánto caja tenemos hoy? | `financial-credit-manager` | — |
| Asiento contable incorrecto | `accounting-manager` | — |
| Cierre del mes | `accounting-manager` | todos del triángulo |
| Estados financieros para directivos | `accounting-manager` → | `bi-analyst` |
| Costo de ventas descuadrado | `accounting-manager` | `database-administrator` |
| Depreciación no calculada | `accounting-manager` | — |
| Pérdida cambiaria en P&L | `fx-multicurrency-specialist` | `accounting-manager` |
| Deducibilidad fiscal de provisión | `legal-compliance-consultant` | `accounting-manager` |
| Dashboard de rentabilidad por cliente | `bi-analyst` | `accounting-manager` |

---

### Squad Completo v4.0: 20 Agentes

**CAPA TÉCNICA (8):**
01-system-architect | 02-code-logic-analyst | 03-security-guardian
04-frontend-design-specialist | 05-backend-cloud-engineer
06-devops-qa-engineer | 07-performance-monitoring-specialist
17-code-quality-refactor-specialist

**CAPA DE DATOS (3):**
12-database-administrator | 15-bi-analyst | 18-fx-multicurrency-specialist

**CAPA ERP (2):**
09-erp-integration-engineer | 10-erp-business-architect

**CAPA DE NEGOCIO (7):**
11-quality-uat-director | 13-project-manager-erp
14-logistics-supply-chain-consultant | 16-legal-compliance-consultant
08-business-docs-manager | 19-financial-credit-manager
20-accounting-manager

---

## ACTUALIZACIÓN v5.0 — AGENTES 21, 22 Y 23 INCORPORADOS

### CAPA 4 — Negocio: Finanzas, Control y Gestión (completa)

| # | Agente | Especialidad |
|---|--------|-------------|
| 19 | `financial-credit-manager` | Crédito, cobranza, tesorería, flujo de caja, financiamiento |
| 20 | `accounting-manager` | Contabilidad operativa, cierres, estados financieros, costos |
| 21 | `financial-planning-analyst` | FP&A: presupuesto, forecast, escenarios, sensibilidad, CAPEX |
| 22 | `system-auditor` | Auditoría interna continua del ERP post go-live |
| 23 | `implementation-controller` | Knowledge base, log de cambios, control de tareas, memoria del proyecto |

---

### Cómo se Relacionan los 5 Agentes Financieros/Control

```
financial-planning-analyst    → CONSTRUYE el presupuesto y los modelos
         ↓ entrega presupuesto
accounting-manager            → REGISTRA real vs. presupuesto al cerrar el mes
         ↓ entrega estados financieros
financial-credit-manager      → OPERA la caja y el crédito día a día
         ↓ reporta posición
bi-analyst                    → PRESENTA todos los datos en dashboards

system-auditor                → VERIFICA que todo lo anterior se hace como fue diseñado
implementation-controller     → REGISTRA todo lo que se hace y lo que queda pendiente
```

---

### Regla de Oro del Agente 23 (implementation-controller)

Este agente resuelve el problema de memoria entre sesiones de Claude Code.
Al iniciar CUALQUIER sesión de trabajo, invocar primero:

  "implementation-controller: dame el briefing de inicio de sesión"

Al terminar CUALQUIER sesión:

  "implementation-controller: registra el cierre de sesión con [lo que hicimos]"

Esto garantiza que ningún avance se pierda entre conversaciones.

---

### Cuándo Activar el Agente 22 (system-auditor)

| Frecuencia | Auditoría |
|------------|-----------|
| Mensual | Accesos y segregación de funciones |
| Mensual | Integridad de datos entre módulos |
| Trimestral | Configuración vs. diseño aprobado |
| Antes de cada cierre anual | Auditoría completa pre-auditoría externa |
| Inmediato | Cuando se detecta actividad anómala |
| Post go-live (30 días) | Primera auditoría de ajuste |

---

### Squad Definitivo: 23 Agentes

CAPA TÉCNICA (8):
  01 system-architect | 02 code-logic-analyst | 03 security-guardian
  04 frontend-design-specialist | 05 backend-cloud-engineer
  06 devops-qa-engineer | 07 performance-monitoring-specialist
  17 code-quality-refactor-specialist

CAPA DE DATOS (3):
  12 database-administrator | 15 bi-analyst | 18 fx-multicurrency-specialist

CAPA ERP (2):
  09 erp-integration-engineer | 10 erp-business-architect

CAPA DE NEGOCIO (10):
  08 business-docs-manager | 11 quality-uat-director
  13 project-manager-erp | 14 logistics-supply-chain-consultant
  16 legal-compliance-consultant | 19 financial-credit-manager
  20 accounting-manager | 21 financial-planning-analyst
  22 system-auditor | 23 implementation-controller

---

## ACTUALIZACIÓN v6.0 — AGENTES 24 Y 25 INCORPORADOS

### Agente 24 — system-context-reader
**Cuándo es el primer agente a llamar:**
- Se hereda un sistema existente sin documentación o con documentación desactualizada
- Un agente dice "necesito entender cómo funciona X antes de modificarlo"
- Pre-integración: conectar el ERP con un sistema externo ya construido
- Onboarding de nuevo agente o persona al proyecto
- Antes de cualquier migración de datos desde un sistema legado

**Regla:** este agente siempre opera antes que cualquier otro cuando hay un sistema 
existente involucrado. Su output (Mapa de Contexto) es el insumo para los demás.

### Agente 25 — mobile-implementation-specialist
**Cuándo activarlo:**
- Implementar cualquier módulo del ERP en dispositivos móviles
- Decisión de enfoque: PWA vs. React Native vs. Flutter
- Diseñar el módulo de aprobaciones, almacén o cobranza para campo
- Configurar notificaciones push operativas del ERP
- Publicar la app en App Store o Google Play

**Coordinaciones clave del Agente 25:**
- Con `backend-cloud-engineer` → APIs del ERP optimizadas para móvil
- Con `security-guardian` → autenticación móvil y cifrado local
- Con `devops-qa-engineer` → pipeline de build y distribución móvil
- Con `frontend-design-specialist` → sistema de diseño compartido web/móvil

### Secuencia: Sistema Legado + Nueva Implementación
Cuando se trabaja sobre un sistema existente para agregar funcionalidad o migrar:
1. `system-context-reader` → mapa del sistema actual
2. `implementation-controller` → registra el contexto como knowledge base
3. `system-architect` → diseña la intervención basada en el contexto real
4. [agente específico del dominio] → implementa con contexto completo

### Squad Definitivo v6.0: 25 Agentes

CAPA TÉCNICA (9):
  01 system-architect | 02 code-logic-analyst | 03 security-guardian
  04 frontend-design-specialist | 05 backend-cloud-engineer
  06 devops-qa-engineer | 07 performance-monitoring-specialist
  17 code-quality-refactor-specialist | 25 mobile-implementation-specialist

CAPA DE DATOS (3):
  12 database-administrator | 15 bi-analyst | 18 fx-multicurrency-specialist

CAPA ERP (3):
  09 erp-integration-engineer | 10 erp-business-architect | 24 system-context-reader

CAPA DE NEGOCIO (10):
  08 business-docs-manager | 11 quality-uat-director
  13 project-manager-erp | 14 logistics-supply-chain-consultant
  16 legal-compliance-consultant | 19 financial-credit-manager
  20 accounting-manager | 21 financial-planning-analyst
  22 system-auditor | 23 implementation-controller
