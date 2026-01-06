/**
 * Script de Migración COMPLETA de Productos
 *
 * Este script actualiza TODOS los campos del producto:
 * 1. Campos principales: marca, nombreComercial, presentacion, sabor (Title Case)
 * 2. Campos legacy: grupo, subgrupo (Title Case)
 * 3. Nueva clasificación: tipoProductoId, categoriaIds, etiquetaIds
 * 4. Snapshots desnormalizados para display
 *
 * Uso:
 *   npx ts-node scripts/migrar-clasificacion.ts           # Modo verificación (dry-run)
 *   npx ts-node scripts/migrar-clasificacion.ts --execute # Ejecutar migración real
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  CATEGORIAS,
  TIPOS_PRODUCTO,
  PRODUCTOS_MIGRACION,
  ETIQUETAS,
  ETIQUETAS_POR_MARCA,
  ETIQUETAS_POR_PRESENTACION,
  ETIQUETAS_POR_PUBLICO,
  CategoriaConfig,
  TipoProductoConfig,
  ProductoMigracion,
  EtiquetaConfig
} from './data/clasificacion-mapeo.js';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let serviceAccount: any;
try {
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  console.error('❌ Error: No se encontró serviceAccountKey.json');
  console.error('   Por favor coloca el archivo de credenciales en la raíz del proyecto.');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const ADMIN_USER_ID = 'SYSTEM_MIGRATION';
const IS_DRY_RUN = !process.argv.includes('--execute');

// ============================================================================
// TIPOS
// ============================================================================

interface MigrationResult {
  categoriasCreadas: number;
  tiposCreados: number;
  etiquetasCreadas: number;
  productosActualizados: number;
  productosNoEncontrados: string[];
  errores: string[];
}

interface ProductoSnapshot {
  tipoProducto: { id: string; codigo: string; nombre: string } | null;
  categoriaPrincipal: { id: string; codigo: string; nombre: string; color: string } | null;
  categorias: Array<{ id: string; codigo: string; nombre: string; color: string }>;
  etiquetas: Array<{ id: string; codigo: string; nombre: string; color: string; tipo: string }>;
}

// ============================================================================
// FUNCIONES DE CREACIÓN EN FIRESTORE
// ============================================================================

async function crearCategorias(): Promise<Map<string, { id: string; data: CategoriaConfig }>> {
  console.log('\n📁 Creando categorías...');
  const resultado = new Map<string, { id: string; data: CategoriaConfig }>();

  for (const cat of CATEGORIAS) {
    try {
      // Verificar si ya existe
      const existingQuery = await db
        .collection('categorias')
        .where('codigo', '==', cat.codigo)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        const existingId = existingQuery.docs[0].id;
        resultado.set(cat.codigo, { id: existingId, data: cat });
        console.log(`  ⏭️  ${cat.codigo} ya existe: ${cat.nombre}`);
        continue;
      }

      if (IS_DRY_RUN) {
        resultado.set(cat.codigo, { id: `DRY_RUN_${cat.codigo}`, data: cat });
        console.log(`  🔍 [DRY-RUN] Crearía: ${cat.codigo} - ${cat.nombre}`);
        continue;
      }

      // Normalizar nombre para búsquedas
      const nombreNormalizado = cat.nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();

      const docRef = await db.collection('categorias').add({
        codigo: cat.codigo,
        nombre: cat.nombre,
        nombreNormalizado,
        descripcion: cat.descripcion,
        color: cat.color,
        icono: cat.icono,
        orden: cat.orden,
        categoriaPadreId: null,
        nivel: 1,
        ruta: [cat.nombre],
        mostrarEnWeb: true,
        slug: nombreNormalizado.replace(/\s+/g, '-'),
        ordenDisplay: cat.orden,
        imagenUrl: '',
        estado: 'activa',
        metricas: {
          productosActivos: 0,
          productosTotal: 0,
          subcategorias: 0,
          unidadesVendidas: 0,
          ventasTotalPEN: 0,
          margenPromedio: 0
        },
        creadoPor: ADMIN_USER_ID,
        fechaCreacion: Timestamp.now()
      });

      resultado.set(cat.codigo, { id: docRef.id, data: cat });
      console.log(`  ✅ Creada: ${cat.codigo} - ${cat.nombre}`);
    } catch (error) {
      console.error(`  ❌ Error creando ${cat.codigo}:`, error);
    }
  }

  console.log(`  Total categorías: ${resultado.size}`);
  return resultado;
}

async function crearTiposProducto(): Promise<Map<string, { id: string; data: TipoProductoConfig }>> {
  console.log('\n🏷️  Creando tipos de producto...');
  const resultado = new Map<string, { id: string; data: TipoProductoConfig }>();

  for (const tipo of TIPOS_PRODUCTO) {
    try {
      const existingQuery = await db
        .collection('tiposProducto')
        .where('codigo', '==', tipo.codigo)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        const existingId = existingQuery.docs[0].id;
        resultado.set(tipo.codigo, { id: existingId, data: tipo });
        console.log(`  ⏭️  ${tipo.codigo} ya existe: ${tipo.nombre}`);
        continue;
      }

      if (IS_DRY_RUN) {
        resultado.set(tipo.codigo, { id: `DRY_RUN_${tipo.codigo}`, data: tipo });
        console.log(`  🔍 [DRY-RUN] Crearía: ${tipo.codigo} - ${tipo.nombre}`);
        continue;
      }

      // Normalizar nombre para búsquedas
      const nombreNormalizado = tipo.nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();

      const docRef = await db.collection('tiposProducto').add({
        codigo: tipo.codigo,
        nombre: tipo.nombre,
        nombreNormalizado,
        alias: tipo.alias || [],
        principioActivo: tipo.principioActivo || '',
        beneficiosPrincipales: [],
        categoriasSugeridasIds: [],
        descripcion: '',
        iconoUrl: '',
        imagenUrl: '',
        estado: 'activo',
        metricas: {
          productosActivos: 0,
          unidadesVendidas: 0,
          ventasTotalPEN: 0,
          margenPromedio: 0
        },
        creadoPor: ADMIN_USER_ID,
        fechaCreacion: Timestamp.now()
      });

      resultado.set(tipo.codigo, { id: docRef.id, data: tipo });
      console.log(`  ✅ Creado: ${tipo.codigo} - ${tipo.nombre}`);
    } catch (error) {
      console.error(`  ❌ Error creando ${tipo.codigo}:`, error);
    }
  }

  console.log(`  Total tipos: ${resultado.size}`);
  return resultado;
}

async function crearEtiquetas(): Promise<Map<string, { id: string; data: EtiquetaConfig }>> {
  console.log('\n🔖 Creando etiquetas...');
  const resultado = new Map<string, { id: string; data: EtiquetaConfig }>();

  for (const etq of ETIQUETAS) {
    try {
      const existingQuery = await db
        .collection('etiquetas')
        .where('codigo', '==', etq.codigo)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        const existingId = existingQuery.docs[0].id;
        resultado.set(etq.codigo, { id: existingId, data: etq });
        console.log(`  ⏭️  ${etq.codigo} ya existe: ${etq.nombre}`);
        continue;
      }

      if (IS_DRY_RUN) {
        resultado.set(etq.codigo, { id: `DRY_RUN_${etq.codigo}`, data: etq });
        console.log(`  🔍 [DRY-RUN] Crearía: ${etq.codigo} - ${etq.nombre}`);
        continue;
      }

      // Normalizar nombre para búsquedas
      const nombreNormalizado = etq.nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim();

      const slug = nombreNormalizado.replace(/\s+/g, '-');

      const docRef = await db.collection('etiquetas').add({
        codigo: etq.codigo,
        nombre: etq.nombre,
        nombreNormalizado,
        slug,
        tipo: etq.tipo,
        color: etq.color,
        descripcion: etq.descripcion || '',
        icono: '',
        ordenDisplay: 0,
        mostrarEnFiltros: true,
        mostrarEnProducto: true,
        estado: 'activa',
        metricas: {
          productosActivos: 0,
          unidadesVendidas: 0,
          ventasTotalPEN: 0
        },
        creadoPor: ADMIN_USER_ID,
        fechaCreacion: Timestamp.now()
      });

      resultado.set(etq.codigo, { id: docRef.id, data: etq });
      console.log(`  ✅ Creada: ${etq.codigo} - ${etq.nombre}`);
    } catch (error) {
      console.error(`  ❌ Error creando ${etq.codigo}:`, error);
    }
  }

  console.log(`  Total etiquetas: ${resultado.size}`);
  return resultado;
}

// ============================================================================
// FUNCIONES DE MAPEO
// ============================================================================

function inferirEtiquetas(producto: ProductoMigracion): string[] {
  const etiquetas = new Set<string>();

  // Todos son importados de USA (ETQ-029 = Made in USA)
  etiquetas.add('ETQ-029');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ETIQUETAS POR MARCA (certificaciones verificadas)
  // ═══════════════════════════════════════════════════════════════════════════
  const etiquetasMarca = ETIQUETAS_POR_MARCA[producto.marca];
  if (etiquetasMarca) {
    etiquetasMarca.forEach((e: string) => etiquetas.add(e));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ETIQUETAS POR PRESENTACIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  const etiquetasPresentacion = ETIQUETAS_POR_PRESENTACION[producto.presentacion];
  if (etiquetasPresentacion) {
    etiquetasPresentacion.forEach((e: string) => etiquetas.add(e));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ETIQUETAS POR PÚBLICO (detectadas del nombre del producto)
  // ═══════════════════════════════════════════════════════════════════════════
  const nombreCompleto = `${producto.nombreComercial} ${producto.nombreLegacy}`.toLowerCase();

  // Buscar palabras clave en el nombre del producto
  for (const [keyword, etiquetaCodigo] of Object.entries(ETIQUETAS_POR_PUBLICO)) {
    if (nombreCompleto.includes(keyword.toLowerCase())) {
      etiquetas.add(etiquetaCodigo);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ETIQUETAS ADICIONALES POR CARACTERÍSTICAS
  // ═══════════════════════════════════════════════════════════════════════════

  // Por sabor (si no es neutral, tiene sabor agradable - ETQ-025)
  if (producto.sabor && producto.sabor.toLowerCase() !== 'neutral') {
    etiquetas.add('ETQ-025');
  }

  return Array.from(etiquetas);
}

function mapearPresentacion(presentacion: string): string {
  // Mapear a los valores del enum Presentacion
  const mapeo: Record<string, string> = {
    'Cápsulas': 'capsulas',
    'Cápsulas Vegetales': 'capsulas',
    'Cápsulas Blandas': 'capsulas_blandas',
    'Cápsulas Blandas de Liberación Rápida': 'capsulas_blandas',
    'Cápsulas de Liberación Rápida': 'capsulas',
    'Mini Cápsulas Blandas': 'capsulas_blandas',
    'Tabletas': 'tabletas',
    'Tableta de Disolución Rápida': 'tabletas',
    'Tableta Bisectada': 'tabletas',
    'Gomitas': 'gomitas',
    'Líquido': 'liquido',
    'Gotero': 'liquido',
    'Polvo': 'polvo',
    'Roll On': 'liquido',
    'Spray': 'liquido',
    'Pastillas': 'tabletas'
  };

  return mapeo[presentacion] || 'capsulas';
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE CREACIÓN DE PRODUCTOS
// ============================================================================

async function crearProducto(
  producto: ProductoMigracion,
  categoriasMap: Map<string, { id: string; data: CategoriaConfig }>,
  tiposMap: Map<string, { id: string; data: TipoProductoConfig }>,
  etiquetasMap: Map<string, { id: string; data: EtiquetaConfig }>
): Promise<string | null> {
  try {
    // Obtener tipo de producto
    const tipoInfo = tiposMap.get(producto.tipoProductoCodigo);
    if (!tipoInfo) {
      console.error(`  ❌ No se encontró tipo ${producto.tipoProductoCodigo}`);
      return null;
    }

    // Obtener categorías
    const categoriasInfo = producto.categoriasCodigos
      .map((cod: string) => categoriasMap.get(cod))
      .filter((info: { id: string; data: CategoriaConfig } | undefined): info is { id: string; data: CategoriaConfig } => info !== undefined);

    if (categoriasInfo.length === 0) {
      console.error(`  ❌ No se encontraron categorías para ${producto.nombreComercial}`);
      return null;
    }

    // Inferir etiquetas
    const etiquetasCodigos = inferirEtiquetas(producto);
    const etiquetasInfo = etiquetasCodigos
      .map(cod => etiquetasMap.get(cod))
      .filter((info): info is { id: string; data: EtiquetaConfig } => info !== undefined);

    // Construir snapshots
    const tipoSnapshot = {
      id: tipoInfo.id,
      codigo: tipoInfo.data.codigo,
      nombre: tipoInfo.data.nombre
    };

    const categoriasSnapshots = categoriasInfo.map((c: { id: string; data: CategoriaConfig }) => ({
      id: c.id,
      codigo: c.data.codigo,
      nombre: c.data.nombre,
      color: c.data.color
    }));

    const etiquetasSnapshots = etiquetasInfo.map(e => ({
      id: e.id,
      codigo: e.data.codigo,
      nombre: e.data.nombre,
      color: e.data.color,
      tipo: e.data.tipo
    }));

    // Mapear categoría principal a grupo legacy (Title Case)
    const grupoLegacy = categoriasInfo[0].data.nombre;

    // Mapear tipo de producto a subgrupo legacy (Title Case)
    const subgrupoLegacy = tipoInfo.data.nombre;

    // Calcular servingsPerDay y cicloRecompraDias
    const servingsPerDay = parseFloat(producto.servingSize) || 1;
    const contenidoNumerico = parseFloat(producto.contenido.replace(/[^\d.]/g, '')) || 0;
    const cicloRecompraDias = contenidoNumerico > 0 && servingsPerDay > 0
      ? Math.round(contenidoNumerico / servingsPerDay)
      : undefined;

    // Construir objeto del nuevo producto
    const productoData: any = {
      // ═══════════════ CAMPOS PRINCIPALES (Title Case) ═══════════════
      marca: producto.marca,
      nombreComercial: producto.nombreComercial,
      presentacion: mapearPresentacion(producto.presentacion),
      presentacionOriginal: producto.presentacion,
      sabor: producto.sabor,
      dosaje: producto.dosaje,
      contenido: producto.contenido,

      // ═══════════════ CAMPOS LEGACY (Title Case) ═══════════════
      grupo: grupoLegacy,
      subgrupo: subgrupoLegacy,

      // ═══════════════ NUEVA CLASIFICACIÓN ═══════════════
      // Tipo de Producto
      tipoProductoId: tipoInfo.id,
      tipoProducto: tipoSnapshot,

      // Categorías (múltiples)
      categoriaIds: categoriasInfo.map((c: { id: string; data: CategoriaConfig }) => c.id),
      categoriaPrincipalId: categoriasInfo[0].id,
      categorias: categoriasSnapshots,

      // Etiquetas
      etiquetaIds: etiquetasInfo.map(e => e.id),
      etiquetas: etiquetasSnapshots,

      // ═══════════════ CICLO DE RECOMPRA ═══════════════
      servingsPerDay: servingsPerDay,
      ...(cicloRecompraDias && { cicloRecompraDias }),

      // ═══════════════ ESTADO Y PRECIOS ═══════════════
      estado: 'activo',
      precioCosto: 0,
      precioVenta: 0,
      margenPorcentaje: 0,

      // ═══════════════ METADATA ═══════════════
      migracion: {
        versionMigracion: '2.0',
        fechaMigracion: IS_DRY_RUN ? 'DRY_RUN' : Timestamp.now(),
        nombreLegacy: producto.nombreLegacy,
        categoriaLegacy: producto.categoriaLegacy,
        subgrupoLegacy: producto.subgrupoLegacy
      },

      // Auditoría
      creadoPor: ADMIN_USER_ID,
      creadoEn: IS_DRY_RUN ? 'DRY_RUN' : Timestamp.now(),
      actualizadoPor: ADMIN_USER_ID,
      actualizadoEn: IS_DRY_RUN ? 'DRY_RUN' : Timestamp.now()
    };

    if (IS_DRY_RUN) {
      console.log(`  🔍 [DRY-RUN] Crearía: ${producto.marca} - ${producto.nombreComercial}`);
      console.log(`     Presentación: ${productoData.presentacion} (${producto.presentacion})`);
      console.log(`     Grupo: ${productoData.grupo}`);
      console.log(`     Subgrupo: ${productoData.subgrupo}`);
      console.log(`     Tipo: ${tipoSnapshot.nombre}`);
      console.log(`     Categorías: ${categoriasSnapshots.map((c: { nombre: string }) => c.nombre).join(', ')}`);
      console.log(`     Etiquetas: ${etiquetasSnapshots.map(e => e.nombre).join(', ')}`);
      if (cicloRecompraDias) {
        console.log(`     Ciclo recompra: ${cicloRecompraDias} días`);
      }
      return `DRY_RUN_${producto.nombreLegacy}`;
    }

    const docRef = await db.collection('productos').add(productoData);
    console.log(`  ✅ Creado: ${producto.marca} - ${producto.nombreComercial} (${docRef.id})`);
    return docRef.id;
  } catch (error) {
    console.error(`  ❌ Error creando ${producto.nombreComercial}:`, error);
    return null;
  }
}

// ============================================================================
// ACTUALIZACIÓN DE MÉTRICAS
// ============================================================================

async function actualizarMetricas(
  categoriasMap: Map<string, { id: string; data: CategoriaConfig }>,
  tiposMap: Map<string, { id: string; data: TipoProductoConfig }>,
  etiquetasMap: Map<string, { id: string; data: EtiquetaConfig }>
): Promise<void> {
  if (IS_DRY_RUN) {
    console.log('\n📊 [DRY-RUN] Se actualizarían las métricas de categorías, tipos y etiquetas');
    return;
  }

  console.log('\n📊 Actualizando métricas...');

  // Contar productos por categoría
  const contadorCategorias = new Map<string, number>();
  const contadorTipos = new Map<string, number>();
  const contadorEtiquetas = new Map<string, number>();

  const productosSnapshot = await db.collection('productos').where('estado', '==', 'activo').get();

  for (const doc of productosSnapshot.docs) {
    const data = doc.data();

    // Contar categorías
    const categoriaIds = data.categoriaIds || [];
    for (const catId of categoriaIds) {
      contadorCategorias.set(catId, (contadorCategorias.get(catId) || 0) + 1);
    }

    // Contar tipo
    if (data.tipoProductoId) {
      contadorTipos.set(data.tipoProductoId, (contadorTipos.get(data.tipoProductoId) || 0) + 1);
    }

    // Contar etiquetas
    const etiquetaIds = data.etiquetaIds || [];
    for (const etqId of etiquetaIds) {
      contadorEtiquetas.set(etqId, (contadorEtiquetas.get(etqId) || 0) + 1);
    }
  }

  // Actualizar métricas de categorías
  for (const [codigo, info] of categoriasMap) {
    const count = contadorCategorias.get(info.id) || 0;
    await db.collection('categorias').doc(info.id).update({
      'metricas.productosActivos': count,
      'metricas.productosTotal': count
    });
  }

  // Actualizar métricas de tipos
  for (const [codigo, info] of tiposMap) {
    const count = contadorTipos.get(info.id) || 0;
    await db.collection('tiposProducto').doc(info.id).update({
      'metricas.productosActivos': count,
      'metricas.productosTotal': count
    });
  }

  // Actualizar métricas de etiquetas
  for (const [codigo, info] of etiquetasMap) {
    const count = contadorEtiquetas.get(info.id) || 0;
    await db.collection('etiquetas').doc(info.id).update({
      'metricas.productosActivos': count,
      'metricas.productosTotal': count
    });
  }

  console.log('  ✅ Métricas actualizadas');
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function ejecutarMigracion(): Promise<MigrationResult> {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║   MIGRACIÓN COMPLETA DE PRODUCTOS - BusinessMN v2.0                ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  if (IS_DRY_RUN) {
    console.log('║   🔍 MODO VERIFICACIÓN (dry-run) - No se realizarán cambios        ║');
    console.log('║   Para ejecutar: npx ts-node scripts/migrar-clasificacion.ts --execute ║');
  } else {
    console.log('║   ⚠️  MODO EJECUCIÓN - Se aplicarán cambios a la base de datos     ║');
  }
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  const result: MigrationResult = {
    categoriasCreadas: 0,
    tiposCreados: 0,
    etiquetasCreadas: 0,
    productosActualizados: 0,
    productosNoEncontrados: [],
    errores: []
  };

  try {
    // Paso 1: Crear categorías
    const categoriasMap = await crearCategorias();
    result.categoriasCreadas = categoriasMap.size;

    // Paso 2: Crear tipos de producto
    const tiposMap = await crearTiposProducto();
    result.tiposCreados = tiposMap.size;

    // Paso 3: Crear etiquetas
    const etiquetasMap = await crearEtiquetas();
    result.etiquetasCreadas = etiquetasMap.size;

    // Paso 4: Crear productos NUEVOS
    console.log('\n📦 Creando productos...');
    console.log(`   Total productos a crear: ${PRODUCTOS_MIGRACION.length}`);

    let procesados = 0;
    for (const producto of PRODUCTOS_MIGRACION) {
      procesados++;
      process.stdout.write(`\r   Procesando ${procesados}/${PRODUCTOS_MIGRACION.length}...`);

      const productoId = await crearProducto(
        producto,
        categoriasMap,
        tiposMap,
        etiquetasMap
      );

      if (productoId) {
        result.productosActualizados++;
      } else {
        result.errores.push(`Error creando: ${producto.nombreLegacy}`);
      }
    }

    console.log('\n');

    // Paso 5: Actualizar métricas
    await actualizarMetricas(categoriasMap, tiposMap, etiquetasMap);

    // Resumen
    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                        RESUMEN DE MIGRACIÓN                        ║');
    console.log('╠════════════════════════════════════════════════════════════════════╣');
    console.log(`║   Categorías creadas:        ${String(result.categoriasCreadas).padStart(4)}                                ║`);
    console.log(`║   Tipos de producto:         ${String(result.tiposCreados).padStart(4)}                                ║`);
    console.log(`║   Etiquetas creadas:         ${String(result.etiquetasCreadas).padStart(4)}                                ║`);
    console.log(`║   Productos creados:         ${String(result.productosActualizados).padStart(4)}                                ║`);
    console.log(`║   Errores:                   ${String(result.errores.length).padStart(4)}                                ║`);
    console.log('╚════════════════════════════════════════════════════════════════════╝');

    if (result.errores.length > 0) {
      console.log('\n❌ Errores durante la migración:');
      result.errores.forEach(e => console.log(`   - ${e}`));
    }

    if (IS_DRY_RUN) {
      console.log('\n💡 Para ejecutar la migración real, usa:');
      console.log('   node scripts/dist/migrar-clasificacion.js --execute');
    }

  } catch (error) {
    console.error('\n❌ Error fatal durante la migración:', error);
    result.errores.push(`Error fatal: ${error}`);
  }

  return result;
}

// Ejecutar
ejecutarMigracion()
  .then(() => {
    console.log('\n✅ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
