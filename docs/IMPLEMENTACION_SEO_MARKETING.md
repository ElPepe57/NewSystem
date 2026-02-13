# Implementación SEO y Marketing Digital - BusinessMN Web

## Índice
1. [SEO Técnico](#1-seo-técnico)
2. [SEO On-Page](#2-seo-on-page)
3. [Datos Estructurados](#3-datos-estructurados-schemaorg)
4. [Integraciones Marketing](#4-integraciones-de-marketing)
5. [Landing Pages Dinámicas](#5-landing-pages-dinámicas)
6. [Email Marketing](#6-email-marketing)
7. [Analytics Avanzado](#7-analytics-y-tracking-avanzado)
8. [Estrategia de Contenido](#8-estrategia-de-contenido)
9. [Redes Sociales](#9-integraciones-redes-sociales)
10. [Checklist de Implementación](#10-checklist-de-implementación)

---

## 1. SEO Técnico

### 1.1 Configuración Next.js/Vite para SSR/SSG

```typescript
// packages/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitePluginSSR } from 'vite-plugin-ssr';

export default defineConfig({
  plugins: [
    react(),
    vitePluginSSR({
      prerender: {
        // Pre-renderizar páginas estáticas para SEO
        partial: true,
        noExtraDir: true,
        parallel: 4
      }
    })
  ],
  build: {
    // Optimización para Core Web Vitals
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@headlessui/react', 'framer-motion']
        }
      }
    }
  }
});
```

### 1.2 Tipos para SEO

```typescript
// packages/shared/src/types/seo.types.ts

export interface MetaTags {
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  robots?: string;
  author?: string;
}

export interface OpenGraph {
  title: string;
  description: string;
  image: string;
  url: string;
  type: 'website' | 'product' | 'article';
  siteName: string;
  locale: string;
}

export interface TwitterCard {
  card: 'summary' | 'summary_large_image' | 'product';
  site: string;
  creator?: string;
  title: string;
  description: string;
  image: string;
}

export interface SEOConfig {
  meta: MetaTags;
  openGraph: OpenGraph;
  twitter: TwitterCard;
  jsonLd: Record<string, unknown>[];
}

export interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
  images?: {
    url: string;
    title?: string;
    caption?: string;
  }[];
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface PageSEO {
  slug: string;
  seo: SEOConfig;
  breadcrumbs: BreadcrumbItem[];
  lastModified: Date;
}
```

### 1.3 Servicio SEO

```typescript
// packages/web/src/services/seo.service.ts

import {
  SEOConfig,
  MetaTags,
  OpenGraph,
  SitemapEntry,
  BreadcrumbItem
} from '@businessmn/shared';
import { Producto } from '@businessmn/shared';

const SITE_URL = 'https://businessmn.pe';
const SITE_NAME = 'BusinessMN - Suplementos Premium';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

export class SEOService {

  // ============ META TAGS GENERADORES ============

  static generateProductSEO(producto: Producto): SEOConfig {
    const url = `${SITE_URL}/producto/${producto.slug || producto.sku}`;
    const image = producto.imagenes?.[0] || DEFAULT_IMAGE;

    // Generar descripción optimizada
    const description = this.generateProductDescription(producto);

    // Keywords basadas en producto
    const keywords = this.extractProductKeywords(producto);

    return {
      meta: {
        title: `${producto.nombre} | ${producto.marca} - BusinessMN`,
        description,
        keywords,
        canonical: url,
        robots: producto.activo ? 'index, follow' : 'noindex, nofollow'
      },
      openGraph: {
        title: producto.nombre,
        description,
        image,
        url,
        type: 'product',
        siteName: SITE_NAME,
        locale: 'es_PE'
      },
      twitter: {
        card: 'summary_large_image',
        site: '@businessmn_pe',
        title: producto.nombre,
        description,
        image
      },
      jsonLd: [
        this.generateProductSchema(producto),
        this.generateBreadcrumbSchema([
          { name: 'Inicio', url: SITE_URL },
          { name: producto.categoria || 'Productos', url: `${SITE_URL}/categoria/${producto.categoriaId}` },
          { name: producto.nombre, url }
        ])
      ]
    };
  }

  static generateCategorySEO(
    categoria: { id: string; nombre: string; descripcion?: string },
    productos: Producto[]
  ): SEOConfig {
    const url = `${SITE_URL}/categoria/${categoria.id}`;
    const productCount = productos.length;

    const description = categoria.descripcion ||
      `Encuentra ${productCount} productos de ${categoria.nombre}. Suplementos de alta calidad con envío a todo Perú.`;

    return {
      meta: {
        title: `${categoria.nombre} - Suplementos | BusinessMN`,
        description,
        keywords: [categoria.nombre, 'suplementos', 'peru', 'envio gratis'],
        canonical: url,
        robots: 'index, follow'
      },
      openGraph: {
        title: `${categoria.nombre} - BusinessMN`,
        description,
        image: productos[0]?.imagenes?.[0] || DEFAULT_IMAGE,
        url,
        type: 'website',
        siteName: SITE_NAME,
        locale: 'es_PE'
      },
      twitter: {
        card: 'summary_large_image',
        site: '@businessmn_pe',
        title: categoria.nombre,
        description,
        image: productos[0]?.imagenes?.[0] || DEFAULT_IMAGE
      },
      jsonLd: [
        this.generateCollectionPageSchema(categoria, productos),
        this.generateBreadcrumbSchema([
          { name: 'Inicio', url: SITE_URL },
          { name: categoria.nombre, url }
        ])
      ]
    };
  }

  // ============ GENERADORES DE DESCRIPCIÓN ============

  private static generateProductDescription(producto: Producto): string {
    const parts: string[] = [];

    // Nombre y marca
    parts.push(`${producto.nombre} de ${producto.marca}.`);

    // Presentación
    if (producto.presentacion) {
      parts.push(`Presentación: ${producto.presentacion}.`);
    }

    // Precio (si hay oferta, destacar)
    if (producto.precioOferta && producto.precioOferta < producto.precioVenta) {
      const descuento = Math.round((1 - producto.precioOferta / producto.precioVenta) * 100);
      parts.push(`¡${descuento}% de descuento! Antes S/${producto.precioVenta}, ahora S/${producto.precioOferta}.`);
    } else {
      parts.push(`Precio: S/${producto.precioVenta}.`);
    }

    // Stock
    if (producto.stockTotal > 0) {
      parts.push('Disponible con envío a todo Perú.');
    }

    // Limitar a 160 caracteres para meta description
    let description = parts.join(' ');
    if (description.length > 160) {
      description = description.substring(0, 157) + '...';
    }

    return description;
  }

  private static extractProductKeywords(producto: Producto): string[] {
    const keywords = new Set<string>();

    // Básicos
    keywords.add(producto.nombre.toLowerCase());
    keywords.add(producto.marca.toLowerCase());

    // Categoría
    if (producto.categoria) {
      keywords.add(producto.categoria.toLowerCase());
    }

    // Etiquetas
    producto.etiquetas?.forEach(tag => keywords.add(tag.toLowerCase()));

    // Keywords de SEO específicas
    keywords.add('suplementos');
    keywords.add('peru');
    keywords.add('envio gratis');
    keywords.add('original');
    keywords.add('garantizado');

    // Tipo de producto común
    const tiposComunes = ['proteina', 'creatina', 'vitamina', 'pre entreno', 'aminoacidos'];
    tiposComunes.forEach(tipo => {
      if (producto.nombre.toLowerCase().includes(tipo)) {
        keywords.add(tipo);
      }
    });

    return Array.from(keywords).slice(0, 10);
  }

  // ============ SCHEMA.ORG GENERATORS ============

  static generateProductSchema(producto: Producto): Record<string, unknown> {
    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: producto.nombre,
      description: producto.descripcion || this.generateProductDescription(producto),
      sku: producto.sku,
      brand: {
        '@type': 'Brand',
        name: producto.marca
      },
      image: producto.imagenes || [],
      offers: {
        '@type': 'Offer',
        url: `${SITE_URL}/producto/${producto.slug || producto.sku}`,
        priceCurrency: 'PEN',
        price: producto.precioOferta || producto.precioVenta,
        priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        availability: producto.stockTotal > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: SITE_NAME
        }
      }
    };

    // Agregar precio original si hay descuento
    if (producto.precioOferta && producto.precioOferta < producto.precioVenta) {
      (schema.offers as Record<string, unknown>).priceSpecification = {
        '@type': 'PriceSpecification',
        price: producto.precioOferta,
        priceCurrency: 'PEN',
        valueAddedTaxIncluded: true
      };
    }

    // Agregar reviews si existen
    if (producto.reviews && producto.reviews.length > 0) {
      const avgRating = producto.reviews.reduce((sum, r) => sum + r.rating, 0) / producto.reviews.length;
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: avgRating.toFixed(1),
        reviewCount: producto.reviews.length,
        bestRating: 5,
        worstRating: 1
      };
    }

    return schema;
  }

  static generateBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url
      }))
    };
  }

  static generateOrganizationSchema(): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'BusinessMN',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      description: 'Tienda de suplementos premium en Perú. Proteínas, vitaminas y más con envío a todo el país.',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'PE',
        addressRegion: 'Lima'
      },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+51-XXX-XXX-XXX',
        contactType: 'customer service',
        availableLanguage: 'Spanish'
      },
      sameAs: [
        'https://facebook.com/businessmn',
        'https://instagram.com/businessmn_pe',
        'https://tiktok.com/@businessmn'
      ]
    };
  }

  static generateCollectionPageSchema(
    categoria: { nombre: string },
    productos: Producto[]
  ): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: categoria.nombre,
      description: `Colección de ${categoria.nombre} - ${productos.length} productos disponibles`,
      numberOfItems: productos.length,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: productos.length,
        itemListElement: productos.slice(0, 10).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE_URL}/producto/${p.slug || p.sku}`,
          name: p.nombre
        }))
      }
    };
  }

  static generateFAQSchema(faqs: { question: string; answer: string }[]): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer
        }
      }))
    };
  }

  // ============ SITEMAP GENERATOR ============

  static async generateSitemap(productos: Producto[]): Promise<string> {
    const entries: SitemapEntry[] = [];

    // Páginas estáticas
    const staticPages = [
      { url: '/', priority: 1.0, changefreq: 'daily' as const },
      { url: '/productos', priority: 0.9, changefreq: 'daily' as const },
      { url: '/ofertas', priority: 0.9, changefreq: 'daily' as const },
      { url: '/nosotros', priority: 0.5, changefreq: 'monthly' as const },
      { url: '/contacto', priority: 0.5, changefreq: 'monthly' as const },
      { url: '/blog', priority: 0.8, changefreq: 'weekly' as const }
    ];

    staticPages.forEach(page => {
      entries.push({
        url: `${SITE_URL}${page.url}`,
        lastmod: new Date().toISOString(),
        changefreq: page.changefreq,
        priority: page.priority
      });
    });

    // Páginas de productos
    productos.forEach(producto => {
      if (producto.activo) {
        entries.push({
          url: `${SITE_URL}/producto/${producto.slug || producto.sku}`,
          lastmod: producto.fechaActualizacion?.toISOString() || new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.8,
          images: producto.imagenes?.map(img => ({ url: img, title: producto.nombre }))
        });
      }
    });

    // Generar XML
    return this.generateSitemapXML(entries);
  }

  private static generateSitemapXML(entries: SitemapEntry[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    entries.forEach(entry => {
      xml += '  <url>\n';
      xml += `    <loc>${entry.url}</loc>\n`;
      xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
      xml += `    <priority>${entry.priority}</priority>\n`;

      entry.images?.forEach(img => {
        xml += '    <image:image>\n';
        xml += `      <image:loc>${img.url}</image:loc>\n`;
        if (img.title) xml += `      <image:title>${img.title}</image:title>\n`;
        xml += '    </image:image>\n';
      });

      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  }

  // ============ ROBOTS.TXT ============

  static generateRobotsTxt(): string {
    return `# BusinessMN Robots.txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /mi-cuenta/
Disallow: /carrito/

# Sitemaps
Sitemap: ${SITE_URL}/sitemap.xml
Sitemap: ${SITE_URL}/sitemap-products.xml
Sitemap: ${SITE_URL}/sitemap-blog.xml

# Crawl-delay para bots agresivos
User-agent: AhrefsBot
Crawl-delay: 10

User-agent: SemrushBot
Crawl-delay: 10
`;
  }
}
```

### 1.4 Componente SEO Head

```tsx
// packages/web/src/components/SEO/SEOHead.tsx

import { Helmet } from 'react-helmet-async';
import { SEOConfig } from '@businessmn/shared';

interface SEOHeadProps {
  seo: SEOConfig;
}

export function SEOHead({ seo }: SEOHeadProps) {
  const { meta, openGraph, twitter, jsonLd } = seo;

  return (
    <Helmet>
      {/* Meta Tags Básicos */}
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="keywords" content={meta.keywords.join(', ')} />
      <meta name="robots" content={meta.robots || 'index, follow'} />
      <link rel="canonical" href={meta.canonical} />

      {/* Open Graph */}
      <meta property="og:title" content={openGraph.title} />
      <meta property="og:description" content={openGraph.description} />
      <meta property="og:image" content={openGraph.image} />
      <meta property="og:url" content={openGraph.url} />
      <meta property="og:type" content={openGraph.type} />
      <meta property="og:site_name" content={openGraph.siteName} />
      <meta property="og:locale" content={openGraph.locale} />

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitter.card} />
      <meta name="twitter:site" content={twitter.site} />
      <meta name="twitter:title" content={twitter.title} />
      <meta name="twitter:description" content={twitter.description} />
      <meta name="twitter:image" content={twitter.image} />

      {/* JSON-LD Structured Data */}
      {jsonLd.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </Helmet>
  );
}
```

---

## 2. SEO On-Page

### 2.1 Optimización de URLs

```typescript
// packages/shared/src/utils/slug.utils.ts

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s-]/g, '') // Solo alfanuméricos
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-') // Múltiples guiones a uno
    .replace(/^-|-$/g, ''); // Sin guiones al inicio/final
}

