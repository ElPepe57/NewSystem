# Implementacion SEO y Marketing Digital - Parte 2

## 7. Analytics y Tracking Avanzado

### 7.1 Dashboard de Marketing Analytics

```typescript
// packages/shared/src/types/analytics.marketing.types.ts

export interface MarketingMetrics {
  periodo: {
    inicio: Date;
    fin: Date;
  };

  // Tráfico
  trafico: {
    sesiones: number;
    usuarios: number;
    usuariosNuevos: number;
    tasaRebote: number;
    duracionPromedio: number;
    paginasVistas: number;
  };

  // Fuentes de tráfico
  fuentes: {
    organico: TrafficSource;
    directo: TrafficSource;
    referral: TrafficSource;
    social: TrafficSource;
    email: TrafficSource;
    paid: TrafficSource;
  };

  // Conversiones
  conversiones: {
    leads: number;
    addToCart: number;
    checkouts: number;
    compras: number;
    tasaConversion: number;
    valorPromedioPedido: number;
    ingresoTotal: number;
  };

  // Embudo
  embudo: FunnelStep[];

  // Top páginas
  topPaginas: PageMetrics[];

  // Top productos
  topProductos: ProductMetrics[];

  // Campañas
  campanias: CampaignMetrics[];
}

export interface TrafficSource {
  sesiones: number;
  usuarios: number;
  conversiones: number;
  ingresos: number;
  tasaConversion: number;
}

export interface FunnelStep {
  nombre: string;
  usuarios: number;
  tasaConversion: number;
  abandono: number;
}

export interface PageMetrics {
  url: string;
  titulo: string;
  vistas: number;
  usuariosUnicos: number;
  tiempoPromedio: number;
  tasaRebote: number;
  conversiones: number;
}

export interface ProductMetrics {
  productoId: string;
  nombre: string;
  vistas: number;
  addToCart: number;
  compras: number;
  ingresos: number;
  tasaConversion: number;
}

export interface CampaignMetrics {
  id: string;
  nombre: string;
  fuente: string;
  medio: string;
  clics: number;
  impresiones: number;
  ctr: number;
  costo: number;
  conversiones: number;
  cpa: number;
  roas: number;
}

// SEO Metrics
export interface SEOMetrics {
  // Rankings
  rankings: KeywordRanking[];

  // Core Web Vitals
  coreWebVitals: {
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
    ttfb: number; // Time to First Byte
  };

  // Indexación
  indexacion: {
    paginasIndexadas: number;
    errores404: number;
    erroresServer: number;
    paginasBloqueadas: number;
  };

  // Backlinks
  backlinks: {
    total: number;
    dominiosReferentes: number;
    nuevos: number;
    perdidos: number;
  };
}

export interface KeywordRanking {
  keyword: string;
  posicion: number;
  posicionAnterior: number;
  cambio: number;
  url: string;
  volumenBusqueda: number;
}
```

### 7.2 Servicio de Analytics

