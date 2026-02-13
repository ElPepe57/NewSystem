# IMPLEMENTACION COMPLETA - PARTE 3: AGENTE IA Y FIREBASE FUNCTIONS

---

# 6. AGENTE IA DE VENTAS - IMPLEMENTACION COMPLETA

## 6.1 Arquitectura del Agente

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENTE IA - ARQUITECTURA                          │
└─────────────────────────────────────────────────────────────────────────┘

   FRONTEND (Web)                    BACKEND (Functions)
        │                                   │
        │   ┌───────────────────┐           │
        │   │   ChatWidget.tsx  │           │
        │   │   - UI del chat   │           │
        │   │   - Input mensaje │           │
        │   │   - Lista mensajes│           │
        │   └─────────┬─────────┘           │
        │             │                     │
        │             │ POST /api/ai-agent  │
        │             │                     │
        │             ▼                     │
        │   ┌─────────────────────────────────────────────────┐
        │   │              Firebase Function                   │
        │   │              aiAgentEndpoint                     │
        │   │                                                  │
        │   │  1. Obtener contexto del usuario                 │
        │   │  2. Cargar historial de conversacion             │
        │   │  3. Construir system prompt                      │
        │   │  4. Llamar Claude API con tools                  │
        │   │  5. Ejecutar tools si es necesario               │
        │   │  6. Formatear respuesta                          │
        │   │  7. Guardar en Firestore                         │
        │   │                                                  │
        │   └─────────────────────────────────────────────────┘
        │                     │
        │                     │ Tools disponibles:
        │                     │
        │   ┌─────────────────┼─────────────────┐
        │   │                 │                 │
        │   ▼                 ▼                 ▼
        │ ┌───────┐     ┌───────┐         ┌───────┐
        │ │search │     │ check │         │ add   │
        │ │Products│    │ Stock │         │ToCart │
        │ └───────┘     └───────┘         └───────┘
        │
        │   ┌─────────────────┼─────────────────┐
        │   │                 │                 │
        │   ▼                 ▼                 ▼
        │ ┌───────┐     ┌───────┐         ┌───────┐
        │ │ get   │     │compare│         │ get   │
        │ │Recom  │     │Prices │         │Order  │
        │ └───────┘     └───────┘         └───────┘
```

## 6.2 System Prompt del Agente

```typescript
// packages/functions/src/ai-agent/prompts/system.prompt.ts

export function buildSystemPrompt(
  cliente: any | null,
  contexto: {
    productosEnCarrito?: number;
    totalCarrito?: number;
    paginaActual?: string;
    productoViendose?: any;
  }
): string {
  const basePrompt = `Eres un asistente de ventas experto de BMN Suplementos, una tienda especializada en suplementos alimenticios y vitaminas importadas de USA.

## TU ROL
- Ayudar a los clientes a encontrar productos para sus necesidades de salud
- Recomendar productos basandote en sus objetivos
- Responder preguntas sobre productos, ingredientes y beneficios
- Asistir en el proceso de compra
- Proporcionar informacion de precios y disponibilidad

## REGLAS IMPORTANTES
1. NUNCA inventes informacion sobre productos. Usa SOLO los datos que te proporcionen las herramientas.
2. Si no tienes informacion, di que verificaras y usa la herramienta correspondiente.
3. Siempre verifica stock antes de recomendar un producto.
4. Menciona los precios en Soles (S/).
5. Se amable, profesional y orientado a ayudar.
6. NO des consejos medicos especificos. Sugiere consultar con un profesional de salud.
7. Respuestas cortas y directas, maximo 2-3 parrafos.

## CATEGORIAS DE PRODUCTOS
- Sistema Inmune: Vitamina C, Zinc, Aceite de Oregano, Elderberry
- Omega y Corazon: Omega 3, CoQ10, Aceite de Krill
- Vitaminas: Vitamina D3, Complejo B, Multivitaminicos
- Energia y Deporte: Pre-entrenos, Proteinas, Creatina
- Digestion: Probioticos, Enzimas, Fibra
- Relajacion y Sueno: Melatonina, Magnesio, GABA, Valeriana
- Belleza: Colageno, Biotina, Acido Hialuronico

## MARCAS PRINCIPALES
- NOW Foods (calidad premium, precio accesible)
- Nordic Naturals (omega 3 de alta pureza)
- Nature Made (vitaminas confiables)
- Garden of Life (organicos)
- Solgar (premium)`;

  // Agregar contexto del cliente si esta logueado
  let clienteContext = '';
  if (cliente) {
    clienteContext = `

## INFORMACION DEL CLIENTE
- Nombre: ${cliente.nombre}
- Segmento: ${cliente.segmento || 'nuevo'}
- Clasificacion: ${cliente.clasificacionABC || 'nuevo'}
${cliente.metricas?.productosFavoritos?.length > 0 ?
  `- Productos favoritos: ${cliente.metricas.productosFavoritos.join(', ')}` : ''}
${cliente.segmento === 'vip' || cliente.segmento === 'premium' ?
  '- CLIENTE VIP: Ofrece atencion preferencial y menciona promociones exclusivas.' : ''}`;
  }

  // Agregar contexto de la sesion
  let sessionContext = '';
  if (contexto.productosEnCarrito && contexto.productosEnCarrito > 0) {
    sessionContext += `
- El cliente tiene ${contexto.productosEnCarrito} productos en su carrito (S/${contexto.totalCarrito?.toFixed(2)})`;
  }
  if (contexto.paginaActual) {
    sessionContext += `
- Esta navegando en: ${contexto.paginaActual}`;
  }
  if (contexto.productoViendose) {
    sessionContext += `
- Esta viendo el producto: ${contexto.productoViendose.nombreComercial} (${contexto.productoViendose.sku})`;
  }

  if (sessionContext) {
    sessionContext = `

## CONTEXTO DE LA SESION${sessionContext}`;
  }

  return basePrompt + clienteContext + sessionContext;
}
```

## 6.3 Tools del Agente (Herramientas)

```typescript
// packages/functions/src/ai-agent/tools/index.ts

