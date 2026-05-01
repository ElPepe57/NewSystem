# CHARTER DE MÓDULOS · BusinessMN v2

> **Propósito de este documento:**
> Definir QUÉ hace cada módulo, qué le pertenece, qué NO le pertenece, y cómo se
> relaciona con los demás. La constitución del sistema.
>
> **Origen:** sesión S58f. Cita del usuario:
> *"En realidad todo no tiene que estar en una sola página, pero que se entienda para
> qué es cada página, eso es lo que más me importa, y que las responsabilidades y
> funciones estén claras y el sidebar bien organizado."*
>
> **Regla de oro:** si dos módulos pueden hacer lo mismo, este documento decide cuál
> es el dueño. Los demás solo pueden mostrar/referenciar — no operar.

---

## 0 · Filosofía del sistema

El ERP se organiza por **intención del usuario**, no por equipo ni por entidad de datos.

Cada módulo responde a una pregunta concreta:

| Pregunta del usuario | Módulo dueño |
|---|---|
| ¿Qué tengo que hacer hoy? | **Dashboard** |
| ¿Cómo está mi negocio en general? | **Finanzas** |
| ¿Qué hago con el dinero ahora? | **Tesorería** |
| ¿A quién le compro? | **Compras** |
| ¿A quién le vendo? | **Ventas** |
| ¿Qué tengo en stock? | **Productos** |
| ¿Dónde están mis envíos? | **Envíos** |
| ¿Cuáles son mis gastos recurrentes? | **Gastos** |
| ¿Quién es esta persona/empresa? | **Personas** (Clientes / Proveedores / Red Logística / Empleados) |

**Implicación práctica:** un mismo dato puede aparecer en varios módulos, pero solo
**uno** lo opera. Los demás lo muestran de lectura.

Ejemplo: una OC pagada genera un movimiento de tesorería.
- **Compras** muestra "OC pagada · S/ 4,500" (lectura).
- **Tesorería** opera el movimiento (escritura).
- **Finanzas** muestra el impacto ejecutivo (lectura agregada).
- Las tres lo ven, solo Tesorería lo modifica.

---

## 1 · Sidebar definitivo · 4 secciones