```typescript
// packages/functions/src/services/marketingAnalytics.service.ts

import { getFirestore } from 'firebase-admin/firestore';
import { MarketingMetrics, SEOMetrics } from '@businessmn/shared';

const db = getFirestore();

export class MarketingAnalyticsService {

  // ============ RECOLECCIÓN DE DATOS ============

  static async trackPageView(data: {
    sessionId: string;
    userId?: string;
    url: string;
    referrer?: string;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    };
    device: {
      tipo: 'mobile' | 'tablet' | 'desktop';
      navegador: string;
      os: string;
    };
  }) {
    const pageViewRef = db.collection('analytics_pageviews').doc();

    await pageViewRef.set({
      ...data,
      timestamp: new Date(),
      fechaHora: new Date().toISOString()
    });

    // Actualizar contadores en tiempo real
    await this.incrementDailyCounter('pageviews');

    return pageViewRef.id;
  }

  static async trackEvent(data: {
    sessionId: string;
    userId?: string;
    evento: string;
    categoria: string;
    accion: string;
    etiqueta?: string;
    valor?: number;
    metadata?: Record<string, unknown>;
  }) {
    const eventRef = db.collection('analytics_events').doc();

    await eventRef.set({
      ...data,
      timestamp: new Date()
    });

    // Contadores específicos por evento
    await this.incrementDailyCounter(`event_${data.evento}`);

    return eventRef.id;
  }

  static async trackConversion(data: {
    sessionId: string;
    userId?: string;
    tipo: 'lead' | 'add_to_cart' | 'checkout' | 'purchase';
    valor?: number;
    productoId?: string;
    ordenId?: string;
    utm?: Record<string, string>;
  }) {
    const conversionRef = db.collection('analytics_conversions').doc();

    await conversionRef.set({
      ...data,
      timestamp: new Date()
    });

    // Atribución de conversión
    if (data.utm?.source) {
      await this.updateCampaignConversions(data.utm, data.valor || 0);
    }

    return conversionRef.id;
  }

  // ============ HELPERS ============

  private static async incrementDailyCounter(key: string) {
    const today = new Date().toISOString().split('T')[0];
    const counterRef = db.collection('analytics_counters').doc(today);

    await counterRef.set({
      [key]: FieldValue.increment(1),
      updatedAt: new Date()
    }, { merge: true });
  }

  private static async updateCampaignConversions(
    utm: Record<string, string>,
    valor: number
  ) {
    const campaignId = `${utm.source}_${utm.medium}_${utm.campaign}`;
    const campaignRef = db.collection('analytics_campaigns').doc(campaignId);

    await campaignRef.set({
      source: utm.source,
      medium: utm.medium,
      campaign: utm.campaign,
      conversiones: FieldValue.increment(1),
      ingresos: FieldValue.increment(valor),
      updatedAt: new Date()
    }, { merge: true });
  }

  // ============ REPORTES ============

  static async getMarketingDashboard(
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<MarketingMetrics> {
    const [
      trafico,
      fuentes,
      conversiones,
      topPaginas,
      topProductos,
      campanias
    ] = await Promise.all([
      this.getTrafficMetrics(fechaInicio, fechaFin),
      this.getTrafficSources(fechaInicio, fechaFin),
      this.getConversionMetrics(fechaInicio, fechaFin),
      this.getTopPages(fechaInicio, fechaFin),
      this.getTopProducts(fechaInicio, fechaFin),
      this.getCampaignMetrics(fechaInicio, fechaFin)
    ]);

    // Calcular embudo
    const embudo = this.calculateFunnel(trafico, conversiones);

    return {
      periodo: { inicio: fechaInicio, fin: fechaFin },
      trafico,
      fuentes,
      conversiones,
      embudo,
      topPaginas,
      topProductos,
      campanias
    };
  }

  private static async getTrafficMetrics(inicio: Date, fin: Date) {
    const pageviewsRef = db.collection('analytics_pageviews')
      .where('timestamp', '>=', inicio)
      .where('timestamp', '<=', fin);

    const snapshot = await pageviewsRef.get();

    const sesiones = new Set<string>();
    const usuarios = new Set<string>();
    let totalDuration = 0;
    let bounces = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      sesiones.add(data.sessionId);
      if (data.userId) usuarios.add(data.userId);
      if (data.duration) totalDuration += data.duration;
      if (data.bounce) bounces++;
    });

    return {
      sesiones: sesiones.size,
      usuarios: usuarios.size,
      usuariosNuevos: 0, // Calcular con query adicional
      tasaRebote: (bounces / sesiones.size) * 100,
      duracionPromedio: totalDuration / sesiones.size,
      paginasVistas: snapshot.size
    };
  }

  private static async getTrafficSources(inicio: Date, fin: Date) {
    const pageviewsRef = db.collection('analytics_pageviews')
      .where('timestamp', '>=', inicio)
      .where('timestamp', '<=', fin);

    const snapshot = await pageviewsRef.get();

    const sources: Record<string, TrafficSource> = {
      organico: { sesiones: 0, usuarios: 0, conversiones: 0, ingresos: 0, tasaConversion: 0 },
      directo: { sesiones: 0, usuarios: 0, conversiones: 0, ingresos: 0, tasaConversion: 0 },
      referral: { sesiones: 0, usuarios: 0, conversiones: 0, ingresos: 0, tasaConversion: 0 },
      social: { sesiones: 0, usuarios: 0, conversiones: 0, ingresos: 0, tasaConversion: 0 },
      email: { sesiones: 0, usuarios: 0, conversiones: 0, ingresos: 0, tasaConversion: 0 },
      paid: { sesiones: 0, usuarios: 0, conversiones: 0, ingresos: 0, tasaConversion: 0 }
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      const source = this.categorizeSource(data.utm, data.referrer);
      sources[source].sesiones++;
    });

    return sources;
  }

  private static categorizeSource(
    utm?: { source?: string; medium?: string },
    referrer?: string
  ): string {
    if (utm?.medium === 'cpc' || utm?.medium === 'ppc') return 'paid';
    if (utm?.medium === 'email') return 'email';
    if (utm?.source) {
      if (['facebook', 'instagram', 'tiktok', 'twitter'].includes(utm.source.toLowerCase())) {
        return 'social';
      }
    }
    if (!referrer) return 'directo';
    if (referrer.includes('google') || referrer.includes('bing')) return 'organico';
    return 'referral';
  }

  private static calculateFunnel(
    trafico: { sesiones: number },
    conversiones: { leads: number; addToCart: number; checkouts: number; compras: number }
  ): FunnelStep[] {
    const steps = [
      { nombre: 'Visitas', usuarios: trafico.sesiones },
      { nombre: 'Ver producto', usuarios: Math.floor(trafico.sesiones * 0.6) },
      { nombre: 'Agregar al carrito', usuarios: conversiones.addToCart },
      { nombre: 'Iniciar checkout', usuarios: conversiones.checkouts },
      { nombre: 'Compra', usuarios: conversiones.compras }
    ];

    return steps.map((step, index) => {
      const prevUsuarios = index > 0 ? steps[index - 1].usuarios : step.usuarios;
      return {
        ...step,
        tasaConversion: (step.usuarios / prevUsuarios) * 100,
        abandono: prevUsuarios - step.usuarios
      };
    });
  }

  // ============ SEO METRICS ============

  static async getSEOMetrics(): Promise<SEOMetrics> {
    // En producción, integrar con Google Search Console API y herramientas SEO
    return {
      rankings: await this.getKeywordRankings(),
      coreWebVitals: await this.getCoreWebVitals(),
      indexacion: await this.getIndexationStatus(),
      backlinks: await this.getBacklinkMetrics()
    };
  }

  private static async getKeywordRankings(): Promise<KeywordRanking[]> {
    // Integración con Search Console o herramienta SEO
    const rankingsRef = db.collection('seo_rankings')
      .orderBy('posicion', 'asc')
      .limit(50);

    const snapshot = await rankingsRef.get();

    return snapshot.docs.map(doc => ({
      ...doc.data() as KeywordRanking
    }));
  }

  private static async getCoreWebVitals() {
    // Obtener de la colección o API de PageSpeed
    const vitalsDoc = await db.collection('seo_metrics').doc('core_web_vitals').get();
    return vitalsDoc.data() || {
      lcp: 0,
      fid: 0,
      cls: 0,
      ttfb: 0
    };
  }
}
```

