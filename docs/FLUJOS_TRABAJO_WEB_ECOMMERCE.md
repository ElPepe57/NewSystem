# FLUJOS DE TRABAJO Y VISUALIZACIONES
## Integracion Web E-Commerce con ERP BMN System

---

# 1. FLUJO COMPLETO DE COMPRA DEL CLIENTE

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           JOURNEY DEL CLIENTE - FLUJO COMPLETO                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │  VISITANTE  │
                                    │  (Anonimo)  │
                                    └──────┬──────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
             ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
             │   BUSQUEDA  │        │  CATEGORIA  │        │   OFERTA    │
             │   Directa   │        │   Navegar   │        │  Promocion  │
             └──────┬──────┘        └──────┬──────┘        └──────┬──────┘
                    │                      │                      │
                    └──────────────────────┼──────────────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  CATALOGO   │
                                    │  (Lista)    │
                                    └──────┬──────┘
                                           │
                         ┌─────────────────┼─────────────────┐
                         │                 │                 │
                         ▼                 ▼                 ▼
                  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
                  │   FILTRAR   │   │  COMPARAR   │   │   CHAT IA   │
                  │  Productos  │   │  Productos  │   │   Preguntar │
                  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
                         │                 │                 │
                         └─────────────────┼─────────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  PRODUCTO   │
                                    │  (Detalle)  │
                                    └──────┬──────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
             ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
             │   AGREGAR   │        │   GUARDAR   │        │   SEGUIR    │
             │  A CARRITO  │        │  FAVORITO   │        │  NAVEGANDO  │
             └──────┬──────┘        └─────────────┘        └─────────────┘
                    │
                    │
                    │      ┌───────────────────────────────────────────────────────┐
                    │      │           SISTEMA DE RESERVA DE STOCK                 │
                    │      │                                                       │
                    │      │   Al agregar al carrito:                              │
                    │      │   1. Verificar stock disponible                       │
                    │      │   2. Crear reserva temporal (48h default)             │
                    │      │   3. Bloquear unidades especificas                    │
                    │      │   4. Mostrar tiempo restante al usuario               │
                    │      │                                                       │
                    │      │   Si no hay stock:                                    │
                    │      │   - Opcion de lista de espera                         │
                    │      │   - Notificacion cuando llegue                        │
                    │      │                                                       │
                    │      └───────────────────────────────────────────────────────┘
                    │
                    ▼
             ┌─────────────┐
             │   CARRITO   │
             │  (Sidebar)  │
             └──────┬──────┘
                    │
                    ├────────────────────────────────────────┐
                    │                                        │
                    ▼                                        ▼
             ┌─────────────┐                          ┌─────────────┐
             │  MODIFICAR  │                          │  CONTINUAR  │
             │  Cantidades │                          │  COMPRANDO  │
             └──────┬──────┘                          └─────────────┘
                    │
                    ▼
             ┌─────────────┐
             │  CHECKOUT   │
             │  (Iniciar)  │
             └──────┬──────┘
                    │
                    │      ┌───────────────────────────────────────────────────────┐
                    │      │           SI USUARIO NO ESTA LOGUEADO                 │
                    │      │                                                       │
                    │      │   Opciones:                                           │
                    │      │   1. Continuar como invitado (solo email)             │
                    │      │   2. Iniciar sesion (si ya tiene cuenta)              │
                    │      │   3. Crear cuenta (beneficios: historial, puntos)     │
                    │      │                                                       │
                    │      └───────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │                                                                       │
    │                       CHECKOUT 3 PASOS                                │
    │                                                                       │
    │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
    │   │  PASO 1         │    │  PASO 2         │    │  PASO 3         │  │
    │   │  CONTACTO       │───>│  ENVIO          │───>│  PAGO           │  │
    │   │                 │    │                 │    │                 │  │
    │   │  - Nombre       │    │  - Direccion    │    │  - Tarjeta      │  │
    │   │  - Email        │    │  - Distrito     │    │  - Yape/Plin    │  │
    │   │  - Telefono     │    │  - Referencia   │    │  - Transferencia│  │
    │   │  - DNI/RUC      │    │  - Metodo envio │    │  - Contraentrega│  │
    │   └─────────────────┘    └─────────────────┘    └─────────────────┘  │
    │                                                                       │
    └───────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
             ┌─────────────┐
             │   PAGAR     │
             │  (Proceso)  │
             └──────┬──────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
  ┌─────────────┐       ┌─────────────┐
  │    EXITO    │       │   ERROR     │
  │  Confirmado │       │   Reintentar│
  └──────┬──────┘       └─────────────┘
         │
         │      ┌───────────────────────────────────────────────────────────────────┐
         │      │                    POST-COMPRA AUTOMATICO                         │
         │      │                                                                   │
         │      │   1. Confirmar reserva de stock -> Stock definitivo              │
         │      │   2. Crear registro de Venta en ERP                              │
         │      │   3. Enviar email de confirmacion                                │
         │      │   4. Enviar WhatsApp de confirmacion                             │
         │      │   5. Actualizar metricas del cliente (RFM)                       │
         │      │   6. Disparar evento de analytics (purchase)                     │
         │      │   7. Si cliente nuevo -> crear en Maestro de Clientes            │
         │      │                                                                   │
         │      └───────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────┐
  │CONFIRMACION │
  │   (Pagina)  │
  └──────┬──────┘
         │
         │
         ▼
  ┌─────────────┐
  │  TRACKING   │
  │   (Email +  │
  │  WhatsApp)  │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  ENTREGA    │
  │ (Completada)│
  └──────┬──────┘
         │
         │      ┌───────────────────────────────────────────────────────────────────┐
         │      │                    CICLO DE RECOMPRA                              │
         │      │                                                                   │
         │      │   Basado en producto.cicloRecompraDias:                           │
         │      │                                                                   │
         │      │   - Si producto dura 30 dias                                     │
         │      │   - Dia 25: Enviar recordatorio "Es hora de reponer"             │
         │      │   - Con link directo a recompra (carrito prellenado)             │
         │      │                                                                   │
         │      └───────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────┐
  │  RECOMPRA   │
  │ (Automatica)│
  └─────────────┘
