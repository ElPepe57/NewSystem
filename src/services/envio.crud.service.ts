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
  CrearEnvioJPayload,
  CrearEnvioEPayload,
  CrearEnvioFPayload,
  SubEnvioT1, EstadoSubEnvio,
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

    // S49 — Destino cliente (Caso F) y vínculo con Venta/Devolución
    if (data.destinoTipo) nuevoEnvio.destinoTipo = data.destinoTipo;
    if (data.destinoClienteId) nuevoEnvio.destinoClienteId = data.destinoClienteId;
    if (data.destinoClienteNombre) nuevoEnvio.destinoClienteNombre = data.destinoClienteNombre;
    if (data.destinoClienteDireccion) nuevoEnvio.destinoClienteDireccion = data.destinoClienteDireccion;
    if (data.destinoClienteDistrito) nuevoEnvio.destinoClienteDistrito = data.destinoClienteDistrito;
    if (data.destinoClienteTelefono) nuevoEnvio.destinoClienteTelefono = data.destinoClienteTelefono;
    // S49 — Origen cliente (Caso G devolución)
    if (data.origenClienteId) nuevoEnvio.origenClienteId = data.origenClienteId;
    if (data.origenClienteNombre) nuevoEnvio.origenClienteNombre = data.origenClienteNombre;
    // S49 — Vínculos con Venta / Devolución
    if (data.ventaId) nuevoEnvio.ventaId = data.ventaId;
    if (data.ventaNumero) nuevoEnvio.ventaNumero = data.ventaNumero;
    if (data.devolucionId) nuevoEnvio.devolucionId = data.devolucionId;
    if (data.devolucionNumero) nuevoEnvio.devolucionNumero = data.devolucionNumero;

    // Resolver nombre de casilla destino (skip si destinoTipo='cliente' — no hay casilla)
    if (data.destinoCasillaId && data.destinoTipo !== 'cliente') {
      const { casillaCrudService } = await import('./casilla.crud.service');
      const cas = await casillaCrudService.getById(data.destinoCasillaId);
      if (cas) {
        nuevoEnvio.destinoCasillaNombre = cas.nombre;
      } else {
        // Fallback legacy: buscar en almacenes
        const almRef = await import('firebase/firestore').then(m => m.getDoc(doc(db, 'almacenes', data.destinoCasillaId)));
        if (almRef.exists()) nuevoEnvio.destinoCasillaNombre = (almRef.data() as any).nombre;
      }
    } else if (data.destinoTipo === 'cliente') {
      // Caso F: destino es cliente — destinoCasillaNombre vacío, usar destinoClienteNombre
      nuevoEnvio.destinoCasillaNombre = data.destinoClienteNombre || 'Cliente';
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
   * Agrega un costo landed al envio.
   *
   * S46 (D-17, D-18): si el caller no especifica `scope` se asume `'envio'` por
   * compatibilidad retroactiva. Si `scope='tanda'`, `tandaId` es required y debe
   * referenciar a una sub-tanda existente del envío. `estado` default = 'estimado'
   * (asume factura pendiente hasta confirmación explícita).
   *
   * Si el envío ya tiene `costosFinalizados=true`, no se permiten nuevos costos
   * (requiere reabrir con `reabrirCostosLanded()`).
   */
  async agregarCostoLanded(envioId: string, costo: Omit<CostoLanded, 'id' | 'creadoPor' | 'fechaCreacion'>, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envio no encontrado');
    if (envio.costosFinalizados) {
      throw new Error('Los costos del envío están finalizados. Reabrir antes de agregar nuevos.');
    }

    // S46 — Defaults y validaciones de scope/tandaId/estado
    const scope = costo.scope ?? 'envio';
    if (scope === 'tanda') {
      if (!costo.tandaId) {
        throw new Error("Costo con scope='tanda' requiere tandaId");
      }
      const existe = (envio.subEnvios ?? []).some((se) => se.id === costo.tandaId);
      if (!existe) {
        throw new Error(`Sub-tanda ${costo.tandaId} no existe en el envío`);
      }
    }
    const estado = costo.estado ?? 'estimado';

    const nuevoCosto: CostoLanded = {
      ...costo,
      scope,
      estado,
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

    logger.info(
      `Costo landed agregado a envio ${envio.numeroEnvio}: ${costo.categoriaCostoNombre} S/${costo.montoPEN.toFixed(2)} · scope=${scope}${costo.tandaId ? ` tanda=${costo.tandaId}` : ''} · estado=${estado}`
    );
  },

  /**
   * S46 (D-17) — Confirma un costo landed (estimado → confirmado).
   *
   * Se llama cuando llega la factura real del proveedor/colaborador. Opcionalmente
   * permite actualizar el monto real (si difiere del estimado) y registrar el
   * número de factura como referencia.
   *
   * Validaciones:
   *  - Costo debe existir y estar en estado 'estimado'
   *  - Envío no puede estar en `costosFinalizados=true`
   */
  async confirmarCostoLanded(
    envioId: string,
    costoId: string,
    datos: {
      /** Monto real de la factura si difiere del estimado (en USD o PEN según moneda) */
      montoReal?: number;
      /** Número de factura/documento de respaldo */
      facturaReferencia?: string;
      /** Fecha de confirmación (default: ahora) */
      fechaConfirmacion?: Date;
    },
    userId: string
  ): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envío no encontrado');
    if (envio.costosFinalizados) {
      throw new Error('Los costos del envío ya están finalizados');
    }

    const idx = envio.costosLanded.findIndex((c) => c.id === costoId);
    if (idx === -1) throw new Error(`Costo ${costoId} no encontrado en el envío`);
    const costo = envio.costosLanded[idx];
    const estadoActual = costo.estado ?? 'estimado';
    if (estadoActual === 'confirmado') {
      throw new Error('El costo ya está confirmado');
    }

    const fechaConf = datos.fechaConfirmacion
      ? Timestamp.fromDate(datos.fechaConfirmacion)
      : Timestamp.now();

    // Si hay monto real distinto, recalcular montoPEN
    let nuevoMonto = costo.monto;
    let nuevoMontoPEN = costo.montoPEN;
    if (datos.montoReal !== undefined && datos.montoReal !== costo.monto) {
      nuevoMonto = datos.montoReal;
      const tc = costo.tipoCambio ?? 1;
      nuevoMontoPEN =
        costo.moneda === 'USD' ? datos.montoReal * tc : datos.montoReal;
    }

    const costoActualizado: CostoLanded = {
      ...costo,
      monto: nuevoMonto,
      montoPEN: nuevoMontoPEN,
      estado: 'confirmado',
      fechaConfirmacion: fechaConf,
      confirmadoPor: userId,
      ...(datos.facturaReferencia
        ? { facturaReferencia: datos.facturaReferencia }
        : {}),
    };
    const costosActualizados = [...envio.costosLanded];
    costosActualizados[idx] = costoActualizado;
    const totalPEN = costosActualizados.reduce((sum, c) => sum + c.montoPEN, 0);

    await updateDoc(doc(db, COLL, envioId), {
      costosLanded: costosActualizados,
      costoLandedTotalPEN: totalPEN,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    logger.success(
      `Costo ${costo.categoriaCostoNombre} confirmado en envío ${envio.numeroEnvio}${datos.facturaReferencia ? ` · factura ${datos.facturaReferencia}` : ''}`
    );
  },

  /**
   * S46 (D-17) — Finaliza los costos del envío (cierre financiero).
   *
   * Valida que TODOS los costos estén confirmados + marca `costosFinalizados=true`
   * + bloquea futuras ediciones. Este es el evento que transita el CTRU de cada
   * unidad de "preliminar" a "final definitivo".
   *
   * Requiere confirmación explícita del usuario (action irreversible salvo
   * reapertura auditada).
   */
  async finalizarCostosLanded(envioId: string, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envío no encontrado');
    if (envio.costosFinalizados) {
      throw new Error('Los costos del envío ya están finalizados');
    }

    const estimados = envio.costosLanded.filter((c) => (c.estado ?? 'estimado') === 'estimado');
    if (estimados.length > 0) {
      throw new Error(
        `No se puede finalizar: ${estimados.length} costo(s) todavía en estado 'estimado'. Confirma cada uno con la factura real antes de cerrar.`
      );
    }

    const now = Timestamp.now();
    await updateDoc(doc(db, COLL, envioId), {
      costosFinalizados: true,
      fechaFinalizacionCostos: now,
      finalizadoPor: userId,
      actualizadoPor: userId,
      fechaActualizacion: now,
    });

    logger.success(
      `Costos del envío ${envio.numeroEnvio} FINALIZADOS · ${envio.costosLanded.length} costos confirmados · CTRU de ${envio.totalUnidades} unidades pasa a DEFINITIVO`
    );
  },

  /**
   * S46 (D-17) — Reabre los costos de un envío que ya fue finalizado (caso raro).
   *
   * Solo se debe usar cuando:
   *  - Llegó una factura adicional después del cierre (ej. tasa aduanera atrasada)
   *  - Una factura previa fue anulada/corregida por el proveedor
   *
   * Requiere motivo explícito que queda en el envío para auditoría.
   */
  async reabrirCostosLanded(
    envioId: string,
    motivo: string,
    userId: string
  ): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error('Envío no encontrado');
    if (!envio.costosFinalizados) {
      throw new Error('Los costos no están finalizados — no hay nada que reabrir');
    }
    if (!motivo.trim()) {
      throw new Error('Debe especificar un motivo para reabrir los costos (auditoría)');
    }

    const now = Timestamp.now();
    await updateDoc(doc(db, COLL, envioId), {
      costosFinalizados: false,
      motivoReaperturaCostos: motivo.trim(),
      actualizadoPor: userId,
      fechaActualizacion: now,
    });

    logger.warn(
      `Costos del envío ${envio.numeroEnvio} REABIERTOS por ${userId} · motivo: ${motivo.trim()}`
    );
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

  // ═══════════════════════════════════════════════════════════════════════
  // S47 — Wizard J: envío Casilla Internacional → Casilla Internacional
  // Ver docs/MODELO_ENVIOS_TRANSVERSAL.md §4 (Caso J, D-8, D-9)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * S47 — Crea un envío Caso J (casilla internacional → casilla internacional).
   *
   * Dos variantes:
   *   - J1: mismo colaborador, dos casillas suyas (movimiento interno)
   *   - J2: colaboradores distintos (remitente → destinatario)
   *
   * D-9: si origen y destino están en países distintos, el wizard marca
   * `advertenciaCambioPais=true` para auditoría. No bloquea la creación.
   *
   * Flujo:
   *   1. Construye EnvioUnidad[] desde las unidades seleccionadas (estado 'pendiente')
   *   2. Invoca `crear()` genérico con origenTipo='casilla' y destinoCasillaId (casilla intl)
   *   3. Agrega costos landed vía `agregarCostoLanded()` con estado 'estimado' (D-17)
   *
   * Retorna el envío creado con id + número.
   */
  async crearEnvioJ(
    payload: CrearEnvioJPayload,
    userId: string
  ): Promise<{ id: string; numeroEnvio: string }> {
    const {
      casillaOrigenId,
      casillaDestinoId,
      variante,
      colaboradorTransporteId,
      numeroTracking,
      unidades,
      costos,
      notas,
      advertenciaCambioPais,
    } = payload;

    // 1. Armar EnvioUnidad[] desde las unidades seleccionadas
    const unidadesDetalle: EnvioUnidad[] = unidades.map((u) => ({
      unidadId: u.unidadId,
      productoId: u.productoId,
      sku: u.sku,
      codigoUnidad: u.codigoUnidad,
      estadoEnvio: 'pendiente' as const,
      ...(u.pesoLibras ? { pesoLibras: u.pesoLibras } : {}),
    }));

    // 2. EnvioFormData genérico (destino es casilla internacional, NO almacén Perú)
    const formData: EnvioFormData = {
      origenTipo: 'casilla',
      origenCasillaId: casillaOrigenId,
      destinoCasillaId: casillaDestinoId,
      colaboradorId: colaboradorTransporteId || undefined,
      unidadesIds: unidades.map((u) => u.unidadId),
      unidadesDetalle,
      numeroTracking: numeroTracking || undefined,
      ...(notas ? { notas } : {}),
    };

    // 3. Crear el envío base (nace en 'borrador' según D-15)
    const resultado = await this.crear(formData, userId);

    // 4. Persistir metadata Caso J en el documento del envío (variante + advertencia)
    //    Estos campos son específicos de J y se guardan como extensión del doc.
    //    Cuando S48+ formalice `tipoRutaLogistica` se migrarán a ese esquema.
    const extrasJ: Record<string, unknown> = {
      casoJVariante: variante,
    };
    if (advertenciaCambioPais) {
      extrasJ.advertenciaCambioPais = true;
    }
    try {
      await updateDoc(doc(db, COLL, resultado.id), extrasJ);
    } catch (err) {
      // No bloquea — metadata de ruta es soft-info, no altera el flujo operativo
      logger.warn(`[crearEnvioJ] No se pudo persistir metadata J: ${err}`);
    }

    // 5. Agregar costos landed capturados en el wizard (estado 'estimado' por default)
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

    logger.success(
      `[crearEnvioJ] Envío J creado: ${resultado.numeroEnvio} · variante ${variante} · ${unidades.length} uds · ${costos.length} costos${advertenciaCambioPais ? ' · ⚠ cambio país' : ''}`
    );

    return resultado;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // S48 — Wizard E: Traslado interno Almacén Perú ↔ Almacén Perú
  // Ver docs/MODELO_ENVIOS_TRANSVERSAL.md §4 (Caso E, D-1 absorbe Transferencias)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * S48 — Crea un envío Caso E (traslado interno entre dos almacenes Perú).
   *
   * Diferencias clave vs. T2/J:
   *   - origenCasillaPais === 'Peru' && destinoCasillaPais === 'Peru'
   *   - Todo en PEN (costos.montoPEN directo, sin conversión USD)
   *   - No hay aduana ni diferencial cambiario
   *   - Motivo del traslado obligatorio
   *
   * Flujo:
   *   1. Construye EnvioUnidad[] con estado 'pendiente'
   *   2. Invoca `crear()` genérico con origenTipo='casilla', tipo='interna_origen',
   *      motivo + motivoDetalle del traslado
   *   3. Agrega costos landed vía `agregarCostoLanded()` con moneda='PEN' y
   *      tipoCambio=1 (no conversión en Caso E)
   *
   * Retorna el envío creado con id + número.
   */
  async crearEnvioE(
    payload: CrearEnvioEPayload,
    userId: string
  ): Promise<{ id: string; numeroEnvio: string }> {
    const {
      casillaOrigenId,
      casillaDestinoId,
      motivo,
      motivoDetalle,
      colaboradorTransporteId,
      numeroTracking,
      unidades,
      costosPEN,
      notas,
    } = payload;

    // 1. Armar EnvioUnidad[]
    const unidadesDetalle: EnvioUnidad[] = unidades.map((u) => ({
      unidadId: u.unidadId,
      productoId: u.productoId,
      sku: u.sku,
      codigoUnidad: u.codigoUnidad,
      estadoEnvio: 'pendiente' as const,
      ...(u.pesoLibras ? { pesoLibras: u.pesoLibras } : {}),
    }));

    // 2. EnvioFormData con tipo='interna_origen' (motivo Perú→Perú)
    const formData: EnvioFormData = {
      origenTipo: 'casilla',
      origenCasillaId: casillaOrigenId,
      destinoCasillaId: casillaDestinoId,
      colaboradorId: colaboradorTransporteId || undefined,
      unidadesIds: unidades.map((u) => u.unidadId),
      unidadesDetalle,
      numeroTracking: numeroTracking || undefined,
      tipo: 'interna_origen',
      motivo,
      ...(motivoDetalle ? { motivoDetalle } : {}),
      ...(notas ? { notas } : {}),
    };

    // 3. Crear envío base (D-15: Caso E nace en 'borrador')
    const resultado = await this.crear(formData, userId);

    // 4. Agregar costos landed (todo en PEN, tipoCambio=1 implícito para Caso E)
    for (const costo of costosPEN) {
      await this.agregarCostoLanded(
        resultado.id,
        {
          categoriaCostoId: costo.categoriaCostoId,
          categoriaCostoNombre: costo.categoriaCostoNombre,
          descripcion: costo.descripcion,
          monto: costo.montoPEN,
          moneda: 'PEN',
          montoPEN: costo.montoPEN,
          tipoCambio: 1,
          metodoProrrateo: costo.metodoProrrateo,
          ...(costo.detalleVariado ? { detalleVariado: costo.detalleVariado } : {}),
          pagado: false,
        },
        userId
      );
    }

    logger.success(
      `[crearEnvioE] Envío E (traslado interno) creado: ${resultado.numeroEnvio} · motivo ${motivo} · ${unidades.length} uds · ${costosPEN.length} costos PEN`
    );

    return resultado;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // S49 — Wizard F: Despacho venta Almacén Perú → cliente
  // Ver docs/MODELO_ENVIOS_TRANSVERSAL.md §4 (Caso F, D-1 absorbe Ventas)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * S49 — Crea un envío Caso F (despacho de venta desde almacén Perú al cliente).
   *
   * Diferencias clave vs. T2/E/J:
   *   - destinoTipo='cliente' (no es casilla)
   *   - Vinculado obligatoriamente a una Venta existente (ventaId)
   *   - Cliente + dirección se desnormalizan desde la Venta
   *   - Todo en PEN (despacho local en Perú)
   *
   * Flujo:
   *   1. Construye EnvioUnidad[] con estado 'pendiente'
   *   2. Invoca `crear()` genérico con origenTipo='casilla', destinoTipo='cliente'
   *      y vinculando al ventaId
   *   3. Agrega costos landed (delivery) con moneda='PEN' y tipoCambio=1
   *
   * NOTA: el destinoCasillaId se setea vacío ('') porque el destino es un cliente,
   * no una casilla. El Envio queda con destinoTipo='cliente' y los datos del
   * cliente desnormalizados.
   */
  async crearEnvioF(
    payload: CrearEnvioFPayload,
    userId: string
  ): Promise<{ id: string; numeroEnvio: string }> {
    const {
      almacenOrigenId,
      ventaId,
      ventaNumero,
      cliente,
      colaboradorTransporteId,
      numeroTracking,
      unidades,
      costosPEN,
      notas,
    } = payload;

    // 1. EnvioUnidad[]
    const unidadesDetalle: EnvioUnidad[] = unidades.map((u) => ({
      unidadId: u.unidadId,
      productoId: u.productoId,
      sku: u.sku,
      codigoUnidad: u.codigoUnidad,
      estadoEnvio: 'pendiente' as const,
      ...(u.pesoLibras ? { pesoLibras: u.pesoLibras } : {}),
    }));

    // 2. FormData — destino es cliente, no casilla física
    //    destinoCasillaId queda como string vacío (solo pasa validación del type);
    //    el envío real usa destinoTipo='cliente' + destinoCliente* desnormalizado.
    const formData: EnvioFormData = {
      origenTipo: 'casilla',
      origenCasillaId: almacenOrigenId,
      destinoCasillaId: '', // Caso F no tiene casilla destino — cliente final
      destinoTipo: 'cliente',
      destinoClienteId: cliente.id,
      destinoClienteNombre: cliente.nombre,
      destinoClienteDireccion: cliente.direccion,
      destinoClienteDistrito: cliente.distrito,
      destinoClienteTelefono: cliente.telefono,
      colaboradorId: colaboradorTransporteId || undefined,
      unidadesIds: unidades.map((u) => u.unidadId),
      unidadesDetalle,
      numeroTracking: numeroTracking || undefined,
      ventaId,
      ventaNumero,
      ...(notas ? { notas } : {}),
    };

    // 3. Crear envío base (D-15: Caso F nace en 'borrador')
    const resultado = await this.crear(formData, userId);

    // 4. Agregar costos landed en PEN (tipoCambio=1 implícito para Caso F)
    for (const costo of costosPEN) {
      await this.agregarCostoLanded(
        resultado.id,
        {
          categoriaCostoId: costo.categoriaCostoId,
          categoriaCostoNombre: costo.categoriaCostoNombre,
          descripcion: costo.descripcion,
          monto: costo.montoPEN,
          moneda: 'PEN',
          montoPEN: costo.montoPEN,
          tipoCambio: 1,
          metodoProrrateo: costo.metodoProrrateo,
          pagado: false,
        },
        userId
      );
    }

    logger.success(
      `[crearEnvioF] Envío F (despacho venta) creado: ${resultado.numeroEnvio} · VT ${ventaNumero} · cliente ${cliente.nombre} · ${unidades.length} uds · ${costosPEN.length} costos PEN`
    );

    return resultado;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // S45 — Sub-envíos T1 (tandas de despacho del proveedor)
  // Ver docs/MODELO_ENVIOS_TRANSVERSAL.md §7 (D-3, D-16)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * S45 — Crea una nueva sub-tanda dentro de un envío T1 existente (casos A/B/D).
   *
   * Flujo típico (modo prospectivo): el proveedor avisa "tu pedido va en 3 paquetes
   * con fechas X/Y/Z" → el usuario crea 3 sub-tandas planificadas con estado
   * 'pendiente'. Al recibir cada una, transita a 'entregado' via
   * `transicionarSubEnvio()`.
   *
   * Flujo reactivo: al recibir la primera tanda parcial, se crea retroactivamente
   * con estado 'entregado' directo.
   *
   * Validación: las unidadesIds deben estar en el envío padre y NO asignadas aún
   * a otra sub-tanda (excepción: tipo='reemplazo' que sí puede repetir unidad).
   */
  async crearSubTandaT1(
    envioId: string,
    data: {
      unidadesIds: string[];
      tipo?: 'normal' | 'reemplazo';
      numeroTrackingProveedor?: string;
      fechaEstimadaEntrega?: Date;
      estado?: EstadoSubEnvio; // default 'pendiente'
      reclamoId?: string;      // solo si tipo='reemplazo'
      tandaOriginalId?: string;
      notas?: string;
    },
    userId: string
  ): Promise<SubEnvioT1> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error(`Envío ${envioId} no encontrado`);

    const tipo = data.tipo ?? 'normal';
    const estado = data.estado ?? 'pendiente';
    const now = Timestamp.now();

    // Validación: unidades ya asignadas a otras sub-tandas normales
    if (tipo === 'normal') {
      const ocupadas = new Set<string>();
      for (const se of envio.subEnvios ?? []) {
        if (se.tipo === 'normal') {
          se.unidadesIds.forEach((uid) => ocupadas.add(uid));
        }
      }
      const conflictos = data.unidadesIds.filter((uid) => ocupadas.has(uid));
      if (conflictos.length > 0) {
        throw new Error(
          `Estas unidades ya están en otra sub-tanda: ${conflictos.slice(0, 3).join(', ')}`
        );
      }
    }

    const secuencia = (envio.subEnvios?.length ?? 0) + 1;
    const nuevaTanda: SubEnvioT1 = {
      id: `SE-${envioId.slice(-6)}-${secuencia}`,
      secuencia,
      tipo,
      unidadesIds: data.unidadesIds,
      estado,
      creadoPor: userId,
      fechaCreacion: now,
      ...(data.numeroTrackingProveedor && { numeroTrackingProveedor: data.numeroTrackingProveedor }),
      ...(data.fechaEstimadaEntrega && {
        fechaEstimadaEntrega: Timestamp.fromDate(data.fechaEstimadaEntrega),
      }),
      ...(data.reclamoId && { reclamoId: data.reclamoId }),
      ...(data.tandaOriginalId && { tandaOriginalId: data.tandaOriginalId }),
      ...(data.notas && { notas: data.notas }),
    };

    const subEnviosActualizados = [...(envio.subEnvios ?? []), nuevaTanda];
    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, {
      subEnvios: subEnviosActualizados,
      actualizadoPor: userId,
      fechaActualizacion: now,
    });

    logger.success(
      `[crearSubTandaT1] Envío ${envio.numeroEnvio} · tanda ${secuencia} (${tipo}) creada · ${data.unidadesIds.length} uds`
    );
    return nuevaTanda;
  },

  /**
   * S45 — Transita el estado de una sub-tanda específica dentro del envío.
   *
   * Transiciones válidas:
   *   pendiente → en_transito (cuando el proveedor despacha, se ingresa tracking)
   *   pendiente → cancelada
   *   en_transito → entregado (llegó completa)
   *   en_transito → entregado_parcial (llegó incompleta — dispara incidencia)
   *   en_transito → cancelada (raro, con auditoría)
   *
   * Actualiza automáticamente el estado del envío padre (T1) según reglas D-3:
   *   - Primer sub-envío en_transito → envío padre pasa a 'en_transito'
   *   - Primer sub-envío entregado → envío padre pasa a 'recibida_parcial'
   *   - Todos los sub-envíos entregados + unidades recibidas = total → 'recibida_completa'
   */
  async transicionarSubEnvio(
    envioId: string,
    subEnvioId: string,
    nuevoEstado: EstadoSubEnvio,
    userId: string,
    extra?: {
      fechaDespachoProveedor?: Date;
      fechaEntrega?: Date;
      numeroTrackingProveedor?: string;
    }
  ): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error(`Envío ${envioId} no encontrado`);

    const subEnvios = envio.subEnvios ?? [];
    const idx = subEnvios.findIndex((se) => se.id === subEnvioId);
    if (idx === -1) throw new Error(`Sub-tanda ${subEnvioId} no existe en el envío`);

    const now = Timestamp.now();
    const actualizada: SubEnvioT1 = {
      ...subEnvios[idx],
      estado: nuevoEstado,
      actualizadoPor: userId,
      fechaActualizacion: now,
      ...(extra?.fechaDespachoProveedor && {
        fechaDespachoProveedor: Timestamp.fromDate(extra.fechaDespachoProveedor),
      }),
      ...(extra?.fechaEntrega && {
        fechaEntrega: Timestamp.fromDate(extra.fechaEntrega),
      }),
      ...(extra?.numeroTrackingProveedor && {
        numeroTrackingProveedor: extra.numeroTrackingProveedor,
      }),
    };
    const subEnviosActualizados = [...subEnvios];
    subEnviosActualizados[idx] = actualizada;

    // ─── Derivar estado del envío padre según las sub-tandas ───
    const algunaEnTransito = subEnviosActualizados.some((se) => se.estado === 'en_transito');
    const algunaEntregada = subEnviosActualizados.some(
      (se) => se.estado === 'entregado' || se.estado === 'entregado_parcial'
    );
    const todasTerminales = subEnviosActualizados.every(
      (se) => se.estado === 'entregado' || se.estado === 'entregado_parcial' || se.estado === 'cancelada'
    );

    let nuevoEstadoEnvio: EstadoEnvio | undefined;
    if (todasTerminales && algunaEntregada) {
      // Todas tandas llegaron (al menos una entregada, el resto puede ser cancelada)
      nuevoEstadoEnvio = 'recibida_completa';
    } else if (algunaEntregada) {
      nuevoEstadoEnvio = 'recibida_parcial';
    } else if (algunaEnTransito) {
      nuevoEstadoEnvio = 'en_transito';
    }

    const ref = doc(db, COLL, envioId);
    const updates: Record<string, unknown> = {
      subEnvios: subEnviosActualizados,
      actualizadoPor: userId,
      fechaActualizacion: now,
    };
    if (nuevoEstadoEnvio && nuevoEstadoEnvio !== envio.estado) {
      updates.estado = nuevoEstadoEnvio;
      if (nuevoEstadoEnvio === 'en_transito' && !envio.fechaSalida) {
        updates.fechaSalida = extra?.fechaDespachoProveedor
          ? Timestamp.fromDate(extra.fechaDespachoProveedor)
          : now;
      }
      if (nuevoEstadoEnvio === 'recibida_completa' && !envio.fechaLlegadaReal) {
        updates.fechaLlegadaReal = extra?.fechaEntrega
          ? Timestamp.fromDate(extra.fechaEntrega)
          : now;
      }
    }
    await updateDoc(ref, updates);

    logger.info(
      `[transicionarSubEnvio] ${envio.numeroEnvio} · tanda ${actualizada.secuencia} → ${nuevoEstado}${
        nuevoEstadoEnvio ? ` · envío padre → ${nuevoEstadoEnvio}` : ''
      }`
    );
  },

  /**
   * S45 — Elimina una sub-tanda (solo permitido si está en estado 'pendiente').
   * Las unidades vuelven a estar disponibles para asignarse a otras tandas.
   */
  async eliminarSubTanda(envioId: string, subEnvioId: string, userId: string): Promise<void> {
    const envio = await this.getById(envioId);
    if (!envio) throw new Error(`Envío ${envioId} no encontrado`);

    const subEnvios = envio.subEnvios ?? [];
    const tanda = subEnvios.find((se) => se.id === subEnvioId);
    if (!tanda) throw new Error(`Sub-tanda ${subEnvioId} no existe`);
    if (tanda.estado !== 'pendiente') {
      throw new Error(
        `Solo se pueden eliminar sub-tandas en estado 'pendiente' (actual: ${tanda.estado})`
      );
    }

    const subEnviosActualizados = subEnvios.filter((se) => se.id !== subEnvioId);
    const ref = doc(db, COLL, envioId);
    await updateDoc(ref, {
      subEnvios: subEnviosActualizados,
      actualizadoPor: userId,
      fechaActualizacion: Timestamp.now(),
    });

    logger.info(`[eliminarSubTanda] ${envio.numeroEnvio} · tanda ${tanda.secuencia} eliminada`);
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