### 7.3 Hook de Analytics para React

```tsx
// packages/web/src/hooks/useAnalytics.ts

import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { GTMService } from '../services/gtm.service';
import { MetaPixelService } from '../services/metaPixel.service';
import { getSessionId, getUserId } from '../utils/session.utils';

export function useAnalytics() {
  const location = useLocation();

  // Track page views automáticamente
  useEffect(() => {
    // Enviar a GTM
    window.dataLayer?.push({
      event: 'page_view',
      page_path: location.pathname,
      page_title: document.title
    });

    // Enviar a Firebase Analytics
    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getSessionId(),
        userId: getUserId(),
        url: location.pathname + location.search,
        referrer: document.referrer,
        utm: getUTMParams()
      })
    }).catch(console.error);
  }, [location]);

  // Track events
  const trackEvent = useCallback((
    evento: string,
    categoria: string,
    accion: string,
    etiqueta?: string,
    valor?: number
  ) => {
    // GTM
    window.dataLayer?.push({
      event: evento,
      event_category: categoria,
      event_action: accion,
      event_label: etiqueta,
      value: valor
    });

    // Firebase
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getSessionId(),
        userId: getUserId(),
        evento,
        categoria,
        accion,
        etiqueta,
        valor
      })
    }).catch(console.error);
  }, []);

  // Track e-commerce events
  const trackViewItem = useCallback((producto: Producto) => {
    GTMService.viewItem(producto);
    MetaPixelService.viewContent(producto);
    trackEvent('view_item', 'ecommerce', 'view', producto.sku);
  }, [trackEvent]);

  const trackAddToCart = useCallback((producto: Producto, cantidad: number) => {
    GTMService.addToCart(producto, cantidad);
    MetaPixelService.addToCart(producto, cantidad);
    trackEvent('add_to_cart', 'ecommerce', 'add', producto.sku, producto.precioVenta * cantidad);
  }, [trackEvent]);

  const trackPurchase = useCallback((order: {
    id: string;
    total: number;
    items: CartItem[];
  }) => {
    GTMService.purchase(order);
    MetaPixelService.purchase(order);
    trackEvent('purchase', 'ecommerce', 'complete', order.id, order.total);
  }, [trackEvent]);

  return {
    trackEvent,
    trackViewItem,
    trackAddToCart,
    trackPurchase
  };
}

function getUTMParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};

  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(key => {
    const value = params.get(key);
    if (value) utm[key.replace('utm_', '')] = value;
  });

  return utm;
}
```

