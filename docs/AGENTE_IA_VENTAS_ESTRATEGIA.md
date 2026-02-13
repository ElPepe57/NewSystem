# Estrategia de Agente IA de Ventas - BMN System

## Resumen Ejecutivo

Este documento detalla la estrategia completa para implementar un agente de IA que actúe como tu "clon de ventas", entrenado con los datos de tu sistema ERP y tu estilo de venta personalizado.

---

## 1. ANÁLISIS DE TU SITUACIÓN ACTUAL

### Lo que tienes (Assets de Datos)

Tu sistema ERP contiene una estructura de datos **excepcionalmente rica** que te posiciona muy bien para este proyecto:

| Categoría | Datos Disponibles | Valor para IA |
|-----------|-------------------|---------------|
| **Productos** | 300+ campos por producto (precios, stock, competencia, demanda) | ⭐⭐⭐⭐⭐ |
| **Clientes** | Historial completo, RFM, predicciones, productos favoritos | ⭐⭐⭐⭐⭐ |
| **Ventas** | Rentabilidad real, motivos rechazo, conversión | ⭐⭐⭐⭐⭐ |
| **Competencia** | Precios ML, Amazon, iHerb, estrategias competidores | ⭐⭐⭐⭐ |
| **Inventario** | Multi-almacén, trazabilidad USA→Perú, rotación | ⭐⭐⭐⭐ |

### Lo que necesitas agregar

Para entrenar un agente que venda como tú, necesitas **capturar tu conocimiento tácito**:

```
□ Guiones de venta exitosos (WhatsApp, Facebook)
□ Respuestas a objeciones comunes
□ Técnicas de cierre que funcionan
□ Forma de explicar productos complejos
□ Tu tono y personalidad en mensajes
□ Preguntas que haces para calificar clientes
□ Señales de compra que identificas
□ Estrategias de upselling/cross-selling
□ Manejo de regateos y descuentos
□ Seguimiento post-venta
```

---

## 2. ARQUITECTURA PROPUESTA

### Diagrama General

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CANALES DE ENTRADA                          │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│    WhatsApp     │    Facebook     │         Página Web              │
│   (Business)    │   (Messenger)   │        (Chat Widget)            │
└────────┬────────┴────────┬────────┴────────────────┬────────────────┘
         │                 │                          │
         ▼                 ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      n8n (ORQUESTADOR)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Webhook   │  │   Webhook   │  │   Webhook   │                  │
│  │  WhatsApp   │  │  Facebook   │  │     Web     │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         └────────────────┼────────────────┘                         │
│                          ▼                                          │
│              ┌───────────────────────┐                              │
│              │   Router de Mensajes  │                              │
│              └───────────┬───────────┘                              │
│                          ▼                                          │
│     ┌────────────────────────────────────────────────┐              │
│     │            MÓDULO DE CONTEXTO                  │              │
│     │  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │              │
│     │  │ Firebase │ │ Historial│ │ Conversación │    │              │
│     │  │   API    │ │  Cliente │ │    Actual    │    │              │
│     │  └────┬─────┘ └────┬─────┘ └──────┬───────┘    │              │
│     │       └────────────┼──────────────┘            │              │
│     └────────────────────┼───────────────────────────┘              │
└──────────────────────────┼──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CEREBRO IA (Claude API)                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    System Prompt                             │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │    │
│  │  │Identidad │ │Catálogo  │ │Políticas │ │  Tu Estilo   │    │    │
│  │  │  Marca   │ │Productos │ │ Comercial│ │  de Venta    │    │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Tool Calling                              │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐               │    │
│  │  │ Consultar  │ │  Crear     │ │ Verificar  │               │    │
│  │  │ Productos  │ │ Cotización │ │   Stock    │               │    │
│  │  └────────────┘ └────────────┘ └────────────┘               │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐               │    │
│  │  │  Buscar    │ │ Calcular   │ │ Registrar  │               │    │
│  │  │  Cliente   │ │  Precios   │ │   Venta    │               │    │
│  │  └────────────┘ └────────────┘ └────────────┘               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RESPUESTA AL CANAL                             │
│        WhatsApp ◄────── n8n ──────► Facebook ◄────► Web             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. COMPONENTES TÉCNICOS DETALLADOS

### 3.1 Modelo de IA Recomendado