import Anthropic from '@anthropic-ai/sdk';

export const agentTools: Anthropic.Tool[] = [
  {
    name: 'buscar_productos',
    description: 'Busca productos en el catalogo por nombre, marca, categoria o beneficio. Usa esta herramienta cuando el usuario pregunte por un producto especifico o quiera encontrar productos para una necesidad.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Termino de busqueda (nombre, marca, categoria o beneficio)'
        },
        categoria: {
          type: 'string',
          description: 'Filtrar por categoria (opcional)',
          enum: ['sistema_inmune', 'omega', 'vitaminas', 'energia', 'digestion', 'sueno', 'belleza']
        },
        limite: {
          type: 'number',
          description: 'Numero maximo de resultados (default 5)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'verificar_stock',
    description: 'Verifica la disponibilidad de stock de uno o varios productos. Usa esta herramienta antes de recomendar un producto para confirmar que esta disponible.',
    input_schema: {
      type: 'object',
      properties: {
        productoIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs de los productos a verificar'
        }
      },
      required: ['productoIds']
    }
  },
  {
    name: 'obtener_recomendaciones',
    description: 'Obtiene recomendaciones personalizadas para el cliente basadas en su historial, segmento o necesidad expresada.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          description: 'Tipo de recomendacion',
          enum: ['historial', 'categoria', 'complementarios', 'populares', 'ofertas']
        },
        categoria: {
          type: 'string',
          description: 'Categoria para filtrar (si aplica)'
        },
        productoBase: {
          type: 'string',
          description: 'ID del producto base para complementarios'
        }
      },
      required: ['tipo']
    }
  },
  {
    name: 'comparar_precios',
    description: 'Compara el precio de un producto con el mercado (competidores). Util cuando el cliente pregunta si el precio es bueno.',
    input_schema: {
      type: 'object',
      properties: {
        productoId: {
          type: 'string',
          description: 'ID del producto a comparar'
        }
      },
      required: ['productoId']
    }
  },
  {
    name: 'agregar_al_carrito',
    description: 'Agrega un producto al carrito del cliente. Solo usa esta herramienta cuando el cliente confirme que quiere agregar el producto.',
    input_schema: {
      type: 'object',
      properties: {
        productoId: {
          type: 'string',
          description: 'ID del producto a agregar'
        },
        cantidad: {
          type: 'number',
          description: 'Cantidad a agregar (default 1)'
        }
      },
      required: ['productoId']
    }
  },
  {
    name: 'consultar_estado_pedido',
    description: 'Consulta el estado de un pedido del cliente. Usa esta herramienta cuando el cliente pregunte por su pedido.',
    input_schema: {
      type: 'object',
      properties: {
        numeroPedido: {
          type: 'string',
          description: 'Numero de pedido (ej: VNT-2025-0001)'
        }
      },
      required: ['numeroPedido']
    }
  }
];
```

## 6.4 Implementacion de cada Tool

```typescript
// packages/functions/src/ai-agent/tools/searchProducts.ts

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface SearchResult {
  id: string;
  sku: string;
  nombre: string;
  marca: string;
  precio: number;
  stockDisponible: number;
  categoria: string;
  imagen?: string;
  descripcionCorta?: string;
}