### 7.4 Dashboard de Marketing (Componente)

```tsx
// packages/admin/src/pages/Marketing/MarketingDashboard.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { MarketingAnalyticsService } from '../../services/marketingAnalytics.service';

export function MarketingDashboard() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  });

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['marketing-metrics', dateRange],
    queryFn: () => MarketingAnalyticsService.getMarketingDashboard(
      dateRange.start,
      dateRange.end
    )
  });

  if (isLoading) return <LoadingSpinner />;

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard de Marketing</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          titulo="Sesiones"
          valor={metrics?.trafico.sesiones || 0}
          formato="numero"
          icono="users"
        />
        <KPICard
          titulo="Tasa de Conversión"
          valor={metrics?.conversiones.tasaConversion || 0}
          formato="porcentaje"
          icono="trending-up"
        />
        <KPICard
          titulo="Ingresos"
          valor={metrics?.conversiones.ingresoTotal || 0}
          formato="moneda"
          icono="dollar"
        />
        <KPICard
          titulo="Ticket Promedio"
          valor={metrics?.conversiones.valorPromedioPedido || 0}
          formato="moneda"
          icono="shopping-cart"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fuentes de tráfico */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Fuentes de Tráfico</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={Object.entries(metrics?.fuentes || {}).map(([key, value]) => ({
                  name: key,
                  value: value.sesiones
                }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {Object.keys(metrics?.fuentes || {}).map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Embudo de conversión */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Embudo de Conversión</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={metrics?.embudo || []}
              layout="vertical"
              margin={{ left: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="nombre" />
              <Tooltip />
              <Bar dataKey="usuarios" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Productos */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Top Productos</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3">Producto</th>
              <th className="text-right py-3">Vistas</th>
              <th className="text-right py-3">Add to Cart</th>
              <th className="text-right py-3">Compras</th>
              <th className="text-right py-3">Conversión</th>
              <th className="text-right py-3">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {metrics?.topProductos.slice(0, 10).map(producto => (
              <tr key={producto.productoId} className="border-b">
                <td className="py-3">{producto.nombre}</td>
                <td className="text-right">{producto.vistas}</td>
                <td className="text-right">{producto.addToCart}</td>
                <td className="text-right">{producto.compras}</td>
                <td className="text-right">{producto.tasaConversion.toFixed(1)}%</td>
                <td className="text-right">S/{producto.ingresos.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Campañas */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Rendimiento de Campañas</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3">Campaña</th>
              <th className="text-left py-3">Fuente/Medio</th>
              <th className="text-right py-3">Clics</th>
              <th className="text-right py-3">CTR</th>
              <th className="text-right py-3">Conversiones</th>
              <th className="text-right py-3">CPA</th>
              <th className="text-right py-3">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {metrics?.campanias.map(campania => (
              <tr key={campania.id} className="border-b">
                <td className="py-3">{campania.nombre}</td>
                <td>{campania.fuente}/{campania.medio}</td>
                <td className="text-right">{campania.clics}</td>
                <td className="text-right">{campania.ctr.toFixed(2)}%</td>
                <td className="text-right">{campania.conversiones}</td>
                <td className="text-right">S/{campania.cpa.toFixed(2)}</td>
                <td className="text-right">
                  <span className={campania.roas >= 1 ? 'text-green-600' : 'text-red-600'}>
                    {campania.roas.toFixed(2)}x
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 8. Estrategia de Contenido

### 8.1 Tipos para Blog

```typescript
// packages/shared/src/types/blog.types.ts

export interface BlogPost {
  id: string;
  slug: string;

  // Contenido
  titulo: string;
  extracto: string;
  contenido: string; // Markdown o HTML
  imagenDestacada: string;

