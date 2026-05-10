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
  activa: boolean;
  orden: number;
}

/**
 * Categorias pre-pobladas por bloque (seed)
 */
export const CATEGORIAS_SEED: Record<BloqueCosto, { nombre: string; subcategorias?: string[] }[]> = {
  producto: [
    { nombre: 'Transporte', subcategorias: ['Flete viajero', 'Flete courier', 'Flete maritimo'] },
    { nombre: 'Aranceles', subcategorias: ['Impuesto importacion', 'Agente aduanero'] },
    { nombre: 'Seguros', subcategorias: ['Seguro de carga'] },
    { nombre: 'Manipuleo', subcategorias: ['Recojo local', 'Almacenaje temporal'] },
  ],
  venta: [
    { nombre: 'Comisiones', subcategorias: ['Comision ML', 'Comision pasarela', 'Comision vendedor'] },
    { nombre: 'Distribucion', subcategorias: ['Delivery local', 'Courier local'] },
    { nombre: 'Empaque', subcategorias: ['Kit de empaque', 'Material extra'] },
    { nombre: 'Marketing directo', subcategorias: ['Descuento por venta', 'Promocion'] },
  ],
  periodo: [
    { nombre: 'Personal', subcategorias: ['Sueldos', 'Comisiones fijas', 'Capacitacion'] },
    { nombre: 'Local', subcategorias: ['Alquiler', 'Servicios (luz/agua/internet)', 'Mantenimiento'] },
    { nombre: 'Profesionales', subcategorias: ['Contador', 'Abogado', 'Consultorias'] },
    { nombre: 'Tecnologia', subcategorias: ['Software/SaaS', 'Hosting', 'Dominio'] },
    { nombre: 'Operativos', subcategorias: ['Movilidad', 'Suministros oficina', 'Herramientas'] },
    { nombre: 'Financieros', subcategorias: ['Comisiones bancarias', 'Intereses', 'ITF'] },
    { nombre: 'Marketing general', subcategorias: ['Publicidad online', 'Material POP', 'Eventos'] },
  ],
};