```
┌─────────────────────────────────────────────────┐
│  🔍 Buscar todo…              [⌘K]              │
├─────────────────────────────────────────────────┤
│                                                 │
│  OPERACIÓN                                      │
│    📊  Dashboard                                │
│    🛒  Compras                                  │
│    🏪  Ventas                                   │
│    📦  Productos                                │
│    🚚  Envíos                                   │
│                                                 │
│  FINANZAS Y CONTABILIDAD                        │
│    📈  Finanzas                                 │
│    💼  Tesorería                                │
│    📋  Gastos                                   │
│    💱  Tipo de Cambio                           │
│                                                 │
│  PERSONAS                                       │
│    👥  Clientes                                 │
│    🏢  Proveedores                              │
│    🚛  Red Logística                            │
│    🪪  Empleados                                │
│                                                 │
│  SISTEMA                                        │
│    ⚙️  Configuración                            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### ¿Por qué estas 4 secciones?

| Sección | Verbo dominante | Frecuencia de uso |
|---|---|---|
| **Operación** | "hacer" (crear OC, despachar, recibir) | Diaria · alta |
| **Finanzas y Contabilidad** | "controlar" (ver, ajustar, conciliar) | Diaria · media |
| **Personas** | "consultar / mantener" (ficha, historial) | Semanal · baja |
| **Sistema** | "configurar" | Mensual · muy baja |

El orden refleja la frecuencia. Lo más usado arriba.

---

## 2 · Las 14 páginas y sus responsabilidades

Para cada página: **propósito único** (1 línea), **qué hace**, **qué NO hace**, **qué relaciona**.

---

### 2.1 · 📊 Dashboard

**Propósito único:** *"Lo que necesito saber HOY al abrir el sistema."*

**Qué hace:**
- Muestra alertas operativas urgentes (OCs vencidas, ventas sin cobrar +30d, pagos pendientes a colaboradores).
- Sintetiza el día anterior (cuánto entró, cuánto salió, qué se confirmó).
- Da accesos directos a las acciones más probables del día.
- Es la portada del sistema — primera pantalla al iniciar sesión.

**Qué NO hace:**
- No es un reporte ejecutivo (eso es Finanzas).
- No registra movimientos (eso es Tesorería).
- No mantiene fichas (eso es Personas).
- No muestra históricos largos.

**Relaciones:**
- Lee de TODOS los módulos.
- Cada alerta lleva con deep-link al módulo dueño.
- No tiene escritura propia.

---

### 2.2 · 🛒 Compras

**Propósito único:** *"Todo lo que tiene que ver con comprarle a alguien."*

**Qué hace:**
- Crear, confirmar, recibir y cerrar Órdenes de Compra (OCs).
- Gestionar el ciclo de vida de cada OC (borrador → confirmada → en tránsito → recibida → pagada).
- Muestra el lado financiero de la OC (total, pagado, saldo) — pero **el pago se opera desde Tesorería** o desde el panel embebido que es **una vista de Tesorería dentro de Compras**.
- Mantiene la lista de OCs activas y el historial.

**Qué NO hace:**
- No mantiene la ficha del proveedor (eso es Personas → Proveedores).
- No registra el movimiento de tesorería (lo hace Tesorería; Compras solo dispara la acción).
- No genera el envío (eso es Envíos, aunque Compras lo dispara).
- No actualiza el stock directamente (lo hace Productos al recibir).

**Relaciones:**
- Lee de Personas → Proveedores (datos del proveedor).
- Lee de Productos (catálogo).
- Dispara a Envíos (cuando confirma OC con logística).
- Dispara a Tesorería (cuando se registra pago).
- Dispara a Productos (cuando se recibe la mercancía).

**Vistas internas:**
- Listado de OCs (`/compras`).
- Detalle de OC (`/compras/:id` o modal).
- Wizard de nueva OC (`/compras/nueva`).

---

### 2.3 · 🏪 Ventas

**Propósito único:** *"Todo lo que tiene que ver con venderle a alguien."*

**Qué hace:**
- Crear, confirmar, despachar y cerrar ventas.
- Gestionar el ciclo (cotización → confirmada → despachada → cobrada → cerrada).
- Muestra el lado financiero (total, cobrado, saldo) — el cobro se opera desde Tesorería o panel embebido.
- Lista activas + historial.

**Qué NO hace:**
- No mantiene ficha del cliente (Personas → Clientes).
- No registra el movimiento de cobro (lo hace Tesorería).
- No genera el despacho (Envíos lo gestiona, Ventas lo dispara).

**Relaciones:**
- Lee de Personas → Clientes.
- Lee de Productos (catálogo + stock).
- Dispara a Envíos (despacho).
- Dispara a Tesorería (cobro).
- Dispara a Productos (descuenta stock al despachar).

---

### 2.4 · 📦 Productos

**Propósito único:** *"Qué tengo, dónde está, cuánto cuesta."*

**Qué hace:**
- Catálogo maestro de productos (SKU, descripción, marca, categoría).
- Inventario y stock por almacén/casilla.
- Costos (landed cost, costo unitario, CTRU).
- Movimientos de inventario (entradas, salidas, ajustes, conteos).
- Packs/kits (combos de productos).

**Qué NO hace:**
- No vende ni compra (Compras y Ventas).
- No precio de venta a clientes (eso vive en Ventas o Cotizaciones, según contexto).

**Relaciones:**
- Recibe entradas de Compras (al confirmar recepción).
- Recibe salidas de Ventas (al despachar).
- Lee de Tesorería (para CTRU al pagar OC).

---

### 2.5 · 🚚 Envíos

**Propósito único:** *"Todo lo que sale, entra o se traslada físicamente."*

**Qué hace:**
- Hub transversal de logística (decisión arquitectónica S43-S52).
- 4 tipos: C (casilla→PE), J (casilla→casilla), E (PE→PE), I (PE→tercero).
- Pendientes T-F (despacho venta) y T-G (devolución).
- Gestión de transportadores: viajeros, courier internacional, transportista local.
- Tarifas por tramos de peso, fletes, pagos a colaboradores.
- Sub-envíos T1, reclamos, costos landed.

**Qué NO hace:**
- No es responsable del cobro al cliente (Ventas).
- No mantiene ficha del colaborador (Personas → Red Logística).
- No registra el pago al colaborador (Tesorería; Envíos lo dispara).

**Relaciones:**
- Recibe disparo de Compras (T1, T2 desde OC).
- Recibe disparo de Ventas (T-F).
- Recibe disparo de Devoluciones (T-G — futuro).
- Lee de Personas → Red Logística (colaboradores y casillas).
- Dispara a Tesorería (pago a colaborador, reembolso de viajero).
- Actualiza Productos (movimiento de inventario al recibir/despachar).

---

### 2.6 · 📈 Finanzas

**Propósito único:** *"Cómo está mi negocio en términos de dinero — la visión ejecutiva."*

**Qué hace:**
- Vista ejecutiva agregada del estado financiero del negocio.
- **Overview** (`/finanzas`): patrimonio total, KPIs combinados, alertas, tendencia.
- **Saldos por entidad** (`/finanzas/saldos`): cuentas corrientes — quién me debe, a quién le debo.
- **Cash flow** (`/finanzas/cash-flow`): flujo de caja consolidado.
- Reportes ejecutivos para el dueño/CFO.

**Qué NO hace:**
- No registra movimientos (Tesorería).
- No gestiona las cuentas bancarias individuales (Tesorería).
- No edita pagos ni cobros (los muestra agregados).
- No mantiene fichas (Personas).

**Audiencia:** dueño, CFO, gerente.

**Frecuencia:** abrir 1-2 veces al día para ver "cómo va todo".

**Relaciones:**
- Lee de Tesorería (movimientos, productos financieros).
- Lee de Personas (fichas de las CC).
- Lee de Compras/Ventas/Gastos (para alertas).
- No tiene escritura.

---

### 2.7 · 💼 Tesorería

**Propósito único:** *"La operación diaria del dinero. Donde se mueve plata de verdad."*

**Qué hace:**
- **Productos financieros** (`/tesoreria`): cuentas bancarias, cajas, billeteras digitales, tarjetas de crédito, cajas recaudadoras de agentes (caso GK Xpress).
- **Movimientos** (`/tesoreria/movimientos`): libro mayor unificado (todo lo que entra y sale).
- **Conversiones** (`/tesoreria/conversiones`): PEN ↔ USD entre cuentas propias.
- **Transferencias** (`/tesoreria/transferencias`): entre cuentas propias.
- **Pagos masivos** (`/tesoreria/pagos-masivos`): subir CSV con N pagos a N proveedores.
- **Pipeline** (`/tesoreria/pipeline`): pipeline operativo de tesorería.

**Qué NO hace:**
- No es vista ejecutiva (Finanzas).
- No mantiene CC por entidad como vista principal (eso es `/finanzas/saldos` — Tesorería se concentra en productos financieros propios).
- No factura electrónicamente (módulo aparte futuro).

**Audiencia:** operador financiero, contador interno, dueño cuando opera.

**Frecuencia:** múltiples veces al día.

**Relaciones:**
- Recibe disparos de Compras (pago de OC).
- Recibe disparos de Ventas (cobro de venta).
- Recibe disparos de Gastos (pago de gasto).
- Recibe disparos de Envíos (pago a colaborador).
- Escribe en CC (cuentas corrientes — automático cuando registra movimiento).
- Es leída por Finanzas (vista ejecutiva).

---

### 2.8 · 📋 Gastos

**Propósito único:** *"Egresos recurrentes y eventuales no asociados a OC."*

**Qué hace:**
- Catálogo de gastos fijos (alquiler, servicios, sueldos administrativos).
- Registro de gastos eventuales.
- Vinculación a proveedor formal o informal.
- Disparo del pago hacia Tesorería.

**Qué NO hace:**
- No registra el movimiento de pago (Tesorería; Gastos lo dispara).
- No es planilla (la planilla tiene módulo propio futuro).

**Relaciones:**
- Lee de Personas → Proveedores.
- Dispara a Tesorería (pago).

---

### 2.9 · 💱 Tipo de Cambio

**Propósito único:** *"Mantener el TC del día actualizado y tener histórico."*

**Qué hace:**
- Registra el TC oficial del día (compra/venta SUNAT u otra fuente).
- Histórico de TCs.
- Pool USD TCPA (tipo de cambio promedio acumulado para conversiones).
- Es **fuente de verdad** del TC para todos los demás módulos.

**Qué NO hace:**
- No hace conversiones (eso es Tesorería).
- No calcula diferencial cambiario en operaciones (eso lo hace Tesorería al cerrar conversión).

**Relaciones:**
- Es leído por todos los módulos que tocan dinero (al crear OC, venta, gasto, conversión).

---

### 2.10 · 👥 Clientes

**Propósito único:** *"Quién es esta persona/empresa que nos compra."*

**Qué hace:**
- Ficha del cliente (datos personales, contacto, dirección, historial de compras).
- Datos bancarios pasivos (`datosBancarios[]`) — cuentas donde el cliente recibe.
- Historial de ventas y CC del cliente (lectura agregada).

**Qué NO hace:**
- No vende (Ventas).
- No cobra (Tesorería).
- No gestiona deudas activamente (Finanzas → Saldos).

**Relaciones:**
- Es leído por Ventas y Cotizaciones.
- Es leído por Finanzas → Saldos.

---

### 2.11 · 🏢 Proveedores

**Propósito único:** *"Quién es esta persona/empresa a la que le compramos."*

**Qué hace:**
- Ficha del proveedor (datos, productos que ofrece, condiciones, historial de OCs).
- Datos bancarios pasivos (donde le pagamos).
- Promoción de `datosBancarios` → CuentaCaja recaudadora (caso GK Xpress).

**Qué NO hace:**
- No compra (Compras).
- No paga (Tesorería).

**Relaciones:**
- Es leído por Compras y Gastos.
- Es leído por Finanzas → Saldos.
- Promueve cuentas a Tesorería cuando aplica.

---

### 2.12 · 🚛 Red Logística

**Propósito único:** *"Las personas y casillas que mueven nuestros envíos."*

**Qué hace:**
- Ficha de colaboradores (viajeros, courier internacional, transportistas locales).
- Casillas internacionales asociadas.
- Tarifas por tramos de peso (TramoPeso[]).
- Datos bancarios pasivos.

**Qué NO hace:**
- No mueve envíos (Envíos).
- No paga (Tesorería).

**Relaciones:**
- Es leído por Envíos.
- Es leído por Finanzas → Saldos.

**Nota:** caso GK Xpress (90% de envíos) genera flujo recaudador especial — su ficha
puede tener cuenta promovida a CajaRecaudadora.

---

### 2.13 · 🪪 Empleados

**Propósito único:** *"Las personas que trabajan en la empresa."*

**Qué hace:**
- Ficha del empleado.
- Datos bancarios pasivos (donde le depositamos sueldo / adelantos).
- Histórico de adelantos.

**Qué NO hace:**
- No paga sueldos (futuro: módulo Planilla, separado).
- No es reemplazo de la planilla.

**Relaciones:**
- Es leído por Planilla (futuro).
- Es leído por Tesorería (para anticipos).

---

### 2.14 · ⚙️ Configuración

**Propósito único:** *"Ajustes del sistema."*

**Qué hace:**
- Usuarios y permisos.
- Datos de la empresa.
- Preferencias generales.
- Integraciones (Mercado Libre, WhatsApp, etc.).

**Frecuencia:** mensual o menor.

---

## 3 · Tabla maestra de propiedad

Para cada concepto del negocio: quién es el dueño y quién solo muestra/lee.

| Concepto | Dueño (operación) | Lectura/visualización |
|---|---|---|
| Producto financiero (cuenta, tarjeta, caja) | Tesorería | Finanzas |
| Movimiento de tesorería | Tesorería | Finanzas, módulos disparadores |
| OC (Orden de Compra) | Compras | Tesorería (en pago), Productos (en recepción) |
| Venta | Ventas | Tesorería (en cobro), Envíos (en despacho) |
| Gasto | Gastos | Tesorería (en pago) |
| Envío | Envíos | Compras (T1/T2), Ventas (T-F), Devoluciones (T-G) |
| Producto / SKU | Productos | Compras, Ventas |
| Stock / inventario | Productos | Envíos (al recibir/despachar) |
| Cliente (ficha) | Personas → Clientes | Ventas, Cotizaciones, Finanzas |
| Proveedor (ficha) | Personas → Proveedores | Compras, Gastos, Finanzas |
| Colaborador (ficha) | Personas → Red Logística | Envíos, Finanzas |
| Empleado (ficha) | Personas → Empleados | Tesorería (anticipos), Planilla (futuro) |
| Cuenta Corriente (CC por entidad) | Tesorería (escritura automática) | Finanzas → Saldos (vista principal), Personas (en ficha) |
| Tipo de cambio del día | Tipo de Cambio | Todos los módulos que tocan dinero |
| Pool USD TCPA | Tesorería | Finanzas, Tipo de Cambio |
| Conversión PEN/USD | Tesorería | Finanzas |
| Cargo a tarjeta de crédito | Tesorería | Compras (donde se origina) |
| Pago de estado de cuenta TC | Tesorería | Finanzas |
| Costo landed / CTRU | Productos (cálculo) | Compras (input), Envíos (input) |
| Datos bancarios pasivos de terceros | Personas (cada tipo) | Tesorería (al promover) |
| Caja recaudadora (caso GK Xpress) | Tesorería | Personas → Red Logística (en ficha) |
| Reportes ejecutivos | Finanzas | — |
| Cash flow agregado | Finanzas | — |
| Aportes/retiros de socios | Tesorería (movimiento tipo) | Finanzas |
| Adelantos a empleados | Tesorería (movimiento tipo) | Empleados (historial) |
| Anticipos a viajeros | Tesorería (movimiento tipo) | Envíos (referencia), Red Logística |

**Regla:** si una columna tiene varios "lectores", solo el "dueño" puede modificar.
Los lectores muestran información en su contexto, pero el botón de edición lleva al dueño.

---

## 4 · Patrón de "panel embebido" para integraciones

Cuando un módulo necesita mostrar información financiera de otro:

```
┌─ Detalle de OC ─────────────────────────────────┐
│  Header (estado, proveedor, fecha)              │
│  Productos                                      │
│  ...                                            │
│  ┌─ 💰 PAGOS Y TESORERÍA ────────────────────┐  │  ← panel embebido
│  │  (datos de Tesorería leídos en contexto)  │  │
│  │  [Ver en Tesorería →]                     │  │  ← link al módulo dueño
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Reglas del patrón:**
1. El panel embebido es **lectura + acción primaria**.
2. Las acciones primarias (registrar pago, ver detalle) abren wizards o navegan al módulo dueño.
3. El panel SIEMPRE tiene un link "Ver en [Módulo dueño] →" para casos avanzados.
4. El panel NO duplica funcionalidad — solo expone lo más relevante en contexto.