  // SEO
  seo: {
    title: string;
    description: string;
    keywords: string[];
    canonical?: string;
  };

  // Categorización
  categoria: BlogCategoria;
  etiquetas: string[];

  // Productos relacionados
  productosRelacionados: string[];

  // Autor
  autor: {
    id: string;
    nombre: string;
    avatar?: string;
    bio?: string;
  };

  // Estado
  estado: 'borrador' | 'publicado' | 'programado';
  fechaPublicacion: Date;
  fechaActualizacion?: Date;

  // Métricas
  vistas: number;
  compartidos: number;
  tiempoLecturaMinutos: number;

  // Comentarios
  comentariosHabilitados: boolean;
}

export type BlogCategoria =
  | 'nutricion'
  | 'entrenamiento'
  | 'suplementacion'
  | 'recetas'
  | 'noticias'
  | 'guias';

export interface BlogSeries {
  id: string;
  nombre: string;
  descripcion: string;
  posts: string[]; // IDs ordenados
  imagenPortada: string;
}
```

### 8.2 Servicio de Blog

```typescript
// packages/web/src/services/blog.service.ts

import { getFirestore, collection, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { BlogPost, BlogCategoria } from '@businessmn/shared';

const db = getFirestore();

export class BlogService {

  static async getPosts(options: {
    categoria?: BlogCategoria;
    etiqueta?: string;
    limite?: number;
    pagina?: number;
  } = {}): Promise<{ posts: BlogPost[]; total: number }> {
    let q = query(
      collection(db, 'blog_posts'),
      where('estado', '==', 'publicado'),
      orderBy('fechaPublicacion', 'desc')
    );

    if (options.categoria) {
      q = query(q, where('categoria', '==', options.categoria));
    }

    if (options.etiqueta) {
      q = query(q, where('etiquetas', 'array-contains', options.etiqueta));
    }

    const limite = options.limite || 10;
    q = query(q, limit(limite));

    const snapshot = await getDocs(q);

    return {
      posts: snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BlogPost)),
      total: snapshot.size
    };
  }

  static async getPostBySlug(slug: string): Promise<BlogPost | null> {
    const q = query(
      collection(db, 'blog_posts'),
      where('slug', '==', slug),
      where('estado', '==', 'publicado'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    // Incrementar vistas
    await updateDoc(snapshot.docs[0].ref, {
      vistas: increment(1)
    });

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as BlogPost;
  }

  static async getRelatedPosts(post: BlogPost, limite = 3): Promise<BlogPost[]> {
    // Posts de la misma categoría
    const q = query(
      collection(db, 'blog_posts'),
      where('estado', '==', 'publicado'),
      where('categoria', '==', post.categoria),
      where('id', '!=', post.id),
      orderBy('vistas', 'desc'),
      limit(limite)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BlogPost));
  }

  static async getPopularPosts(limite = 5): Promise<BlogPost[]> {
    const q = query(
      collection(db, 'blog_posts'),
      where('estado', '==', 'publicado'),
      orderBy('vistas', 'desc'),
      limit(limite)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BlogPost));
  }

  // Generar tiempo de lectura
  static calculateReadingTime(contenido: string): number {
    const wordsPerMinute = 200;
    const words = contenido.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }

  // Generar tabla de contenidos
  static generateTableOfContents(contenido: string): { id: string; texto: string; nivel: number }[] {
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const toc: { id: string; texto: string; nivel: number }[] = [];

    let match;
    while ((match = headingRegex.exec(contenido)) !== null) {
      const nivel = match[1].length;
      const texto = match[2];
      const id = texto.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      toc.push({ id, texto, nivel });
    }

    return toc;
  }
}
```

### 8.3 Componentes de Blog

```tsx
// packages/web/src/components/Blog/BlogPostCard.tsx

import { Link } from 'react-router-dom';
import { BlogPost } from '@businessmn/shared';
import { OptimizedImage } from '../common/OptimizedImage';

interface BlogPostCardProps {
  post: BlogPost;
  variant?: 'default' | 'featured' | 'compact';
}

