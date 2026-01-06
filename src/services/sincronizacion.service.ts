/**
 * Servicio de Sincronización Global
 *
 * Permite sincronizar todos los stores con Firebase cuando se han
 * eliminado datos directamente desde la consola de Firebase.
 *
 * También limpia referencias huérfanas (ej: OCs que referencian productos eliminados)
 */

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SincronizacionResult {
  modulo: string;
  registrosActualizados: number;
  registrosEliminados: number;
  referenciasLimpiadas: number;
  errores: string[];
}

export interface SincronizacionGlobalResult {
  exito: boolean;
  fecha: Date;
  resultados: SincronizacionResult[];
  resumen: {
    totalActualizados: number;
    totalEliminados: number;
    totalReferenciasLimpiadas: number;
    totalErrores: number;
  };
}

class SincronizacionService {
  /**
   * Ejecuta sincronización completa de todos los módulos
   */
  async sincronizarTodo(
    onProgress?: (mensaje: string, progreso: number) => void
  ): Promise<SincronizacionGlobalResult> {
    const resultados: SincronizacionResult[] = [];
    const modulos = [
      { nombre: 'Productos', fn: () => this.sincronizarProductos() },
      { nombre: 'Proveedores', fn: () => this.sincronizarProveedores() },
      { nombre: 'Órdenes de Compra', fn: () => this.sincronizarOrdenesCompra() },
      { nombre: 'Ventas', fn: () => this.sincronizarVentas() },
      { nombre: 'Unidades', fn: () => this.sincronizarUnidades() },
      { nombre: 'Clientes', fn: () => this.sincronizarClientes() },
      { nombre: 'Almacenes', fn: () => this.sincronizarAlmacenes() },
      { nombre: 'Transferencias', fn: () => this.sincronizarTransferencias() },
      { nombre: 'Gastos', fn: () => this.sincronizarGastos() },
      { nombre: 'Cotizaciones', fn: () => this.sincronizarCotizaciones() },
      { nombre: 'Tipos de Producto', fn: () => this.sincronizarTiposProducto() },
      { nombre: 'Categorías', fn: () => this.sincronizarCategorias() },
      { nombre: 'Marcas', fn: () => this.sincronizarMarcas() },
      { nombre: 'Competidores', fn: () => this.sincronizarCompetidores() },
    ];

    let completados = 0;
    for (const modulo of modulos) {
      try {
        onProgress?.(`Sincronizando ${modulo.nombre}...`, (completados / modulos.length) * 100);
        const resultado = await modulo.fn();
        resultados.push(resultado);
      } catch (error: any) {
        resultados.push({
          modulo: modulo.nombre,
          registrosActualizados: 0,
          registrosEliminados: 0,
          referenciasLimpiadas: 0,
          errores: [error.message]
        });
      }
      completados++;
    }

    onProgress?.('Sincronización completada', 100);

    const resumen = {
      totalActualizados: resultados.reduce((sum, r) => sum + r.registrosActualizados, 0),
      totalEliminados: resultados.reduce((sum, r) => sum + r.registrosEliminados, 0),
      totalReferenciasLimpiadas: resultados.reduce((sum, r) => sum + r.referenciasLimpiadas, 0),
      totalErrores: resultados.reduce((sum, r) => sum + r.errores.length, 0)
    };

    return {
      exito: resumen.totalErrores === 0,
      fecha: new Date(),
      resultados,
      resumen
    };
  }