| Opción | Pros | Contras | Costo Estimado |
|--------|------|---------|----------------|
| **Claude API (Anthropic)** | Mejor razonamiento, tool calling nativo, ventana 200k tokens | Costo medio-alto | ~$15-50/día según volumen |
| **GPT-4 Turbo (OpenAI)** | Ecosistema maduro, function calling | Menor ventana contexto | ~$20-60/día |
| **GPT-4o Mini** | Muy económico, rápido | Menos preciso en ventas complejas | ~$2-10/día |
| **Fine-tuned GPT-3.5** | Económico, personalizable | Requiere datos de entrenamiento | ~$5-15/día |
| **Llama 3 (Local)** | Costo $0 en uso, privacidad total | Requiere servidor potente, menos preciso | Servidor: $50-200/mes |

**Mi recomendación:** Iniciar con **Claude API** (Sonnet para volumen, Opus para casos complejos) y evaluar fine-tuning después de 3 meses de data.

### 3.2 Stack Tecnológico Completo

```yaml
Orquestación:
  - n8n (self-hosted o cloud)
  - Alternativa: Make.com, Zapier (más limitados)

Base de Datos (ya tienes):
  - Firebase Firestore (datos principales)

Base de Datos Adicional (recomendada):
  - Supabase o PostgreSQL (para analytics IA)
  - Pinecone o Qdrant (embeddings para RAG)

IA Principal:
  - Claude API (Anthropic)
  - Backup: GPT-4 Turbo

Canales:
  - WhatsApp Business API (via 360dialog, Twilio, o WABA directo)
  - Facebook Messenger API
  - Widget Web (Crisp, Chatwoot, o custom)

Memoria de Conversaciones:
  - Redis (sesiones activas)
  - Firebase (historial permanente)

Monitoreo:
  - Langfuse o LangSmith (observabilidad IA)
  - n8n logs
```

### 3.3 APIs de Firebase a Exponer

Para que n8n consulte tus datos, necesitas exponer endpoints. Tienes dos opciones:

**Opción A: Firebase Cloud Functions (Recomendada)**

```typescript
// functions/src/api/productos.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const getProductoByNombre = functions.https.onCall(async (data, context) => {
  const { query } = data;
  const db = admin.firestore();

  const productos = await db.collection('productos')
    .where('nombreComercial', '>=', query)
    .where('nombreComercial', '<=', query + '\uf8ff')
    .limit(10)
    .get();

  return productos.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    // Solo campos necesarios para ventas
    nombre: doc.data().nombreComercial,
    precio: doc.data().precioSugerido,
    stock: doc.data().stockDisponible,
    descripcion: doc.data().descripcion,
  }));
});

export const getClienteByTelefono = functions.https.onCall(async (data, context) => {
  const { telefono } = data;
  const db = admin.firestore();

  const clientes = await db.collection('clientes')
    .where('telefono', '==', normalizarTelefono(telefono))
    .limit(1)
    .get();

  if (clientes.empty) return null;

  const cliente = clientes.docs[0];
  const analytics = await getClienteAnalytics(cliente.id); // Tu servicio existente

  return {
    id: cliente.id,
    ...cliente.data(),
    analytics,
  };
});

export const crearCotizacion = functions.https.onCall(async (data, context) => {
  // Crear cotización desde la conversación del agente
});
```

**Opción B: REST API con Express (más control)**

```typescript
// api/index.ts
import express from 'express';
import cors from 'cors';
import { productoRoutes } from './routes/productos';
import { clienteRoutes } from './routes/clientes';
import { cotizacionRoutes } from './routes/cotizaciones';

const app = express();
app.use(cors());
app.use(express.json());

// Autenticación para n8n
app.use('/api', authenticateN8N);

app.use('/api/productos', productoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/cotizaciones', cotizacionRoutes);

// Deploy en Cloud Run o Firebase Hosting
```

---

## 4. SYSTEM PROMPT - EL CEREBRO DE TU AGENTE

Este es el componente más crítico. Aquí defines quién es tu agente.

### 4.1 Estructura del System Prompt