export async function searchProducts(params: {
  query: string;
  categoria?: string;
  limite?: number;
}): Promise<SearchResult[]> {
  const { query: searchTerm, categoria, limite = 5 } = params;

  // Obtener todos los productos activos
  const productosSnap = await getDocs(
    query(collection(db, 'productos'), where('estado', '==', 'activo'))
  );

  const productos = productosSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  // Filtrar por termino de busqueda
  const termLower = searchTerm.toLowerCase();
  let resultados = productos.filter(p => {
    const matchNombre = p.nombreComercial?.toLowerCase().includes(termLower);
    const matchMarca = p.marca?.toLowerCase().includes(termLower);
    const matchSku = p.sku?.toLowerCase().includes(termLower);
    const matchCategoria = p.categorias?.some(
      (c: any) => c.nombre?.toLowerCase().includes(termLower)
    );
    const matchEtiquetas = p.etiquetasData?.some(
      (e: any) => e.nombre?.toLowerCase().includes(termLower)
    );

    return matchNombre || matchMarca || matchSku || matchCategoria || matchEtiquetas;
  });

  // Filtrar por categoria si se especifica
  if (categoria) {
    resultados = resultados.filter(p =>
      p.categorias?.some((c: any) =>
        c.nombre?.toLowerCase().includes(categoria.toLowerCase())
      )
    );
  }

  // Ordenar por relevancia (stock disponible y precio)
  resultados.sort((a, b) => {
    // Priorizar productos con stock
    if (a.stockDisponible > 0 && b.stockDisponible === 0) return -1;
    if (b.stockDisponible > 0 && a.stockDisponible === 0) return 1;
    return 0;
  });

  // Limitar resultados
  return resultados.slice(0, limite).map(p => ({
    id: p.id,
    sku: p.sku,
    nombre: p.nombreComercial,
    marca: p.marca,
    precio: p.precioSugerido,
    stockDisponible: p.stockDisponible - (p.stockReservado || 0),
    categoria: p.categorias?.[0]?.nombre || p.grupo || '',
    imagen: p.imagenes?.[0],
    descripcionCorta: `${p.presentacion} ${p.contenido}`
  }));
}
```

```typescript
// packages/functions/src/ai-agent/tools/checkStock.ts

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface StockInfo {
  productoId: string;
  sku: string;
  nombre: string;
  stockDisponible: number;
  disponible: boolean;
  mensaje: string;
}

export async function checkStock(params: {
  productoIds: string[];
}): Promise<StockInfo[]> {
  const resultados: StockInfo[] = [];

  for (const productoId of params.productoIds) {
    const productoDoc = await getDoc(doc(db, 'productos', productoId));

    if (!productoDoc.exists()) {
      resultados.push({
        productoId,
        sku: '',
        nombre: 'Producto no encontrado',
        stockDisponible: 0,
        disponible: false,
        mensaje: 'Producto no encontrado en el catalogo'
      });
      continue;
    }

    const producto = productoDoc.data();
    const stockReal = (producto.stockDisponible || 0) - (producto.stockReservado || 0);

    let mensaje: string;
    if (stockReal <= 0) {
      mensaje = 'Agotado temporalmente';
    } else if (stockReal <= 5) {
      mensaje = `Ultimas ${stockReal} unidades!`;
    } else if (stockReal <= 20) {
      mensaje = `${stockReal} unidades disponibles`;
    } else {
      mensaje = 'Stock disponible';
    }

    resultados.push({
      productoId,
      sku: producto.sku,
      nombre: producto.nombreComercial,
      stockDisponible: stockReal,
      disponible: stockReal > 0,
      mensaje
    });
  }

  return resultados;
}
```

```typescript
// packages/functions/src/ai-agent/tools/getRecommendations.ts

import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface Recommendation {
  id: string;
  sku: string;
  nombre: string;
  marca: string;
  precio: number;
  imagen?: string;
  razon: string;
}

export async function getRecommendations(params: {
  tipo: 'historial' | 'categoria' | 'complementarios' | 'populares' | 'ofertas';
  categoria?: string;
  productoBase?: string;
  clienteId?: string;
}): Promise<Recommendation[]> {
  const { tipo, categoria, productoBase, clienteId } = params;

  switch (tipo) {
    case 'populares':
      return await getPopulares();

    case 'categoria':
      return await getPorCategoria(categoria!);

    case 'complementarios':
      return await getComplementarios(productoBase!);

    case 'ofertas':
      return await getOfertas();

    case 'historial':
      return await getPorHistorial(clienteId!);

    default:
      return await getPopulares();
  }
}

async function getPopulares(): Promise<Recommendation[]> {
  const snap = await getDocs(
    query(
      collection(db, 'productos'),
      where('estado', '==', 'activo'),
      where('stockDisponible', '>', 0),
      limit(5)
    )
  );

  return snap.docs.map(d => {
    const p = d.data();
    return {
      id: d.id,
      sku: p.sku,
      nombre: p.nombreComercial,
      marca: p.marca,
      precio: p.precioSugerido,
      imagen: p.imagenes?.[0],
      razon: 'Mas vendido'
    };
  });
}