export function generateProductSlug(producto: {
  nombre: string;
  marca: string;
  presentacion?: string;
}): string {
  const parts = [producto.nombre, producto.marca];

  if (producto.presentacion) {
    parts.push(producto.presentacion);
  }

  return generateSlug(parts.join(' '));
}

// Ejemplo: "Whey Protein Gold Standard" + "Optimum Nutrition" + "5 lbs"
// Resultado: "whey-protein-gold-standard-optimum-nutrition-5-lbs"
```

### 2.2 Optimización de Imágenes

```typescript
// packages/web/src/components/common/OptimizedImage.tsx

import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Generar srcset para diferentes resoluciones
  const generateSrcSet = (baseSrc: string) => {
    const sizes = [320, 640, 768, 1024, 1280];
    return sizes
      .map(size => {
        // Asumiendo que usamos Firebase Storage con transformaciones
        const resizedUrl = baseSrc.includes('firebasestorage')
          ? `${baseSrc}&w=${size}`
          : baseSrc;
        return `${resizedUrl} ${size}w`;
      })
      .join(', ');
  };

  const placeholderSrc = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Crect fill='%23f3f4f6' width='100%25' height='100%25'/%3E%3C/svg%3E`;

  return (
    <picture>
      {/* WebP para navegadores modernos */}
      <source
        type="image/webp"
        srcSet={generateSrcSet(src.replace(/\.(jpg|png)$/, '.webp'))}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />

      {/* Fallback */}
      <img
        src={error ? placeholderSrc : src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </picture>
  );
}
```