```markdown
# IDENTIDAD

Eres el asistente de ventas de [NOMBRE DE TU NEGOCIO], especialista en suplementos
nutricionales importados de Estados Unidos. Tu nombre es [NOMBRE DEL AGENTE].

## Personalidad
- Profesional pero cercano
- Conocedor profundo de suplementos y salud
- Honesto sobre disponibilidad y tiempos de entrega
- Nunca presionas, pero sí guías hacia la mejor decisión
- Usas emojis con moderación (solo en WhatsApp/Messenger)

## Tono de comunicación
[AQUÍ VAN TUS EJEMPLOS DE MENSAJES REALES]

---

# CONOCIMIENTO DEL NEGOCIO

## Qué vendemos
- Suplementos nutricionales importados directamente de USA
- Marcas: [LISTA DE MARCAS PRINCIPALES]
- Categorías: Sistema inmune, digestivo, energía, etc.

## Propuesta de valor
- Productos originales de Amazon/iHerb USA
- Trazabilidad completa (código de lote verificable)
- Precios competitivos vs competencia local
- Asesoría personalizada

## Políticas comerciales
- Envío gratis: Pedidos mayores a S/[X]
- Tiempo de entrega Lima: 1-2 días hábiles
- Tiempo de entrega provincias: 3-5 días hábiles
- Productos sin stock: Se importan en [X] días
- Métodos de pago: Yape, Plin, Transferencia, Efectivo
- Garantía: [TUS POLÍTICAS]

## Descuentos autorizados
- Cliente nuevo: Hasta 5%
- Compra recurrente (3+ pedidos): Hasta 10%
- Volumen (3+ unidades mismo producto): Hasta 15%
- Casos especiales: Escalar a humano

---

# FLUJO DE CONVERSACIÓN

## 1. Saludo y calificación
- Identificar si es cliente nuevo o existente
- Si es existente: Consultar historial y personalizar
- Preguntar qué necesita o busca

## 2. Descubrimiento de necesidades
Preguntas clave:
- "¿Para qué condición o necesidad buscas el suplemento?"
- "¿Has usado este producto antes?"
- "¿Tienes alguna restricción alimentaria (vegano, alergias)?"
- "¿Qué presupuesto tienes en mente?"

## 3. Presentación de opciones
- Máximo 3 opciones relevantes
- Explicar diferencias claras
- Destacar el más recomendado y por qué

## 4. Manejo de objeciones

### "Está muy caro"
[TU RESPUESTA TÍPICA]

### "Lo encontré más barato en..."
[TU RESPUESTA TÍPICA]

### "No estoy seguro si funciona"
[TU RESPUESTA TÍPICA]

### "Tengo que consultarlo"
[TU RESPUESTA TÍPICA]

## 5. Cierre
- Resumen de pedido
- Confirmar datos de entrega
- Indicar formas de pago
- Crear cotización en el sistema

## 6. Post-venta
- Confirmar recepción de pago
- Coordinar entrega
- Seguimiento de satisfacción

---

# HERRAMIENTAS DISPONIBLES

Tienes acceso a las siguientes funciones:

## buscar_productos
Busca productos en el catálogo.
Parámetros: query (string), categoria (opcional), marca (opcional)
Uso: Cuando el cliente pregunta por un producto específico o categoría.

## obtener_producto
Obtiene detalles completos de un producto.
Parámetros: producto_id (string)
Uso: Para dar información detallada, verificar stock, precio.

## buscar_cliente
Busca cliente por teléfono o nombre.
Parámetros: telefono (string) o nombre (string)
Uso: Al inicio de la conversación para personalizar.

## obtener_historial_cliente
Obtiene compras anteriores y preferencias.
Parámetros: cliente_id (string)
Uso: Para recomendar productos basado en historial.

## verificar_stock
Verifica disponibilidad en tiempo real.
Parámetros: producto_id (string), cantidad (number)
Respuesta: disponible, ubicacion, tiempo_entrega

## calcular_cotizacion
Calcula precio total con envío.
Parámetros: productos (array), direccion (string), canal (string)
Respuesta: subtotal, envio, descuento, total

## crear_cotizacion
Crea cotización formal en el sistema.
Parámetros: cliente_id, productos, notas
Respuesta: numero_cotizacion, link_pdf

## escalar_humano
Transfiere la conversación a un humano.
Parámetros: razon (string), urgencia (alta/media/baja)
Uso: Casos complejos, reclamos, descuentos especiales.

---

# REGLAS CRÍTICAS

1. NUNCA inventes información de productos. Si no sabes, consulta la herramienta.
2. NUNCA prometas tiempos de entrega sin verificar stock.
3. SIEMPRE verifica el stock antes de confirmar disponibilidad.
4. NUNCA des descuentos mayores a los autorizados sin escalar.
5. Si el cliente está molesto o hay un reclamo, ESCALA inmediatamente.
6. Si detectas intención de compra clara, CREA la cotización.
7. REGISTRA toda información nueva del cliente (dirección, preferencias).
8. Si no entiendes algo, PREGUNTA antes de asumir.

---

# CONTEXTO DE ESTA CONVERSACIÓN

Canal: {{canal}} (WhatsApp/Facebook/Web)
Cliente identificado: {{cliente_nombre}} | ID: {{cliente_id}}
Historial resumido: {{cliente_historial}}
Última compra: {{ultima_compra}}
Productos favoritos: {{productos_favoritos}}
Segmento: {{segmento_cliente}}
Hora actual: {{hora_actual}}
```