async function getPorCategoria(categoria: string): Promise<Recommendation[]> {
  const snap = await getDocs(
    query(
      collection(db, 'productos'),
      where('estado', '==', 'activo'),
      where('stockDisponible', '>', 0)
    )
  );

  const productos = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((p: any) =>
      p.categorias?.some((c: any) =>
        c.nombre?.toLowerCase().includes(categoria.toLowerCase())
      ) ||
      p.grupo?.toLowerCase().includes(categoria.toLowerCase())
    )
    .slice(0, 5);

  return productos.map((p: any) => ({
    id: p.id,
    sku: p.sku,
    nombre: p.nombreComercial,
    marca: p.marca,
    precio: p.precioSugerido,
    imagen: p.imagenes?.[0],
    razon: `Top en ${categoria}`
  }));
}

async function getComplementarios(productoBaseId: string): Promise<Recommendation[]> {
  // Logica para productos complementarios
  // Basado en reglas de negocio o ML
  const complementos: Record<string, string[]> = {
    'omega': ['vitamina_d', 'coq10'],
    'vitamina_d': ['omega', 'calcio'],
    'probioticos': ['enzimas', 'fibra'],
    'melatonina': ['magnesio', 'gaba'],
    'colageno': ['vitamina_c', 'biotina']
  };

  // Implementar logica real aqui
  return [];
}

async function getOfertas(): Promise<Recommendation[]> {
  // Productos con promocion activa
  // Implementar cuando se tenga el sistema de promociones
  return [];
}

async function getPorHistorial(clienteId: string): Promise<Recommendation[]> {
  // Basado en compras anteriores y ciclo de recompra
  // Implementar con datos del cliente
  return [];
}
```

```typescript
// packages/functions/src/ai-agent/tools/addToCart.ts

import { CarritoService } from '../../services/carrito.service';

export interface AddToCartResult {
  success: boolean;
  mensaje: string;
  carrito?: {
    items: number;
    total: number;
  };
}

export async function addToCart(params: {
  productoId: string;
  cantidad?: number;
  sessionId: string;
  usuarioId?: string;
}): Promise<AddToCartResult> {
  const { productoId, cantidad = 1, sessionId, usuarioId } = params;

  try {
    const result = await CarritoService.agregarProducto({
      productoId,
      cantidad,
      sessionId,
      usuarioId
    });

    if (result.success && result.cart) {
      return {
        success: true,
        mensaje: `Agregado al carrito. Tu stock esta reservado por 48 horas.`,
        carrito: {
          items: result.cart.items.length,
          total: result.cart.total
        }
      };
    }

    return {
      success: false,
      mensaje: result.error || 'No se pudo agregar al carrito'
    };
  } catch (error) {
    return {
      success: false,
      mensaje: 'Error al agregar al carrito'
    };
  }
}
```

```typescript
// packages/functions/src/ai-agent/tools/comparePrices.ts

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface PriceComparison {
  productoId: string;
  sku: string;
  nombre: string;
  nuestroPrecio: number;
  mercado: {
    minimo: number;
    promedio: number;
    maximo: number;
  };
  ventaja: 'mejor_precio' | 'precio_competitivo' | 'precio_premium';
  ahorro: number;
  mensaje: string;
}

export async function comparePrices(params: {
  productoId: string;
}): Promise<PriceComparison | null> {
  const productoDoc = await getDoc(doc(db, 'productos', params.productoId));

  if (!productoDoc.exists()) {
    return null;
  }

  const producto = productoDoc.data();
  const investigacion = producto.investigacion;

  if (!investigacion) {
    return {
      productoId: params.productoId,
      sku: producto.sku,
      nombre: producto.nombreComercial,
      nuestroPrecio: producto.precioSugerido,
      mercado: { minimo: 0, promedio: 0, maximo: 0 },
      ventaja: 'precio_competitivo',
      ahorro: 0,
      mensaje: 'No tenemos datos comparativos del mercado para este producto.'
    };
  }

  const nuestroPrecio = producto.precioSugerido;
  const precioMercadoMin = investigacion.precioPERUMin || 0;
  const precioMercadoProm = investigacion.precioPERUPromedio || 0;
  const precioMercadoMax = investigacion.precioPERUMax || 0;

  let ventaja: 'mejor_precio' | 'precio_competitivo' | 'precio_premium';
  let mensaje: string;

  if (nuestroPrecio < precioMercadoMin) {
    ventaja = 'mejor_precio';
    mensaje = `Tenemos el MEJOR PRECIO del mercado. Ahorras S/${(precioMercadoMin - nuestroPrecio).toFixed(2)} vs el precio mas bajo de la competencia.`;
  } else if (nuestroPrecio <= precioMercadoProm) {
    ventaja = 'precio_competitivo';
    mensaje = `Precio competitivo. Estas ahorrando S/${(precioMercadoProm - nuestroPrecio).toFixed(2)} vs el precio promedio del mercado.`;
  } else {
    ventaja = 'precio_premium';
    mensaje = `Precio premium que incluye garantia de producto original y envio rapido.`;
  }

  return {
    productoId: params.productoId,
    sku: producto.sku,
    nombre: producto.nombreComercial,
    nuestroPrecio,
    mercado: {
      minimo: precioMercadoMin,
      promedio: precioMercadoProm,
      maximo: precioMercadoMax
    },
    ventaja,
    ahorro: Math.max(0, precioMercadoProm - nuestroPrecio),
    mensaje
  };
}
```

## 6.5 Endpoint Principal del Agente

```typescript
// packages/functions/src/ai-agent/agent.ts

