import { Timestamp } from 'firebase/firestore';

/**
 * Bloque de costo — las 3 cajas del modelo de costos
 * - producto: Costos directos de traer el producto al país (landed costs en envios) · IMPACTA CTRU
 * - venta: Costos directos por cada venta (comision ML, delivery, empaque) · NO impacta CTRU · resta margen contribución
 * - periodo: Gastos fijos del mes (planilla, alquiler, servicios) · NO impacta CTRU · resta margen operativo
 *
 * Renaming chk5.A1 (S3.6 M1.bis · Cost Intelligence):
 *   ANTES: 'importacion' (legacy técnico)
 *   AHORA: 'producto' (canónico user-facing · alineado con mockup gastoform-v2-3-niveles-s58f.html)
 */
export type BloqueCosto = 'producto' | 'venta' | 'periodo';

/**
 * Categoria de costo/gasto — maestro dinamico editable desde UI
 * Reemplaza la nomenclatura GA/GD/GV/GO con un arbol flexible.
 */
export interface CategoriaCosto {
  id: string;
  codigo: string;                      // CC-001, CC-002, etc.
  nombre: string;
  descripcion?: string;
  bloque: BloqueCosto;

  // Jerarquia: permite sub-categorias
  categoriaPadreId?: string;
  categoriaPadreNombre?: string;       // Desnormalizado
  nivel: number;                       // 0 = raiz, 1 = sub-categoria

  // Visual (chk5.A2 · canon mockup gastoform-v2-3-niveles-s58f.html)
  icono?: string;                      // Emoji opcional · ej '👥', '🏢', '⚡' · fallback a default por bloque

  // Configuracion
  activa: boolean;
  orden: number;                       // Para ordenar en UI

  // Auditoria
  creadoPor: string;
  fechaCreacion: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;
}

/**
 * Datos para crear/editar una categoria de costo
 */
export interface CategoriaCostoFormData {
  nombre: string;
  descripcion?: string;
  bloque: BloqueCosto;
  categoriaPadreId?: string;
  icono?: string;                      // Emoji opcional · ver CategoriaCosto.icono
  activa: boolean;
  orden: number;
}

/**
 * Categorias pre-pobladas por bloque (seed) · con iconos canónicos
 */
export interface CategoriaSeedItem {
  nombre: string;
  icono?: string;                                                  // Emoji canon (chk5.A2)
  subcategorias?: { nombre: string; icono?: string }[];
}

export const CATEGORIAS_SEED: Record<BloqueCosto, CategoriaSeedItem[]> = {
  producto: [
    { nombre: 'Transporte',  icono: '🚚', subcategorias: [
      { nombre: 'Flete viajero',  icono: '✈️' },
      { nombre: 'Flete courier',  icono: '📦' },
      { nombre: 'Flete maritimo', icono: '🚢' },
    ]},
    { nombre: 'Aranceles',   icono: '🛃', subcategorias: [
      { nombre: 'Impuesto importacion', icono: '📋' },
      { nombre: 'Agente aduanero',      icono: '👨‍💼' },
    ]},
    { nombre: 'Seguros',     icono: '🛡️', subcategorias: [
      { nombre: 'Seguro de carga', icono: '🛡️' },
    ]},
    { nombre: 'Manipuleo',   icono: '📥', subcategorias: [
      { nombre: 'Recojo local',         icono: '🚛' },
      { nombre: 'Almacenaje temporal',  icono: '🏬' },
    ]},
  ],
  venta: [
    { nombre: 'Comisiones',         icono: '💰', subcategorias: [
      { nombre: 'Comision ML',         icono: '🛍️' },
      { nombre: 'Comision pasarela',   icono: '💳' },
      { nombre: 'Comision vendedor',   icono: '🤝' },
    ]},
    { nombre: 'Distribucion',       icono: '🚐', subcategorias: [
      { nombre: 'Delivery local',  icono: '🛵' },
      { nombre: 'Courier local',   icono: '📮' },
    ]},
    { nombre: 'Empaque',            icono: '📦', subcategorias: [
      { nombre: 'Kit de empaque',  icono: '🎁' },
      { nombre: 'Material extra',  icono: '📎' },
    ]},
    { nombre: 'Marketing directo',  icono: '📣', subcategorias: [
      { nombre: 'Descuento por venta', icono: '🏷️' },
      { nombre: 'Promocion',           icono: '🎯' },
    ]},
  ],
  periodo: [
    { nombre: 'Personal',          icono: '👥', subcategorias: [
      { nombre: 'Sueldos',           icono: '💵' },
      { nombre: 'Comisiones fijas',  icono: '💰' },
      { nombre: 'Capacitacion',      icono: '📚' },
    ]},
    { nombre: 'Local',             icono: '🏢', subcategorias: [
      { nombre: 'Alquiler',                    icono: '🏠' },
      { nombre: 'Servicios (luz/agua/internet)', icono: '💧' },
      { nombre: 'Mantenimiento',               icono: '🔧' },
    ]},
    { nombre: 'Profesionales',     icono: '⚖️', subcategorias: [
      { nombre: 'Contador',     icono: '🧮' },
      { nombre: 'Abogado',      icono: '⚖️' },
      { nombre: 'Consultorias', icono: '💼' },
    ]},
    { nombre: 'Tecnologia',        icono: '💻', subcategorias: [
      { nombre: 'Software/SaaS', icono: '☁️' },
      { nombre: 'Hosting',       icono: '🖥️' },
      { nombre: 'Dominio',       icono: '🌐' },
    ]},
    { nombre: 'Operativos',        icono: '🔧', subcategorias: [
      { nombre: 'Movilidad',             icono: '🚗' },
      { nombre: 'Suministros oficina',   icono: '📎' },
      { nombre: 'Herramientas',          icono: '🛠️' },
    ]},
    { nombre: 'Financieros',       icono: '🏦', subcategorias: [
      { nombre: 'Comisiones bancarias', icono: '💳' },
      { nombre: 'Intereses',            icono: '📈' },
      { nombre: 'ITF',                  icono: '🏛️' },
    ]},
    { nombre: 'Marketing general', icono: '📣', subcategorias: [
      { nombre: 'Publicidad online', icono: '📱' },
      { nombre: 'Material POP',      icono: '🪧' },
      { nombre: 'Eventos',           icono: '🎉' },
    ]},
  ],
};