```

---

# 2. FLUJO DE SINCRONIZACION ERP <-> WEB

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                      SINCRONIZACION BIDIRECCIONAL ERP <-> WEB                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘


                        ERP ADMIN                           WEB TIENDA
                     (Sistema Actual)                    (Nueva - B2C)
                           │                                   │
                           │                                   │
    ═══════════════════════│═══════════════════════════════════│═══════════════════════════
                           │         PRODUCTOS                 │
    ═══════════════════════│═══════════════════════════════════│═══════════════════════════
                           │                                   │
      ┌────────────────────┤                                   │
      │ Admin crea/edita   │                                   │
      │ producto en ERP    │                                   │
      └────────────────────┤                                   │
                           │                                   │
                           │    ┌───────────────────────┐      │
                           ├───>│  Firestore Trigger    │──────┤
                           │    │  onWrite: productos   │      │
                           │    └───────────────────────┘      │
                           │                                   │
                           │                                   ├────────────────────┐
                           │                                   │ Web muestra        │
                           │                                   │ producto actualizado│
                           │                                   └────────────────────┘
                           │                                   │
    ═══════════════════════│═══════════════════════════════════│═══════════════════════════
                           │          STOCK                    │
    ═══════════════════════│═══════════════════════════════════│═══════════════════════════
                           │                                   │
      ┌────────────────────┤                                   │
      │ Recepcion de       │                                   │
      │ Orden de Compra    │                                   │
      └────────────────────┤                                   │
                           │                                   │
                           │    ┌───────────────────────┐      │
                           ├───>│  Incrementar stock    │──────┤
                           │    │  Actualizar producto  │      │
                           │    └───────────────────────┘      │
                           │                                   │
                           │                                   ├────────────────────┐
                           │                                   │ Web muestra        │
                           │                                   │ "En stock"         │
                           │                                   └────────────────────┘
                           │                                   │
                           │                                   │
                           │                                   ├────────────────────┐
                           │                                   │ Cliente agrega     │
                           │                                   │ producto al carrito│
                           │                                   └────────────────────┤
                           │                                   │                    │
                           │    ┌───────────────────────┐      │                    │
                           │<───│  Reservar stock       │<─────┤                    │
                           │    │  (temporal 48h)       │      │                    │
                           │    └───────────────────────┘      │                    │
                           │                                   │                    │
      ┌────────────────────┤                                   │                    │
      │ ERP ve stock       │                                   │                    │
      │ reservado          │                                   │                    │
      └────────────────────┘                                   │                    │
                           │                                   │                    │
    ═══════════════════════│═══════════════════════════════════│════════════════════│══════
                           │         VENTAS                    │                    │
    ═══════════════════════│═══════════════════════════════════│════════════════════│══════
                           │                                   │                    │
                           │                                   │                    │
                           │                                   ├────────────────────┤
                           │                                   │ Cliente completa   │
                           │                                   │ compra             │
                           │                                   └────────────────────┤
                           │                                   │                    │
                           │    ┌───────────────────────┐      │                    │
                           │<───│  Crear Venta          │<─────┤                    │
                           │    │  Confirmar stock      │      │                    │
                           │    │  Actualizar metricas  │      │                    │
                           │    └───────────────────────┘      │                    │
                           │                                   │                    │
      ┌────────────────────┤                                   │                    │
      │ ERP ve nueva       │                                   │                    │
      │ venta del canal    │                                   │                    │
      │ "Web"              │                                   │                    │
      └────────────────────┘                                   │                    │
                           │                                   │                    │
    ═══════════════════════│═══════════════════════════════════│════════════════════│══════
                           │        CLIENTES                   │                    │
    ═══════════════════════│═══════════════════════════════════│════════════════════│══════
                           │                                   │                    │
                           │                                   │                    │
                           │    ┌───────────────────────┐      │                    │
                           │<───│  Si cliente nuevo:    │<─────┘                    │
                           │    │  Crear en Maestro     │                           │
                           │    │  Calcular RFM inicial │                           │
                           │    └───────────────────────┘                           │
                           │                                                        │
      ┌────────────────────┤                                                        │
      │ ERP tiene acceso   │                                                        │
      │ completo al CRM    │                                                        │
      │ de todos los       │                                                        │
      │ canales            │                                                        │
      └────────────────────┘                                                        │
                           │                                                        │
                           │                                                        │
    ═══════════════════════│════════════════════════════════════════════════════════│══════
                           │       PRECIOS & PROMOS                                 │
    ═══════════════════════│════════════════════════════════════════════════════════│══════
                           │                                                        │
      ┌────────────────────┤                                                        │
      │ Admin actualiza    │                                                        │
      │ precio sugerido    │                                                        │
      │ o crea promocion   │                                                        │
      └────────────────────┤                                                        │
                           │                                                        │
                           │    ┌───────────────────────┐                           │
                           ├───>│  Trigger actualiza    │───────────────────────────┤
                           │    │  precios en tiempo    │                           │
                           │    │  real                 │                           │
                           │    └───────────────────────┘                           │
                           │                                                        │
                           │                                   ┌────────────────────┤
                           │                                   │ Web muestra        │
                           │                                   │ nuevo precio       │
                           │                                   │ inmediatamente     │
                           │                                   └────────────────────┘
```