**Ejemplos canónicos:**
- En detalle OC → panel "Pagos y Tesorería".
- En detalle Venta → panel "Cobros".
- En detalle Gasto → panel "Pago".
- En detalle Envío → panel "Pago a colaborador".
- En detalle Movimiento → panel "Documentos vinculados" (referencia inversa).

---

## 5 · Decisiones que cierra este Charter

| ID | Decisión | Implicación |
|---|---|---|
| **D-CH-1** | Sidebar tiene 4 secciones: Operación, Finanzas y Contabilidad, Personas, Sistema | Orden refleja frecuencia de uso |
| **D-CH-2** | Tesorería en sidebar como ítem propio | Resuelve "huérfana" |
| **D-CH-3** | Finanzas = ejecutivo, Tesorería = operativo | Roles separados, audiencias distintas |
| **D-CH-4** | Cada concepto tiene UN módulo dueño | Cero duplicación de operación |
| **D-CH-5** | Otros módulos pueden mostrar/leer datos de un concepto, pero no operarlo | Sus paneles llaman al wizard del dueño |
| **D-CH-6** | Patrón "panel embebido" para integraciones | Lectura + acción primaria + link al dueño |
| **D-CH-7** | Cada página tiene UN propósito declarado en su header | El usuario entiende para qué es cada página al abrirla |
| **D-CH-8** | CC por entidad vive en Finanzas → Saldos como vista principal | Tesorería se concentra en productos financieros del negocio |
| **D-CH-9** | Caso GK Xpress (caja recaudadora) es soportado en Tesorería con ficha en Red Logística | Banner promoción + vista dedicada |
| **D-CH-10** | Planilla NO entra en este charter — tiene su refactor futuro | Empleados solo guarda ficha y datos bancarios |
| **D-CH-11** | Reportes contables NIIF/NIF son stand-by | Solo lo necesario para auditoría eventual |
| **D-CH-12** | Adelantos/aportes/retiros se registran como tipos de MovimientoTesoreria, sin UI dedicada | Caben en Tesorería y se reflejan en Finanzas |