### 4.2 Cómo personalizar con TU estilo

Necesito que documentes esto:

```markdown
## MIS RESPUESTAS TÍPICAS

### Cuando saludo
"[Copia aquí 3-5 saludos que realmente usas]"

### Cuando presento un producto
"[Copia aquí cómo describes típicamente un producto]"

### Cuando el cliente dice que está caro
"[Tu respuesta real a esta objeción]"

### Cuando cierro una venta
"[Cómo confirmas el pedido típicamente]"

### Cuando hay un problema
"[Cómo manejas quejas]"

### Frases que uso frecuentemente
- "[frase 1]"
- "[frase 2]"
- "[frase 3]"

### Cosas que NUNCA diría
- "[cosa 1]"
- "[cosa 2]"
```

---

## 5. IMPLEMENTACIÓN CON N8N

### 5.1 Flujo Principal

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW: Agente de Ventas                    │
└─────────────────────────────────────────────────────────────────┘

[Webhook WhatsApp] ──┐
[Webhook Facebook] ──┼──► [Router] ──► [Identificar Cliente]
[Webhook Web] ───────┘         │
                               ▼
                    [Obtener Contexto Firebase]
                               │
                               ▼
                    [Construir System Prompt]
                               │
                               ▼
                    [Obtener Historial Conversación]
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Claude API Call    │
                    │   (con Tool Calling) │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        [Tool: Buscar    [Tool: Verificar  [Tool: Crear
         Productos]       Stock]            Cotización]
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                    [Procesar Respuesta IA]
                               │
                               ▼
                    [Guardar en Historial]
                               │
                               ▼
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        [Enviar a        [Enviar a        [Enviar a
         WhatsApp]        Facebook]        Web Socket]
```

### 5.2 Nodos n8n Detallados

**Nodo 1: Webhook WhatsApp (360dialog/Twilio)**

```json
{
  "node": "Webhook",
  "config": {
    "path": "whatsapp-incoming",
    "method": "POST",
    "authentication": "headerAuth"
  }
}
```

**Nodo 2: Identificar Cliente**

```javascript
// Code Node
const telefono = $input.first().json.from;
const mensaje = $input.first().json.text?.body || $input.first().json.message;
const canal = 'whatsapp';

// Normalizar teléfono
const telefonoNormalizado = telefono.replace(/[^0-9]/g, '');

return {
  telefono: telefonoNormalizado,
  mensaje,
  canal,
  timestamp: new Date().toISOString()
};
```

**Nodo 3: HTTP Request - Buscar Cliente en Firebase**

```json
{
  "node": "HTTP Request",
  "config": {
    "method": "POST",
    "url": "https://tu-proyecto.cloudfunctions.net/getClienteByTelefono",
    "body": {
      "telefono": "={{$json.telefono}}"
    }
  }
}
```

**Nodo 4: Construir Contexto**

```javascript
// Code Node
const cliente = $('Buscar Cliente').first().json;
const mensaje = $('Identificar Cliente').first().json;
const historialConversacion = $('Obtener Historial').first().json || [];

// Construir contexto para el prompt
const contexto = {
  canal: mensaje.canal,
  cliente_nombre: cliente?.nombre || 'Cliente nuevo',
  cliente_id: cliente?.id || null,
  cliente_historial: cliente?.analytics?.resumenCompras || 'Sin historial',
  ultima_compra: cliente?.ultimaCompra || 'Primera vez',
  productos_favoritos: cliente?.analytics?.productosFavoritos?.slice(0, 3) || [],
  segmento_cliente: cliente?.segmento || 'nuevo',
  hora_actual: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })
};

// System prompt con contexto inyectado
const systemPrompt = construirSystemPrompt(contexto);

