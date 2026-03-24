import { useMemo } from 'react';
import type { Producto } from '../types/producto.types';
import { normalizarTexto } from '../lib/textUtils';

export interface VarianteCandidato {
  producto: Producto;
  confianza: 'alta' | 'media';
  camposDiferentes: string[];
}

/**
 * Hook que detecta productos candidatos a ser padre de una variante.
 * Se activa cuando marca + nombreComercial coinciden con productos existentes.
 *
 * @param productos - Lista completa de productos existentes
 * @param marca - Marca del producto en creación
 * @param nombreComercial - Nombre del producto en creación
 * @param contenido - Contenido del producto (campo diferenciador principal)
 * @param dosaje - Dosaje del producto
 * @param sabor - Sabor del producto
 */
export function useDetectarVarianteCandidatos(
  productos: Producto[],
  marca: string,
  nombreComercial: string,
  contenido?: string,
  dosaje?: string,
  sabor?: string,
): VarianteCandidato[] {
  return useMemo(() => {
    if (!marca || !nombreComercial || marca.length < 2 || nombreComercial.length < 2) {
      return [];
    }

    const marcaNorm = normalizarTexto(marca);
    const nombreNorm = normalizarTexto(nombreComercial);

    const candidatos: VarianteCandidato[] = [];

    for (const p of productos) {
      // Skip variants (only match against parents or independent products)
      if (p.esVariante) continue;
      // Skip eliminated
      if (p.estado === 'eliminado') continue;

      const pMarcaNorm = normalizarTexto(p.marca || '');
      const pNombreNorm = normalizarTexto(p.nombreComercial || '');

      // Exact match on marca + nombre
      if (pMarcaNorm === marcaNorm && pNombreNorm === nombreNorm) {
        // Determine what's different
        const camposDiferentes: string[] = [];
        if (contenido && p.contenido && normalizarTexto(contenido) !== normalizarTexto(p.contenido)) {
          camposDiferentes.push('contenido');
        }
        if (dosaje && p.dosaje && normalizarTexto(dosaje) !== normalizarTexto(p.dosaje)) {
          camposDiferentes.push('dosaje');
        }
        if (sabor && p.sabor && normalizarTexto(sabor) !== normalizarTexto(p.sabor)) {
          camposDiferentes.push('sabor');
        }

        candidatos.push({
          producto: p,
          confianza: 'alta',
          camposDiferentes,
        });
      }
    }

    // Sort: parents first, then by SKU
    return candidatos.sort((a, b) => {
      if (a.producto.esPadre && !b.producto.esPadre) return -1;
      if (!a.producto.esPadre && b.producto.esPadre) return 1;
      return (a.producto.sku || '').localeCompare(b.producto.sku || '');
    });
  }, [productos, marca, nombreComercial, contenido, dosaje, sabor]);
}
