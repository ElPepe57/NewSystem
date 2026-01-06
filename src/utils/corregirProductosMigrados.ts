/**
 * Utilidad para corregir productos migrados que les falta sabor y servingsPerDay
 */

import { ProductoService } from '../services/producto.service';

interface ProductoCSV {
  marca: string;
  nombreComercial: string;
  dosaje: string;
  contenido: string;
  servingSize: string;
  sabor: string;
}

// Datos del CSV con sabor y servingSize
const productosCSV: ProductoCSV[] = [
  { marca: "NOW FOODS", nombreComercial: "5-HTP", dosaje: "100 mg", contenido: "120", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "PHYSICIAN'S CHOICE", nombreComercial: "60 BILLION PROBIOTIC", dosaje: "-", contenido: "30", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "NORDIC NATURALS", nombreComercial: "ARTIC-D", dosaje: "1000 UI + 1060 mg", contenido: "8 oz", servingSize: "0.17", sabor: "LIMON" },
  { marca: "CARLYLE", nombreComercial: "ACEITE DE OREGANO", dosaje: "4000 mg", contenido: "150", servingSize: "2", sabor: "OREGANO" },
  { marca: "CARLYLE", nombreComercial: "ACEITE DE OREGANO", dosaje: "34 mg", contenido: "2 oz", servingSize: "0.026", sabor: "OREGANO" },
  { marca: "KIRKLAND SIGNATURE", nombreComercial: "MULTIVITAMINICO PARA ADULTOS", dosaje: "-", contenido: "160", servingSize: "2", sabor: "FRESA Y BAYAS" },
  { marca: "ALLIMAX", nombreComercial: "ALLISURE POWDER", dosaje: "180 mg", contenido: "30", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "ALPHA LIPOIC ACID", dosaje: "600 mg", contenido: "120", servingSize: "3", sabor: "COCO" },
  { marca: "CARLYLE", nombreComercial: "ANTARTIC KRILL OIL", dosaje: "2000 mg + 600 mcg", contenido: "120", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "ASHWAGHANDA", dosaje: "3000 mg", contenido: "300", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "HORBAACH", nombreComercial: "ASHWAGHANDA", dosaje: "450 mg", contenido: "120", servingSize: "4", sabor: "NEUTRAL" },
  { marca: "NOW FOODS", nombreComercial: "ASHWAGHANDA", dosaje: "450 mg", contenido: "90", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "ASTAXANTINA", dosaje: "12 mg", contenido: "120", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "VITAMINA B12", dosaje: "5000 mcg", contenido: "250", servingSize: "1", sabor: "BAYAS" },
  { marca: "CARLYLE", nombreComercial: "BERBERINA", dosaje: "500000 mcg", contenido: "60", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "HORBAACH", nombreComercial: "BERBERINA", dosaje: "2000 mg", contenido: "120", servingSize: "1", sabor: "CANELA" },
  { marca: "NOW FOODS", nombreComercial: "BORO", dosaje: "3 mg", contenido: "250", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "KIRKLAND SIGNATURE", nombreComercial: "CALCIUM, D3 Y ZINC", dosaje: "-", contenido: "120", servingSize: "2", sabor: "FRUTAS TROPICALES" },
  { marca: "CENTRUM", nombreComercial: "CAPSULAS MULTIVITAMINICAS DE MUJER", dosaje: "-", contenido: "275", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "KIRKLAND SIGNATURE", nombreComercial: "GOMITAS MULTIVITAMINICAS DE NIÑO", dosaje: "-", contenido: "160", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "CITICOLINE CDP", dosaje: "1000 mg", contenido: "60", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "DR. MORITZ", nombreComercial: "CITRATO DE MAGNESIO", dosaje: "100 mg", contenido: "60", servingSize: "2", sabor: "FRAMBUESA" },
  { marca: "YOUTHEORY", nombreComercial: "COLLAGEN + BIOTIN", dosaje: "6000 mg + 3000 mcg", contenido: "390", servingSize: "6", sabor: "NEUTRAL" },
  { marca: "LIFE EXTENSION", nombreComercial: "COMPLEJO B", dosaje: "-", contenido: "60", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "COMPLEJO B", dosaje: "-", contenido: "240", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "NORDIC NATURALS", nombreComercial: "COMPLETE OMEGA JUNIOR", dosaje: "283 mg + 35 mg", contenido: "180", servingSize: "2", sabor: "LIMON" },
  { marca: "MICROINGREDIENTS", nombreComercial: "COQ 10", dosaje: "100 mg", contenido: "240", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "VITAMINA D3", dosaje: "10000 IU", contenido: "400", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "VITAMINA D3", dosaje: "5000 IU", contenido: "500", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "D3 + K2", dosaje: "10000 IU + 200 mcg", contenido: "300", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "D3 + K2", dosaje: "5000 IU + 100 mcg", contenido: "300", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "NOW FOODS", nombreComercial: "D3 + K2", dosaje: "1000 IU + 45 mcg", contenido: "120", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "D3 + K2", dosaje: "10000 IU + 200 mcg", contenido: "300", servingSize: "1", sabor: "COCO" },
  { marca: "MICROINGREDIENTS", nombreComercial: "D3 + K2", dosaje: "5000 IU + 100 mcg", contenido: "300", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "JOYSPRING", nombreComercial: "DETOXZEE", dosaje: "200 IU + 300 mcg", contenido: "1 oz", servingSize: "0.033", sabor: "BAYAS" },
  { marca: "COCO MARCH", nombreComercial: "DIGESTIVE DROPS", dosaje: "200 mg", contenido: "1 oz", servingSize: "0.014", sabor: "NEUTRAL" },
  { marca: "PHYSICIAN'S CHOICE", nombreComercial: "ENZIMAS DIGESTIVAS", dosaje: "-", contenido: "60", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "LIFE EXTENSION", nombreComercial: "FOLATO OPTIMIZADO", dosaje: "1700 mcg", contenido: "100", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "GINKGO BILOBA", dosaje: "120 mg", contenido: "400", servingSize: "2", sabor: "COCO" },
  { marca: "MICROINGREDIENTS", nombreComercial: "GLUCOSAMINA CONDROITINA", dosaje: "4000 mg", contenido: "300", servingSize: "3", sabor: "NEUTRAL" },
  { marca: "NORDIC NATURALS", nombreComercial: "ZERO AZUCAR DHA PARA NIÑOS", dosaje: "600 mg", contenido: "30", servingSize: "1", sabor: "FRUTAS CITRICAS" },
  { marca: "NORDIC NATURALS", nombreComercial: "ZERO AZUCAR DHA PARA NIÑOS", dosaje: "600 mg", contenido: "45", servingSize: "1", sabor: "FRUTAS CITRICAS" },
  { marca: "CENTRUM", nombreComercial: "GOMITAS MULTIVITAMINICAS DE HOMBRE", dosaje: "-", contenido: "170", servingSize: "2", sabor: "FRUTAS TROPICALES" },
  { marca: "CENTRUM", nombreComercial: "GOMITAS MULTIVITAMINICAS DE MUJER", dosaje: "-", contenido: "170", servingSize: "2", sabor: "FRUTAS TROPICALES" },
  { marca: "JOYSPRING", nombreComercial: "GOTAS GENIUS", dosaje: "-", contenido: "1 oz", servingSize: "0.033", sabor: "NEUTRAL" },
  { marca: "LIL CRITTER'S", nombreComercial: "GOMITAS MULTIVITAMINICAS DE NIÑO", dosaje: "-", contenido: "300", servingSize: "2", sabor: "FRUTAS TROPICALES" },
  { marca: "CARLYLE", nombreComercial: "KRILL OIL", dosaje: "2000 mg + 600 mcg", contenido: "120", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "KRILL OIL", dosaje: "2000 mg + 800 mcg", contenido: "240", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "NOW FOODS", nombreComercial: "KSM 66 + ASHWAGHANDA", dosaje: "600 mg", contenido: "90", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "NOW FOODS", nombreComercial: "L-TEANINA", dosaje: "100 mg", contenido: "90", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "LIFE EXTENSION", nombreComercial: "MAGTEIN", dosaje: "144 mg", contenido: "90", servingSize: "3", sabor: "NEUTRAL" },
  { marca: "JOYSPRING", nombreComercial: "LINGO LEAP", dosaje: "-", contenido: "1 oz", servingSize: "0.033", sabor: "FRAMBUESAS" },
  { marca: "CARLYLE", nombreComercial: "MELENA DE LEON", dosaje: "2 ml", contenido: "2 oz", servingSize: "0.066", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "VITAMINA C LIPOSOMAL", dosaje: "2200 mg", contenido: "90", servingSize: "2", sabor: "NARANJA" },
  { marca: "CARLYLE", nombreComercial: "LUTEINA", dosaje: "40 mg", contenido: "180", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "DOCTOR'S BEST", nombreComercial: "MAGNESIO GLICINATO", dosaje: "200 mg", contenido: "240", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "DOUBLE WOOD", nombreComercial: "MAGNESIO GLICINATO", dosaje: "400 mg", contenido: "180", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "MAGNESIO + ASHWAGHANDA", dosaje: "150 mg + 1500 mg", contenido: "120", servingSize: "3", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "MAGNESIO BISGLICINATO", dosaje: "665 mg", contenido: "250", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "DR. MORITZ", nombreComercial: "MAGNESIO PARA NIÑOS", dosaje: "100 mg", contenido: "60", servingSize: "2", sabor: "FRAMBUESA" },
  { marca: "HORBAACH", nombreComercial: "MAGNESIO GLICINATO", dosaje: "1330 mg", contenido: "250", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "SOLARAY", nombreComercial: "MAGNESIO GLICINATO", dosaje: "350 mg", contenido: "120", servingSize: "4", sabor: "NEUTRAL" },
  { marca: "DOUBLE WOOD", nombreComercial: "MAGTEIN", dosaje: "2000 mg", contenido: "120", servingSize: "4", sabor: "NEUTRAL" },
  { marca: "NATROL", nombreComercial: "MELATONINA", dosaje: "5 mg", contenido: "200", servingSize: "1", sabor: "FRESA" },
  { marca: "NATROL", nombreComercial: "MELATONINA +  L-TEANINA PARA NIÑOS", dosaje: "1 mg + 25 mg", contenido: "60", servingSize: "2", sabor: "FRESA" },
  { marca: "MICROINGREDIENTS", nombreComercial: "MELATONINA", dosaje: "20 mg", contenido: "400", servingSize: "1", sabor: "FRESA" },
  { marca: "NATROL", nombreComercial: "MELATONINA", dosaje: "5 mg", contenido: "250", servingSize: "1", sabor: "FRESA" },
  { marca: "CARLYLE", nombreComercial: "MELATONINA", dosaje: "40 mg", contenido: "150", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "MELATONINA", dosaje: "5 mg", contenido: "300", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "NATROL", nombreComercial: "GOMITAS DE MELATONINA PARA ADULTOS", dosaje: "10 mg", contenido: "190", servingSize: "2", sabor: "FRESA" },
  { marca: "NATROL", nombreComercial: "GOMITAS DE MELATONINA PARA NIÑOS", dosaje: "1 mg", contenido: "140", servingSize: "1", sabor: "FRESA" },
  { marca: "NATROL", nombreComercial: "GOMITAS DE MELATONINA PARA NIÑOS", dosaje: "1 mg", contenido: "90", servingSize: "1", sabor: "FRESA" },
  { marca: "CARLYLE", nombreComercial: "GOMITAS DE MELATONINA PARA ADULTOS", dosaje: "12 mg", contenido: "300", servingSize: "1", sabor: "BAYAS" },
  { marca: "HORBAACH", nombreComercial: "MELENA DE LEON", dosaje: "4200 mg", contenido: "120", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "HORBAACH", nombreComercial: "5-MTHF", dosaje: "1000 mcg", contenido: "200", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "HORBAACH", nombreComercial: "CARDO MARIANO", dosaje: "3000 mg", contenido: "300", servingSize: "3", sabor: "NEUTRAL" },
  { marca: "SPORTS RESEARCH", nombreComercial: "MULTI COLAGENO", dosaje: "1600 mg", contenido: "90", servingSize: "3", sabor: "NEUTRAL" },
  { marca: "CENTRUM", nombreComercial: "CAPSULAS MULTIVITAMINICAS DE ADULTO", dosaje: "-", contenido: "200", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "CENTRUM", nombreComercial: "CAPSULAS MULTIVITAMINICAS DE HOMBRE", dosaje: "-", contenido: "200", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "MARY RUTH'S", nombreComercial: "LIQUIDO MULTIVITAMINICO", dosaje: "-", contenido: "15.22 oz", servingSize: "1.014", sabor: "FRAMBUESA" },
  { marca: "MARY RUTH'S", nombreComercial: "LIQUIDO MULTIVITAMINICO + CRECIMIENTO DEL CABELLO", dosaje: "-", contenido: "15.22 oz", servingSize: "1.014", sabor: "MANGO" },
  { marca: "CARLYLE", nombreComercial: "MYO INOSITOL", dosaje: "2060 mg", contenido: "150", servingSize: "4", sabor: "NEUTRAL" },
  { marca: "LIFE EXTENSION", nombreComercial: "NAD+", dosaje: "100 mg", contenido: "30", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "LIFE EXTENSION", nombreComercial: "NAD + RESVERATROL", dosaje: "55 mg + 300 mg", contenido: "30", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "LIFE EXTENSION", nombreComercial: "NEUROMAG", dosaje: "144 mg", contenido: "90", servingSize: "3", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "ACEITE DE OREGANO", dosaje: "6000 mg", contenido: "300", servingSize: "2", sabor: "OREGANO" },
  { marca: "PIPPING ROCK", nombreComercial: "ACEITE DE OREGANO", dosaje: "4000 mg", contenido: "200", servingSize: "2", sabor: "OREGANO" },
  { marca: "MICROINGREDIENTS", nombreComercial: "OMEGA 3", dosaje: "4200 mg", contenido: "240", servingSize: "3", sabor: "LIMON" },
  { marca: "SPORTS RESEARCH", nombreComercial: "ALASKA OMEGA 3", dosaje: "1040 mg", contenido: "90", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "NORDIC NATURALS", nombreComercial: "OMEGA 3", dosaje: "1560 mg", contenido: "8 oz", servingSize: "0.17", sabor: "LIMON" },
  { marca: "NOW FOODS", nombreComercial: "OMEGA 369", dosaje: "1400 mg", contenido: "250", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "TRIQUETRA", nombreComercial: "FOLATO DE METILO ORGANICO PARA NIÑOS", dosaje: "1 oz", contenido: "1 oz", servingSize: "0.04", sabor: "BAYAS" },
  { marca: "MICROINGREDIENTS", nombreComercial: "POLVO DE PEPTIDOS DE COLAGENO", dosaje: "10888 mg", contenido: "1 lb", servingSize: "0.024", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "CAPSULAS DE PEPTIDOS DE COLAGENO", dosaje: "1100 mg", contenido: "240", servingSize: "3", sabor: "NEUTRAL" },
  { marca: "DOCTOR'S BEST", nombreComercial: "PEPZIN GI", dosaje: "75 mg", contenido: "120", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "NORDIC NATURALS", nombreComercial: "DHA PARA BEBES", dosaje: "300 IU + 1050 mg", contenido: "2 oz", servingSize: "0.042", sabor: "NEUTRAL" },
  { marca: "NORDIC NATURALS", nombreComercial: "DHA XTRA", dosaje: "880 mg", contenido: "2 oz", servingSize: "0.042", sabor: "BAYAS" },
  { marca: "CARLYLE", nombreComercial: "PREBIOTICOS + PROBIOTICOS 50 BILLION", dosaje: "142 mg + 200 mg", contenido: "120", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "CAPSULAS DE ACEITE DE SEMILLA DE CALABAZA", dosaje: "3000 mg", contenido: "300", servingSize: "3", sabor: "CALABAZA" },
  { marca: "NOW FOODS", nombreComercial: "REFUERZO DE CANDIDA", dosaje: "-", contenido: "180", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "RESVERATROL", dosaje: "1800 mg", contenido: "180", servingSize: "3", sabor: "UVA" },
  { marca: "WELLNESS LABS RX", nombreComercial: "NAD + RESVERATROL", dosaje: "300 mg + 1200 mg", contenido: "90", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "ICY HOT", nombreComercial: "ICY HOT", dosaje: "-", contenido: "2.5 oz", servingSize: "0.028", sabor: "MENTOL" },
  { marca: "CARLYLE", nombreComercial: "SELENIO", dosaje: "200 mcg", contenido: "200", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "CARLYLE", nombreComercial: "SHILAJIT", dosaje: "2000 mg", contenido: "90", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "MICROINGREDIENTS", nombreComercial: "ESPIRULINA DE CHLORELLA", dosaje: "3000 mg", contenido: "720", servingSize: "6", sabor: "NEUTRAL" },
  { marca: "ICY HOT", nombreComercial: "ICY HOT", dosaje: "-", contenido: "4 oz", servingSize: "0.044", sabor: "MENTOL" },
  { marca: "NOW FOODS", nombreComercial: "SUPER ENZIMAS", dosaje: "-", contenido: "180", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "LIFE EXTENSION", nombreComercial: "SUPER OMEGA 3 PLUS", dosaje: "2350 mg", contenido: "120", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "LIFE EXTENSION", nombreComercial: "COQ 10", dosaje: "100 mg", contenido: "60", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "HORBAACH", nombreComercial: "TONGKAT ALI", dosaje: "1600 mg", contenido: "120", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "NORDIC NATURALS", nombreComercial: "ULTIMATE OMEGA TEEN", dosaje: "1120 mg", contenido: "60", servingSize: "2", sabor: "FRESA" },
  { marca: "NORDIC NATURALS", nombreComercial: "ULTIMATE OMEGA", dosaje: "2840 mg", contenido: "4 oz", servingSize: "0.17", sabor: "LIMON" },
  { marca: "NORDIC NATURALS", nombreComercial: "ULTIMATE OMEGA KIDS", dosaje: "680 mg", contenido: "90", servingSize: "2", sabor: "FRESA" },
  { marca: "NOW FOODS", nombreComercial: "ULTRA OMEGA 3 - CEREBRO Y CORAZON", dosaje: "750 mg", contenido: "180", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "NOW FOODS", nombreComercial: "ULTRA OMEGA 3 - CARDIOVASCULAR", dosaje: "750 mg", contenido: "180", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "NATURE'S TRUTH", nombreComercial: "VINAGRE DE MANZANA", dosaje: "1200 mg", contenido: "60", servingSize: "2", sabor: "MANZANA" },
  { marca: "CARLYLE", nombreComercial: "VITAMINA B COMPLEX", dosaje: "-", contenido: "300", servingSize: "2", sabor: "NEUTRAL" },
  { marca: "HORBAACH", nombreComercial: "VITAMINA B12", dosaje: "5000 mcg", contenido: "120", servingSize: "1", sabor: "BAYAS" },
  { marca: "HORBAACH", nombreComercial: "VITAMINA E", dosaje: "450 mg", contenido: "200", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "NUBEST", nombreComercial: "VITAMINA PARA EL CRECIMIENTO +10 AÑOS", dosaje: "-", contenido: "60", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "VITAFUSION", nombreComercial: "GOMITAS MULTIVITAMINICAS DE MUJER", dosaje: "-", contenido: "220", servingSize: "2", sabor: "BAYAS" },
  { marca: "SWANSON", nombreComercial: "ZINC CARNOSIN", dosaje: "8 mg", contenido: "60", servingSize: "1", sabor: "NEUTRAL" },
  { marca: "MARY RUTH'S", nombreComercial: "ZINC IONICO ORGANICO", dosaje: "3 mg", contenido: "2 oz", servingSize: "0.066", sabor: "BAYAS" },
];