return {
  systemPrompt,
  mensajeUsuario: mensaje.mensaje,
  historialConversacion,
  clienteId: cliente?.id
};
```

**Nodo 5: Claude API con Tool Calling**

```json
{
  "node": "HTTP Request",
  "config": {
    "method": "POST",
    "url": "https://api.anthropic.com/v1/messages",
    "headers": {
      "x-api-key": "={{$credentials.anthropicApiKey}}",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    "body": {
      "model": "claude-sonnet-4-20250514",
      "max_tokens": 1024,
      "system": "={{$json.systemPrompt}}",
      "messages": "={{$json.historialConversacion.concat([{role: 'user', content: $json.mensajeUsuario}])}}",
      "tools": [
        {
          "name": "buscar_productos",
          "description": "Busca productos en el catálogo por nombre, marca o categoría",
          "input_schema": {
            "type": "object",
            "properties": {
              "query": {"type": "string", "description": "Término de búsqueda"},
              "categoria": {"type": "string", "description": "Filtrar por categoría"},
              "marca": {"type": "string", "description": "Filtrar por marca"}
            },
            "required": ["query"]
          }
        },
        {
          "name": "verificar_stock",
          "description": "Verifica disponibilidad de un producto",
          "input_schema": {
            "type": "object",
            "properties": {
              "producto_id": {"type": "string"},
              "cantidad": {"type": "number", "default": 1}
            },
            "required": ["producto_id"]
          }
        },
        {
          "name": "crear_cotizacion",
          "description": "Crea una cotización formal",
          "input_schema": {
            "type": "object",
            "properties": {
              "cliente_id": {"type": "string"},
              "productos": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "producto_id": {"type": "string"},
                    "cantidad": {"type": "number"}
                  }
                }
              },
              "notas": {"type": "string"}
            },
            "required": ["productos"]
          }
        },
        {
          "name": "escalar_humano",
          "description": "Transfiere a atención humana",
          "input_schema": {
            "type": "object",
            "properties": {
              "razon": {"type": "string"},
              "urgencia": {"type": "string", "enum": ["alta", "media", "baja"]}
            },
            "required": ["razon"]
          }
        }
      ]
    }
  }
}
```

**Nodo 6: Procesar Tool Calls (Loop)**

```javascript
// Code Node - Procesar respuesta de Claude
const response = $input.first().json;
const toolCalls = response.content.filter(c => c.type === 'tool_use');
const textResponse = response.content.find(c => c.type === 'text')?.text;

if (toolCalls.length > 0) {
  // Necesita ejecutar herramientas
  return {
    needsToolExecution: true,
    toolCalls: toolCalls.map(tc => ({
      id: tc.id,
      name: tc.name,
      input: tc.input
    })),
    partialResponse: textResponse
  };
} else {
  // Respuesta final
  return {
    needsToolExecution: false,
    finalResponse: textResponse
  };
}
```

### 5.3 Herramientas como Sub-workflows

**Sub-workflow: buscar_productos**

```javascript
// Recibe: { query, categoria?, marca? }
// HTTP Request a Firebase
const searchParams = {
  query: $json.input.query,
  categoria: $json.input.categoria || null,
  marca: $json.input.marca || null
};

// Llamar a tu Cloud Function
// Retornar resultados formateados para Claude
return {
  tool_result: productos.map(p => ({
    id: p.id,
    nombre: p.nombreComercial,
    marca: p.marca,
    precio: `S/${p.precioSugerido}`,
    stock: p.stockDisponible > 0 ? 'Disponible' : 'Agotado',
    descripcion_corta: p.descripcion?.substring(0, 200)
  }))
};
```

---

## 6. INTEGRACIONES POR CANAL

### 6.1 WhatsApp Business API

**Opciones de Proveedor:**

| Proveedor | Costo Mensual | Complejidad | Recomendación |
|-----------|---------------|-------------|---------------|
| **360dialog** | $50 + msgs | Media | Mejor relación costo/beneficio |
| **Twilio** | $15 + msgs | Baja | Más documentación |
| **Meta Cloud API** | $0 + msgs | Alta | Más económico, más complejo |
| **WABA Directo** | $0 + msgs | Muy Alta | Solo si tienes dev dedicado |

**Costo por mensaje (aproximado):**
- Mensajes de sesión (24h): ~$0.005 - $0.01
- Plantillas (fuera de 24h): ~$0.05 - $0.15

**Setup con 360dialog + n8n:**

```yaml
1. Crear cuenta en 360dialog.com
2. Vincular número WhatsApp Business
3. Configurar webhook en n8n
4. Configurar plantillas de mensaje (obligatorio para iniciar conversaciones)
```

### 6.2 Facebook Messenger

```yaml
Setup:
1. Crear App en Meta for Developers
2. Agregar producto "Messenger"
3. Vincular página de Facebook
4. Configurar webhook con token de verificación
5. Solicitar permisos: pages_messaging