### 2.3 Core Web Vitals Optimization

```typescript
// packages/web/src/utils/performance.utils.ts

// Lazy loading de componentes pesados
export const lazyLoadComponent = (
  importFn: () => Promise<{ default: React.ComponentType<unknown> }>
) => {
  return React.lazy(importFn);
};

// Preload de recursos críticos
export function preloadCriticalResources() {
  // Fuentes
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.as = 'font';
  fontLink.type = 'font/woff2';
  fontLink.href = '/fonts/inter-var.woff2';
  fontLink.crossOrigin = 'anonymous';
  document.head.appendChild(fontLink);

  // Imágenes hero
  const heroImage = document.createElement('link');
  heroImage.rel = 'preload';
  heroImage.as = 'image';
  heroImage.href = '/images/hero-banner.webp';
  document.head.appendChild(heroImage);
}

// Intersection Observer para lazy loading
export function createLazyObserver(
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
) {
  return new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry);
        }
      });
    },
    {
      rootMargin: '100px',
      threshold: 0.1,
      ...options
    }
  );
}

// Reportar Web Vitals
export function reportWebVitals() {
  if ('web-vital' in window) {
    import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
      onCLS(console.log);
      onFID(console.log);
      onFCP(console.log);
      onLCP(console.log);
      onTTFB(console.log);
    });
  }
}
```