---

# 3. FLUJO DEL AGENTE IA DE VENTAS

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AGENTE IA DE VENTAS - FLUJO DETALLADO                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘


                                 ┌─────────────────┐
                                 │    USUARIO      │
                                 │  escribe en     │
                                 │     chat        │
                                 └────────┬────────┘
                                          │
                                          │ "Hola, busco algo para
                                          │  dormir mejor"
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │      FIREBASE FUNCTION        │
                          │      /api/ai-agent            │
                          └───────────────┬───────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
                    ▼                                           ▼
         ┌─────────────────────┐                    ┌─────────────────────┐
         │  OBTENER CONTEXTO   │                    │  OBTENER CONTEXTO   │
         │     DEL USUARIO     │                    │    DEL SISTEMA      │
         │                     │                    │                     │
         │ - clienteId         │                    │ - Catalogo completo │
         │ - Historial compras │                    │ - Stock actual      │
         │ - Segmento RFM      │                    │ - Promociones       │
         │ - Productos favoritos│                   │ - Precios compet.   │
         │ - Conversacion prev │                    │                     │
         └─────────────────────┘                    └─────────────────────┘
                    │                                           │
                    └─────────────────────┬─────────────────────┘
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │      CONSTRUIR PROMPT         │
                          │                               │
                          │  System: "Eres un asistente   │
                          │  de ventas experto en         │
                          │  suplementos. El cliente      │
                          │  {nombre} es segmento {vip},  │
                          │  sus productos favoritos son  │
                          │  {lista}. Tiene acceso a      │
                          │  promociones exclusivas..."   │
                          │                               │
                          └───────────────┬───────────────┘
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │      LLAMADA CLAUDE API       │
                          │      (con tools habilitados)  │
                          │                               │
                          │  Tools disponibles:           │
                          │  - buscar_productos()         │
                          │  - verificar_stock()          │
                          │  - obtener_precio()           │
                          │  - comparar_competencia()     │
                          │  - agregar_carrito()          │
                          │  - obtener_recomendaciones()  │
                          │                               │
                          └───────────────┬───────────────┘
                                          │
                                          │
               ┌──────────────────────────┼──────────────────────────┐
               │                          │                          │
               │                          │                          │
               ▼                          ▼                          ▼
    ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
    │   TOOL: buscar      │   │   TOOL: obtener     │   │   TOOL: verificar   │
    │   productos         │   │   recomendaciones   │   │   stock             │
    │                     │   │                     │   │                     │
    │   query: "dormir    │   │   categoria: "sueno"│   │   productoIds: [...]│
    │           mejor"    │   │   cliente: {...}    │   │                     │
    │                     │   │                     │   │                     │
    │   Resultado:        │   │   Resultado:        │   │   Resultado:        │
    │   - Melatonina      │   │   - Melatonina 5mg  │   │   - Melatonina: 23  │
    │   - Magnesio        │   │     (best seller)   │   │   - Magnesio: 45    │
    │   - Valeriana       │   │   - Magnesio Glicinato│  │   - GABA: 0        │
    │   - GABA            │   │     (sugerido RFM)  │   │                     │
    └─────────────────────┘   └─────────────────────┘   └─────────────────────┘
               │                          │                          │
               └──────────────────────────┼──────────────────────────┘
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │   CLAUDE GENERA RESPUESTA     │
                          │                               │
                          │   "Hola! Para mejorar el      │
                          │   sueno te recomiendo:        │
                          │                               │
                          │   1. Melatonina 5mg NOW       │
                          │      - Ayuda a regular ciclo  │
                          │      - S/45.00 (23 en stock)  │
                          │                               │
                          │   2. Magnesio Glicinato       │
                          │      - Relaja musculos        │
                          │      - S/65.00 (45 en stock)  │
                          │                               │
                          │   El GABA esta agotado pero   │
                          │   puedo avisarte cuando       │
                          │   llegue.                     │
                          │                               │
                          │   Quieres que agregue         │
                          │   alguno a tu carrito?"       │
                          │                               │
                          └───────────────┬───────────────┘
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │   FORMATEAR RESPUESTA UI      │
                          │                               │
                          │   {                           │
                          │     texto: "Hola! Para...",   │
                          │     productos: [              │
                          │       { id, sku, nombre,      │
                          │         precio, imagen }      │
                          │     ],                        │
                          │     acciones: [               │
                          │       { type: 'add_to_cart',  │
                          │         productId: '...',     │
                          │         label: 'Agregar' }    │
                          │     ]                         │
                          │   }                           │
                          │                               │
                          └───────────────┬───────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │    USUARIO      │
                                 │  ve respuesta   │
                                 │  con productos  │
                                 │  y botones de   │
                                 │    accion       │
                                 └────────┬────────┘
                                          │
                                          │ Click: "Agregar Melatonina"
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │   TOOL: agregar_carrito       │
                          │                               │
                          │   productoId: "melatonina123" │
                          │   cantidad: 1                 │
                          │                               │
                          │   Ejecuta:                    │
                          │   1. Verificar stock          │
                          │   2. Crear reserva 48h        │
                          │   3. Agregar a carrito        │
                          │   4. Actualizar UI            │
                          │                               │
                          └───────────────┬───────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │    RESPUESTA    │
                                 │                 │
                                 │  "Perfecto! He  │
                                 │  agregado la    │
                                 │  Melatonina a   │
                                 │  tu carrito.    │
                                 │  El stock esta  │
                                 │  reservado por  │
                                 │  48 horas.      │
                                 │                 │
                                 │  Deseas agregar │
                                 │  algo mas?"     │
                                 │                 │
                                 └─────────────────┘