Webhook URL: https://tu-n8n.com/webhook/facebook-messenger
```

### 6.3 Widget Web

**Opción A: Chatwoot (Open Source, Recomendado)**

```yaml
Ventajas:
- Self-hosted (control total)
- Integra WhatsApp, Facebook, Web
- Panel de agente para supervisión
- API robusta para n8n

Setup:
- Docker: docker-compose up
- Cloud: chatwoot.com (desde $19/mes)
```

**Opción B: Widget Custom con Socket.io**

```typescript
// Frontend (React)
import { io } from 'socket.io-client';

const socket = io('wss://tu-servidor.com/chat');

socket.on('agente_respuesta', (mensaje) => {
  // Mostrar mensaje del agente
});

function enviarMensaje(texto: string) {
  socket.emit('cliente_mensaje', {
    sessionId: getSessionId(),
    mensaje: texto
  });
}
```

---

## 7. DATOS QUE NECESITAS PREPARAR

### 7.1 Checklist de Contenido

```markdown
## CATÁLOGO DE PRODUCTOS (Ya tienes en Firebase)
[x] Nombres y descripciones
[x] Precios
[x] Stock
[x] Categorías
[ ] Descripciones optimizadas para ventas (beneficios, no características)
[ ] FAQs por producto
[ ] Contraindicaciones/advertencias

## CONOCIMIENTO DE VENTAS (Necesitas documentar)
[ ] Guiones de venta exitosos (mínimo 20 conversaciones)
[ ] Respuestas a 30+ objeciones comunes
[ ] Preguntas de calificación
[ ] Técnicas de cierre que usas
[ ] Estrategias de upselling
[ ] Scripts de seguimiento

## POLÍTICAS COMERCIALES
[ ] Tabla de precios y descuentos
[ ] Política de envíos
[ ] Política de devoluciones
[ ] Métodos de pago aceptados
[ ] Horarios de atención
[ ] Tiempos de respuesta comprometidos

## DATOS DE CLIENTES (Ya tienes en Firebase)
[x] Historial de compras
[x] Segmentación RFM
[x] Productos favoritos
[ ] Notas de preferencias personales
[ ] Fechas importantes (cumpleaños, etc.)

## COMPETENCIA (Ya tienes en Firebase)
[x] Precios de competidores
[x] Análisis de mercado
[ ] Argumentos vs competencia
[ ] Por qué elegir tu negocio
```

### 7.2 Formato de Guiones de Venta

Necesito que documentes así:

```markdown
## CONVERSACIÓN EXITOSA #1

**Contexto:** Cliente preguntó por vitamina D
**Canal:** WhatsApp
**Resultado:** Venta de S/150

---

Cliente: Hola, tienen vitamina D?

Yo: [TU RESPUESTA EXACTA]

Cliente: Cuánto cuesta?

Yo: [TU RESPUESTA EXACTA]

Cliente: Es original?

Yo: [TU RESPUESTA EXACTA]

Cliente: Ok me llevo 2

Yo: [TU RESPUESTA EXACTA]

---

**Qué funcionó:** [Por qué cerró esta venta]
**Objeciones manejadas:** [Lista]
```

---

## 8. CONSULTAS CRÍTICAS PARA TI

Antes de implementar, necesito que respondas estas preguntas:

### Sobre tu Negocio

```markdown
1. ¿Cuál es el nombre comercial de tu negocio?
   Respuesta: _______________

2. ¿Cómo quieres que se llame el agente IA?
   Respuesta: _______________

3. ¿Cuál es tu propuesta de valor principal? (Por qué comprarte a ti)
   Respuesta: _______________

4. ¿Cuáles son tus 5 productos más vendidos?
   1. _______________
   2. _______________
   3. _______________
   4. _______________
   5. _______________

5. ¿Cuál es tu ticket promedio actual?
   Respuesta: S/_______________