---

## 3. Datos Estructurados (Schema.org)

### 3.1 Schemas Adicionales

```typescript
// packages/web/src/services/schema.service.ts

export class SchemaService {

  // Schema para ofertas especiales
  static generateOfferSchema(producto: Producto): Record<string, unknown> {
    if (!producto.precioOferta) return {};

    return {
      '@context': 'https://schema.org',
      '@type': 'Offer',
      name: `Oferta: ${producto.nombre}`,
      description: `${producto.nombre} con descuento especial`,
      price: producto.precioOferta,
      priceCurrency: 'PEN',
      priceValidUntil: producto.fechaFinOferta?.toISOString().split('T')[0],
      availability: 'https://schema.org/InStock',
      itemOffered: {
        '@type': 'Product',
        name: producto.nombre,
        brand: producto.marca
      }
    };
  }

  // Schema para artículos de blog
  static generateArticleSchema(article: {
    title: string;
    content: string;
    author: string;
    publishDate: Date;
    updateDate?: Date;
    image: string;
    url: string;
  }): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.content.substring(0, 160),
      image: article.image,
      author: {
        '@type': 'Person',
        name: article.author
      },
      publisher: {
        '@type': 'Organization',
        name: 'BusinessMN',
        logo: {
          '@type': 'ImageObject',
          url: 'https://businessmn.pe/logo.png'
        }
      },
      datePublished: article.publishDate.toISOString(),
      dateModified: (article.updateDate || article.publishDate).toISOString(),
      mainEntityOfPage: article.url
    };
  }

  // Schema para búsqueda del sitio
  static generateSiteSearchSchema(): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'BusinessMN',
      url: 'https://businessmn.pe',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://businessmn.pe/buscar?q={search_term_string}'
        },
        'query-input': 'required name=search_term_string'
      }
    };
  }

  // Schema para tienda local
  static generateLocalBusinessSchema(): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: 'BusinessMN',
      description: 'Tienda de suplementos deportivos y nutricionales',
      url: 'https://businessmn.pe',
      telephone: '+51-XXX-XXX-XXX',
      email: 'ventas@businessmn.pe',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Dirección de la tienda',
        addressLocality: 'Lima',
        addressRegion: 'Lima',
        postalCode: '15000',
        addressCountry: 'PE'
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: -12.0464,
        longitude: -77.0428
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '18:00'
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: 'Saturday',
          opens: '09:00',
          closes: '13:00'
        }
      ],
      priceRange: '$$'
    };
  }
}
```

---

## 4. Integraciones de Marketing

### 4.1 Google Tag Manager