export function BlogPostCard({ post, variant = 'default' }: BlogPostCardProps) {
  const formattedDate = new Date(post.fechaPublicacion).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (variant === 'featured') {
    return (
      <Link
        to={`/blog/${post.slug}`}
        className="group relative block h-96 overflow-hidden rounded-2xl"
      >
        <OptimizedImage
          src={post.imagenDestacada}
          alt={post.titulo}
          width={800}
          height={400}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <span className="inline-block px-3 py-1 bg-green-600 rounded-full text-sm font-medium mb-3">
            {post.categoria}
          </span>
          <h2 className="text-2xl font-bold mb-2 group-hover:text-green-400 transition-colors">
            {post.titulo}
          </h2>
          <p className="text-gray-300 line-clamp-2 mb-3">{post.extracto}</p>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>{formattedDate}</span>
            <span>{post.tiempoLecturaMinutos} min de lectura</span>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link to={`/blog/${post.slug}`} className="flex gap-4 group">
        <OptimizedImage
          src={post.imagenDestacada}
          alt={post.titulo}
          width={100}
          height={100}
          className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
        />
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors line-clamp-2">
            {post.titulo}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{formattedDate}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/blog/${post.slug}`} className="group block">
      <div className="aspect-video overflow-hidden rounded-xl mb-4">
        <OptimizedImage
          src={post.imagenDestacada}
          alt={post.titulo}
          width={400}
          height={225}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-2">
        {post.categoria}
      </span>

      <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600 transition-colors mb-2">
        {post.titulo}
      </h3>

      <p className="text-gray-600 line-clamp-2 mb-3">{post.extracto}</p>

      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>{formattedDate}</span>
        <span>{post.tiempoLecturaMinutos} min</span>
        <span>{post.vistas} vistas</span>
      </div>
    </Link>
  );
}
```

```tsx
// packages/web/src/pages/Blog/BlogPost.tsx

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import { BlogService } from '../../services/blog.service';
import { SEOService, SchemaService } from '../../services/seo.service';
import { ProductCard } from '../../components/Product/ProductCard';
import { BlogPostCard } from '../../components/Blog/BlogPostCard';
import { ShareButtons } from '../../components/common/ShareButtons';
import { TableOfContents } from '../../components/Blog/TableOfContents';

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: () => BlogService.getPostBySlug(slug!)
  });

  const { data: relatedPosts } = useQuery({
    queryKey: ['related-posts', post?.id],
    queryFn: () => BlogService.getRelatedPosts(post!, 3),
    enabled: !!post
  });

  const { data: relatedProducts } = useQuery({
    queryKey: ['related-products', post?.productosRelacionados],
    queryFn: () => ProductoService.getByIds(post!.productosRelacionados),
    enabled: !!post?.productosRelacionados?.length
  });

  if (isLoading) return <LoadingSpinner />;
  if (!post) return <NotFound />;

  const toc = BlogService.generateTableOfContents(post.contenido);
  const articleSchema = SchemaService.generateArticleSchema({
    title: post.titulo,
    content: post.extracto,
    author: post.autor.nombre,
    publishDate: new Date(post.fechaPublicacion),
    updateDate: post.fechaActualizacion ? new Date(post.fechaActualizacion) : undefined,
    image: post.imagenDestacada,
    url: `https://businessmn.pe/blog/${post.slug}`
  });

  return (
    <>
      <Helmet>
        <title>{post.seo.title}</title>
        <meta name="description" content={post.seo.description} />
        <meta name="keywords" content={post.seo.keywords.join(', ')} />
        <link rel="canonical" href={`https://businessmn.pe/blog/${post.slug}`} />

        {/* Open Graph */}
        <meta property="og:title" content={post.titulo} />
        <meta property="og:description" content={post.extracto} />
        <meta property="og:image" content={post.imagenDestacada} />
        <meta property="og:type" content="article" />

        {/* Schema */}
        <script type="application/ld+json">
          {JSON.stringify(articleSchema)}
        </script>
      </Helmet>

      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">
              {post.categoria}
            </span>
            <time dateTime={post.fechaPublicacion.toString()}>
              {new Date(post.fechaPublicacion).toLocaleDateString('es-PE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </time>
            <span>{post.tiempoLecturaMinutos} min de lectura</span>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {post.titulo}
          </h1>

          <p className="text-xl text-gray-600 mb-6">{post.extracto}</p>

          {/* Autor */}
          <div className="flex items-center gap-4">
            {post.autor.avatar && (
              <img
                src={post.autor.avatar}
                alt={post.autor.nombre}
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <p className="font-semibold">{post.autor.nombre}</p>
              {post.autor.bio && (
                <p className="text-sm text-gray-500">{post.autor.bio}</p>
              )}
            </div>
          </div>
        </header>

        {/* Imagen destacada */}
        <img
          src={post.imagenDestacada}
          alt={post.titulo}
          className="w-full aspect-video object-cover rounded-2xl mb-8"
        />

        <div className="flex gap-8">
          {/* Tabla de contenidos (sticky sidebar) */}
          {toc.length > 0 && (
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24">
                <TableOfContents items={toc} />
              </div>
            </aside>
          )}

          {/* Contenido */}
          <div className="flex-1 prose prose-lg max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h2 id={generateId(children)}>{children}</h2>,
                h2: ({ children }) => <h3 id={generateId(children)}>{children}</h3>,
                h3: ({ children }) => <h4 id={generateId(children)}>{children}</h4>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                )
              }}
            >
              {post.contenido}
            </ReactMarkdown>
          </div>
        </div>

        {/* Compartir */}
        <div className="border-t border-b py-6 my-8">
          <p className="text-center text-gray-600 mb-4">¿Te gustó este artículo? ¡Compártelo!</p>
          <ShareButtons
            url={`https://businessmn.pe/blog/${post.slug}`}
            title={post.titulo}
            description={post.extracto}
          />
        </div>

        {/* Productos relacionados */}
        {relatedProducts && relatedProducts.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Productos Mencionados</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map(producto => (
                <ProductCard key={producto.id} producto={producto} variant="compact" />
              ))}
            </div>
          </section>
        )}

        {/* Posts relacionados */}
        {relatedPosts && relatedPosts.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Artículos Relacionados</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map(relatedPost => (
                <BlogPostCard key={relatedPost.id} post={relatedPost} />
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}

function generateId(children: React.ReactNode): string {
  const text = typeof children === 'string' ? children : '';
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
```

---

## 9. Integraciones Redes Sociales

### 9.1 Botones de Compartir

```tsx
// packages/web/src/components/common/ShareButtons.tsx

import { useState } from 'react';

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

export function ShareButtons({ url, title, description, image }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || '');

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url
        });
      } catch (err) {
        // Usuario canceló
      }
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      {/* Facebook */}
      <a
        href={shareLinks.facebook}
        target="_blank"
        rel="noopener noreferrer"
        className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1877F2] text-white hover:opacity-90 transition-opacity"
        aria-label="Compartir en Facebook"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z" />
        </svg>
      </a>

      {/* Twitter/X */}
      <a
        href={shareLinks.twitter}
        target="_blank"
        rel="noopener noreferrer"
        className="w-10 h-10 flex items-center justify-center rounded-full bg-black text-white hover:opacity-90 transition-opacity"
        aria-label="Compartir en Twitter"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

      {/* WhatsApp */}
      <a
        href={shareLinks.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="w-10 h-10 flex items-center justify-center rounded-full bg-[#25D366] text-white hover:opacity-90 transition-opacity"
        aria-label="Compartir en WhatsApp"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>

      {/* LinkedIn */}
      <a
        href={shareLinks.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="w-10 h-10 flex items-center justify-center rounded-full bg-[#0A66C2] text-white hover:opacity-90 transition-opacity"
        aria-label="Compartir en LinkedIn"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </a>

      {/* Copiar enlace */}
      <button
        onClick={handleCopyLink}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
        aria-label="Copiar enlace"
      >
        {copied ? (
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
        )}
      </button>

      {/* Native Share (mobile) */}
      {typeof navigator !== 'undefined' && navigator.share && (
        <button
          onClick={handleNativeShare}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
          aria-label="Compartir"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      )}
    </div>
  );
}
```

### 9.2 Feed de Instagram

```tsx
// packages/web/src/components/Social/InstagramFeed.tsx

