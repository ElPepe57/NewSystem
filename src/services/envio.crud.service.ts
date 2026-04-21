import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  query, where, orderBy, Timestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  Envio, EnvioFormData, EnvioFiltros, EnvioUnidad,
  EstadoEnvio, CostoLanded, RecepcionEnvio, ResumenEnvios,
  CrearEnvioT2Payload,
} from '../types/envio.types';
import { TIPOS_ENVIO_INTERNACIONAL } from '../types/envio.types';

const COLL = COLLECTIONS.ENVIOS;
const UNIDADES_COLL = COLLECTIONS.UNIDADES;

/** Elimina recursivamente campos undefined de un objeto (Firestore los rechaza) */
function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

async function generarNumeroEnvio(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`ENV-${year}`, 3);
}

export const envioCrudService = {
  async getAll(): Promise<Envio[]> {
    const q = query(collection(db, COLL), orderBy('fechaCreacion', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Envio));
  },

  async getById(id: string): Promise<Envio | null> {
    const ref = doc(db, COLL, id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } as Envio : null;
  },

  async getByOrdenCompra(ordenCompraId: string): Promise<Envio[]> {
    const q = query(collection(db, COLL), where('ordenCompraId', '==', ordenCompraId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Envio));
  },

  async getByFiltros(filtros: EnvioFiltros): Promise<Envio[]> {
    let q = query(collection(db, COLL));

    if (filtros.estado) q = query(q, where('estado', '==', filtros.estado));
    if (filtros.origenTipo) q = query(q, where('origenTipo', '==', filtros.origenTipo));
    if (filtros.colaboradorId) q = query(q, where('colaboradorId', '==', filtros.colaboradorId));
    if (filtros.ordenCompraId) q = query(q, where('ordenCompraId', '==', filtros.ordenCompraId));
    if (filtros.destinoCasillaId) q = query(q, where('destinoCasillaId', '==', filtros.destinoCasillaId));

    const snap = await getDocs(q);
    let envios = snap.docs.map(d => ({ id: d.id, ...d.data() } as Envio));

    // Filtros en memoria
    if (filtros.fechaDesde) {
      const desde = Timestamp.fromDate(filtros.fechaDesde);
      envios = envios.filter(e => e.fechaCreacion.toMillis() >= desde.toMillis());
    }
    if (filtros.fechaHasta) {
      const hasta = Timestamp.fromDate(filtros.fechaHasta);
      envios = envios.filter(e => e.fechaCreacion.toMillis() <= hasta.toMillis());
    }

    return envios.sort((a, b) => b.fechaCreacion.toMillis() - a.fechaCreacion.toMillis());
  },

  /**
   * Crea un envio nuevo (T1 desde OC o manual entre casillas)
   */
  async crear(data: EnvioFormData, userId: string): Promise<{ id: string; numeroEnvio: string }> {
    const numeroEnvio = await generarNumeroEnvio();
    const now = Timestamp.now();

    // S38-014: productosSummary con snapshot completo por línea de negocio (SUP vs SKC).
    // DRY: usamos buildProductoSnapshot — misma fuente de verdad que OC, Venta, Cotización.
    // El scanner y otros consumidores pueden llamar getDescripcionProducto() sin lookup runtime.
    const unidadesArr = data.unidadesDetalle || [];
    const summaryMap = new Map<string, any>();
    let pesoTotal = 0;

    const productoIdsUnicos = [...new Set(unidadesArr.map(u => u.productoId).filter(Boolean))];
    const snapshotsProductos: Record<string, any> = {};
    if (productoIdsUnicos.length > 0) {
      try {
        const { ProductoService } = await import('./producto.service');
        const { buildProductoSnapshot } = await import('../utils/producto.helpers');
        for (const pid of productoIdsUnicos) {
          const p = await ProductoService.getById(pid);
          if (p) {
            snapshotsProductos[pid] = {
              ...buildProductoSnapshot({ ...p, productoId: pid }),
              lineaNegocioId: (p as any).lineaNegocioId,
            };
          }
        }
      } catch (err) {
        logger.warn('No se pudo enriquecer productosSummary del envío:', err);
      }
    }

    for (const u of unidadesArr) {
      const existing = summaryMap.get(u.productoId);
      if (existing) {
        existing.cantidad += 1;
      } else {
        const snap = snapshotsProductos[u.productoId];
        summaryMap.set(u.productoId, snap
          ? {
              productoId: u.productoId,
              sku: snap.sku,
              nombre: snap.nombreComercial,
              cantidad: 1,
              ...(snap.marca && { marca: snap.marca }),
              ...(snap.presentacion && { presentacion: snap.presentacion }),
              ...(snap.contenido && { contenido: snap.contenido }),
              ...(snap.dosaje && { dosaje: snap.dosaje }),
              ...(snap.sabor && { sabor: snap.sabor }),
              ...(snap.pesoLibras && { pesoLibras: snap.pesoLibras }),
              ...(snap.atributosSkincare && { atributosSkincare: snap.atributosSkincare }),
              ...(snap.lineaNegocioId && { lineaNegocioId: snap.lineaNegocioId }),
            }
          : { productoId: u.productoId, sku: u.sku, nombre: u.sku, cantidad: 1 }
        );
      }
      if (u.pesoLibras) pesoTotal += u.pesoLibras;
    }
    const productosSummary = Array.from(summaryMap.values());

    const nuevoEnvio: Record<string, unknown> = {
      numeroEnvio,
      estado: 'borrador' as EstadoEnvio,
      origenTipo: data.origenTipo,

      // Destino
      destinoCasillaId: data.destinoCasillaId,
      destinoCasillaNombre: '', // se resuelve abajo

      // Unidades
      unidades: unidadesArr,
      totalUnidades: unidadesArr.length,
      productosSummary,
      ...(pesoTotal > 0 ? { pesoTotalLibras: Math.round(pesoTotal * 100) / 100 } : {}),

      // Costos landed (vacios, se agregan despues)
      costosLanded: [],
      costoLandedTotalPEN: 0,

      // Auditoria
      creadoPor: userId,
      fechaCreacion: now,
    };

    // S38-014: Origen — DESNORMALIZAR nombre y país del proveedor/casilla
    // para que la UI no tenga que hacer JOIN cada vez (DRY: mismo patrón que destinoCasillaNombre)
    if (data.origenTipo === 'proveedor' && data.origenProveedorId) {
      nuevoEnvio.origenProveedorId = data.origenProveedorId;
      try {
        const { proveedorService } = await import('./proveedor.service');
        const prov = await proveedorService.getById(data.origenProveedorId);
        if (prov) {
          nuevoEnvio.origenProveedorNombre = prov.nombre;
          if (prov.pais) nuevoEnvio.origenProveedorPais = prov.pais;
        }
      } catch (err) {
        logger.warn('No se pudo desnormalizar nombre del proveedor de origen:', err);
      }
    } else if (data.origenTipo === 'casilla' && data.origenCasillaId) {
      nuevoEnvio.origenCasillaId = data.origenCasillaId;
      try {
        const { casillaCrudService } = await import('./casilla.crud.service');
        const cas = await casillaCrudService.getById(data.origenCasillaId);
        if (cas) {
          nuevoEnvio.origenCasillaNombre = cas.nombre;
        }
      } catch (err) {
        logger.warn('No se pudo desnormalizar nombre de la casilla de origen:', err);
      }
    }

    // S38-014: Colaborador (courier) — desnormalizar nombre también
    if (data.colaboradorId) {
      nuevoEnvio.colaboradorId = data.colaboradorId;
      try {
        const { colaboradorService } = await import('./colaborador.service');
        const col = await colaboradorService.getById(data.colaboradorId);
        if (col) nuevoEnvio.colaboradorNombre = col.nombre;
      } catch (err) {
        logger.warn('No se pudo desnormalizar nombre del colaborador:', err);
      }
    }

    // Vinculo OC
    if (data.ordenCompraId) nuevoEnvio.ordenCompraId = data.ordenCompraId;
    if (data.subOrdenId) nuevoEnvio.subOrdenId = data.subOrdenId;

    // Tracking
    if (data.numeroTracking) nuevoEnvio.numeroTracking = data.numeroTracking;
    if (data.courier) nuevoEnvio.courier = data.courier;
    if (data.fechaLlegadaEstimada) nuevoEnvio.fechaLlegadaEstimada = Timestamp.fromDate(data.fechaLlegadaEstimada);
    if (data.notas) nuevoEnvio.notas = data.notas;

    // S38-009: esDDP significa que NO hay casilla origen intermedia (el proveedor
    // despacha directo a la casilla destino). El destino SIEMPRE es una casilla real.
    if (data.esDDP) {
      nuevoEnvio.esDDP = true;
    }

    // Resolver nombre de casilla destino
    if (data.destinoCasillaId) {
      const { casillaCrudService } = await import('./casilla.crud.service');
      const cas = await casillaCrudService.getById(data.destinoCasillaId);
      if (cas) {
        nuevoEnvio.destinoCasillaNombre = cas.nombre;
      } else {
        // Fallback legacy: buscar en almacenes
        const almRef = await import('firebase/firestore').then(m => m.getDoc(doc(db, 'almacenes', data.destinoCasillaId)));
        if (almRef.exists()) nuevoEnvio.destinoCasillaNombre = (almRef.data() as any).nombre;
      }
    }

    // Sanitizar undefined en unidades anidadas y en el objeto raíz
    if (Array.isArray(nuevoEnvio.unidades)) {
      nuevoEnvio.unidades = (nuevoEnvio.unidades as Record<string, unknown>[]).map(u => removeUndefined(u));
    }
    const docRef = await addDoc(collection(db, COLL), removeUndefined(nuevoEnvio));
    logger.success(`Envio ${numeroEnvio} creado`);
    return { id: docRef.id, numeroEnvio };
  },

  /**
   * Agrega un costo landed al envio
   */
  async agregarCostoLanded(envioId: string, costo: Omit<CostoLanded, 'id' | 'creadoPor' | 'fechaCreacion'>, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');

    const nuevoCosto: CostoLanded = {
      ...costo,
      id: `CL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      creadoPor: userId,
      fechaCreacion: Timestamp.now(),
    };

    const costosActualizados = [...envio.costosLanded, nuevoCosto];
    const totalPEN = costosActualizados.reduce((sum, c) => sum + c.montoPEN, 0);

    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, {
      costosLanded: costosActualizados,
      costoLandedTotalPEN: totalPEN,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    logger.info(`Costo landed agregado a envio ${envio.numeroEnvio}: ${costo.categoriaCostoNombre} S/${costo.montoPEN.toFixed(2)}`);
  },

  /**
   * S44 — Crea un envio T2 (Casilla Internacional → Almacén Perú) desde el Wizard T2.
   *
   * Caso C del Modelo Envíos Transversal. A diferencia de `crear()` genérico, este
   * método es un wrapper conveniente que recibe el payload del Wizard T2 y:
   *   1. Convierte las unidades seleccionadas en `EnvioUnidad[]` (con pesoLibras desnormalizado)
   *   2. Llama a `crear()` existente con `origenTipo='casilla'` → nace en `borrador` (D-15)
   *   3. Si se capturaron costos, los agrega vía `agregarCostoLanded()` con estado `'estimado'` (D-17)
   *
   * En S44 todos los costos son `scope='envio'` implícito (D-18). El `scope='tanda'` se implementa en S46.
   *
   * Retorna el envío creado con id + número.
   */
  async crearEnvioT2(
    payload: CrearEnvioT2Payload,
    userId: string
  ): Promise<{ id: string; numeroEnvio: string }> {
    const { casillaOrigenId, almacenDestinoId, tipoTransporte, colaboradorId, numeroTracking, unidades, costos, notas } = payload;

    // 1. Armar unidadesDetalle (EnvioUnidad[]) desde las unidades seleccionadas
    const unidadesDetalle = unidades.map((u) => ({
      unidadId: u.unidadId,
      productoId: u.productoId,
      sku: u.sku,
      codigoUnidad: u.codigoUnidad,
      estadoEnvio: 'pendiente' as const,
      ...(u.pesoLibras ? { pesoLibras: u.pesoLibras } : {}),
    }));

    // 2. Construir EnvioFormData para crear() genérico
    const formData: EnvioFormData = {
      origenTipo: 'casilla',
      origenCasillaId: casillaOrigenId,
      destinoCasillaId: almacenDestinoId,
      colaboradorId: colaboradorId || undefined,
      unidadesIds: unidades.map((u) => u.unidadId),
      unidadesDetalle,
      numeroTracking: numeroTracking || undefined,
      // No hay courier explícito en T2 — se registra como colaborador transportador
      ...(notas ? { notas } : {}),
    };

    // 3. Crear el envío base (nace en 'borrador' según D-15 — wizards manuales)
    const resultado = await this.crear(formData, userId);

    // 4. Agregar los costos landed (todos en estado 'estimado' por default — D-17)
    //    En S44 el estado 'estimado'/'confirmado' se persiste en el campo CostoLanded.estado
    //    cuando exista en el modelo. Por ahora se deja implicito hasta S46+.
    for (const costo of costos) {
      await this.agregarCostoLanded(
        resultado.id,
        {
          categoriaCostoId: costo.categoriaCostoId,
          categoriaCostoNombre: costo.categoriaCostoNombre,
          descripcion: costo.descripcion,
          monto: costo.montoUSD,
          moneda: 'USD',
          montoPEN: costo.montoUSD * costo.tipoCambio,
          tipoCambio: costo.tipoCambio,
          metodoProrrateo: costo.metodoProrrateo,
          ...(costo.detalleVariado ? { detalleVariado: costo.detalleVariado } : {}),
          pagado: false,
        },
        userId
      );
    }

    // Indicador de tipo de ruta para Firestore (anticipa S48 consolidation)
    // Se escribe como campo derivado en futuras sesiones. Por ahora el tipo se
    // deriva heurísticamente por `origenTipo='casilla' && destino es almacén Perú`.

    logger.success(
      `[crearEnvioT2] Envío T2 creado: ${resultado.numeroEnvio} · ${unidades.length} uds · ${costos.length} costos landed · tipo ${tipoTransporte}`
    );

    return resultado;
  },

  /**
   * Confirma el envio (borrador → confirmado)
   */
  async confirmar(envioId: string, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');
    if (envio.estado !== 'borrador') throw new Error('Solo se pueden confirmar envios en borrador');

    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, {
      estado: 'confirmado' as EstadoEnvio,
      fechaConfirmacion: Timestamp.now(),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });
  },

  /**
   * Marca el envio como en transito
   */
  async enviar(envioId: string, datos: { numeroTracking?: string; fechaSalida?: Date; courier?: string; courierColaboradorId?: string }, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');
    if (envio.estado !== 'confirmado') throw new Error('Solo se pueden enviar envios confirmados');

    const now = Timestamp.now();
    const updateData: Record<string, unknown> = {
      estado: 'en_transito' as EstadoEnvio,
      fechaSalida: datos.fechaSalida ? Timestamp.fromDate(datos.fechaSalida) : now,
      actualizadoPor: userId,
      fechaActualizacion: now,
    };

    if (datos.numeroTracking) updateData.numeroTracking = datos.numeroTracking;
    // S39: courier info desde DespacharOCModal
    if (datos.courier) updateData.courier = datos.courier;
    if (datos.courierColaboradorId) {
      updateData.colaboradorId = datos.courierColaboradorId;
      // Desnormalizar nombre
      try {
        const { colaboradorService } = await import('./colaborador.service');
        const col = await colaboradorService.getById(datos.courierColaboradorId);
        if (col) updateData.colaboradorNombre = col.nombre;
      } catch { /* best effort */ }
    }

    // Actualizar estado de unidades en el envio a 'enviada'
    if (envio.unidades.length > 0) {
      updateData.unidades = envio.unidades.map(u => ({
        ...u,
        estadoEnvio: 'enviada',
      }));
    }

    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, updateData);

    // Actualizar estado de unidades en Firestore a 'en_transito'
    if (envio.unidades.length > 0) {
      const batch = writeBatch(db);
      for (const u of envio.unidades) {
        batch.update(doc(db, UNIDADES_COLL, u.unidadId), {
          estado: 'en_transito',
          actualizadoPor: userId,
          fechaActualizacion: now,
        });
      }
      await batch.commit();
    }

    logger.success(`Envio ${envio.numeroEnvio} marcado como en transito`);
  },

  /**
   * Cancela un envio
   */
  async cancelar(envioId: string, motivo: string, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');

    const cancelables: EstadoEnvio[] = ['borrador', 'confirmado'];
    if (!cancelables.includes(envio.estado)) {
      throw new Error('Solo se pueden cancelar envios en borrador o confirmados');
    }

    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, {
      estado: 'cancelada' as EstadoEnvio,
      notas: `${envio.notas || ''}\n[CANCELADO] ${motivo}`.trim(),
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });
  },

  async getEnTransito(): Promise<Envio[]> {
    return this.getByFiltros({ estado: 'en_transito' });
  },

  async getPendientesRecepcion(): Promise<Envio[]> {
    const q = query(collection(db, COLL), where('estado', 'in', ['en_transito', 'recibida_parcial']));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Envio));
  },

  async getByColaboradorId(colaboradorId: string): Promise<Envio[]> {
    return this.getByFiltros({ colaboradorId });
  },

  /**
   * Actualiza el flete de un envio.
   * Distribuye el costo de flete entre las unidades por producto.
   * Si el envio ya fue recibido, propaga el costoFleteUSD a las unidades
   * individuales en Firestore y recalcula su ctruInicial.
   */
  async actualizarFleteEnvio(
    envioId: string,
    costoFletePorProducto: Record<string, number>,
    userId: string
  ): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');

    if (envio.tipo && !TIPOS_ENVIO_INTERNACIONAL.includes(envio.tipo)) {
      throw new Error('Solo se puede asignar flete a envios internacionales → Peru');
    }

    // Agrupar unidades por producto para calcular costo por unidad
    const unidadesPorProducto = new Map<string, EnvioUnidad[]>();
    for (const u of envio.unidades) {
      if (!unidadesPorProducto.has(u.productoId)) {
        unidadesPorProducto.set(u.productoId, []);
      }
      unidadesPorProducto.get(u.productoId)!.push(u);
    }

    // Calcular costoFleteUSD por unidad y costo total
    let costoFleteTotal = 0;
    const unidadesActualizadas = envio.unidades.map(u => {
      const costoFleteProducto = costoFletePorProducto[u.productoId] || 0;
      const cantidadUnidades = unidadesPorProducto.get(u.productoId)?.length || 1;
      const costoPorUnidad = cantidadUnidades > 0 ? costoFleteProducto / cantidadUnidades : 0;
      return { ...u, costoFleteUSD: costoPorUnidad };
    });

    for (const costo of Object.values(costoFletePorProducto)) {
      costoFleteTotal += costo || 0;
    }

    // Actualizar documento del envio
    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, {
      unidades: unidadesActualizadas,
      costoFleteTotal,
      monedaFlete: 'USD',
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    // Si el envio ya fue recibido, propagar flete a las unidades en Firestore
    const yaRecibida = envio.estado === 'recibida_completa' || envio.estado === 'recibida_parcial';
    if (yaRecibida) {
      const batch = writeBatch(db);
      let batchCount = 0;

      for (const unidad of unidadesActualizadas) {
        if (unidad.estadoEnvio !== 'recibida') continue;
        if (!unidad.costoFleteUSD || unidad.costoFleteUSD <= 0) continue;

        const unidadRef = doc(db, UNIDADES_COLL, unidad.unidadId);
        const unidadSnap = await getDoc(unidadRef);
        if (!unidadSnap.exists()) continue;

        const unidadData = unidadSnap.data();
        const updateData: Record<string, unknown> = {
          costoFleteUSD: unidad.costoFleteUSD,
          actualizadoPor: userId,
          fechaActualizacion: Timestamp.now(),
        };

        // Recalcular ctruInicial incluyendo flete
        const tc = unidadData.tcPago || unidadData.tcCompra || 0;
        const costoBasePEN = (unidadData.costoUnitarioUSD || 0) * tc;
        const costoFletePEN = unidad.costoFleteUSD * tc;
        const nuevoCtruInicial = costoBasePEN + costoFletePEN;
        updateData.ctruInicial = nuevoCtruInicial;
        if (!unidadData.costoGAGOAsignado || unidadData.costoGAGOAsignado === 0) {
          updateData.ctruDinamico = nuevoCtruInicial;
        }

        batch.update(unidadRef, updateData);
        batchCount++;

        if (batchCount >= 490) {
          await batch.commit();
          batchCount = 0;
        }
      }

      if (batchCount > 0) await batch.commit();

      // Trigger recalculo CTRU dinamico si aplica
      try {
        const ctruService = await import('./ctru.service');
        await ctruService.ctruService.recalcularCTRUDinamicoSafe();
      } catch (e) {
        logger.warn('No se pudo recalcular CTRU tras actualizar flete:', e);
      }
    }

    logger.success(`Flete actualizado para envio ${envio.numeroEnvio}: $${costoFleteTotal.toFixed(2)}`);
  },

  /**
   * Retorna KPIs del modulo de envios
   */
  async getResumen(): Promise<ResumenEnvios> {
    const todos = await this.getAll();
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const enTransito = todos.filter(e => e.estado === 'en_transito');
    const pendientesRecepcion = todos.filter(e =>
      e.estado === 'en_transito' || e.estado === 'recibida_parcial'
    );
    const completadasMes = todos.filter(e =>
      (e.estado === 'recibida_completa' || e.estado === 'recibida_parcial') &&
      e.fechaLlegadaReal &&
      e.fechaLlegadaReal.toDate() >= inicioMes
    );

    const internos = todos.filter(e => e.tipo === 'interna_origen').length;
    const internacionales = todos.filter(e => e.tipo === 'internacional_peru').length;

    // Tiempo promedio de transito de envios internacionales completados
    const completadosConDias = todos.filter(e =>
      e.tipo === 'internacional_peru' && e.diasEnTransito !== undefined
    );
    const tiempoPromedioTransitoDias = completadosConDias.length > 0
      ? completadosConDias.reduce((sum, e) => sum + (e.diasEnTransito || 0), 0) / completadosConDias.length
      : 0;

    // Incidencias del mes (unidades danadas/faltantes en recepciones del mes)
    const unidadesFaltantesMes = completadasMes.reduce(
      (sum, e) => sum + (e.totalUnidadesFaltantes || 0), 0
    );
    const unidadesDanadasMes = completadasMes.reduce(
      (sum, e) => sum + (e.totalUnidadesDanadas || 0), 0
    );
    // Envios con incidencias = completadas con danadas/faltantes + estados excepcion (aduana/perdida) + incidencias[] sin resolver en TODOS los envios (no solo mes)
    const tieneIncidenciaActiva = (e: Envio): boolean => {
      if ((e.totalUnidadesFaltantes || 0) > 0 || (e.totalUnidadesDanadas || 0) > 0) return true;
      if (e.estado === 'retenida_aduana' || e.estado === 'perdida_total') return true;
      if (Array.isArray(e.incidencias) && e.incidencias.some(i => !i.resuelta)) return true;
      return false;
    };
    const enviosConIncidencias = todos.filter(tieneIncidenciaActiva).length;

    return {
      totalEnvios: todos.length,
      enTransito: enTransito.length,
      pendientesRecepcion: pendientesRecepcion.length,
      completadasMes: completadasMes.length,
      internos,
      internacionales,
      tiempoPromedioTransitoDias: Math.round(tiempoPromedioTransitoDias * 10) / 10,
      enviosConIncidencias,
      unidadesFaltantesMes,
      unidadesDanadasMes,
    };
  },
};