```typescript
// packages/web/src/services/gtm.service.ts

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

export class GTMService {
  private static GTM_ID = 'GTM-XXXXXXX';

  static initialize() {
    // Inicializar dataLayer
    window.dataLayer = window.dataLayer || [];

    // Insertar script GTM
    const script = document.createElement('script');
    script.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${this.GTM_ID}');
    `;
    document.head.appendChild(script);
  }

  // ============ EVENTOS E-COMMERCE GA4 ============

  static viewItem(producto: Producto) {
    window.dataLayer.push({
      event: 'view_item',
      ecommerce: {
        currency: 'PEN',
        value: producto.precioOferta || producto.precioVenta,
        items: [{
          item_id: producto.sku,
          item_name: producto.nombre,
          item_brand: producto.marca,
          item_category: producto.categoria,
          price: producto.precioOferta || producto.precioVenta,
          quantity: 1
        }]
      }
    });
  }

  static viewItemList(productos: Producto[], listName: string) {
    window.dataLayer.push({
      event: 'view_item_list',
      ecommerce: {
        item_list_id: listName.toLowerCase().replace(/\s/g, '_'),
        item_list_name: listName,
        items: productos.map((p, index) => ({
          item_id: p.sku,
          item_name: p.nombre,
          item_brand: p.marca,
          item_category: p.categoria,
          price: p.precioOferta || p.precioVenta,
          index: index,
          quantity: 1
        }))
      }
    });
  }

  static addToCart(producto: Producto, cantidad: number) {
    window.dataLayer.push({
      event: 'add_to_cart',
      ecommerce: {
        currency: 'PEN',
        value: (producto.precioOferta || producto.precioVenta) * cantidad,
        items: [{
          item_id: producto.sku,
          item_name: producto.nombre,
          item_brand: producto.marca,
          item_category: producto.categoria,
          price: producto.precioOferta || producto.precioVenta,
          quantity: cantidad
        }]
      }
    });
  }

  static removeFromCart(producto: Producto, cantidad: number) {
    window.dataLayer.push({
      event: 'remove_from_cart',
      ecommerce: {
        currency: 'PEN',
        value: (producto.precioOferta || producto.precioVenta) * cantidad,
        items: [{
          item_id: producto.sku,
          item_name: producto.nombre,
          price: producto.precioOferta || producto.precioVenta,
          quantity: cantidad
        }]
      }
    });
  }

  static beginCheckout(items: CartItem[], total: number) {
    window.dataLayer.push({
      event: 'begin_checkout',
      ecommerce: {
        currency: 'PEN',
        value: total,
        items: items.map(item => ({
          item_id: item.productoId,
          item_name: item.nombre,
          price: item.precioUnitario,
          quantity: item.cantidad
        }))
      }
    });
  }

  static addPaymentInfo(paymentMethod: string, total: number) {
    window.dataLayer.push({
      event: 'add_payment_info',
      ecommerce: {
        currency: 'PEN',
        value: total,
        payment_type: paymentMethod
      }
    });
  }

  static purchase(order: {
    id: string;
    total: number;
    shipping: number;
    items: CartItem[];
  }) {
    window.dataLayer.push({
      event: 'purchase',
      ecommerce: {
        transaction_id: order.id,
        value: order.total,
        currency: 'PEN',
        shipping: order.shipping,
        items: order.items.map(item => ({
          item_id: item.productoId,
          item_name: item.nombre,
          price: item.precioUnitario,
          quantity: item.cantidad
        }))
      }
    });
  }

  // ============ EVENTOS PERSONALIZADOS ============

  static searchProducts(query: string, resultsCount: number) {
    window.dataLayer.push({
      event: 'search',
      search_term: query,
      results_count: resultsCount
    });
  }

  static chatWithAI(action: 'open' | 'message' | 'close') {
    window.dataLayer.push({
      event: 'ai_chat_interaction',
      chat_action: action
    });
  }

  static viewPromotion(promotion: {
    id: string;
    name: string;
    creative?: string;
  }) {
    window.dataLayer.push({
      event: 'view_promotion',
      ecommerce: {
        items: [{
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          creative_name: promotion.creative
        }]
      }
    });
  }

  static selectPromotion(promotion: {
    id: string;
    name: string;
  }) {
    window.dataLayer.push({
      event: 'select_promotion',
      ecommerce: {
        items: [{
          promotion_id: promotion.id,
          promotion_name: promotion.name
        }]
      }
    });
  }
}
```

### 4.2 Meta Pixel (Facebook/Instagram)

```typescript
// packages/web/src/services/metaPixel.service.ts

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

export class MetaPixelService {
  private static PIXEL_ID = 'XXXXXXXXXXXXXXXXX';