```

---

# 4. FLUJO DE RECOMENDACIONES INTELIGENTES

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                     MOTOR DE RECOMENDACIONES - FLUJOS POR TIPO                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
TIPO 1: RECOMENDACIONES POR RECOMPRA (Ciclo de vida del producto)
═══════════════════════════════════════════════════════════════════════════════════════════

     COMPRA ORIGINAL                                              TRIGGER RECOMPRA
           │                                                            │
           ▼                                                            ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐    ┌─────────────┐
    │   Cliente   │      │  Producto   │      │    80%      │    │  ENVIAR     │
    │   compra    │─────>│  dura       │─────>│   del       │───>│  REMINDER   │
    │  Omega 3    │      │  60 dias    │      │   ciclo     │    │             │
    │             │      │  (servings  │      │  (dia 48)   │    │  Email +    │
    │             │      │   /day = 2) │      │             │    │  WhatsApp + │
    │             │      │             │      │             │    │  Push notif │
    └─────────────┘      └─────────────┘      └─────────────┘    └──────┬──────┘
                                                                        │
                                                                        ▼
                                                                 ┌─────────────┐
                                                                 │  CONTENIDO  │
                                                                 │             │
                                                                 │ "Tu Omega 3 │
                                                                 │  esta por   │
                                                                 │  terminarse"│
                                                                 │             │
                                                                 │ [RECOMPRAR] │
                                                                 │  <- Link    │
                                                                 │  directo    │
                                                                 │  con carrito│
                                                                 │  prellenado │
                                                                 └─────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
TIPO 2: RECOMENDACIONES POR SEGMENTO RFM
═══════════════════════════════════════════════════════════════════════════════════════════

                    ┌─────────────────────────────────────────────────────────────┐
                    │                     MATRIZ RFM                              │
                    └─────────────────────────────────────────────────────────────┘

       Recencia Alta                                            Recencia Baja
    ┌───────────────────────────────────────────────────────────────────────────────┐
    │                                                                               │
F   │  ┌─────────────┐                                    ┌─────────────┐          │
r   │  │    VIP      │                                    │  EN RIESGO  │          │
e   │  │             │                                    │             │          │
c   │  │ - Novedades │                                    │ - Descuentos│          │
u   │  │ - Exclusivos│                                    │   especiales│          │
e   │  │ - Acceso    │                                    │ - Encuesta  │          │
n   │  │   anticipado│                                    │   "te       │          │
c   │  │             │                                    │   extrañamos│          │
i   │  └─────────────┘                                    └─────────────┘          │
a   │                                                                               │
    │                                                                               │
A   │  ┌─────────────┐                                    ┌─────────────┐          │
l   │  │  FRECUENTE  │                                    │  INACTIVO   │          │
t   │  │             │                                    │             │          │
a   │  │ - Best value│                                    │ - Reactivar │          │
    │  │ - Bundles   │                                    │   con oferta│          │
    │  │ - Cross-sell│                                    │ - 20% off   │          │
    │  │             │                                    │   primera   │          │
    │  │             │                                    │   compra    │          │
    │  └─────────────┘                                    └─────────────┘          │
    │                                                                               │
    │  ┌─────────────┐                                    ┌─────────────┐          │
F   │  │   NUEVO     │                                    │  PERDIDO    │          │
r   │  │             │                                    │             │          │
e   │  │ - Bienvenida│                                    │ - Win-back  │          │
c   │  │ - Guia de   │                                    │   campaign  │          │
u   │  │   productos │                                    │ - 30% off   │          │
e   │  │ - Primeros  │                                    │ - Ultimo    │          │
n   │  │   pasos     │                                    │   intento   │          │
c   │  └─────────────┘                                    └─────────────┘          │
i   │                                                                               │
a   │                                                                               │
    │                                                                               │
B   │                                                                               │
a   └───────────────────────────────────────────────────────────────────────────────┘
j
a


═══════════════════════════════════════════════════════════════════════════════════════════
TIPO 3: RECOMENDACIONES POR CONTEXTO (Pagina actual)
═══════════════════════════════════════════════════════════════════════════════════════════

                    ┌─────────────────────────────────────────────────────────────┐
                    │               CONTEXTO -> RECOMENDACION                     │
                    └─────────────────────────────────────────────────────────────┘


    ┌──────────────────┐          ┌──────────────────────────────────────────────┐
    │ VIENDO PRODUCTO  │          │                                              │
    │                  │   ──────>│  "Frecuentemente comprados juntos"           │
    │ Aceite de Oregano│          │  - Vitamina C (complementario)               │
    │                  │          │  - Zinc (complementario)                     │
    │                  │          │  - Probioticos (complementario)              │
    └──────────────────┘          │                                              │
                                  │  "Otros clientes tambien vieron"             │
                                  │  - Aceite de Coco (similar)                  │
                                  │  - Ajo Negro (similar)                       │
                                  └──────────────────────────────────────────────┘


    ┌──────────────────┐          ┌──────────────────────────────────────────────┐
    │ EN CARRITO       │          │                                              │
    │                  │   ──────>│  "Completa tu compra con"                    │
    │ - Omega 3        │          │  - Vitamina D (sinergia con Omega)           │
    │ - Magnesio       │          │  - Cobre de 1 probiotico                     │
    │                  │          │                                              │
    │                  │          │  "Ahorra con bundles"                        │
    │                  │          │  - Pack Inmunidad (-15%)                     │
    │                  │          │                                              │
    └──────────────────┘          │  "Te falta S/XX para envio gratis"           │
                                  └──────────────────────────────────────────────┘


    ┌──────────────────┐          ┌──────────────────────────────────────────────┐
    │ EN CATEGORIA     │          │                                              │
    │                  │   ──────>│  "Mas vendidos en Sistema Inmune"            │
    │ Sistema Inmune   │          │  - Aceite de Oregano (★★★★★ 128 reviews)     │
    │                  │          │  - Vitamina C 1000 (★★★★☆ 95 reviews)        │
    │                  │          │                                              │
    │                  │          │  "Mejor valor"                               │
    │                  │          │  - Zinc Picolinato (S/35, 90 caps)           │
    │                  │          │                                              │
    └──────────────────┘          │  "Nuevos"                                    │
                                  │  - Elderberry + Zinc                         │
                                  └──────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
TIPO 4: RECOMENDACIONES POR INTELIGENCIA DE PRECIOS (Ventaja competitiva)
═══════════════════════════════════════════════════════════════════════════════════════════

    ┌──────────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                      │
    │   Usando datos de InvestigacionMercado existente:                                    │
    │                                                                                      │
    │   ┌─────────────────────┐      ┌─────────────────────────────────────────────────┐  │
    │   │                     │      │                                                 │  │
    │   │  Nuestro precio:    │      │  BADGE EN PRODUCTO:                             │  │
    │   │  S/ 89.90           │      │                                                 │  │
    │   │                     │      │  ┌─────────────────────────────────────────┐   │  │
    │   │  Mercado:           │      │  │  💰 MEJOR PRECIO DEL MERCADO            │   │  │
    │   │  - Minimo: S/95     │ ────>│  │     S/89.90 vs S/95-140 en competencia  │   │  │
    │   │  - Promedio: S/120  │      │  │                                         │   │  │
    │   │  - Maximo: S/140    │      │  │  Ahorras S/5.10 vs precio mas bajo      │   │  │
    │   │                     │      │  │  Ahorras S/30.10 vs precio promedio     │   │  │
    │   │                     │      │  └─────────────────────────────────────────┘   │  │
    │   └─────────────────────┘      │                                                 │  │
    │                                └─────────────────────────────────────────────────┘  │
    │                                                                                      │
    │   ┌─────────────────────────────────────────────────────────────────────────────┐   │
    │   │                                                                             │   │
    │   │  HOME PAGE - SECCION "MEJORES PRECIOS DEL MERCADO"                          │   │
    │   │                                                                             │   │
    │   │  Productos donde tenemos ventaja competitiva > 10%:                         │   │
    │   │                                                                             │   │
    │   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                        │   │
    │   │  │ Omega 3 │  │ Vit D3  │  │ Oregano │  │ Magnesio│                        │   │
    │   │  │ -18%    │  │ -22%    │  │ -15%    │  │ -12%    │                        │   │
    │   │  │ vs merc │  │ vs merc │  │ vs merc │  │ vs merc │                        │   │
    │   │  └─────────┘  └─────────┘  └─────────┘  └─────────┘                        │   │
    │   │                                                                             │   │
    │   └─────────────────────────────────────────────────────────────────────────────┘   │
    │                                                                                      │
    └──────────────────────────────────────────────────────────────────────────────────────┘
```