import { useQuery } from '@tanstack/react-query';

interface InstagramPost {
  id: string;
  permalink: string;
  media_url: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  caption?: string;
  timestamp: string;
}

async function fetchInstagramFeed(): Promise<InstagramPost[]> {
  // Usar Instagram Basic Display API
  const response = await fetch('/api/instagram/feed');
  return response.json();
}

export function InstagramFeed() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ['instagram-feed'],
    queryFn: fetchInstagramFeed,
    staleTime: 1000 * 60 * 30 // 30 minutos
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square bg-gray-200 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Síguenos en Instagram
          </h2>
          <a
            href="https://instagram.com/businessmn_pe"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:text-green-700 font-medium"
          >
            @businessmn_pe
          </a>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {posts?.slice(0, 6).map(post => (
            <a
              key={post.id}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square overflow-hidden rounded-lg group"
            >
              <img
                src={post.media_url}
                alt={post.caption?.substring(0, 50) || 'Instagram post'}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## 10. Checklist de Implementacion

### Fase 1: SEO Técnico (Semana 1-2)
- [ ] Configurar SSR/SSG con Vite Plugin SSR
- [ ] Implementar SEOService completo
- [ ] Crear componente SEOHead
- [ ] Configurar sitemap.xml dinámico
- [ ] Configurar robots.txt
- [ ] Optimizar Core Web Vitals (LCP, FID, CLS)
- [ ] Implementar lazy loading de imágenes
- [ ] Configurar compresión y caché

### Fase 2: Datos Estructurados (Semana 2-3)
- [ ] Schema de Producto (Product)
- [ ] Schema de Organización
- [ ] Schema de BreadcrumbList
- [ ] Schema de FAQPage
- [ ] Schema de ArticleSchema para blog
- [ ] Schema de SearchAction
- [ ] Schema de LocalBusiness
- [ ] Validar con Google Rich Results Test

### Fase 3: Integraciones Marketing (Semana 3-4)
- [ ] Configurar Google Tag Manager
- [ ] Implementar eventos GA4 e-commerce
- [ ] Configurar Meta Pixel
- [ ] Implementar eventos de Facebook
- [ ] Configurar Google Ads conversion tracking
- [ ] Implementar remarketing dinámico
- [ ] Testing de todas las conversiones

### Fase 4: Email Marketing (Semana 4-5)
- [ ] Integrar Brevo (Sendinblue)
- [ ] Crear templates transaccionales
  - [ ] Bienvenida
  - [ ] Carrito abandonado
  - [ ] Confirmación de compra
  - [ ] Recordatorio de recompra
  - [ ] Solicitud de review
- [ ] Configurar flujos automatizados
- [ ] Implementar popup de captura de leads
- [ ] Segmentación de contactos

### Fase 5: Landing Pages (Semana 5-6)
- [ ] Sistema de landing pages dinámicas
- [ ] Componentes: Hero, Countdown, ExitPopup
- [ ] A/B testing framework
- [ ] UTM tracking completo
- [ ] Personalización por segmento

### Fase 6: Contenido y Blog (Semana 6-7)
- [ ] Implementar sistema de blog
- [ ] Crear categorías de contenido
- [ ] Componentes: BlogPostCard, TableOfContents
- [ ] SEO para artículos
- [ ] Productos relacionados en posts
- [ ] Sistema de series/guías

### Fase 7: Analytics Avanzado (Semana 7-8)
- [ ] Dashboard de marketing
- [ ] Tracking de embudo completo
- [ ] Atribución multi-canal
- [ ] Reportes de campañas
- [ ] Métricas de SEO
- [ ] Alertas automatizadas

### Fase 8: Redes Sociales (Semana 8)
- [ ] Botones de compartir
- [ ] Feed de Instagram
- [ ] Open Graph optimizado
- [ ] Twitter Cards
- [ ] Social proof widgets

---

## Métricas de Éxito

| Métrica | Objetivo Mes 3 | Objetivo Mes 6 | Objetivo Año 1 |
|---------|----------------|----------------|----------------|
| Tráfico Orgánico | +50% | +150% | +400% |
| Posiciones Top 10 | 20 keywords | 50 keywords | 100 keywords |
| Tasa de Conversión | 1.5% | 2.5% | 3.5% |
| Email Open Rate | 25% | 30% | 35% |
| ROAS Ads | 2x | 3x | 4x |
| Core Web Vitals | Todas verdes | Todas verdes | Todas verdes |
| Backlinks | 50 | 150 | 500 |

---

## Herramientas Recomendadas

### SEO
- Google Search Console (gratis)
- Google Analytics 4 (gratis)
- Ahrefs o SEMrush (pago)
- Screaming Frog (gratis hasta 500 URLs)

### Email Marketing
- Brevo/Sendinblue (gratis hasta 300 emails/día)
- Mailchimp (alternativa)

### Analytics
- Google Analytics 4
- Hotjar (mapas de calor)
- Microsoft Clarity (gratis)

### Ads
- Google Ads
- Meta Ads Manager
- TikTok Ads (opcional)

### Contenido
- Canva (diseño)
- Grammarly (redacción)
- SurferSEO (optimización contenido)
