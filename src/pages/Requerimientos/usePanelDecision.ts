/**
 * usePanelDecision · F4 · capa de medición #4.
 *
 * Ensambla el `PanelDecisionInput` para `computePanelDecision` desde las distintas fuentes de verdad:
 *   - RESTOCK  → productoIntel (store) → evaluarReorden (motor ROP)
 *   - ROTACION → productoIntel.rotacion
 *   - DEMANDA  → cotización vinculada (CotizacionService)
 *   - CAJA     → saldo consolidado de tesorería (getEstadisticasAgregadas · async)
 *
 * Maneja la captura inline (precioVentaPEN / driverDemanda) como estado local que pisa el dato del req
 * y recomputa el modelo en vivo. El componente persiste por separado (requerimientoService).
 */
import { useEffect, useMemo, useState } from 'react';
import { useProductoIntelStore } from '../../store/productoIntelStore';
import { tesoreriaService } from '../../services/tesoreria.service';
import { CotizacionService } from '../../services/cotizacion.service';
import { evaluarReorden, type ReordenInput } from '../../services/stockReorden.helper';
import {
  computePanelDecision,
  resolverLente,
  type PanelDecision,
  type PanelDecisionInput,
  type RestockLensInput,
  type RotacionContexto,
  type DemandaComprometidaInput,
} from './panelDecision.helper';
import type { Requerimiento, DriverDemanda } from '../../types/requerimiento.types';
import type { ProductoIntel } from '../../types/productoIntel.types';

/** ProductoIntel + leadTime global → ReordenInput (firma exacta del motor). */
function mapProductoIntelAReordenInput(
  intel: ProductoIntel,
  leadTimeGlobalDias: number,
  leadTimeGlobalDesviacion: number,
): ReordenInput {
  const r = intel.rotacion;
  return {
    productoId: intel.productoId,
    sku: intel.sku,
    nombreComercial: intel.nombreComercial,
    marca: intel.marca,
    stockDisponible: r.stockDisponible,
    stockTotal: r.stockTotal,
    velocidadDiaria: r.promedioVentasDiarias,
    unidadesVendidas90d: r.unidadesVendidas90d,
    clasificacionRotacion: r.clasificacionRotacion,
    leadTimeDias: intel.leadTimePromedioDias ?? leadTimeGlobalDias ?? 0,
    leadTimeDesviacionDias: intel.leadTimeDesviacionDias ?? leadTimeGlobalDesviacion ?? 0,
    leadTimeMuestras: intel.leadTimeMuestras ?? 0,
    // El motor netea la demanda comprometida en otro punto (single source en el store);
    // acá es solo el contexto del panel → 0 (el helper lo neteа aparte).
    demandaComprometida: 0,
  };
}

export interface UsePanelDecisionResult {
  decision: PanelDecision;
  loading: boolean;
  /** El producto primario no está en productoIntel (restock sin datos). */
  restockSinDatos: boolean;
  /** Captura inline · setea + recomputa en vivo (la persistencia la hace el componente). */
  precioVentaOverride?: number;
  setPrecioVentaOverride: (v: number | undefined) => void;
  driverOverride?: DriverDemanda;
  setDriverOverride: (d: DriverDemanda | undefined) => void;
}