---

## 6 · Cómo se usa este Charter

### Para diseñar una página nueva
1. Identificar a qué módulo pertenece.
2. Verificar que su propósito calce con el del módulo (sección 2).
3. Si toca un concepto que pertenece a otro, usar patrón "panel embebido" (sección 4).
4. Declarar el propósito en el header de la página.

### Para revisar una página existente
1. ¿Su propósito está claro al abrirla?
2. ¿Está haciendo cosas que pertenecen a otro módulo?
3. ¿Sus integraciones siguen el patrón embebido?

### Para resolver disputas de propiedad
1. Buscar en la tabla maestra (sección 3).
2. Si no está, agregarla con criterio del usuario.

---

## 7 · Próximo paso después de validar este Charter

Una vez validado:
1. **Refinar el roadmap de mockups** basado en las responsabilidades aquí declaradas.
2. **Revisar mockup M-NAV-01 (sidebar global)** que ya existe — ajustar si hay desviaciones.
3. **Producir mockup por módulo** mostrando: header con propósito + paneles embebidos + zona del módulo dueño.

**No se producen mockups adicionales hasta que valides este Charter.**

---

> **Última actualización:** 2026-04-29 · sesión S58f
> **Estado:** esperando validación del usuario
> **Decisiones a confirmar:** las 12 D-CH-1 a D-CH-12 (sección 5)