import * as functions from 'firebase-functions';
import Anthropic from '@anthropic-ai/sdk';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { buildSystemPrompt } from './prompts/system.prompt';
import { agentTools } from './tools';
import { searchProducts } from './tools/searchProducts';
import { checkStock } from './tools/checkStock';
import { getRecommendations } from './tools/getRecommendations';
import { comparePrices } from './tools/comparePrices';
import { addToCart } from './tools/addToCart';
import type { AIConversation, ChatMessage, SendMessageInput } from '../types/ai-agent.types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export const aiAgentEndpoint = functions.https.onCall(async (data: SendMessageInput, context) => {
  const { message, conversationId, sessionId, usuarioId, contexto } = data;

  try {
    // 1. Obtener o crear conversacion
    let conversation: AIConversation;

    if (conversationId) {
      const convDoc = await getDoc(doc(db, 'conversaciones_ia', conversationId));
      if (convDoc.exists()) {
        conversation = { id: convDoc.id, ...convDoc.data() } as AIConversation;
      } else {
        conversation = await createConversation(sessionId, usuarioId);
      }
    } else {
      conversation = await createConversation(sessionId, usuarioId);
    }

    // 2. Obtener contexto del cliente
    let cliente = null;
    if (usuarioId) {
      const clienteDoc = await getDoc(doc(db, 'clientes', usuarioId));
      if (clienteDoc.exists()) {
        cliente = clienteDoc.data();
      }
    }

    // 3. Construir system prompt
    const systemPrompt = buildSystemPrompt(cliente, contexto || {});

    // 4. Preparar mensajes para Claude
    const messages: Anthropic.MessageParam[] = conversation.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    // Agregar mensaje del usuario
    messages.push({ role: 'user', content: message });

    // 5. Llamar a Claude
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: agentTools
    });

    // 6. Procesar tool calls si hay
    let finalContent = '';
    let productsToShow: any[] = [];
    let actionsToShow: any[] = [];

    while (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (!toolUseBlock) break;

      // Ejecutar tool
      const toolResult = await executeToolCall(
        toolUseBlock.name,
        toolUseBlock.input as any,
        sessionId,
        usuarioId
      );

      // Procesar resultado para UI
      if (toolUseBlock.name === 'buscar_productos' && toolResult.length > 0) {
        productsToShow = toolResult.map((p: any) => ({
          id: p.id,
          sku: p.sku,
          nombre: p.nombre,
          marca: p.marca,
          precio: p.precio,
          imagen: p.imagen,
          stockDisponible: p.stockDisponible
        }));

        actionsToShow = toolResult.map((p: any) => ({
          type: 'add_to_cart',
          label: 'Agregar',
          productId: p.id
        }));
      }

      // Continuar conversacion con resultado del tool
      messages.push({
        role: 'assistant',
        content: response.content
      });

      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolResult)
        }]
      });

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: agentTools
      });
    }

    // 7. Extraer respuesta final
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    finalContent = textBlock?.text || 'Lo siento, no pude procesar tu mensaje.';

    // 8. Crear mensaje de respuesta
    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: finalContent,
      timestamp: Timestamp.now(),
      products: productsToShow.length > 0 ? productsToShow : undefined,
      actions: actionsToShow.length > 0 ? actionsToShow : undefined
    };

    // 9. Guardar en conversacion
    const userMessage: ChatMessage = {
      id: `msg-${Date.now() - 1}`,
      role: 'user',
      content: message,
      timestamp: Timestamp.now()
    };

    await updateDoc(doc(db, 'conversaciones_ia', conversation.id), {
      messages: [...conversation.messages, userMessage, assistantMessage],
      ultimaActividad: Timestamp.now(),
      'metricas.productosRecomendados': conversation.metricas.productosRecomendados + productsToShow.length
    });

    return {
      conversationId: conversation.id,
      message: assistantMessage
    };

  } catch (error) {
    console.error('Error en agente IA:', error);
    throw new functions.https.HttpsError('internal', 'Error procesando mensaje');
  }
});