  static initialize() {
    // Insertar script Meta Pixel
    const script = document.createElement('script');
    script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${this.PIXEL_ID}');
      fbq('track', 'PageView');
    `;
    document.head.appendChild(script);
  }

  static viewContent(producto: Producto) {
    window.fbq('track', 'ViewContent', {
      content_ids: [producto.sku],
      content_name: producto.nombre,
      content_type: 'product',
      content_category: producto.categoria,
      value: producto.precioOferta || producto.precioVenta,
      currency: 'PEN'
    });
  }

  static addToCart(producto: Producto, cantidad: number) {
    window.fbq('track', 'AddToCart', {
      content_ids: [producto.sku],
      content_name: producto.nombre,
      content_type: 'product',
      value: (producto.precioOferta || producto.precioVenta) * cantidad,
      currency: 'PEN'
    });
  }

  static initiateCheckout(items: CartItem[], total: number) {
    window.fbq('track', 'InitiateCheckout', {
      content_ids: items.map(i => i.productoId),
      content_type: 'product',
      num_items: items.reduce((sum, i) => sum + i.cantidad, 0),
      value: total,
      currency: 'PEN'
    });
  }

  static purchase(order: { id: string; total: number; items: CartItem[] }) {
    window.fbq('track', 'Purchase', {
      content_ids: order.items.map(i => i.productoId),
      content_type: 'product',
      value: order.total,
      currency: 'PEN',
      num_items: order.items.reduce((sum, i) => sum + i.cantidad, 0)
    });
  }

  static search(query: string) {
    window.fbq('track', 'Search', {
      search_string: query
    });
  }

  static lead(formName: string) {
    window.fbq('track', 'Lead', {
      content_name: formName
    });
  }

  // Conversiones personalizadas
  static customEvent(eventName: string, data?: Record<string, unknown>) {
    window.fbq('trackCustom', eventName, data);
  }
}
```

### 4.3 Google Ads Conversion Tracking

```typescript
// packages/web/src/services/googleAds.service.ts

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

export class GoogleAdsService {
  private static ADS_ID = 'AW-XXXXXXXXXX';

  static initialize() {
    // gtag ya debe estar inicializado por GTM o GA4
    window.gtag('config', this.ADS_ID);
  }

  static trackConversion(
    conversionLabel: string,
    value?: number,
    orderId?: string
  ) {
    window.gtag('event', 'conversion', {
      send_to: `${this.ADS_ID}/${conversionLabel}`,
      value: value,
      currency: 'PEN',
      transaction_id: orderId
    });
  }

  // Conversiones específicas
  static purchaseConversion(order: { id: string; total: number }) {
    this.trackConversion('PURCHASE_LABEL', order.total, order.id);
  }

  static leadConversion() {
    this.trackConversion('LEAD_LABEL');
  }

  static addToCartConversion(value: number) {
    this.trackConversion('ADD_TO_CART_LABEL', value);
  }

  // Remarketing dinámico
  static sendRemarketingEvent(
    eventType: 'view_item' | 'add_to_cart' | 'purchase',
    items: { id: string; price: number }[]
  ) {
    window.gtag('event', eventType, {
      send_to: this.ADS_ID,
      items: items.map(item => ({
        id: item.id,
        google_business_vertical: 'retail'
      }))
    });
  }
}
```

---

## 5. Landing Pages Dinámicas

### 5.1 Sistema de Landing Pages

```typescript
// packages/shared/src/types/landing.types.ts

export interface LandingPage {
  id: string;
  slug: string;
  titulo: string;
  subtitulo?: string;

  // SEO
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };

  // Hero Section
  hero: {
    imagen: string;
    imagenMobile?: string;
    cta: {
      texto: string;
      url: string;
      color?: string;
    };
    badge?: string;
  };

  // Productos destacados
  productosDestacados: string[]; // IDs de productos

  // Secciones dinámicas
  secciones: LandingSection[];

  // Configuración
  config: {
    mostrarChat: boolean;
    mostrarPopupSalida: boolean;
    timerOferta?: {
      fechaFin: Date;
      mensaje: string;
    };
    codigoDescuento?: string;
  };

  // UTM tracking
  utmParams?: {
    source: string;
    medium: string;
    campaign: string;
  };

  // Estado
  activa: boolean;
  fechaInicio?: Date;
  fechaFin?: Date;

  // Métricas
  visitas: number;
  conversiones: number;
}

export type LandingSectionType =
  | 'productos_grid'
  | 'beneficios'
  | 'testimonios'
  | 'faq'
  | 'comparativa'
  | 'video'
  | 'formulario'
  | 'countdown';

export interface LandingSection {
  id: string;
  tipo: LandingSectionType;
  titulo?: string;
  contenido: Record<string, unknown>;
  orden: number;
}
```

### 5.2 Componentes de Landing

```tsx
// packages/web/src/components/Landing/LandingHero.tsx

import { motion } from 'framer-motion';
import { LandingPage } from '@businessmn/shared';

interface LandingHeroProps {
  landing: LandingPage;
}

export function LandingHero({ landing }: LandingHeroProps) {
  const { hero, titulo, subtitulo } = landing;

  return (
    <section className="relative min-h-[80vh] flex items-center">
      {/* Background Image */}
      <div className="absolute inset-0">
        <picture>
          <source
            media="(max-width: 768px)"
            srcSet={hero.imagenMobile || hero.imagen}
          />
          <img
            src={hero.imagen}
            alt={titulo}
            className="w-full h-full object-cover"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          {hero.badge && (
            <span className="inline-block px-4 py-2 bg-yellow-500 text-black font-bold rounded-full mb-6">
              {hero.badge}
            </span>
          )}

          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            {titulo}
          </h1>

          {subtitulo && (
            <p className="text-xl text-gray-200 mb-8">
              {subtitulo}
            </p>
          )}

          <motion.a
            href={hero.cta.url}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block px-8 py-4 text-lg font-bold rounded-lg transition-colors"
            style={{ backgroundColor: hero.cta.color || '#22c55e' }}
          >
            {hero.cta.texto}
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
```

```tsx
// packages/web/src/components/Landing/CountdownTimer.tsx

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  fechaFin: Date;
  mensaje: string;
}

export function CountdownTimer({ fechaFin, mensaje }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const difference = new Date(fechaFin).getTime() - Date.now();

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60)
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [fechaFin]);

  const isExpired = Object.values(timeLeft).every(v => v === 0);

  if (isExpired) return null;

  return (
    <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white py-3 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 flex-wrap">
        <span className="font-medium">{mensaje}</span>

        <div className="flex gap-2">
          {Object.entries(timeLeft).map(([unit, value]) => (
            <div key={unit} className="flex flex-col items-center">
              <span className="text-2xl font-bold bg-black/20 px-3 py-1 rounded">
                {String(value).padStart(2, '0')}
              </span>
              <span className="text-xs mt-1">
                {unit === 'days' ? 'Días' :
                 unit === 'hours' ? 'Hrs' :
                 unit === 'minutes' ? 'Min' : 'Seg'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

```tsx
// packages/web/src/components/Landing/ExitPopup.tsx

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExitPopupProps {
  titulo: string;
  subtitulo: string;
  codigoDescuento?: string;
  imagenProducto?: string;
  ctaTexto: string;
  ctaUrl: string;
}

export function ExitPopup({
  titulo,
  subtitulo,
  codigoDescuento,
  imagenProducto,
  ctaTexto,
  ctaUrl
}: ExitPopupProps) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Verificar si ya fue mostrado en esta sesión
    if (sessionStorage.getItem('exitPopupShown')) {
      return;
    }

    const handleMouseLeave = (e: MouseEvent) => {
      // Detectar si el mouse sale por arriba (intención de cerrar)
      if (e.clientY <= 0 && !dismissed) {
        setShow(true);
        sessionStorage.setItem('exitPopupShown', 'true');
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [dismissed]);

  const handleClose = () => {
    setShow(false);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header con imagen */}
            {imagenProducto && (
              <div className="relative h-48 bg-gradient-to-br from-green-500 to-emerald-600">
                <img
                  src={imagenProducto}
                  alt="Oferta especial"
                  className="absolute bottom-0 right-4 h-56 object-contain"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-yellow-400 text-black font-bold px-3 py-1 rounded-full text-sm">
                    ¡ESPERA!
                  </span>
                </div>
              </div>
            )}

            {/* Contenido */}
            <div className="p-6 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {titulo}
              </h3>
              <p className="text-gray-600 mb-4">
                {subtitulo}
              </p>

              {codigoDescuento && (
                <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-500 mb-1">Usa el código:</p>
                  <p className="text-2xl font-mono font-bold text-green-600">
                    {codigoDescuento}
                  </p>
                </div>
              )}

              <a
                href={ctaUrl}
                className="block w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {ctaTexto}
              </a>

              <button
                onClick={handleClose}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700"
              >
                No gracias, prefiero pagar precio completo
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## 6. Email Marketing

### 6.1 Servicio de Email Marketing

```typescript
// packages/functions/src/services/emailMarketing.service.ts

import * as functions from 'firebase-functions';

interface EmailTemplate {
  id: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

interface EmailRecipient {
  email: string;
  nombre: string;
  variables?: Record<string, string>;
}

export class EmailMarketingService {

  // ============ BREVO (ex-Sendinblue) INTEGRATION ============

  private static BREVO_API_KEY = functions.config().brevo?.api_key;
  private static BREVO_API_URL = 'https://api.brevo.com/v3';

  static async sendTransactionalEmail(
    templateId: number,
    recipient: EmailRecipient,
    params?: Record<string, string>
  ) {
    const response = await fetch(`${this.BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': this.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        templateId,
        to: [{ email: recipient.email, name: recipient.nombre }],
        params: {
          ...params,
          NOMBRE: recipient.nombre
        }
      })
    });

    return response.json();
  }

  // ============ FLUJOS AUTOMATIZADOS ============

  // 1. Bienvenida (cuando se registra)
  static async sendWelcomeEmail(cliente: {
    email: string;
    nombre: string;
    codigoDescuento?: string;
  }) {
    return this.sendTransactionalEmail(1, {
      email: cliente.email,
      nombre: cliente.nombre
    }, {
      CODIGO_DESCUENTO: cliente.codigoDescuento || 'BIENVENIDO10'
    });
  }

  // 2. Carrito abandonado
  static async sendAbandonedCartEmail(
    cliente: { email: string; nombre: string },
    carrito: { items: CartItem[]; total: number; urlRecuperacion: string }
  ) {
    const productosHtml = carrito.items.map(item => `
      <tr>
        <td><img src="${item.imagen}" width="80" /></td>
        <td>${item.nombre}</td>
        <td>${item.cantidad}</td>
        <td>S/${item.precioUnitario}</td>
      </tr>
    `).join('');

    return this.sendTransactionalEmail(2, {
      email: cliente.email,
      nombre: cliente.nombre
    }, {
      PRODUCTOS_HTML: productosHtml,
      TOTAL: `S/${carrito.total.toFixed(2)}`,
      URL_CARRITO: carrito.urlRecuperacion
    });
  }

  // 3. Confirmación de compra
  static async sendOrderConfirmationEmail(
    cliente: { email: string; nombre: string },
    orden: {
      id: string;
      items: CartItem[];
      total: number;
      direccion: string;
      fechaEstimada: string;
    }
  ) {
    return this.sendTransactionalEmail(3, {
      email: cliente.email,
      nombre: cliente.nombre
    }, {
      ORDEN_ID: orden.id,
      TOTAL: `S/${orden.total.toFixed(2)}`,
      DIRECCION: orden.direccion,
      FECHA_ENTREGA: orden.fechaEstimada
    });
  }

  // 4. Recordatorio de recompra
  static async sendReorderReminderEmail(
    cliente: { email: string; nombre: string },
    producto: {
      nombre: string;
      imagen: string;
      ultimaCompra: Date;
      url: string;
    }
  ) {
    const diasDesdeCompra = Math.floor(
      (Date.now() - producto.ultimaCompra.getTime()) / (1000 * 60 * 60 * 24)
    );

    return this.sendTransactionalEmail(4, {
      email: cliente.email,
      nombre: cliente.nombre
    }, {
      PRODUCTO_NOMBRE: producto.nombre,
      PRODUCTO_IMAGEN: producto.imagen,
      DIAS_DESDE_COMPRA: diasDesdeCompra.toString(),
      URL_PRODUCTO: producto.url
    });
  }

  // 5. Post-compra (pedir review)
  static async sendReviewRequestEmail(
    cliente: { email: string; nombre: string },
    producto: {
      nombre: string;
      imagen: string;
      urlReview: string;
    }
  ) {
    return this.sendTransactionalEmail(5, {
      email: cliente.email,
      nombre: cliente.nombre
    }, {
      PRODUCTO_NOMBRE: producto.nombre,
      PRODUCTO_IMAGEN: producto.imagen,
      URL_REVIEW: producto.urlReview
    });
  }

  // ============ CAMPAÑAS MASIVAS ============

  static async createCampaign(campaign: {
    nombre: string;
    asunto: string;
    htmlContent: string;
    listaIds: number[];
    scheduledAt?: Date;
  }) {
    const response = await fetch(`${this.BREVO_API_URL}/emailCampaigns`, {
      method: 'POST',
      headers: {
        'api-key': this.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: campaign.nombre,
        subject: campaign.asunto,
        sender: { name: 'BusinessMN', email: 'ventas@businessmn.pe' },
        htmlContent: campaign.htmlContent,
        recipients: { listIds: campaign.listaIds },
        scheduledAt: campaign.scheduledAt?.toISOString()
      })
    });

    return response.json();
  }

  // ============ GESTIÓN DE CONTACTOS ============

  static async addContact(contact: {
    email: string;
    nombre: string;
    telefono?: string;
    attributes?: Record<string, unknown>;
    listIds?: number[];
  }) {
    const response = await fetch(`${this.BREVO_API_URL}/contacts`, {
      method: 'POST',
      headers: {
        'api-key': this.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: contact.email,
        attributes: {
          NOMBRE: contact.nombre,
          TELEFONO: contact.telefono,
          ...contact.attributes
        },
        listIds: contact.listIds || [1], // Lista principal
        updateEnabled: true
      })
    });

    return response.json();
  }

  static async updateContactSegment(
    email: string,
    segmento: 'vip' | 'frecuente' | 'inactivo' | 'nuevo'
  ) {
    const segmentListMap = {
      vip: 2,
      frecuente: 3,
      inactivo: 4,
      nuevo: 5
    };

    return fetch(`${this.BREVO_API_URL}/contacts/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: {
        'api-key': this.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        listIds: [1, segmentListMap[segmento]],
        attributes: {
          SEGMENTO: segmento,
          FECHA_SEGMENTACION: new Date().toISOString()
        }
      })
    });
  }
}
```

### 6.2 Popup de Captura de Leads

```tsx
// packages/web/src/components/Marketing/LeadCapturePopup.tsx

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeadCapturePopupProps {
  delay?: number; // ms antes de mostrar
  titulo: string;
  subtitulo: string;
  incentivo: string; // ej: "10% de descuento"
  onSubmit: (email: string, nombre: string) => Promise<void>;
}

export function LeadCapturePopup({
  delay = 5000,
  titulo,
  subtitulo,
  incentivo,
  onSubmit
}: LeadCapturePopupProps) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // No mostrar si ya se suscribió o cerró
    if (localStorage.getItem('leadCaptureCompleted') ||
        sessionStorage.getItem('leadCaptureDismissed')) {
      return;
    }

    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit(email, nombre);
      setSuccess(true);
      localStorage.setItem('leadCaptureCompleted', 'true');

      // Cerrar después de mostrar éxito
      setTimeout(() => setShow(false), 3000);
    } catch (error) {
      console.error('Error subscribing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShow(false);
    sessionStorage.setItem('leadCaptureDismissed', 'true');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
          >
            {!success ? (
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-500 p-6 text-white text-center relative">
                  <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-white/80 hover:text-white"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div className="inline-block bg-yellow-400 text-black font-bold px-4 py-1 rounded-full text-sm mb-4">
                    {incentivo}
                  </div>

                  <h3 className="text-2xl font-bold mb-2">{titulo}</h3>
                  <p className="text-green-100">{subtitulo}</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                  >
                    {loading ? 'Enviando...' : 'Obtener mi descuento'}
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    Al suscribirte aceptas recibir emails promocionales.
                    Puedes cancelar en cualquier momento.
                  </p>
                </form>
              </>
            ) : (
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  ¡Listo!
                </h3>
                <p className="text-gray-600">
                  Revisa tu email para obtener tu código de descuento.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

Continuaré con las partes restantes en un siguiente documento.