export function usePanelDecision(req: Requerimiento): UsePanelDecisionResult {
  const getProductoById = useProductoIntelStore((s) => s.getProductoById);
  const leadTimeGlobal = useProductoIntelStore((s) => s.leadTimeGlobal);

  // CAJA · saldo consolidado de tesorería (async · null mientras carga / si no se pudo leer).
  const [cajaDisponiblePEN, setCajaDisponiblePEN] = useState<number | null>(null);
  const [cajaLoading, setCajaLoading] = useState(true);

  // DEMANDA · cotización vinculada (async · solo lente demanda_comprometida).
  const lente = resolverLente(req);
  const [demanda, setDemanda] = useState<DemandaComprometidaInput | undefined>(undefined);
  const [demandaLoading, setDemandaLoading] = useState(lente === 'demanda_comprometida');

  // Captura inline · estado local (la persistencia la hace el componente). Se resetea por `key={req.id}`
  // en el componente (cada req monta una instancia fresca del hook · sin setState-en-effect).
  const [precioVentaOverride, setPrecioVentaOverride] = useState<number | undefined>(undefined);
  const [driverOverride, setDriverOverride] = useState<DriverDemanda | undefined>(undefined);

  // Cargar caja consolidada (async · setState solo en callbacks, nunca síncrono en el body).
  useEffect(() => {
    let activo = true;
    tesoreriaService
      .getEstadisticasAgregadas()
      .then((stats) => {
        if (!activo) return;
        setCajaDisponiblePEN(stats?.saldoTotalEquivalentePEN ?? null);
      })
      .catch(() => {
        if (activo) setCajaDisponiblePEN(null);
      })
      .finally(() => {
        if (activo) setCajaLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [req.id]);

  // Cargar la cotización (lente demanda_comprometida · setState solo en callbacks async).
  useEffect(() => {
    if (lente !== 'demanda_comprometida') {
      return;
    }
    let activo = true;
    const clienteNombre = req.nombreClienteSolicitante || req.clienteNombre;

    if (!req.cotizacionId) {
      // Microtask-deferred (Promise.resolve) → evita setState síncrono en el body del effect.
      Promise.resolve().then(() => {
        if (!activo) return;
        setDemanda({ clienteNombre, cotizacionNumero: req.cotizacionNumero, adelantoPagado: false });
        setDemandaLoading(false);
      });
      return () => {
        activo = false;
      };
    }

    CotizacionService.getById(req.cotizacionId)
      .then((cot) => {
        if (!activo) return;
        const adelantoPagado =
          !!cot?.adelanto || cot?.estado === 'adelanto_pagado' || cot?.estado === 'confirmada';
        const adelantoMontoPEN = cot?.adelanto
          ? cot.adelanto.montoEquivalentePEN ?? cot.adelanto.monto
          : cot?.adelantoComprometido?.monto;
        setDemanda({
          clienteNombre,
          cotizacionId: req.cotizacionId,
          cotizacionNumero: req.cotizacionNumero || cot?.numeroCotizacion,
          adelantoMontoPEN,
          adelantoPagado,
        });
      })
      .catch(() => {
        if (activo) {
          setDemanda({
            clienteNombre,
            cotizacionId: req.cotizacionId,
            cotizacionNumero: req.cotizacionNumero,
            adelantoPagado: false,
          });
        }
      })
      .finally(() => {
        if (activo) setDemandaLoading(false);
      });

    return () => {
      activo = false;
    };
  }, [req.id, lente, req.cotizacionId, req.cotizacionNumero, req.nombreClienteSolicitante, req.clienteNombre]);

  // RESTOCK / ROTACION · desde productoIntel (síncrono · del store).
  const intel = req.productos[0] ? getProductoById(req.productos[0].productoId) : undefined;
  const restockSinDatos = lente === 'restock' && !intel;

  const restock: RestockLensInput | undefined = useMemo(() => {
    if (lente !== 'restock' || !intel) return undefined;
    const alerta = evaluarReorden(
      mapProductoIntelAReordenInput(
        intel,
        leadTimeGlobal?.tiempoPromedioTotal ?? 0,
        leadTimeGlobal?.desviacionEstandar ?? 0,
      ),
    );
    return {
      puntoReorden: alerta.puntoReorden,
      stockNeto: alerta.stockNeto,
      diasCobertura: alerta.diasCobertura,
      velocidadDiaria: alerta.velocidadDiaria,
      leadTimeDias: alerta.leadTimeDias,
      stockSeguridad: alerta.stockSeguridad,
      urgencia: alerta.urgencia,
      razon: alerta.razon,
      cantidadSugerida: alerta.cantidadSugerida,
      necesitaReposicion: alerta.necesitaReposicion,
    };
  }, [lente, intel, leadTimeGlobal]);

  const rotacion: RotacionContexto | undefined = useMemo(() => {
    if (lente !== 'manual' || !intel) return undefined;
    const r = intel.rotacion;
    return {
      velocidadDiaria: r.promedioVentasDiarias,
      clasificacionRotacion: r.clasificacionRotacion,
      diasCobertura: r.diasParaQuiebre,
    };
  }, [lente, intel]);

  const decision = useMemo<PanelDecision>(() => {
    const input: PanelDecisionInput = {
      req,
      cajaDisponiblePEN,
      restock,
      rotacion,
      demanda,
      precioVentaPENOverride: precioVentaOverride,
      driverOverride,
    };
    return computePanelDecision(input);
  }, [req, cajaDisponiblePEN, restock, rotacion, demanda, precioVentaOverride, driverOverride]);

  const loading = cajaLoading || demandaLoading;

  return {
    decision,
    loading,
    restockSinDatos,
    precioVentaOverride,
    setPrecioVentaOverride,
    driverOverride,
    setDriverOverride,
  };
}