async function createConversation(
  sessionId: string,
  usuarioId?: string
): Promise<AIConversation> {
  const conversation: Omit<AIConversation, 'id'> = {
    sessionId,
    usuarioId,
    messages: [],
    contexto: {},
    metricas: {
      productosRecomendados: 0,
      productosAgregados: 0,
      conversionACompra: false
    },
    activa: true,
    fechaInicio: Timestamp.now(),
    ultimaActividad: Timestamp.now()
  };

  const docRef = doc(db, 'conversaciones_ia', `conv-${Date.now()}`);
  await setDoc(docRef, conversation);

  return { id: docRef.id, ...conversation };
}

async function executeToolCall(
  toolName: string,
  input: any,
  sessionId: string,
  usuarioId?: string
): Promise<any> {
  switch (toolName) {
    case 'buscar_productos':
      return await searchProducts(input);

    case 'verificar_stock':
      return await checkStock(input);

    case 'obtener_recomendaciones':
      return await getRecommendations({ ...input, clienteId: usuarioId });

    case 'comparar_precios':
      return await comparePrices(input);

    case 'agregar_al_carrito':
      return await addToCart({ ...input, sessionId, usuarioId });

    default:
      return { error: 'Herramienta no reconocida' };
  }
}
```

---

# 7. FIREBASE FUNCTIONS COMPLETAS

## 7.1 Indice Principal

```typescript
// packages/functions/src/index.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Inicializar Firebase Admin
admin.initializeApp();

// API Endpoints
export { aiAgentEndpoint } from './ai-agent/agent';
export { productsApi } from './api/products';
export { cartApi } from './api/cart';
export { checkoutApi } from './api/checkout';

// Webhooks
export { culqiWebhook } from './webhooks/culqi.webhook';
export { whatsappWebhook } from './webhooks/whatsapp.webhook';

// Triggers
export { onOrderCreate } from './triggers/onOrderCreate';
export { onCartExpire } from './triggers/onCartExpire';
export { onStockChange } from './triggers/onStockChange';

// Scheduled Jobs
export { cleanExpiredCarts } from './scheduled/cleanExpiredCarts';
export { sendReorderReminders } from './scheduled/sendReorderReminders';
export { calculateRFM } from './scheduled/calculateRFM';
```

## 7.2 Triggers de Firestore

```typescript
// packages/functions/src/triggers/onOrderCreate.ts

import * as functions from 'firebase-functions';
import { sendOrderConfirmationEmail } from '../notifications/email';
import { sendOrderConfirmationWhatsApp } from '../notifications/whatsapp';

export const onOrderCreate = functions.firestore
  .document('ventas/{ventaId}')
  .onCreate(async (snap, context) => {
    const venta = snap.data();
    const ventaId = context.params.ventaId;

    try {
      // 1. Enviar email de confirmacion
      if (venta.datosContacto?.email) {
        await sendOrderConfirmationEmail({
          to: venta.datosContacto.email,
          nombreCliente: venta.datosContacto.nombre,
          numeroVenta: venta.numeroVenta,
          productos: venta.productos,
          total: venta.totalPEN,
          tiempoEntrega: venta.datosEnvio?.tiempoEstimado || '24-48 horas'
        });
      }

      // 2. Enviar WhatsApp
      if (venta.datosContacto?.telefono) {
        await sendOrderConfirmationWhatsApp({
          to: venta.datosContacto.telefono,
          nombreCliente: venta.datosContacto.nombre,
          numeroVenta: venta.numeroVenta,
          total: venta.totalPEN
        });
      }

      // 3. Actualizar metricas del cliente
      if (venta.clienteId) {
        // Incrementar contador de compras, actualizar ultima compra, etc.
      }

      console.log(`Venta ${ventaId} procesada exitosamente`);
    } catch (error) {
      console.error(`Error procesando venta ${ventaId}:`, error);
    }
  });
```

```typescript
// packages/functions/src/triggers/onCartExpire.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendCartAbandonmentEmail } from '../notifications/email';

const db = admin.firestore();

