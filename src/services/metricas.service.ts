/**
 * Servicio de Métricas Transversales
 *
 * Actualiza automáticamente las métricas en el Gestor Maestro cuando ocurren eventos
 * en otros módulos (ventas, compras, investigaciones, cotizaciones).
 *
 * Este servicio es el "cerebro" que conecta la información transversal del negocio.
 */

import {
  doc,
  updateDoc,
  increment,
  arrayUnion,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type { Venta } from '../types/venta.types';
import type { OrdenCompra } from '../types/ordenCompra.types';

const CLIENTES_COLLECTION = 'clientes';
const MARCAS_COLLECTION = 'marcas';

export const metricasService = {
  /**
   * Actualizar métricas del cliente después de una venta
   *
   * Se llama cuando:
   * - Se confirma una venta
   * - Se completa el pago de una venta
   * - Se entrega una venta
   */
  async actualizarMetricasClientePorVenta(
    clienteId: string,
    datosVenta: { totalPEN: number; productos: Array<{ sku: string; marca: string; nombreComercial: string }> }
  ): Promise<void> {
    if (!clienteId) return;

    try {
      const clienteRef = doc(db, CLIENTES_COLLECTION, clienteId);

      // Extraer productos únicos para favoritos
      const productosComprados = datosVenta.productos?.map(p => `${p.marca} ${p.nombreComercial}`) || [];

      const updates: Record<string, unknown> = {
        'metricas.totalCompras': increment(1),
        'metricas.montoTotalPEN': increment(datosVenta.totalPEN),
        'metricas.ultimaCompra': serverTimestamp(),
        fechaActualizacion: serverTimestamp()
      };

      // Agregar productos a frecuentes (máximo 10)
      if (productosComprados.length > 0) {
        updates['metricas.productosFrecuentes'] = arrayUnion(...productosComprados.slice(0, 3));
      }

      await updateDoc(clienteRef, updates);
      logger.success(`Métricas actualizadas para cliente ${clienteId}`);
    } catch (error: any) {
      console.error('Error actualizando métricas del cliente:', error);
      // No lanzamos error para no interrumpir el flujo principal
    }
  },

  /**
   * Actualizar métricas de la marca después de una venta
   *
   * Se llama cuando se completa una venta con productos de esa marca
   */
  async actualizarMetricasMarcaPorVenta(
    marcaId: string,
    datosVenta: {
      unidadesVendidas: number;
      ventaTotalPEN: number;
      margenReal?: number;
    }
  ): Promise<void> {
    if (!marcaId) return;

    try {
      const marcaRef = doc(db, MARCAS_COLLECTION, marcaId);

      const updates: Record<string, unknown> = {
        'metricas.unidadesVendidas': increment(datosVenta.unidadesVendidas),
        'metricas.ventasTotalPEN': increment(datosVenta.ventaTotalPEN),
        fechaActualizacion: serverTimestamp()
      };

      // Actualizar margen promedio si se proporciona
      // Nota: Esto es una simplificación. En producción, calcularíamos el promedio ponderado
      if (datosVenta.margenReal !== undefined) {
        updates['metricas.ultimoMargen'] = datosVenta.margenReal;
      }

      await updateDoc(marcaRef, updates);
      logger.success(`Métricas actualizadas para marca ${marcaId}`);
    } catch (error: any) {
      console.error('Error actualizando métricas de marca:', error);
    }
  },

  /**
   * Incrementar contador de productos activos de una marca
   *
   * Se llama cuando se crea un nuevo producto con esa marca
   */
  async incrementarProductosMarca(marcaId: string): Promise<void> {
    if (!marcaId) return;

    try {
      const marcaRef = doc(db, MARCAS_COLLECTION, marcaId);
      await updateDoc(marcaRef, {
        'metricas.productosActivos': increment(1),
        fechaActualizacion: serverTimestamp()
      });
      logger.success(`Productos activos incrementados para marca ${marcaId}`);
    } catch (error: any) {
      console.error('Error incrementando productos de marca:', error);
    }
  },

  /**
   * Decrementar contador de productos activos de una marca
   *
   * Se llama cuando se desactiva o elimina un producto de esa marca
   */
  async decrementarProductosMarca(marcaId: string): Promise<void> {
    if (!marcaId) return;

    try {
      const marcaRef = doc(db, MARCAS_COLLECTION, marcaId);
      await updateDoc(marcaRef, {
        'metricas.productosActivos': increment(-1),
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error decrementando productos de marca:', error);
    }
  },

  /**
   * Actualizar ticket promedio del cliente
   *
   * Se debe llamar después de actualizar el total de compras y monto
   */
  async recalcularTicketPromedioCliente(
    clienteId: string,
    totalCompras: number,
    montoTotalPEN: number
  ): Promise<void> {
    if (!clienteId || totalCompras === 0) return;

    try {
      const ticketPromedio = montoTotalPEN / totalCompras;
      const clienteRef = doc(db, CLIENTES_COLLECTION, clienteId);

      await updateDoc(clienteRef, {
        'metricas.ticketPromedio': ticketPromedio,
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error recalculando ticket promedio:', error);
    }
  },

  /**
   * Registrar interacción con el cliente
   *
   * Se llama cuando hay cualquier interacción (cotización, consulta, etc.)
   */
  async registrarInteraccionCliente(
    clienteId: string,
    tipoInteraccion: 'cotizacion' | 'consulta' | 'reclamo' | 'seguimiento'
  ): Promise<void> {
    if (!clienteId) return;

    try {
      const clienteRef = doc(db, CLIENTES_COLLECTION, clienteId);

      await updateDoc(clienteRef, {
        ultimaInteraccion: serverTimestamp(),
        [`contadorInteracciones.${tipoInteraccion}`]: increment(1),
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error registrando interacción:', error);
    }
  },

  /**
   * Actualizar proveedores preferidos de una marca
   *
   * Se llama cuando se hace una compra exitosa a un proveedor con productos de esa marca
   */
  async actualizarProveedorPreferidoMarca(
    marcaId: string,
    proveedorId: string
  ): Promise<void> {
    if (!marcaId || !proveedorId) return;

    try {
      const marcaRef = doc(db, MARCAS_COLLECTION, marcaId);
      await updateDoc(marcaRef, {
        proveedoresPreferidos: arrayUnion(proveedorId),
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error actualizando proveedor preferido:', error);
    }
  },

  /**
   * Procesar una venta completa y actualizar todas las métricas relacionadas
   *
   * Este es el método principal que se debe llamar cuando se completa una venta.
   * Actualiza automáticamente cliente, marcas y cualquier otra entidad relacionada.
   */
  async procesarVentaCompleta(
    venta: Venta,
    marcaIds?: Map<string, string> // Map de SKU -> marcaId
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // 1. Actualizar métricas del cliente
    if (venta.clienteId) {
      promises.push(
        this.actualizarMetricasClientePorVenta(venta.clienteId, {
          totalPEN: venta.totalPEN,
          productos: venta.productos.map(p => ({
            sku: p.sku,
            marca: p.marca,
            nombreComercial: p.nombreComercial
          }))
        })
      );
    }

    // 2. Actualizar métricas de las marcas (si se proporcionan los IDs)
    if (marcaIds && marcaIds.size > 0) {
      // Agrupar productos por marca
      const ventasPorMarca = new Map<string, { unidades: number; total: number }>();

      for (const producto of venta.productos) {
        const marcaId = marcaIds.get(producto.sku);
        if (marcaId) {
          const actual = ventasPorMarca.get(marcaId) || { unidades: 0, total: 0 };
          ventasPorMarca.set(marcaId, {
            unidades: actual.unidades + producto.cantidad,
            total: actual.total + producto.subtotal
          });
        }
      }

      // Actualizar cada marca
      for (const [marcaId, datos] of ventasPorMarca) {
        promises.push(
          this.actualizarMetricasMarcaPorVenta(marcaId, {
            unidadesVendidas: datos.unidades,
            ventaTotalPEN: datos.total,
            margenReal: venta.margenPromedio
          })
        );
      }
    }

    // Ejecutar todas las actualizaciones en paralelo
    await Promise.allSettled(promises);
    logger.success('Métricas de venta procesadas');
  },

  /**
   * Sincronizar métricas de clientes basándose en ventas existentes
   *
   * Esta función recalcula las métricas de todos los clientes basándose
   * en las ventas que tienen el campo clienteId vinculado.
   * Útil para sincronización inicial o corrección de datos.
   */
  async sincronizarMetricasClientes(): Promise<{
    clientesActualizados: number;
    ventasProcesadas: number;
    errores: string[];
  }> {
    const errores: string[] = [];
    let clientesActualizados = 0;
    let ventasProcesadas = 0;

    try {
      // Obtener todas las ventas (excepto canceladas)
      const { collection, getDocs } = await import('firebase/firestore');

      const ventasSnap = await getDocs(collection(db, 'ventas'));
      const ventas = ventasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((v: any) => v.estado !== 'cancelada') as any[];

      console.log(`[sincronizarMetricasClientes] Total ventas (no canceladas): ${ventas.length}`);

      // Agrupar ventas por clienteId
      const ventasPorCliente = new Map<string, {
        totalCompras: number;
        montoTotal: number;
        productos: string[];
        ultimaCompra: Date | null;
      }>();

      // Contar ventas sin clienteId
      const ventasSinCliente = ventas.filter((v: any) => !v.clienteId);
      console.log(`[sincronizarMetricasClientes] Ventas sin clienteId: ${ventasSinCliente.length}`);
      if (ventasSinCliente.length > 0) {
        console.log(`[sincronizarMetricasClientes] Ejemplos sin clienteId:`, ventasSinCliente.slice(0, 3).map((v: any) => ({
          numero: v.numeroVenta,
          cliente: v.nombreCliente,
          telefono: v.telefonoCliente,
          estado: v.estado
        })));
      }

      for (const venta of ventas) {
        if (!venta.clienteId) continue;

        ventasProcesadas++;
        const datos = ventasPorCliente.get(venta.clienteId) || {
          totalCompras: 0,
          montoTotal: 0,
          productos: [],
          ultimaCompra: null
        };

        datos.totalCompras++;
        datos.montoTotal += venta.totalPEN || 0;

        // Actualizar última compra
        const fechaVenta = venta.fechaCreacion?.toDate?.() || (venta.fechaCreacion ? new Date(venta.fechaCreacion) : null);
        if (fechaVenta && (!datos.ultimaCompra || fechaVenta > datos.ultimaCompra)) {
          datos.ultimaCompra = fechaVenta;
        }

        // Extraer productos
        if (venta.productos) {
          for (const p of venta.productos) {
            const prodKey = `${p.marca} ${p.nombreComercial}`;
            if (!datos.productos.includes(prodKey)) {
              datos.productos.push(prodKey);
            }
          }
        }

        ventasPorCliente.set(venta.clienteId, datos);
      }

      // Actualizar cada cliente
      const { updateDoc, doc, serverTimestamp, Timestamp } = await import('firebase/firestore');

      for (const [clienteId, datos] of ventasPorCliente) {
        try {
          const clienteRef = doc(db, CLIENTES_COLLECTION, clienteId);
          const ticketPromedio = datos.totalCompras > 0 ? datos.montoTotal / datos.totalCompras : 0;

          const updateData: Record<string, any> = {
            'metricas.totalCompras': datos.totalCompras,
            'metricas.montoTotalPEN': datos.montoTotal,
            'metricas.ticketPromedio': ticketPromedio,
            'metricas.productosFrecuentes': datos.productos.slice(0, 10),
            fechaActualizacion: serverTimestamp()
          };

          // Agregar ultimaCompra si existe
          if (datos.ultimaCompra) {
            updateData['metricas.ultimaCompra'] = Timestamp.fromDate(datos.ultimaCompra);
          }

          await updateDoc(clienteRef, updateData);

          console.log(`[sincronizarMetricasClientes] Cliente ${clienteId}: ${datos.totalCompras} compras, S/${datos.montoTotal}, ultimaCompra: ${datos.ultimaCompra?.toISOString()}`);
          clientesActualizados++;
        } catch (error: any) {
          errores.push(`Cliente ${clienteId}: ${error.message}`);
        }
      }

      logger.success(`Sincronización completada: ${clientesActualizados} clientes, ${ventasProcesadas} ventas`);
    } catch (error: any) {
      errores.push(`Error general: ${error.message}`);
      console.error('Error en sincronización de métricas:', error);
    }

    return { clientesActualizados, ventasProcesadas, errores };
  },

  /**
   * Sincronizar métricas de marcas basándose en productos existentes
   *
   * Recalcula productosActivos para cada marca basándose en los productos
   * que tienen marcaId vinculado y están activos.
   */
  async sincronizarMetricasMarcas(): Promise<{
    marcasActualizadas: number;
    productosProcesados: number;
    errores: string[];
  }> {
    const errores: string[] = [];
    let marcasActualizadas = 0;
    let productosProcesados = 0;

    try {
      const { collection, getDocs, query, where, updateDoc, doc, serverTimestamp } = await import('firebase/firestore');

      // Obtener productos activos con marcaId
      const productosQuery = query(
        collection(db, 'productos'),
        where('estado', '==', 'activo')
      );

      const productosSnap = await getDocs(productosQuery);
      const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      // Agrupar por marcaId
      const productosPorMarca = new Map<string, number>();

      for (const producto of productos) {
        if (!producto.marcaId) continue;

        productosProcesados++;
        const count = productosPorMarca.get(producto.marcaId) || 0;
        productosPorMarca.set(producto.marcaId, count + 1);
      }

      // Actualizar cada marca
      for (const [marcaId, productosActivos] of productosPorMarca) {
        try {
          const marcaRef = doc(db, MARCAS_COLLECTION, marcaId);

          await updateDoc(marcaRef, {
            'metricas.productosActivos': productosActivos,
            fechaActualizacion: serverTimestamp()
          });

          marcasActualizadas++;
        } catch (error: any) {
          errores.push(`Marca ${marcaId}: ${error.message}`);
        }
      }

      logger.success(`Sincronización de marcas completada: ${marcasActualizadas} marcas, ${productosProcesados} productos`);
    } catch (error: any) {
      errores.push(`Error general: ${error.message}`);
      console.error('Error en sincronización de métricas de marcas:', error);
    }

    return { marcasActualizadas, productosProcesados, errores };
  },

  /**
   * Vincular ventas existentes con clientes del maestro
   *
   * Busca ventas sin clienteId y trata de vincularlas con clientes existentes
   * basándose en nombre, teléfono o DNI/RUC.
   */
  async vincularVentasConClientes(): Promise<{
    ventasVinculadas: number;
    ventasSinVincular: number;
    errores: string[];
  }> {
    const errores: string[] = [];
    let ventasVinculadas = 0;
    let ventasSinVincular = 0;

    try {
      const { collection, getDocs, query, where, updateDoc, doc } = await import('firebase/firestore');

      // Obtener ventas sin clienteId
      const ventasSnap = await getDocs(collection(db, 'ventas'));
      const ventasSinCliente = ventasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((v: any) => !v.clienteId && v.estado !== 'cancelada') as any[];

      // Obtener todos los clientes
      const clientesSnap = await getDocs(collection(db, CLIENTES_COLLECTION));
      const clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      for (const venta of ventasSinCliente) {
        // Buscar cliente por coincidencia
        let clienteEncontrado: any = null;

        // 1. Buscar por DNI/RUC (más preciso)
        if (venta.dniRuc) {
          clienteEncontrado = clientes.find(c => c.dniRuc === venta.dniRuc);
        }

        // 2. Buscar por teléfono
        if (!clienteEncontrado && venta.telefonoCliente) {
          const telLimpio = venta.telefonoCliente.replace(/\D/g, '');
          clienteEncontrado = clientes.find(c => {
            const telCliente = c.telefono?.replace(/\D/g, '');
            return telCliente && telCliente.includes(telLimpio.slice(-9));
          });
        }

        // 3. Buscar por nombre exacto
        if (!clienteEncontrado && venta.nombreCliente) {
          const nombreNorm = venta.nombreCliente.toLowerCase().trim();
          clienteEncontrado = clientes.find(c =>
            c.nombre?.toLowerCase().trim() === nombreNorm
          );
        }

        if (clienteEncontrado) {
          try {
            await updateDoc(doc(db, 'ventas', venta.id), {
              clienteId: clienteEncontrado.id
            });
            ventasVinculadas++;
          } catch (error: any) {
            errores.push(`Venta ${venta.id}: ${error.message}`);
          }
        } else {
          ventasSinVincular++;
        }
      }

      logger.success(`Vinculación completada: ${ventasVinculadas} vinculadas, ${ventasSinVincular} sin vincular`);
    } catch (error: any) {
      errores.push(`Error general: ${error.message}`);
      console.error('Error vinculando ventas:', error);
    }

    return { ventasVinculadas, ventasSinVincular, errores };
  },

  /**
   * Vincular productos existentes con marcas del maestro
   *
   * Busca productos sin marcaId y los vincula con marcas existentes
   * basándose en el nombre de la marca.
   */
  async vincularProductosConMarcas(): Promise<{
    productosVinculados: number;
    productosSinVincular: number;
    marcasCreadas: number;
    errores: string[];
  }> {
    const errores: string[] = [];
    let productosVinculados = 0;
    let productosSinVincular = 0;
    let marcasCreadas = 0;

    try {
      const { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp } = await import('firebase/firestore');

      // Obtener productos sin marcaId
      const productosSnap = await getDocs(collection(db, 'productos'));
      const productosSinMarca = productosSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((p: any) => !p.marcaId && p.estado === 'activo') as any[];

      // Obtener todas las marcas
      const marcasSnap = await getDocs(collection(db, MARCAS_COLLECTION));
      const marcas = marcasSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      // Crear mapa de marcas por nombre normalizado
      const marcasPorNombre = new Map<string, any>();
      for (const marca of marcas) {
        const nombreNorm = marca.nombre?.toLowerCase().trim();
        if (nombreNorm) {
          marcasPorNombre.set(nombreNorm, marca);
        }
        // También agregar alias
        if (marca.alias) {
          for (const alias of marca.alias) {
            marcasPorNombre.set(alias.toLowerCase().trim(), marca);
          }
        }
      }

      for (const producto of productosSinMarca) {
        if (!producto.marca) {
          productosSinVincular++;
          continue;
        }

        const nombreMarcaNorm = producto.marca.toLowerCase().trim();
        let marcaEncontrada = marcasPorNombre.get(nombreMarcaNorm);

        // Si no existe la marca, crearla
        if (!marcaEncontrada) {
          try {
            const nuevaMarca = {
              nombre: producto.marca,
              codigo: `MRC-${Date.now()}`,
              estado: 'activa',
              tipoMarca: 'farmaceutica',
              alias: [],
              metricas: {
                productosActivos: 0,
                unidadesVendidas: 0,
                ventasTotalPEN: 0,
                margenPromedio: 0
              },
              fechaCreacion: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, MARCAS_COLLECTION), nuevaMarca);
            marcaEncontrada = { id: docRef.id, ...nuevaMarca };
            marcasPorNombre.set(nombreMarcaNorm, marcaEncontrada);
            marcasCreadas++;
          } catch (error: any) {
            errores.push(`Crear marca ${producto.marca}: ${error.message}`);
            productosSinVincular++;
            continue;
          }
        }

        // Vincular producto con marca
        try {
          await updateDoc(doc(db, 'productos', producto.id), {
            marcaId: marcaEncontrada.id
          });
          productosVinculados++;
        } catch (error: any) {
          errores.push(`Producto ${producto.id}: ${error.message}`);
          productosSinVincular++;
        }
      }

      logger.success(`Vinculación de productos completada: ${productosVinculados} vinculados, ${marcasCreadas} marcas creadas`);
    } catch (error: any) {
      errores.push(`Error general: ${error.message}`);
      console.error('Error vinculando productos:', error);
    }

    return { productosVinculados, productosSinVincular, marcasCreadas, errores };
  },

  /**
   * Sincronizar métricas de proveedores basándose en investigaciones de mercado
   *
   * Busca productos con investigación que tienen proveedoresUSA y vincula
   * los proveedores por nombre con la colección de proveedores del maestro.
   */
  async sincronizarMetricasProveedores(): Promise<{
    proveedoresActualizados: number;
    productosAnalizados: number;
    vinculacionesCreadas: number;
    errores: string[];
  }> {
    const errores: string[] = [];
    let proveedoresActualizados = 0;
    let productosAnalizados = 0;
    let vinculacionesCreadas = 0;

    try {
      const { collection, getDocs, updateDoc, doc, serverTimestamp } = await import('firebase/firestore');

      // Obtener todos los productos con investigación
      const productosSnap = await getDocs(collection(db, 'productos'));
      const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      // Obtener todos los proveedores del maestro
      const proveedoresSnap = await getDocs(collection(db, 'proveedores'));
      const proveedores = proveedoresSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      // Crear mapa de proveedores por nombre normalizado
      const proveedoresPorNombre = new Map<string, any>();
      for (const prov of proveedores) {
        if (prov.nombre) {
          const nombreNorm = prov.nombre.toLowerCase().trim();
          proveedoresPorNombre.set(nombreNorm, prov);
        }
      }

      // Agrupar datos por proveedor
      const datosPorProveedor = new Map<string, { productosAnalizados: number; precios: number[] }>();

      for (const producto of productos) {
        if (!producto.investigacion?.proveedoresUSA?.length) continue;

        productosAnalizados++;
        let productoModificado = false;
        const proveedoresActualizados: any[] = [];

        for (const provUSA of producto.investigacion.proveedoresUSA) {
          // Si ya tiene proveedorId, solo agregar a las métricas
          if (provUSA.proveedorId) {
            const datos = datosPorProveedor.get(provUSA.proveedorId) || { productosAnalizados: 0, precios: [] };
            datos.productosAnalizados++;
            if (provUSA.precio > 0) datos.precios.push(provUSA.precio);
            datosPorProveedor.set(provUSA.proveedorId, datos);
            proveedoresActualizados.push(provUSA);
            continue;
          }

          // Buscar proveedor por nombre
          if (!provUSA.nombre) {
            proveedoresActualizados.push(provUSA);
            continue;
          }

          const nombreNorm = provUSA.nombre.toLowerCase().trim();
          const proveedorEncontrado = proveedoresPorNombre.get(nombreNorm);

          if (proveedorEncontrado) {
            // Vincular y agregar a métricas
            const proveedorActualizado = { ...provUSA, proveedorId: proveedorEncontrado.id };
            proveedoresActualizados.push(proveedorActualizado);
            productoModificado = true;
            vinculacionesCreadas++;

            const datos = datosPorProveedor.get(proveedorEncontrado.id) || { productosAnalizados: 0, precios: [] };
            datos.productosAnalizados++;
            if (provUSA.precio > 0) datos.precios.push(provUSA.precio);
            datosPorProveedor.set(proveedorEncontrado.id, datos);
          } else {
            proveedoresActualizados.push(provUSA);
          }
        }

        // Actualizar producto si hubo cambios
        if (productoModificado) {
          try {
            await updateDoc(doc(db, 'productos', producto.id), {
              'investigacion.proveedoresUSA': proveedoresActualizados
            });
          } catch (error: any) {
            errores.push(`Producto ${producto.id}: ${error.message}`);
          }
        }
      }

      // Actualizar métricas de cada proveedor
      for (const [proveedorId, datos] of datosPorProveedor) {
        try {
          const precioPromedio = datos.precios.length > 0
            ? datos.precios.reduce((a, b) => a + b, 0) / datos.precios.length
            : 0;

          await updateDoc(doc(db, 'proveedores', proveedorId), {
            'metricas.productosAnalizados': datos.productosAnalizados,
            'metricas.precioPromedio': precioPromedio,
            'metricas.ultimaInvestigacion': serverTimestamp()
          });

          proveedoresActualizados++;
        } catch (error: any) {
          errores.push(`Proveedor ${proveedorId}: ${error.message}`);
        }
      }

      logger.success(`Sincronización de proveedores completada: ${proveedoresActualizados} actualizados, ${vinculacionesCreadas} vinculaciones`);
    } catch (error: any) {
      errores.push(`Error general: ${error.message}`);
      console.error('Error en sincronización de métricas de proveedores:', error);
    }

    return { proveedoresActualizados, productosAnalizados, vinculacionesCreadas, errores };
  },

  /**
   * Sincronizar métricas de competidores basándose en investigaciones de mercado
   *
   * Busca productos con investigación que tienen competidoresPeru y vincula
   * los competidores por nombre con la colección de competidores del maestro.
   */
  async sincronizarMetricasCompetidores(): Promise<{
    competidoresActualizados: number;
    productosAnalizados: number;
    vinculacionesCreadas: number;
    errores: string[];
  }> {
    const errores: string[] = [];
    let competidoresActualizados = 0;
    let productosAnalizados = 0;
    let vinculacionesCreadas = 0;

    try {
      const { collection, getDocs, updateDoc, doc, serverTimestamp } = await import('firebase/firestore');

      // Obtener todos los productos con investigación
      const productosSnap = await getDocs(collection(db, 'productos'));
      const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      // Obtener todos los competidores del maestro
      const competidoresSnap = await getDocs(collection(db, 'competidores'));
      const competidores = competidoresSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      // Crear mapa de competidores por nombre normalizado
      const competidoresPorNombre = new Map<string, any>();
      for (const comp of competidores) {
        if (comp.nombre) {
          const nombreNorm = comp.nombre.toLowerCase().trim();
          competidoresPorNombre.set(nombreNorm, comp);
        }
        // También por alias
        if (comp.alias) {
          for (const alias of comp.alias) {
            competidoresPorNombre.set(alias.toLowerCase().trim(), comp);
          }
        }
      }

      // Agrupar datos por competidor
      const datosPorCompetidor = new Map<string, { productosAnalizados: number; precios: number[] }>();

      for (const producto of productos) {
        if (!producto.investigacion?.competidoresPeru?.length) continue;

        productosAnalizados++;
        let productoModificado = false;
        const competidoresActualizadosArr: any[] = [];

        for (const compPeru of producto.investigacion.competidoresPeru) {
          // Si ya tiene competidorId, solo agregar a las métricas
          if (compPeru.competidorId) {
            const datos = datosPorCompetidor.get(compPeru.competidorId) || { productosAnalizados: 0, precios: [] };
            datos.productosAnalizados++;
            if (compPeru.precio > 0) datos.precios.push(compPeru.precio);
            datosPorCompetidor.set(compPeru.competidorId, datos);
            competidoresActualizadosArr.push(compPeru);
            continue;
          }

          // Buscar competidor por nombre
          if (!compPeru.nombre) {
            competidoresActualizadosArr.push(compPeru);
            continue;
          }

          const nombreNorm = compPeru.nombre.toLowerCase().trim();
          const competidorEncontrado = competidoresPorNombre.get(nombreNorm);

          if (competidorEncontrado) {
            // Vincular y agregar a métricas
            const competidorActualizado = { ...compPeru, competidorId: competidorEncontrado.id };
            competidoresActualizadosArr.push(competidorActualizado);
            productoModificado = true;
            vinculacionesCreadas++;

            const datos = datosPorCompetidor.get(competidorEncontrado.id) || { productosAnalizados: 0, precios: [] };
            datos.productosAnalizados++;
            if (compPeru.precio > 0) datos.precios.push(compPeru.precio);
            datosPorCompetidor.set(competidorEncontrado.id, datos);
          } else {
            competidoresActualizadosArr.push(compPeru);
          }
        }

        // Actualizar producto si hubo cambios
        if (productoModificado) {
          try {
            await updateDoc(doc(db, 'productos', producto.id), {
              'investigacion.competidoresPeru': competidoresActualizadosArr
            });
          } catch (error: any) {
            errores.push(`Producto ${producto.id}: ${error.message}`);
          }
        }
      }

      // Actualizar métricas de cada competidor
      for (const [competidorId, datos] of datosPorCompetidor) {
        try {
          const precioPromedio = datos.precios.length > 0
            ? datos.precios.reduce((a, b) => a + b, 0) / datos.precios.length
            : 0;

          await updateDoc(doc(db, 'competidores', competidorId), {
            'metricas.productosAnalizados': datos.productosAnalizados,
            'metricas.precioPromedio': precioPromedio,
            'metricas.ultimaActualizacion': serverTimestamp()
          });

          competidoresActualizados++;
        } catch (error: any) {
          errores.push(`Competidor ${competidorId}: ${error.message}`);
        }
      }

      logger.success(`Sincronización de competidores completada: ${competidoresActualizados} actualizados, ${vinculacionesCreadas} vinculaciones`);
    } catch (error: any) {
      errores.push(`Error general: ${error.message}`);
      console.error('Error en sincronización de métricas de competidores:', error);
    }

    return { competidoresActualizados, productosAnalizados, vinculacionesCreadas, errores };
  },

  /**
   * Sincronizar métricas de proveedores basándose en órdenes de compra
   *
   * Cuenta las órdenes de compra por proveedor y actualiza:
   * - ordenesCompra: número total de órdenes
   * - montoTotalUSD: suma de totalUSD de todas las órdenes
   * - ultimaCompra: fecha de la última orden
   * - productosComprados: lista de SKUs comprados
   */
  async sincronizarOrdenesProveedores(): Promise<{
    proveedoresActualizados: number;
    ordenesAnalizadas: number;
    errores: string[];
  }> {
    const errores: string[] = [];
    let proveedoresActualizados = 0;
    let ordenesAnalizadas = 0;

    try {
      const { collection, getDocs, updateDoc, doc, serverTimestamp, Timestamp } = await import('firebase/firestore');

      // Obtener todas las órdenes de compra (excepto canceladas)
      const ordenesSnap = await getDocs(collection(db, 'ordenesCompra'));
      const ordenes = ordenesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((o: any) => o.estado !== 'cancelada') as any[];

      // Agrupar datos por proveedorId
      const datosPorProveedor = new Map<string, {
        ordenesCompra: number;
        montoTotalUSD: number;
        productosComprados: Set<string>;
        ultimaCompra: any;
        ordenesCompletadas: number;
      }>();

      for (const orden of ordenes) {
        if (!orden.proveedorId) continue;

        ordenesAnalizadas++;
        const datos = datosPorProveedor.get(orden.proveedorId) || {
          ordenesCompra: 0,
          montoTotalUSD: 0,
          productosComprados: new Set<string>(),
          ultimaCompra: null,
          ordenesCompletadas: 0
        };

        datos.ordenesCompra++;
        datos.montoTotalUSD += orden.totalUSD || 0;

        // Contar órdenes completadas/recibidas
        if (orden.estado === 'recibida' || orden.estado === 'completada') {
          datos.ordenesCompletadas++;
        }

        // Actualizar última compra
        const fechaOrden = orden.fechaCreacion?.toDate?.() || orden.fechaCreacion;
        if (fechaOrden && (!datos.ultimaCompra || fechaOrden > datos.ultimaCompra)) {
          datos.ultimaCompra = fechaOrden;
        }

        // Agregar productos comprados
        if (orden.productos) {
          for (const prod of orden.productos) {
            if (prod.sku) {
              datos.productosComprados.add(prod.sku);
            }
          }
        }

        datosPorProveedor.set(orden.proveedorId, datos);
      }

      // Actualizar métricas de cada proveedor
      for (const [proveedorId, datos] of datosPorProveedor) {
        try {
          const updateData: Record<string, any> = {
            'metricas.ordenesCompra': datos.ordenesCompra,
            'metricas.montoTotalUSD': datos.montoTotalUSD,
            'metricas.productosComprados': Array.from(datos.productosComprados),
            'metricas.ordenesCompletadas': datos.ordenesCompletadas
          };

          if (datos.ultimaCompra) {
            updateData['metricas.ultimaCompra'] = Timestamp.fromDate(
              datos.ultimaCompra instanceof Date ? datos.ultimaCompra : new Date(datos.ultimaCompra)
            );
          }

          await updateDoc(doc(db, 'proveedores', proveedorId), updateData);
          proveedoresActualizados++;
        } catch (error: any) {
          errores.push(`Proveedor ${proveedorId}: ${error.message}`);
        }
      }

      logger.success(`Sincronización de órdenes de proveedores completada: ${proveedoresActualizados} actualizados, ${ordenesAnalizadas} órdenes`);
    } catch (error: any) {
      errores.push(`Error general: ${error.message}`);
      console.error('Error en sincronización de órdenes de proveedores:', error);
    }

    return { proveedoresActualizados, ordenesAnalizadas, errores };
  },

  /**
   * Sincronizar métricas de marcas basándose en ventas existentes
   *
   * Calcula para cada marca:
   * - unidadesVendidas: suma de todas las unidades vendidas
   * - ventasTotalPEN: suma de todas las ventas en PEN
   * - margenPromedio: promedio ponderado de márgenes
   * - ultimaVenta: fecha de la última venta
   */
  async sincronizarVentasMarcas(): Promise<{
    marcasActualizadas: number;
    ventasAnalizadas: number;
    productosVinculados: number;
    errores: string[];
  }> {
    const errores: string[] = [];
    let marcasActualizadas = 0;
    let ventasAnalizadas = 0;
    let productosVinculados = 0;

    try {
      const { collection, getDocs, updateDoc, doc, Timestamp } = await import('firebase/firestore');

      // Obtener todas las ventas válidas (excluir canceladas)
      const ventasSnap = await getDocs(collection(db, 'ventas'));
      const ventas = ventasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((v: any) => v.estado !== 'cancelada') as any[];

      // Obtener todas las marcas del maestro
      const marcasSnap = await getDocs(collection(db, MARCAS_COLLECTION));
      const marcas = marcasSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      // Crear mapa de marcas por nombre normalizado para búsqueda rápida
      const marcasPorNombre = new Map<string, any>();
      for (const marca of marcas) {
        if (marca.nombre) {
          const nombreNorm = marca.nombre.toLowerCase().trim();
          marcasPorNombre.set(nombreNorm, marca);
        }
        // También agregar alias
        if (marca.alias) {
          for (const alias of marca.alias) {
            marcasPorNombre.set(alias.toLowerCase().trim(), marca);
          }
        }
      }

      // Agrupar datos por marcaId
      const datosPorMarca = new Map<string, {
        unidadesVendidas: number;
        ventasTotalPEN: number;
        margenes: { monto: number; margen: number }[];
        ultimaVenta: Date | null;
      }>();

      for (const venta of ventas) {
        if (!venta.productos || !Array.isArray(venta.productos)) continue;

        ventasAnalizadas++;
        const fechaVenta = venta.fechaCreacion?.toDate?.() || (venta.fechaCreacion ? new Date(venta.fechaCreacion) : null);

        for (const producto of venta.productos) {
          if (!producto.marca) continue;

          // Buscar marca por nombre
          const nombreMarcaNorm = producto.marca.toLowerCase().trim();
          const marcaEncontrada = marcasPorNombre.get(nombreMarcaNorm);

          if (!marcaEncontrada) continue;

          productosVinculados++;
          const marcaId = marcaEncontrada.id;

          const datos = datosPorMarca.get(marcaId) || {
            unidadesVendidas: 0,
            ventasTotalPEN: 0,
            margenes: [],
            ultimaVenta: null
          };

          // Acumular métricas
          datos.unidadesVendidas += producto.cantidad || 0;
          datos.ventasTotalPEN += producto.subtotal || 0;

          // Registrar margen para promedio ponderado
          // Prioridad: 1) margenReal guardado, 2) calcularlo desde costoTotalUnidades, 3) margen genérico
          let margenProducto = producto.margenReal;

          // Si no hay margenReal pero hay costoTotalUnidades, calcularlo
          if (margenProducto === undefined && producto.costoTotalUnidades && producto.subtotal > 0) {
            margenProducto = ((producto.subtotal - producto.costoTotalUnidades) / producto.subtotal) * 100;
          }

          // Fallback a campo margen genérico
          if (margenProducto === undefined) {
            margenProducto = producto.margen;
          }

          if (margenProducto !== undefined && margenProducto > 0 && producto.subtotal > 0) {
            datos.margenes.push({
              monto: producto.subtotal,
              margen: margenProducto
            });
          }

          // Actualizar última venta
          if (fechaVenta && (!datos.ultimaVenta || fechaVenta > datos.ultimaVenta)) {
            datos.ultimaVenta = fechaVenta;
          }

          datosPorMarca.set(marcaId, datos);
        }
      }

      // Actualizar métricas de cada marca
      for (const [marcaId, datos] of datosPorMarca) {
        try {
          // Calcular margen promedio ponderado
          let margenPromedio = 0;
          if (datos.margenes.length > 0) {
            const sumaMontos = datos.margenes.reduce((sum, m) => sum + m.monto, 0);
            if (sumaMontos > 0) {
              margenPromedio = datos.margenes.reduce((sum, m) => sum + (m.monto * m.margen), 0) / sumaMontos;
            }
            console.log(`[sincronizarVentasMarcas] Marca ${marcaId}: ${datos.margenes.length} productos con margen, promedio: ${margenPromedio.toFixed(2)}%`);
          } else {
            console.log(`[sincronizarVentasMarcas] Marca ${marcaId}: SIN productos con margen (ventas: S/${datos.ventasTotalPEN})`);
          }

          const updateData: Record<string, any> = {
            'metricas.unidadesVendidas': datos.unidadesVendidas,
            'metricas.ventasTotalPEN': datos.ventasTotalPEN,
            'metricas.margenPromedio': Math.round(margenPromedio * 10) / 10
          };

          if (datos.ultimaVenta) {
            updateData['metricas.ultimaVenta'] = Timestamp.fromDate(datos.ultimaVenta);
          }

          await updateDoc(doc(db, MARCAS_COLLECTION, marcaId), updateData);
          marcasActualizadas++;
        } catch (error: any) {
          errores.push(`Marca ${marcaId}: ${error.message}`);
        }
      }

      logger.success(`Sincronización de ventas de marcas completada: ${marcasActualizadas} marcas, ${ventasAnalizadas} ventas, ${productosVinculados} productos`);
    } catch (error: any) {
      errores.push(`Error general: ${error.message}`);
      console.error('Error en sincronización de ventas de marcas:', error);
    }

    return { marcasActualizadas, ventasAnalizadas, productosVinculados, errores };
  }
};
