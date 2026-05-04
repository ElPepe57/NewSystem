/**
 * productoMarketingIA.service.ts · S3.2 · DEUDA-IA-001 · 2026-05-03
 *
 * Wrapper del Cloud Function `generarDescripcionProducto` (Gemini Flash 2.0).
 * Convierte el response plano de la CF en un objeto `DescripcionMarketing`
 * con audit metadata (fuente='ia', generadoEn=now, generadoPor=userId).
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { Timestamp } from 'firebase/firestore';
import type {
  DescripcionMarketing,
  Producto,
  ProductoFormData,
  ContenidoNeto,
} from '../types/producto.types';

const functions = getFunctions();

interface GenerarDescripcionRequest {
  lineaCodigo?: 'SKC' | 'SUP' | '';
  marca?: string;
  nombreComercial?: string;
  paisOrigen?: string;
  atributosSkincare?: any;
  atributosSuplementos?: any;
  contenidoNeto?: { valor: number; unidad: string };
  categorias?: string[];
  etiquetas?: string[];
  pesoLibras?: number;
}

interface GenerarDescripcionResponseRaw {
  tagline: string;
  beneficios: string[];
  descripcion: string;
  /** S3.4 · long-tail keywords SEO 5-10 frases */
  keywordsSEO: string[];
}

/**
 * Llama la CF y construye el DescripcionMarketing con audit.
 *
 * @param producto · datos del producto (puede ser Producto existente o ProductoFormData)
 * @param userId · uid del usuario · queda en `generadoPor`
 * @param categoriasNombres · opcional · nombres de categorías para enriquecer el prompt
 * @param etiquetasNombres · opcional · nombres de etiquetas
 * @returns DescripcionMarketing con fuente='ia' en los 3 niveles
 */
export async function generarDescripcionMarketing(
  producto: Partial<Producto & ProductoFormData> & {
    lineaCodigo?: 'SKC' | 'SUP' | '';
  },
  userId: string,
  categoriasNombres?: string[],
  etiquetasNombres?: string[],
): Promise<DescripcionMarketing> {
  const payload: GenerarDescripcionRequest = {
    lineaCodigo: producto.lineaCodigo,
    marca: producto.marca,
    nombreComercial: producto.nombreComercial,
    paisOrigen: producto.paisOrigen,
    atributosSkincare: producto.atributosSkincare,
    atributosSuplementos: producto.atributosSuplementos,
    contenidoNeto: producto.contenidoNeto as ContenidoNeto | undefined,
    categorias: categoriasNombres,
    etiquetas: etiquetasNombres,
    pesoLibras: producto.pesoLibras,
  };

  const fn = httpsCallable<GenerarDescripcionRequest, GenerarDescripcionResponseRaw>(
    functions,
    'generarDescripcionProducto',
  );

  const result = await fn(payload);
  const raw = result.data;

  if (
    !raw
    || typeof raw.tagline !== 'string'
    || !Array.isArray(raw.beneficios)
    || typeof raw.descripcion !== 'string'
  ) {
    throw new Error('Respuesta inválida del Cloud Function');
  }

  const ahora = Timestamp.now();
  const audit = (texto: any) => ({
    texto,
    fuente: 'ia' as const,
    generadoEn: ahora,
    generadoPor: userId,
  });

  return {
    tagline: audit(raw.tagline),
    beneficios: audit(raw.beneficios),
    descripcion: audit(raw.descripcion),
    // S3.4 · keywordsSEO opcional (compat con respuestas legacy sin el campo)
    keywordsSEO: Array.isArray(raw.keywordsSEO) && raw.keywordsSEO.length > 0
      ? audit(raw.keywordsSEO)
      : undefined,
  };
}