---

# 5. ARQUITECTURA DE DATOS PARA WEB

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        MODELO DE DATOS FIREBASE - WEB STORE                              │
└─────────────────────────────────────────────────────────────────────────────────────────┘


    COLECCIONES EXISTENTES (reutilizar 100%)          COLECCIONES NUEVAS (web-specific)
    ═══════════════════════════════════════          ══════════════════════════════════


    ┌─────────────────────────────────┐              ┌─────────────────────────────────┐
    │         productos               │              │         carritos_web            │
    │                                 │              │                                 │
    │  {                              │              │  {                              │
    │    id: string                   │              │    id: string                   │
    │    sku: string                  │              │    usuarioId?: string           │
    │    nombreComercial: string      │              │    sessionId: string            │
    │    marca: string                │              │    items: CarritoItem[]         │
    │    precioSugerido: number       │◄────────────►│    subtotal: number             │
    │    stockDisponible: number      │              │    reservaActiva: boolean       │
    │    categorias: []               │              │    vigenciaReserva: Timestamp   │
    │    investigacion: {...}         │              │    fechaCreacion: Timestamp     │
    │    ...                          │              │  }                              │
    │  }                              │              │                                 │
    └─────────────────────────────────┘              └─────────────────────────────────┘
              │                                                    │
              │                                                    │
              ▼                                                    ▼
    ┌─────────────────────────────────┐              ┌─────────────────────────────────┐
    │         clientes                │              │        sesiones_web             │
    │                                 │              │                                 │
    │  {                              │              │  {                              │
    │    id: string                   │              │    id: string                   │
    │    nombre: string               │              │    userId?: string              │
    │    email: string                │◄────────────►│    carritoId: string            │
    │    telefono: string             │              │    ultimaActividad: Timestamp   │
    │    clasificacionABC: string     │              │    dispositivo: string          │
    │    segmento: string             │              │    ip?: string                  │
    │    analisisRFM: {...}           │              │    origen?: string              │
    │    metricas: {...}              │              │  }                              │
    │  }                              │              │                                 │
    └─────────────────────────────────┘              └─────────────────────────────────┘
              │                                                    │
              │                                                    │
              ▼                                                    ▼
    ┌─────────────────────────────────┐              ┌─────────────────────────────────┐
    │         ventas                  │              │        favoritos_web            │
    │                                 │              │                                 │
    │  {                              │              │  {                              │
    │    id: string                   │              │    id: string                   │
    │    numeroVenta: string          │              │    usuarioId: string            │
    │    canal: "web"  ◄──────────────│──────────────│    productosIds: string[]       │
    │    productos: []                │              │    fechaActualizacion: Timestamp│
    │    totalPEN: number             │              │  }                              │
    │    stockReservado: {...}        │              │                                 │
    │    pagos: []                    │              │                                 │
    │    ...                          │              │                                 │
    │  }                              │              │                                 │
    └─────────────────────────────────┘              └─────────────────────────────────┘
              │                                                    │
              │                                                    │
              ▼                                                    ▼
    ┌─────────────────────────────────┐              ┌─────────────────────────────────┐
    │       competidores              │              │        promociones              │
    │                                 │              │                                 │
    │  {                              │              │  {                              │
    │    id: string                   │              │    id: string                   │
    │    nombre: string               │              │    tipo: string                 │
    │    plataformaPrincipal: string  │              │    codigo?: string              │
    │    reputacion: string           │              │    descuento: number            │
    │    metricas: {...}              │              │    condiciones: {...}           │
    │  }                              │              │    vigencia: {...}              │
    │                                 │              │    usosMaximos: number          │
    │  // Usado para mostrar          │              │    usosActuales: number         │
    │  // comparativa de precios      │              │  }                              │
    │                                 │              │                                 │
    └─────────────────────────────────┘              └─────────────────────────────────┘
                                                                   │
                                                                   │
                                                                   ▼
                                                     ┌─────────────────────────────────┐
                                                     │     conversaciones_ia           │
                                                     │                                 │
                                                     │  {                              │
                                                     │    id: string                   │
                                                     │    usuarioId?: string           │
                                                     │    sessionId: string            │
                                                     │    mensajes: [{                 │
                                                     │      role: string               │
                                                     │      content: string            │
                                                     │      timestamp: Timestamp       │
                                                     │      productos?: []             │
                                                     │    }]                           │
                                                     │    productosVistos: string[]    │
                                                     │    productosAgregados: string[] │
                                                     │  }                              │
                                                     │                                 │
                                                     └─────────────────────────────────┘
```

---

# 6. PROMOCION INTELIGENTE DE PRODUCTOS

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE PROMOCION INTELIGENTE DE PRODUCTOS                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
AUTOMATIZACION DE BANNERS Y PROMOCIONES
═══════════════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                     │
    │                          TRIGGERS DE PROMOCION                                      │
    │                                                                                     │
    │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                 │
    │  │  STOCK ALTO     │    │ BAJA ROTACION   │    │  VENCIMIENTO    │                 │
    │  │                 │    │                 │    │   PROXIMO       │                 │
    │  │ Si stock >      │    │ Si diasSinVenta │    │ Si diasParaVencer│                │
    │  │ stockMaximo     │    │ > 30            │    │ < 90            │                 │
    │  │                 │    │                 │    │                 │                 │
    │  │ -> Promocion    │    │ -> Descuento    │    │ -> Flash Sale   │                 │
    │  │    automatica   │    │    progresivo   │    │    urgente      │                 │
    │  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘                 │
    │           │                      │                      │                          │
    │           └──────────────────────┼──────────────────────┘                          │
    │                                  │                                                  │
    │                                  ▼                                                  │
    │                    ┌─────────────────────────────┐                                  │
    │                    │   FIREBASE FUNCTION         │                                  │
    │                    │   (Scheduled - diario)      │                                  │
    │                    │                             │                                  │
    │                    │   1. Analizar inventario    │                                  │
    │                    │   2. Detectar triggers      │                                  │
    │                    │   3. Crear promociones auto │                                  │
    │                    │   4. Actualizar banners     │                                  │
    │                    │   5. Notificar por email    │                                  │
    │                    │      a segmentos objetivo   │                                  │
    │                    │                             │                                  │
    │                    └─────────────────────────────┘                                  │
    │                                                                                     │
    └─────────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
EJEMPLO: PROMOCION POR STOCK ALTO
═══════════════════════════════════════════════════════════════════════════════════════════

    DETECTADO:                                        ACCION AUTOMATICA:
    ┌───────────────────────────────┐                ┌───────────────────────────────┐
    │                               │                │                               │
    │  Producto: Vitamina D3 5000   │                │  1. Crear promocion:          │
    │  Stock actual: 150 unidades   │                │     - Tipo: 2x1               │
    │  Stock maximo: 80 unidades    │ ─────────────> │     - Vigencia: 7 dias        │
    │  Exceso: 70 unidades          │                │     - Limite: 50 unidades     │
    │                               │                │                               │
    │  Rotacion: 20 unid/mes        │                │  2. Generar banner:           │
    │  Meses de stock: 7.5          │                │     "2x1 en Vitamina D3"      │
    │                               │                │                               │
    │                               │                │  3. Email a segmento:         │
    │                               │                │     - Clientes que compraron  │
    │                               │                │       Vitamina D antes        │
    │                               │                │     - Clientes en_riesgo      │
    │                               │                │                               │
    └───────────────────────────────┘                └───────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
PERSONALIZACION DE HOME PAGE POR USUARIO
═══════════════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                     │
    │   USUARIO ANONIMO                          USUARIO LOGUEADO (VIP)                   │
    │   ═══════════════                          ═════════════════════                    │
    │                                                                                     │
    │   ┌─────────────────────────┐              ┌─────────────────────────┐             │
    │   │  HERO: Promocion        │              │  HERO: "Bienvenido Juan"│             │
    │   │        general          │              │         Ofertas VIP     │             │
    │   └─────────────────────────┘              └─────────────────────────┘             │
    │                                                                                     │
    │   ┌─────────────────────────┐              ┌─────────────────────────┐             │
    │   │  SECCION:               │              │  SECCION:               │             │
    │   │  "Mas vendidos"         │              │  "Para ti" (basado en   │             │
    │   │  (productos populares)  │              │   historial de compras) │             │
    │   └─────────────────────────┘              └─────────────────────────┘             │
    │                                                                                     │
    │   ┌─────────────────────────┐              ┌─────────────────────────┐             │
    │   │  SECCION:               │              │  SECCION:               │             │
    │   │  "Categorias"           │              │  "Es hora de reponer"   │             │
    │   │  (todas)                │              │  (ciclo recompra)       │             │
    │   └─────────────────────────┘              └─────────────────────────┘             │
    │                                                                                     │
    │   ┌─────────────────────────┐              ┌─────────────────────────┐             │
    │   │  SECCION:               │              │  SECCION:               │             │
    │   │  "Ofertas"              │              │  "Ofertas exclusivas    │             │
    │   │  (publicas)             │              │   VIP" (20% extra)      │             │
    │   └─────────────────────────┘              └─────────────────────────┘             │
    │                                                                                     │
    └─────────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
BADGES DINAMICOS EN PRODUCTOS
═══════════════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                     │
    │   CONDICION                        BADGE                      PRIORIDAD            │
    │   ─────────                        ─────                      ─────────            │
    │                                                                                     │
    │   stockDisponible < 5              "Ultimas X unidades"          1 (mas alta)      │
    │                                    🔴 Fondo rojo                                   │
    │                                                                                     │
    │   promocionActiva                  "OFERTA -X%"                  2                 │
    │                                    🟡 Fondo amarillo                                │
    │                                                                                     │
    │   nuestroPrecio <                  "Mejor precio"                3                 │
    │   investigacion.precioPERUMin      💰 Fondo verde                                   │
    │                                                                                     │
    │   fechaCreacion < 30 dias          "NUEVO"                       4                 │
    │                                    🔵 Fondo azul                                    │
    │                                                                                     │
    │   ventasMes > percentil90          "MAS VENDIDO"                 5                 │
    │                                    ⭐ Fondo dorado                                  │
    │                                                                                     │
    │   investigacion.demanda = 'alta'   "ALTA DEMANDA"                6                 │
    │   && stockDisponible < 20          🔥 Fondo naranja                                 │
    │                                                                                     │
    └─────────────────────────────────────────────────────────────────────────────────────┘
```

---

# 7. METRICAS Y DASHBOARD WEB

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD DE E-COMMERCE EN TIEMPO REAL                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────────────────┐
    │  📊 E-COMMERCE ANALYTICS                                    Hoy | Semana | Mes | Año │
    ├─────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                     │
    │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
    │  │  VISITANTES   │  │    VENTAS     │  │  CONVERSION   │  │   INGRESOS    │        │
    │  │               │  │               │  │               │  │               │        │
    │  │    1,234      │  │      45       │  │    3.65%      │  │  S/ 8,450     │        │
    │  │    ↑ 12%      │  │    ↑ 23%      │  │   ↑ 0.8%      │  │    ↑ 28%      │        │
    │  │  vs ayer      │  │  vs ayer      │  │  vs ayer      │  │   vs ayer     │        │
    │  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘        │
    │                                                                                     │
    ├─────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                     │
    │  ┌───────────────────────────────────────┐  ┌───────────────────────────────────┐  │
    │  │         EMBUDO DE CONVERSION          │  │      VENTAS POR HORA (HOY)       │  │
    │  │                                       │  │                                   │  │
    │  │  Visitas       ████████████████ 1,234 │  │        ╭──╮                       │  │
    │  │  Ver producto  ████████████     820   │  │       ╱    ╲     ╭──╮            │  │
    │  │  Add to cart   ████████         340   │  │      ╱      ╲   ╱    ╲           │  │
    │  │  Checkout      █████            180   │  │  ───╱        ╲─╱      ╲───       │  │
    │  │  Compra        ███               45   │  │  08  10  12  14  16  18  20  22  │  │
    │  │                                       │  │                                   │  │
    │  │  Tasa abandono carrito: 47%           │  │  Pico: 12:00-14:00 (almuerzo)    │  │
    │  └───────────────────────────────────────┘  └───────────────────────────────────┘  │
    │                                                                                     │
    ├─────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                     │
    │  ┌───────────────────────────────────────┐  ┌───────────────────────────────────┐  │
    │  │        TOP PRODUCTOS (HOY)            │  │      DISPOSITIVOS                 │  │
    │  │                                       │  │                                   │  │
    │  │  1. Omega 3 Nordic      S/ 1,250  12x │  │      ┌─────────────────────┐      │  │
    │  │  2. Aceite Oregano      S/   900  10x │  │      │ 📱 Movil    68%     │      │  │
    │  │  3. Vitamina D3         S/   550   8x │  │      │ 💻 Desktop  28%     │      │  │
    │  │  4. Magnesio Glicinato  S/   520   8x │  │      │ 📟 Tablet    4%     │      │  │
    │  │  5. Probioticos         S/   445   5x │  │      └─────────────────────┘      │  │
    │  │                                       │  │                                   │  │
    │  └───────────────────────────────────────┘  └───────────────────────────────────┘  │
    │                                                                                     │
    ├─────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                     │
    │  ┌───────────────────────────────────────┐  ┌───────────────────────────────────┐  │
    │  │        CHAT IA - METRICAS             │  │      STOCK CRITICO                │  │
    │  │                                       │  │                                   │  │
    │  │  Conversaciones hoy:        89        │  │  ⚠️  Zinc Picolinato       5 uds  │  │
    │  │  Resueltas sin humano:      92%       │  │  ⚠️  GABA 750mg           3 uds  │  │
    │  │  Tiempo promedio:           2.1 min   │  │  ⚠️  CoQ10 100mg          8 uds  │  │
    │  │                                       │  │                                   │  │
    │  │  Productos recomendados:    234       │  │  📦  Pedidos pendientes:          │  │
    │  │  Agregados via chat:        45 (19%)  │  │      - OC-2025-089 (en transito)  │  │
    │  │  Compras via chat:          12 (5%)   │  │      - OC-2025-091 (pagada)       │  │
    │  │                                       │  │                                   │  │
    │  │  Top preguntas:                       │  │                                   │  │
    │  │  1. "Para que sirve X?"      28%      │  │                                   │  │
    │  │  2. "Tienen stock de X?"     22%      │  │                                   │  │
    │  │  3. "Precio de X?"           18%      │  │                                   │  │
    │  └───────────────────────────────────────┘  └───────────────────────────────────┘  │
    │                                                                                     │
    ├─────────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                     │
    │  ┌───────────────────────────────────────┐  ┌───────────────────────────────────┐  │
    │  │      CARRITOS ABANDONADOS             │  │      CLIENTES NUEVOS VS RETORNO   │  │
    │  │                                       │  │                                   │  │
    │  │  Activos ahora:             23        │  │         Nuevos     Retorno        │  │
    │  │  Valor total:               S/ 4,560  │  │                                   │  │
    │  │  Expiran < 2 horas:         8         │  │           32%        68%          │  │
    │  │                                       │  │          ┌──┐      ┌────┐        │  │
    │  │  Recuperados hoy:           5 (22%)   │  │          │  │      │    │        │  │
    │  │  Via email:                 3         │  │          │  │      │    │        │  │
    │  │  Via WhatsApp:              2         │  │          └──┘      └────┘        │  │
    │  │                                       │  │                                   │  │
    │  │  [Ver carritos]  [Enviar recordatorio]│  │  Ticket promedio:                 │  │
    │  │                                       │  │  Nuevos: S/145  Retorno: S/198    │  │
    │  └───────────────────────────────────────┘  └───────────────────────────────────┘  │
    │                                                                                     │
    └─────────────────────────────────────────────────────────────────────────────────────┘
```

---

Este documento complementa el estudio de viabilidad con visualizaciones detalladas de los flujos de trabajo propuestos para la integracion web e-commerce.