export const onCartExpire = functions.firestore
  .document('carritos_web/{carritoId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Detectar cambio a status 'expired' o 'abandoned'
    if (before.status === 'active' &&
        (after.status === 'expired' || after.status === 'abandoned')) {

      const carritoId = context.params.carritoId;

      try {
        // 1. Liberar stock reservado
        for (const item of after.items || []) {
          const productoRef = db.doc(`productos/${item.productoId}`);
          const productoSnap = await productoRef.get();

          if (productoSnap.exists) {
            const stockReservado = productoSnap.data()?.stockReservado || 0;
            await productoRef.update({
              stockReservado: Math.max(0, stockReservado - item.cantidad)
            });
          }
        }

        // 2. Enviar email de carrito abandonado (si hay email)
        if (after.checkoutData?.contact?.email && after.items?.length > 0) {
          await sendCartAbandonmentEmail({
            to: after.checkoutData.contact.email,
            nombreCliente: after.checkoutData.contact.nombre,
            items: after.items,
            total: after.total
          });
        }

        console.log(`Carrito ${carritoId} expirado, stock liberado`);
      } catch (error) {
        console.error(`Error procesando carrito expirado ${carritoId}:`, error);
      }
    }
  });
```

## 7.3 Scheduled Jobs (Cron)

```typescript
// packages/functions/src/scheduled/cleanExpiredCarts.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Ejecutar cada hora
export const cleanExpiredCarts = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const ahora = admin.firestore.Timestamp.now();

    try {
      // Buscar carritos activos con reserva expirada
      const carritosSnap = await db
        .collection('carritos_web')
        .where('status', '==', 'active')
        .where('vigenciaReserva', '<', ahora)
        .get();

      console.log(`Encontrados ${carritosSnap.size} carritos expirados`);

      const batch = db.batch();
      let count = 0;

      for (const doc of carritosSnap.docs) {
        const carrito = doc.data();

        // Liberar stock de cada item
        for (const item of carrito.items || []) {
          const productoRef = db.doc(`productos/${item.productoId}`);
          // Nota: En batch no podemos leer, asi que usamos increment negativo
          batch.update(productoRef, {
            stockReservado: admin.firestore.FieldValue.increment(-item.cantidad)
          });
        }

        // Marcar carrito como expirado
        batch.update(doc.ref, {
          status: 'expired',
          reservaActiva: false
        });

        count++;

        // Firestore batch limit es 500
        if (count >= 400) {
          await batch.commit();
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      console.log(`${carritosSnap.size} carritos limpiados`);
      return null;
    } catch (error) {
      console.error('Error limpiando carritos:', error);
      return null;
    }
  });
```

```typescript
// packages/functions/src/scheduled/sendReorderReminders.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendReorderReminderEmail } from '../notifications/email';
import { sendReorderReminderWhatsApp } from '../notifications/whatsapp';

const db = admin.firestore();