6. ¿Qué porcentaje de consultas actualmente conviertes en venta?
   Respuesta: ___%
```

### Sobre tu Estilo de Venta

```markdown
7. ¿Cómo describirías tu tono? (Formal, casual, técnico, amigable)
   Respuesta: _______________

8. ¿Usas emojis en tus mensajes? ¿Cuáles son tus favoritos?
   Respuesta: _______________

9. ¿Cuál es tu saludo típico?
   Respuesta: _______________

10. ¿Cuál es tu frase de cierre típica?
    Respuesta: _______________

11. ¿Qué NUNCA dirías a un cliente?
    Respuesta: _______________

12. ¿Cuál es la objeción más común que recibes?
    Respuesta: _______________

13. ¿Cómo la manejas normalmente?
    Respuesta: _______________
```

### Sobre Políticas

```markdown
14. ¿Cuál es tu política de descuentos?
    - Máximo descuento sin autorización: ___%
    - Condiciones para descuento: _______________

15. ¿Cuál es el monto mínimo para envío gratis?
    Respuesta: S/_______________

16. ¿Cuánto cobras por envío?
    - Lima: S/_______________
    - Provincias: S/_______________

17. ¿Aceptas devoluciones? ¿Bajo qué condiciones?
    Respuesta: _______________

18. ¿Qué métodos de pago aceptas?
    [ ] Yape
    [ ] Plin
    [ ] Transferencia
    [ ] Efectivo contra entrega
    [ ] Tarjeta
    [ ] Otro: _______________
```

### Sobre Operación

```markdown
19. ¿Cuántos mensajes recibes al día aproximadamente?
    Respuesta: _______________

20. ¿En qué horario recibes más mensajes?
    Respuesta: _______________

21. ¿Cuánto tiempo te toma responder actualmente?
    Respuesta: _______________

22. ¿Qué porcentaje de consultas podrías delegar al agente?
    Respuesta: ___%

23. ¿Qué casos SIEMPRE quieres atender personalmente?
    Respuesta: _______________
```

### Sobre Tecnología

```markdown
24. ¿Tienes servidor propio o usarías servicios cloud?
    [ ] Servidor propio (especificar): _______________
    [ ] Cloud (AWS, GCP, etc.)
    [ ] No tengo preferencia

25. ¿Tienes experiencia con n8n o herramientas similares?
    [ ] Sí, uso n8n
    [ ] Sí, uso Make/Zapier
    [ ] No, pero puedo aprender
    [ ] Necesitaría ayuda técnica

26. ¿Cuál es tu presupuesto mensual para esta solución?
    [ ] $50-100
    [ ] $100-200
    [ ] $200-500
    [ ] $500+
    [ ] Flexible según ROI
```

---

## 9. FASES DE IMPLEMENTACIÓN

### Fase 1: Preparación (Semana 1-2)
```markdown
□ Documentar guiones de venta (mínimo 20 conversaciones)
□ Definir políticas comerciales
□ Responder todas las consultas de sección 8
□ Optimizar descripciones de productos en Firebase
□ Configurar cuenta WhatsApp Business API
```

### Fase 2: Infraestructura (Semana 3-4)
```markdown
□ Desplegar n8n (self-hosted o cloud)
□ Crear Cloud Functions para Firebase
□ Configurar API de Claude
□ Configurar webhooks de WhatsApp
□ Crear base de datos para historial de conversaciones
```

### Fase 3: Desarrollo del Agente (Semana 5-6)
```markdown
□ Escribir System Prompt completo
□ Implementar tools (buscar_productos, verificar_stock, etc.)
□ Crear workflow principal en n8n
□ Pruebas internas con casos de prueba
□ Ajustar prompt basado en resultados
```

### Fase 4: Beta Controlada (Semana 7-8)
```markdown
□ Activar con 10% del tráfico
□ Monitorear todas las conversaciones
□ Identificar fallos y edge cases
□ Iterar prompt y tools
□ Medir métricas: tasa de respuesta, satisfacción, conversión
```

### Fase 5: Escalamiento (Semana 9+)
```markdown
□ Aumentar gradualmente el tráfico
□ Agregar canal Facebook
□ Agregar widget web
□ Implementar dashboard de métricas
□ Optimización continua
```

---

## 10. MÉTRICAS DE ÉXITO

### KPIs a Medir

```markdown
## Eficiencia
- Tiempo promedio de respuesta: < 30 segundos
- Mensajes manejados sin escalamiento: > 80%
- Precisión de información: > 95%