  /**
   * Sincroniza productos y actualiza contadores de stock
   * También elimina productos inactivos
   */
  async sincronizarProductos(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Productos',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener todos los productos
      const productosSnap = await getDocs(collection(db, 'productos'));

      // Eliminar productos inactivos
      for (const docSnap of productosSnap.docs) {
        const producto = docSnap.data();
        if (producto.estado === 'inactivo') {
          try {
            // Primero eliminar unidades asociadas al producto inactivo
            const unidadesQuery = query(
              collection(db, 'unidades'),
              where('productoId', '==', docSnap.id)
            );
            const unidadesSnap = await getDocs(unidadesQuery);

            for (const unidadDoc of unidadesSnap.docs) {
              await deleteDoc(doc(db, 'unidades', unidadDoc.id));
              result.referenciasLimpiadas++;
            }

            // Luego eliminar el producto
            await deleteDoc(doc(db, 'productos', docSnap.id));
            result.registrosEliminados++;
          } catch (e: any) {
            result.errores.push(`Error eliminando producto inactivo ${docSnap.id}: ${e.message}`);
          }
        }
      }

      // Re-obtener productos después de eliminar inactivos
      const productosActivosSnap = await getDocs(collection(db, 'productos'));
      const productosIds = new Set(productosActivosSnap.docs.map(d => d.id));

      // Obtener todas las unidades para calcular stock real
      const unidadesSnap = await getDocs(collection(db, 'unidades'));
      const stockPorProducto = new Map<string, { usa: number; peru: number; transito: number; reservado: number }>();

      // Inicializar todos los productos con stock 0
      for (const prodId of productosIds) {
        stockPorProducto.set(prodId, { usa: 0, peru: 0, transito: 0, reservado: 0 });
      }

      // Calcular stock real desde unidades
      for (const docSnap of unidadesSnap.docs) {
        const unidad = docSnap.data();
        const productoId = unidad.productoId;

        // Si la unidad referencia un producto que no existe, marcar para eliminar
        if (!productosIds.has(productoId)) {
          try {
            await deleteDoc(doc(db, 'unidades', docSnap.id));
            result.referenciasLimpiadas++;
          } catch (e: any) {
            result.errores.push(`Error eliminando unidad huérfana ${docSnap.id}: ${e.message}`);
          }
          continue;
        }

        const stock = stockPorProducto.get(productoId)!;
        switch (unidad.estado) {
          case 'recibida_usa':
            stock.usa++;
            break;
          case 'disponible_peru':
            stock.peru++;
            break;
          case 'en_transito_usa':
          case 'en_transito_peru':
            stock.transito++;
            break;
          case 'asignada_pedido':
          case 'en_despacho':
            stock.peru++;
            stock.reservado++;
            break;
        }
      }

      // Actualizar productos con stock real
      const batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of productosActivosSnap.docs) {
        const producto = docSnap.data();
        const stockReal = stockPorProducto.get(docSnap.id);
        if (!stockReal) continue;

        const stockActual = {
          usa: producto.stockUSA || 0,
          peru: producto.stockPeru || 0,
          transito: producto.stockTransito || 0,
          reservado: producto.stockReservado || 0
        };

        // Solo actualizar si hay diferencias
        if (
          stockActual.usa !== stockReal.usa ||
          stockActual.peru !== stockReal.peru ||
          stockActual.transito !== stockReal.transito ||
          stockActual.reservado !== stockReal.reservado
        ) {
          batch.update(doc(db, 'productos', docSnap.id), {
            stockUSA: stockReal.usa,
            stockPeru: stockReal.peru,
            stockTransito: stockReal.transito,
            stockReservado: stockReal.reservado,
            stockDisponible: stockReal.usa + stockReal.peru - stockReal.reservado,
            ultimaEdicion: serverTimestamp()
          });
          batchCount++;
          result.registrosActualizados++;

          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza proveedores y limpia referencias huérfanas
   */
  async sincronizarProveedores(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Proveedores',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener proveedores existentes
      const proveedoresSnap = await getDocs(collection(db, 'proveedores'));
      const proveedoresIds = new Set(proveedoresSnap.docs.map(d => d.id));

      // Obtener OCs y verificar referencias a proveedores
      const ocsSnap = await getDocs(collection(db, 'ordenesCompra'));

      for (const docSnap of ocsSnap.docs) {
        const oc = docSnap.data();
        if (oc.proveedorId && !proveedoresIds.has(oc.proveedorId)) {
          // Limpiar referencia al proveedor eliminado
          try {
            await updateDoc(doc(db, 'ordenesCompra', docSnap.id), {
              proveedorId: null,
              proveedorNombre: '[Proveedor eliminado]',
              ultimaEdicion: serverTimestamp()
            });
            result.referenciasLimpiadas++;
          } catch (e: any) {
            result.errores.push(`Error limpiando OC ${docSnap.id}: ${e.message}`);
          }
        }
      }

      // Recalcular métricas de proveedores
      const batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of proveedoresSnap.docs) {
        const proveedorId = docSnap.id;

        // Contar OCs activas del proveedor
        const ocsProveedor = ocsSnap.docs.filter(d => d.data().proveedorId === proveedorId);
        const totalOCs = ocsProveedor.length;
        const totalCompras = ocsProveedor.reduce((sum, d) => sum + (d.data().totalUSD || 0), 0);

        const proveedorActual = docSnap.data();
        const metricasActuales = proveedorActual.metricas || {};

        // Verificar si hay cambios en métricas
        const necesitaActualizar =
          metricasActuales.ordenesCompra !== totalOCs ||
          metricasActuales.montoTotalUSD !== totalCompras;

        if (necesitaActualizar) {
          batch.update(doc(db, 'proveedores', proveedorId), {
            metricas: {
              ...metricasActuales,
              ordenesCompra: totalOCs,
              montoTotalUSD: totalCompras
            },
            ultimaEdicion: serverTimestamp()
          });
          batchCount++;
          result.registrosActualizados++;

          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza órdenes de compra
   */
  async sincronizarOrdenesCompra(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Órdenes de Compra',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener productos existentes
      const productosSnap = await getDocs(collection(db, 'productos'));
      const productosIds = new Set(productosSnap.docs.map(d => d.id));

      // Obtener OCs
      const ocsSnap = await getDocs(collection(db, 'ordenesCompra'));

      for (const docSnap of ocsSnap.docs) {
        const oc = docSnap.data();
        const items = oc.items || [];
        let itemsActualizados = false;

        // Filtrar items con productos que ya no existen
        const itemsValidos = items.filter((item: any) => {
          if (!productosIds.has(item.productoId)) {
            result.referenciasLimpiadas++;
            itemsActualizados = true;
            return false;
          }
          return true;
        });

        if (itemsActualizados) {
          try {
            // Recalcular totales
            const subtotal = itemsValidos.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
            const totalUnidades = itemsValidos.reduce((sum: number, item: any) => sum + (item.cantidad || 0), 0);

            await updateDoc(doc(db, 'ordenesCompra', docSnap.id), {
              items: itemsValidos,
              subtotal,
              totalUnidades,
              totalUSD: subtotal + (oc.costoEnvio || 0) + (oc.otrosGastos || 0),
              ultimaEdicion: serverTimestamp()
            });
            result.registrosActualizados++;
          } catch (e: any) {
            result.errores.push(`Error actualizando OC ${docSnap.id}: ${e.message}`);
          }
        }
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza ventas
   */
  async sincronizarVentas(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Ventas',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener productos y clientes existentes
      const productosSnap = await getDocs(collection(db, 'productos'));
      const productosIds = new Set(productosSnap.docs.map(d => d.id));

      const clientesSnap = await getDocs(collection(db, 'clientes'));
      const clientesIds = new Set(clientesSnap.docs.map(d => d.id));

      // Obtener ventas
      const ventasSnap = await getDocs(collection(db, 'ventas'));

      for (const docSnap of ventasSnap.docs) {
        const venta = docSnap.data();
        let necesitaActualizar = false;
        const updates: any = {};

        // Verificar cliente
        if (venta.clienteId && !clientesIds.has(venta.clienteId)) {
          updates.clienteId = null;
          updates.clienteNombre = '[Cliente eliminado]';
          result.referenciasLimpiadas++;
          necesitaActualizar = true;
        }

        // Verificar items de productos
        const items = venta.items || [];
        const itemsValidos = items.filter((item: any) => {
          if (!productosIds.has(item.productoId)) {
            result.referenciasLimpiadas++;
            necesitaActualizar = true;
            return false;
          }
          return true;
        });

        if (itemsValidos.length !== items.length) {
          updates.items = itemsValidos;
          // Recalcular totales
          updates.subtotal = itemsValidos.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
          updates.total = updates.subtotal - (venta.descuento || 0);
        }

        if (necesitaActualizar) {
          try {
            updates.ultimaEdicion = serverTimestamp();
            await updateDoc(doc(db, 'ventas', docSnap.id), updates);
            result.registrosActualizados++;
          } catch (e: any) {
            result.errores.push(`Error actualizando venta ${docSnap.id}: ${e.message}`);
          }
        }
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza unidades
   */
  async sincronizarUnidades(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Unidades',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener productos, OCs y almacenes existentes
      const productosSnap = await getDocs(collection(db, 'productos'));
      const productosIds = new Set(productosSnap.docs.map(d => d.id));

      const ocsSnap = await getDocs(collection(db, 'ordenesCompra'));
      const ocsIds = new Set(ocsSnap.docs.map(d => d.id));

      const almacenesSnap = await getDocs(collection(db, 'almacenes'));
      const almacenesIds = new Set(almacenesSnap.docs.map(d => d.id));

      // Obtener unidades
      const unidadesSnap = await getDocs(collection(db, 'unidades'));

      for (const docSnap of unidadesSnap.docs) {
        const unidad = docSnap.data();
        let eliminar = false;

        // Si el producto no existe, eliminar unidad
        if (!productosIds.has(unidad.productoId)) {
          eliminar = true;
        }

        // Si la OC no existe, eliminar unidad
        if (unidad.ordenCompraId && !ocsIds.has(unidad.ordenCompraId)) {
          eliminar = true;
        }

        if (eliminar) {
          try {
            await deleteDoc(doc(db, 'unidades', docSnap.id));
            result.registrosEliminados++;
          } catch (e: any) {
            result.errores.push(`Error eliminando unidad ${docSnap.id}: ${e.message}`);
          }
          continue;
        }

        // Verificar almacén
        if (unidad.almacenActualId && !almacenesIds.has(unidad.almacenActualId)) {
          try {
            await updateDoc(doc(db, 'unidades', docSnap.id), {
              almacenActualId: null,
              almacenActualNombre: '[Almacén eliminado]',
              ultimaEdicion: serverTimestamp()
            });
            result.referenciasLimpiadas++;
          } catch (e: any) {
            result.errores.push(`Error actualizando unidad ${docSnap.id}: ${e.message}`);
          }
        }
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza clientes
   */
  async sincronizarClientes(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Clientes',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener clientes
      const clientesSnap = await getDocs(collection(db, 'clientes'));

      // Obtener ventas para recalcular métricas
      const ventasSnap = await getDocs(collection(db, 'ventas'));

      const batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of clientesSnap.docs) {
        const clienteId = docSnap.id;
        const cliente = docSnap.data();

        // Calcular métricas reales desde ventas
        const ventasCliente = ventasSnap.docs.filter(d =>
          d.data().clienteId === clienteId && d.data().estado !== 'anulada'
        );

        const totalVentas = ventasCliente.length;
        const totalCompras = ventasCliente.reduce((sum, d) => sum + (d.data().total || 0), 0);

        // Solo actualizar si hay diferencias
        if (cliente.totalVentas !== totalVentas || cliente.totalCompras !== totalCompras) {
          batch.update(doc(db, 'clientes', clienteId), {
            totalVentas,
            totalCompras,
            ultimaEdicion: serverTimestamp()
          });
          batchCount++;
          result.registrosActualizados++;

          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza almacenes
   */
  async sincronizarAlmacenes(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Almacenes',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener almacenes
      const almacenesSnap = await getDocs(collection(db, 'almacenes'));

      // Obtener unidades para recalcular stock por almacén
      const unidadesSnap = await getDocs(collection(db, 'unidades'));

      const stockPorAlmacen = new Map<string, number>();
      for (const docSnap of unidadesSnap.docs) {
        const unidad = docSnap.data();
        if (['recibida_usa', 'disponible_peru', 'asignada_pedido', 'en_despacho'].includes(unidad.estado)) {
          const almacenId = unidad.almacenActualId;
          if (almacenId) {
            stockPorAlmacen.set(almacenId, (stockPorAlmacen.get(almacenId) || 0) + 1);
          }
        }
      }

      const batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of almacenesSnap.docs) {
        const almacenId = docSnap.id;
        const almacen = docSnap.data();
        const stockReal = stockPorAlmacen.get(almacenId) || 0;

        if (almacen.stockActual !== stockReal) {
          batch.update(doc(db, 'almacenes', almacenId), {
            stockActual: stockReal,
            ultimaEdicion: serverTimestamp()
          });
          batchCount++;
          result.registrosActualizados++;

          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza transferencias
   */
  async sincronizarTransferencias(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Transferencias',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener almacenes y unidades existentes
      const almacenesSnap = await getDocs(collection(db, 'almacenes'));
      const almacenesIds = new Set(almacenesSnap.docs.map(d => d.id));

      const unidadesSnap = await getDocs(collection(db, 'unidades'));
      const unidadesIds = new Set(unidadesSnap.docs.map(d => d.id));

      // Obtener transferencias
      const transferenciasSnap = await getDocs(collection(db, 'transferencias'));

      for (const docSnap of transferenciasSnap.docs) {
        const transferencia = docSnap.data();
        let necesitaActualizar = false;
        const updates: any = {};

        // Verificar almacén origen
        if (transferencia.almacenOrigenId && !almacenesIds.has(transferencia.almacenOrigenId)) {
          updates.almacenOrigenId = null;
          updates.almacenOrigenNombre = '[Almacén eliminado]';
          result.referenciasLimpiadas++;
          necesitaActualizar = true;
        }

        // Verificar almacén destino
        if (transferencia.almacenDestinoId && !almacenesIds.has(transferencia.almacenDestinoId)) {
          updates.almacenDestinoId = null;
          updates.almacenDestinoNombre = '[Almacén eliminado]';
          result.referenciasLimpiadas++;
          necesitaActualizar = true;
        }

        // Verificar unidades
        const unidadesTransf = transferencia.unidadIds || [];
        const unidadesValidas = unidadesTransf.filter((id: string) => unidadesIds.has(id));
        if (unidadesValidas.length !== unidadesTransf.length) {
          updates.unidadIds = unidadesValidas;
          updates.totalUnidades = unidadesValidas.length;
          result.referenciasLimpiadas += (unidadesTransf.length - unidadesValidas.length);
          necesitaActualizar = true;
        }

        if (necesitaActualizar) {
          try {
            updates.ultimaEdicion = serverTimestamp();
            await updateDoc(doc(db, 'transferencias', docSnap.id), updates);
            result.registrosActualizados++;
          } catch (e: any) {
            result.errores.push(`Error actualizando transferencia ${docSnap.id}: ${e.message}`);
          }
        }
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza gastos
   */
  async sincronizarGastos(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Gastos',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener ventas existentes
      const ventasSnap = await getDocs(collection(db, 'ventas'));
      const ventasIds = new Set(ventasSnap.docs.map(d => d.id));

      // Obtener gastos
      const gastosSnap = await getDocs(collection(db, 'gastos'));

      for (const docSnap of gastosSnap.docs) {
        const gasto = docSnap.data();

        // Si el gasto está asociado a una venta que ya no existe
        if (gasto.ventaId && !ventasIds.has(gasto.ventaId)) {
          try {
            await updateDoc(doc(db, 'gastos', docSnap.id), {
              ventaId: null,
              ventaNumero: null,
              ultimaEdicion: serverTimestamp()
            });
            result.referenciasLimpiadas++;
          } catch (e: any) {
            result.errores.push(`Error actualizando gasto ${docSnap.id}: ${e.message}`);
          }
        }
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza cotizaciones
   */
  async sincronizarCotizaciones(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Cotizaciones',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener productos y clientes existentes
      const productosSnap = await getDocs(collection(db, 'productos'));
      const productosIds = new Set(productosSnap.docs.map(d => d.id));

      const clientesSnap = await getDocs(collection(db, 'clientes'));
      const clientesIds = new Set(clientesSnap.docs.map(d => d.id));

      // Obtener cotizaciones
      const cotizacionesSnap = await getDocs(collection(db, 'cotizaciones'));

      for (const docSnap of cotizacionesSnap.docs) {
        const cotizacion = docSnap.data();
        let necesitaActualizar = false;
        const updates: any = {};

        // Verificar cliente
        if (cotizacion.clienteId && !clientesIds.has(cotizacion.clienteId)) {
          updates.clienteId = null;
          updates.clienteNombre = '[Cliente eliminado]';
          result.referenciasLimpiadas++;
          necesitaActualizar = true;
        }

        // Verificar items de productos
        const items = cotizacion.items || [];
        const itemsValidos = items.filter((item: any) => {
          if (!productosIds.has(item.productoId)) {
            result.referenciasLimpiadas++;
            necesitaActualizar = true;
            return false;
          }
          return true;
        });

        if (itemsValidos.length !== items.length) {
          updates.items = itemsValidos;
          updates.subtotal = itemsValidos.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
          updates.total = updates.subtotal - (cotizacion.descuento || 0);
        }

        if (necesitaActualizar) {
          try {
            updates.ultimaEdicion = serverTimestamp();
            await updateDoc(doc(db, 'cotizaciones', docSnap.id), updates);
            result.registrosActualizados++;
          } catch (e: any) {
            result.errores.push(`Error actualizando cotización ${docSnap.id}: ${e.message}`);
          }
        }
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza tipos de producto y actualiza contadores de productos
   */
  async sincronizarTiposProducto(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Tipos de Producto',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener todos los tipos de producto
      const tiposSnap = await getDocs(collection(db, 'tiposProducto'));

      // Obtener productos para contar cuántos hay por tipo
      const productosSnap = await getDocs(collection(db, 'productos'));
      const productosPorTipo = new Map<string, { total: number; activos: number }>();

      // Contar productos por tipoProductoId
      for (const docSnap of productosSnap.docs) {
        const producto = docSnap.data();
        const tipoId = producto.tipoProductoId;
        if (tipoId) {
          const current = productosPorTipo.get(tipoId) || { total: 0, activos: 0 };
          current.total++;
          if (producto.estado === 'activo') {
            current.activos++;
          }
          productosPorTipo.set(tipoId, current);
        }
      }

      const batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of tiposSnap.docs) {
        const tipoId = docSnap.id;
        const tipo = docSnap.data();
        const conteo = productosPorTipo.get(tipoId) || { total: 0, activos: 0 };

        const metricasActuales = tipo.metricas || {};
        const necesitaActualizar =
          metricasActuales.productosTotal !== conteo.total ||
          metricasActuales.productosActivos !== conteo.activos;

        if (necesitaActualizar) {
          batch.update(doc(db, 'tiposProducto', tipoId), {
            metricas: {
              ...metricasActuales,
              productosTotal: conteo.total,
              productosActivos: conteo.activos
            },
            ultimaEdicion: serverTimestamp()
          });
          batchCount++;
          result.registrosActualizados++;

          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza categorías y actualiza contadores de productos
   */
  async sincronizarCategorias(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Categorías',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener todas las categorías
      const categoriasSnap = await getDocs(collection(db, 'categorias'));

      // Obtener productos para contar cuántos hay por categoría
      const productosSnap = await getDocs(collection(db, 'productos'));
      const productosPorCategoria = new Map<string, { total: number; activos: number }>();

      // Contar productos por categoría (array-contains)
      for (const docSnap of productosSnap.docs) {
        const producto = docSnap.data();
        const categoriaIds = producto.categoriaIds || [];

        for (const catId of categoriaIds) {
          const current = productosPorCategoria.get(catId) || { total: 0, activos: 0 };
          current.total++;
          if (producto.estado === 'activo') {
            current.activos++;
          }
          productosPorCategoria.set(catId, current);
        }
      }

      const batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of categoriasSnap.docs) {
        const catId = docSnap.id;
        const categoria = docSnap.data();
        const conteo = productosPorCategoria.get(catId) || { total: 0, activos: 0 };

        const necesitaActualizar =
          categoria.productosTotal !== conteo.total ||
          categoria.productosActivos !== conteo.activos;

        if (necesitaActualizar) {
          batch.update(doc(db, 'categorias', catId), {
            productosTotal: conteo.total,
            productosActivos: conteo.activos,
            ultimaEdicion: serverTimestamp()
          });
          batchCount++;
          result.registrosActualizados++;

          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza marcas y actualiza contadores de productos
   */
  async sincronizarMarcas(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Marcas',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener todas las marcas
      const marcasSnap = await getDocs(collection(db, 'marcas'));

      // Obtener productos para contar cuántos hay por marca
      const productosSnap = await getDocs(collection(db, 'productos'));
      const productosPorMarca = new Map<string, { total: number; activos: number }>();

      // Contar productos por marcaId
      for (const docSnap of productosSnap.docs) {
        const producto = docSnap.data();
        const marcaId = producto.marcaId;
        if (marcaId) {
          const current = productosPorMarca.get(marcaId) || { total: 0, activos: 0 };
          current.total++;
          if (producto.estado === 'activo') {
            current.activos++;
          }
          productosPorMarca.set(marcaId, current);
        }
      }

      const batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of marcasSnap.docs) {
        const marcaId = docSnap.id;
        const marca = docSnap.data();
        const conteo = productosPorMarca.get(marcaId) || { total: 0, activos: 0 };

        const necesitaActualizar =
          marca.productosTotal !== conteo.total ||
          marca.productosActivos !== conteo.activos;

        if (necesitaActualizar) {
          batch.update(doc(db, 'marcas', marcaId), {
            productosTotal: conteo.total,
            productosActivos: conteo.activos,
            ultimaEdicion: serverTimestamp()
          });
          batchCount++;
          result.registrosActualizados++;

          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Sincroniza competidores y actualiza contadores de productos analizados
   */
  async sincronizarCompetidores(): Promise<SincronizacionResult> {
    const result: SincronizacionResult = {
      modulo: 'Competidores',
      registrosActualizados: 0,
      registrosEliminados: 0,
      referenciasLimpiadas: 0,
      errores: []
    };

    try {
      // Obtener todos los competidores
      const competidoresSnap = await getDocs(collection(db, 'competidores'));

      // Obtener productos para contar investigaciones por competidor
      const productosSnap = await getDocs(collection(db, 'productos'));

      // Contar productos analizados por competidorId
      const productosPorCompetidor = new Map<string, { count: number; precioTotal: number }>();

      for (const docSnap of productosSnap.docs) {
        const producto = docSnap.data();
        const investigacion = producto.investigacion;

        // Si el producto tiene investigación con competidores
        if (investigacion && Array.isArray(investigacion.competidoresPeru)) {
          for (const comp of investigacion.competidoresPeru) {
            if (comp.competidorId) {
              const current = productosPorCompetidor.get(comp.competidorId) || { count: 0, precioTotal: 0 };
              current.count++;
              current.precioTotal += comp.precio || 0;
              productosPorCompetidor.set(comp.competidorId, current);
            }
          }
        }
      }

      const batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of competidoresSnap.docs) {
        const competidorId = docSnap.id;
        const competidor = docSnap.data();
        const datos = productosPorCompetidor.get(competidorId) || { count: 0, precioTotal: 0 };

        const metricasActuales = competidor.metricas || {};
        const precioPromedio = datos.count > 0 ? datos.precioTotal / datos.count : 0;

        // Verificar si hay cambios
        const necesitaActualizar =
          metricasActuales.productosAnalizados !== datos.count ||
          Math.abs((metricasActuales.precioPromedio || 0) - precioPromedio) > 0.01;

        if (necesitaActualizar) {
          batch.update(doc(db, 'competidores', competidorId), {
            metricas: {
              ...metricasActuales,
              productosAnalizados: datos.count,
              precioPromedio: precioPromedio,
              ultimaActualizacion: serverTimestamp()
            },
            fechaActualizacion: serverTimestamp()
          });
          batchCount++;
          result.registrosActualizados++;

          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (error: any) {
      result.errores.push(error.message);
    }

    return result;
  }

  /**
   * Fuerza la recarga de todos los stores
   * Esto debe llamarse después de la sincronización
   */
  async invalidarCaches(): Promise<void> {
    // Los stores de Zustand se recargarán automáticamente
    // cuando los componentes vuelvan a montar o cuando
    // se llame a sus métodos fetch
    console.log('[Sincronización] Caches invalidados - los stores se recargarán');
  }
}

export const sincronizacionService = new SincronizacionService();