// Ejecutar diariamente a las 10am
export const sendReorderReminders = functions.pubsub
  .schedule('0 10 * * *')
  .timeZone('America/Lima')
  .onRun(async (context) => {
    try {
      // Obtener ventas de hace X dias (basado en ciclo de recompra)
      const ventasSnap = await db.collection('ventas')
        .where('estado', '==', 'entregada')
        .get();

      const ahora = new Date();
      const recordatoriosEnviados: string[] = [];

      for (const ventaDoc of ventasSnap.docs) {
        const venta = ventaDoc.data();

        for (const producto of venta.productos || []) {
          // Verificar ciclo de recompra
          const productoDoc = await db.doc(`productos/${producto.productoId}`).get();
          if (!productoDoc.exists) continue;

          const productoData = productoDoc.data()!;
          const cicloRecompra = productoData.cicloRecompraDias;
          if (!cicloRecompra) continue;

          // Calcular dias desde la compra
          const fechaVenta = venta.fechaVenta?.toDate?.() || new Date();
          const diasTranscurridos = Math.floor(
            (ahora.getTime() - fechaVenta.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Enviar recordatorio cuando falte 20% del ciclo
          const umbralRecordatorio = cicloRecompra * 0.8;

          if (diasTranscurridos >= umbralRecordatorio &&
              diasTranscurridos < cicloRecompra &&
              !recordatoriosEnviados.includes(`${venta.clienteId}-${producto.productoId}`)) {

            // Enviar recordatorio
            if (venta.datosContacto?.email) {
              await sendReorderReminderEmail({
                to: venta.datosContacto.email,
                nombreCliente: venta.datosContacto.nombre,
                producto: {
                  nombre: producto.nombreComercial,
                  sku: producto.sku,
                  precio: productoData.precioSugerido
                },
                diasRestantes: cicloRecompra - diasTranscurridos
              });
            }

            if (venta.datosContacto?.telefono) {
              await sendReorderReminderWhatsApp({
                to: venta.datosContacto.telefono,
                nombreCliente: venta.datosContacto.nombre,
                productoNombre: producto.nombreComercial
              });
            }

            recordatoriosEnviados.push(`${venta.clienteId}-${producto.productoId}`);
          }
        }
      }

      console.log(`Enviados ${recordatoriosEnviados.length} recordatorios de recompra`);
      return null;
    } catch (error) {
      console.error('Error enviando recordatorios:', error);
      return null;
    }
  });
```

## 7.4 Notificaciones

```typescript
// packages/functions/src/notifications/email.ts

import * as nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendOrderConfirmationEmail(params: {
  to: string;
  nombreCliente: string;
  numeroVenta: string;
  productos: any[];
  total: number;
  tiempoEntrega: string;
}): Promise<void> {
  const { to, nombreCliente, numeroVenta, productos, total, tiempoEntrega } = params;

  const productosHTML = productos.map(p => `
    <tr>
      <td>${p.nombreComercial}</td>
      <td>${p.cantidad}</td>
      <td>S/${p.precioUnitario.toFixed(2)}</td>
      <td>S/${p.subtotal.toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <h1>Gracias por tu compra, ${nombreCliente}!</h1>
    <p>Tu pedido <strong>${numeroVenta}</strong> ha sido confirmado.</p>

    <h2>Detalle del pedido:</h2>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Precio</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${productosHTML}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3"><strong>Total:</strong></td>
          <td><strong>S/${total.toFixed(2)}</strong></td>
        </tr>
      </tfoot>
    </table>

    <p><strong>Tiempo de entrega estimado:</strong> ${tiempoEntrega}</p>

    <p>Te enviaremos un mensaje cuando tu pedido sea despachado.</p>

    <p>Saludos,<br>Equipo BMN Suplementos</p>
  `;

  await transporter.sendMail({
    from: '"BMN Suplementos" <ventas@bmn.pe>',
    to,
    subject: `Confirmacion de pedido ${numeroVenta}`,
    html
  });
}

export async function sendCartAbandonmentEmail(params: {
  to: string;
  nombreCliente: string;
  items: any[];
  total: number;
}): Promise<void> {
  const { to, nombreCliente, items, total } = params;

  const html = `
    <h1>Hola ${nombreCliente}, olvidaste algo!</h1>

    <p>Notamos que dejaste productos en tu carrito. Tu stock reservado esta por expirar.</p>

    <p><strong>Total de tu carrito:</strong> S/${total.toFixed(2)}</p>

    <p>
      <a href="https://bmn.pe/carrito" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Completar mi compra
      </a>
    </p>

    <p>Si tienes alguna duda, nuestro equipo esta listo para ayudarte.</p>
  `;

  await transporter.sendMail({
    from: '"BMN Suplementos" <ventas@bmn.pe>',
    to,
    subject: 'Tu carrito te esta esperando',
    html
  });
}

export async function sendReorderReminderEmail(params: {
  to: string;
  nombreCliente: string;
  producto: { nombre: string; sku: string; precio: number };
  diasRestantes: number;
}): Promise<void> {
  const { to, nombreCliente, producto, diasRestantes } = params;

  const html = `
    <h1>Hola ${nombreCliente}!</h1>

    <p>Tu <strong>${producto.nombre}</strong> esta por terminarse (aproximadamente ${diasRestantes} dias).</p>

    <p>
      <a href="https://bmn.pe/producto/${producto.sku}" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Reordenar ahora - S/${producto.precio.toFixed(2)}
      </a>
    </p>

    <p>No te quedes sin tu suplemento favorito!</p>
  `;

  await transporter.sendMail({
    from: '"BMN Suplementos" <ventas@bmn.pe>',
    to,
    subject: `Es hora de reponer tu ${producto.nombre}`,
    html
  });
}
```

```typescript
// packages/functions/src/notifications/whatsapp.ts

import axios from 'axios';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  components: any[]
): Promise<void> {
  try {
    await axios.post(
      `${WHATSAPP_API_URL}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''), // Solo numeros
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'es' },
          components
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error enviando WhatsApp:', error);
    throw error;
  }
}

export async function sendOrderConfirmationWhatsApp(params: {
  to: string;
  nombreCliente: string;
  numeroVenta: string;
  total: number;
}): Promise<void> {
  await sendWhatsAppTemplate(params.to, 'order_confirmation', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.nombreCliente },
        { type: 'text', text: params.numeroVenta },
        { type: 'text', text: `S/${params.total.toFixed(2)}` }
      ]
    }
  ]);
}

export async function sendReorderReminderWhatsApp(params: {
  to: string;
  nombreCliente: string;
  productoNombre: string;
}): Promise<void> {
  await sendWhatsAppTemplate(params.to, 'reorder_reminder', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.nombreCliente },
        { type: 'text', text: params.productoNombre }
      ]
    }
  ]);
}
```