## Ventas
- Tasa de conversión consulta → cotización: Meta ___% (vs actual __%)
- Tasa de conversión cotización → venta: Meta ___% (vs actual __%)
- Ticket promedio: Meta S/___ (vs actual S/___)

## Satisfacción
- CSAT (encuesta post-interacción): > 4.5/5
- Tasa de escalamiento a humano: < 20%
- Quejas por respuestas incorrectas: < 2%

## ROI
- Horas ahorradas por día: ___
- Costo por conversación: < $0.50
- Incremento en ventas atribuible: ___%
```

---

## 11. COSTOS ESTIMADOS MENSUALES

### Escenario: 500 conversaciones/mes

| Componente | Costo Estimado |
|------------|----------------|
| Claude API (Sonnet) | $30-50 |
| WhatsApp Business API (360dialog) | $50 + ~$25 msgs |
| n8n Cloud (o self-hosted) | $0-50 |
| Firebase (ya tienes) | $0 |
| Hosting adicional (si aplica) | $20-50 |
| **Total Estimado** | **$100-225/mes** |

### Escenario: 2000 conversaciones/mes

| Componente | Costo Estimado |
|------------|----------------|
| Claude API | $100-150 |
| WhatsApp Business API | $50 + ~$100 msgs |
| n8n Cloud Pro | $50 |
| Pinecone (embeddings) | $70 |
| **Total Estimado** | **$370-420/mes** |

---

## 12. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Respuestas incorrectas sobre productos | Media | Alto | Verificación obligatoria via tools, nunca inventar |
| Cliente frustrado con bot | Media | Alto | Escalamiento fácil a humano, detección de frustración |
| Falla en API de IA | Baja | Alto | Fallback a GPT-4, mensaje de espera |
| Costos mayores a esperados | Media | Medio | Límites de uso, monitoreo diario |
| Pérdida de ventas por respuesta incorrecta | Baja | Alto | Periodo de beta controlada, supervisión humana inicial |

---

## 13. ALTERNATIVAS SIMPLIFICADAS

Si el proyecto completo parece muy ambicioso, aquí hay alternativas progresivas:

### Nivel 1: Respuestas Automáticas Básicas (1 semana)
```markdown
- Respuestas predefinidas para FAQs comunes
- Sin IA, solo reglas
- Costo: ~$0-20/mes
- Herramienta: ManyChat, Chatfuel
```

### Nivel 2: IA con Catálogo Estático (2-3 semanas)
```markdown
- Claude/GPT con catálogo embebido en prompt
- Sin conexión a Firebase en tiempo real
- Actualización manual del catálogo
- Costo: ~$50-100/mes
```

### Nivel 3: IA Conectada (Lo propuesto - 6-8 semanas)
```markdown
- Conexión completa a Firebase
- Tool calling para operaciones
- Automatización completa
- Costo: ~$150-300/mes
```

### Nivel 4: IA con Fine-tuning (3-4 meses)
```markdown
- Modelo fine-tuned con tus conversaciones
- Personalidad totalmente customizada
- Máxima precisión
- Costo: ~$300-500/mes + costo inicial fine-tuning
```

---

## 14. PRÓXIMOS PASOS INMEDIATOS

1. **Responde las consultas de la Sección 8** - Sin esto no puedo personalizar el system prompt.

2. **Exporta 20+ conversaciones de venta exitosas** - De WhatsApp Business puedes exportar chats. Necesito ver tu estilo real.

3. **Define tu presupuesto** - Para dimensionar la solución correctamente.

4. **Decide el nivel de implementación** - ¿Empezamos con Nivel 2 o 3?

5. **Configura WhatsApp Business API** - Este es el paso técnico más largo, mejor iniciarlo ya.

---

## 15. RECURSOS ADICIONALES

### Documentación Técnica
- [Claude API - Tool Use](https://docs.anthropic.com/claude/docs/tool-use)
- [n8n Documentation](https://docs.n8n.io/)
- [360dialog WhatsApp](https://docs.360dialog.com/)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)

### Plantillas y Ejemplos
- Repositorio con ejemplos de n8n workflows para chatbots
- Templates de System Prompts para ventas
- Ejemplos de Tool Definitions

---

*Documento generado para BMN System*
*Fecha: Enero 2026*
*Versión: 1.0*
