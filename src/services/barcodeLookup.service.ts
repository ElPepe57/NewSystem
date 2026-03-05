import type { ExternalProductInfo } from '../types/escaner.types';

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.net/api/v2/product';

/**
 * Servicio de búsqueda externa de productos por código de barras.
 * Usa Open Food Facts (gratuito) como fuente principal.
 * Solo se usa cuando el barcode NO existe en la base interna.
 */
export const barcodeLookupService = {
  /**
   * Buscar info de producto en APIs externas por código UPC/EAN
   */
  async lookup(barcode: string): Promise<ExternalProductInfo | null> {
    try {
      // Intentar Open Food Facts primero
      const result = await this.searchOpenFoodFacts(barcode);
      if (result) return result;

      return null;
    } catch (error) {
      console.error('Error en barcode lookup externo:', error);
      return null;
    }
  },

  /**
   * Buscar en Open Food Facts (gratuito, sin rate limit estricto)
   */
  async searchOpenFoodFacts(barcode: string): Promise<ExternalProductInfo | null> {
    try {
      const url = `${OPEN_FOOD_FACTS_API}/${barcode}?fields=product_name,brands,image_url,categories`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'BusinessMN-ERP/2.0 (contact@businessmn.com)'
        }
      });

      if (!response.ok) return null;

      const data = await response.json();

      if (data.status !== 1 || !data.product) return null;

      const product = data.product;

      // Solo retornar si tiene al menos nombre o marca
      if (!product.product_name && !product.brands) return null;

      return {
        name: product.product_name || undefined,
        brand: product.brands || undefined,
        imageUrl: product.image_url || undefined,
        category: product.categories || undefined,
        source: 'openfoodfacts'
      };
    } catch (error) {
      console.warn('Open Food Facts lookup failed:', error);
      return null;
    }
  }
};