// Función para normalizar texto (igual que en migración)
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Función para generar clave única
function generarClaveProducto(marca: string, nombreComercial: string, dosaje: string, contenido: string): string {
  return `${normalizar(marca)}-${normalizar(nombreComercial)}-${normalizar(dosaje)}-${normalizar(contenido)}`;
}

export interface CorreccionResult {
  actualizados: number;
  sinCambios: number;
  noEncontrados: number;
  errores: number;
  detalles: string[];
}

/**
 * Corrige los productos migrados agregando sabor y servingsPerDay
 */
export async function corregirProductosMigrados(
  onProgress?: (mensaje: string, progreso: number) => void
): Promise<CorreccionResult> {
  const result: CorreccionResult = {
    actualizados: 0,
    sinCambios: 0,
    noEncontrados: 0,
    errores: 0,
    detalles: []
  };

  onProgress?.('Obteniendo productos existentes...', 0);

  // Obtener todos los productos
  const productosExistentes = await ProductoService.getAll(true);

  // Crear mapa de productos por clave
  const productosMap = new Map<string, typeof productosExistentes[0]>();
  productosExistentes.forEach(p => {
    const clave = generarClaveProducto(p.marca, p.nombreComercial, p.dosaje, p.contenido);
    productosMap.set(clave, p);
  });

  onProgress?.(`Encontrados ${productosExistentes.length} productos`, 5);

  const total = productosCSV.length;

  for (let i = 0; i < productosCSV.length; i++) {
    const productoCSV = productosCSV[i];
    const clave = generarClaveProducto(
      productoCSV.marca,
      productoCSV.nombreComercial,
      productoCSV.dosaje,
      productoCSV.contenido
    );

    const progreso = Math.round(5 + (i / total) * 90);
    onProgress?.(`Procesando ${i + 1}/${total}: ${productoCSV.marca} - ${productoCSV.nombreComercial}`, progreso);

    const productoExistente = productosMap.get(clave);

    if (!productoExistente) {
      result.noEncontrados++;
      continue;
    }

    try {
      const servingsPerDay = parseFloat(productoCSV.servingSize) || 1;
      const contenidoNumerico = parseFloat(productoCSV.contenido) || 0;
      const cicloRecompraDias = contenidoNumerico > 0 && servingsPerDay > 0
        ? Math.round(contenidoNumerico / servingsPerDay)
        : undefined;

      const sabor = productoCSV.sabor === 'NEUTRAL' ? undefined : productoCSV.sabor;

      // Verificar si necesita actualización
      const necesitaActualizacion =
        productoExistente.sabor !== sabor ||
        productoExistente.servingsPerDay !== servingsPerDay ||
        productoExistente.cicloRecompraDias !== cicloRecompraDias;

      if (necesitaActualizacion) {
        const updateData: Record<string, any> = {};

        if (sabor) {
          updateData.sabor = sabor;
        }
        if (servingsPerDay) {
          updateData.servingsPerDay = servingsPerDay;
        }
        if (cicloRecompraDias) {
          updateData.cicloRecompraDias = cicloRecompraDias;
        }

        await ProductoService.update(productoExistente.id, updateData);
        result.actualizados++;
        result.detalles.push(`Actualizado: ${productoCSV.marca} - ${productoCSV.nombreComercial} (sabor: ${sabor || 'N/A'}, servings: ${servingsPerDay})`);
      } else {
        result.sinCambios++;
      }

      // Pequeña pausa cada 10 productos
      if ((result.actualizados + result.sinCambios) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

    } catch (error: any) {
      result.errores++;
      result.detalles.push(`Error: ${productoCSV.marca} - ${productoCSV.nombreComercial}: ${error.message}`);
    }
  }

  onProgress?.('Corrección completada', 100);

  return result;
}
