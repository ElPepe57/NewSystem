/**
 * ocWizardFromOrden — Construye un OCWizardState desde una OrdenCompra existente.
 *
 * S53.9: usado por OCWizardV3 en modo edición. Pre-llena el state del wizard
 * con los datos persistidos de una OC en estado 'borrador' para que el usuario
 * pueda modificarlos y guardar cambios via el servicio `update()`.
 *
 * El mapping cubre los campos que el wizard expone en sus 5 pasos:
 *   - Paso 1 Ruta: configLogistica (proveedor + tramos + deudor)
 *   - Paso 2 Productos: productos + subOrdenes + useSubOrdenes
 *   - Paso 3 Cargos: cargosOC, descuentosOC, impuestosOC
 *   - Paso 4 Inteligencia: derivado, nada a pre-cargar
 *   - Paso 5 Confirmar: tcCompra + observaciones
 */
import type { OrdenCompra } from '../../../../types/ordenCompra.types';
import type { OCWizardState } from './ocWizardTypes';
import { initialWizardState } from './ocWizardTypes';
import { emptyConfig, type ConfigLogistica } from './configLogistica';

export function buildStateFromOrden(orden: OrdenCompra): OCWizardState {
  // Reconstruir ConfigLogistica desde los campos persistidos
  const config: ConfigLogistica = {
    ...emptyConfig,
    proveedorId: orden.proveedorId || '',
    proveedorNombre: orden.nombreProveedor || '',
    paisOrigen: orden.paisOrigen || '',
    casillaDestinoId: orden.almacenDestino || '',
    casillaDestinoNombre: orden.nombreAlmacenDestino || '',
    colaboradorId: orden.colaboradorTransporteId || '',
    colaboradorNombre: orden.colaboradorTransporteNombre || '',
    // Campos derivados del modoEntregaDetallado
    llegadaPeru:
      orden.modoEntregaDetallado === 'ddp_directo' ? 'ddp_directo' : 'viajero',
    salidaProveedor: orden.recojoEnOrigen ? 'recojo_en_origen' : 'proveedor_envia',
    // Deudor alternativo
    deudorId: orden.deudorId || '',
    deudorNombre: orden.deudorNombre || '',
    deudorTipo: (orden.deudorTipo as any) || '',
  };

  return {
    ...initialWizardState,
    currentStep: 0,
    configLogistica: config,
    modoEntregaDetallado: orden.modoEntregaDetallado || null,
    quienPagaFlete: null,
    colaboradorId: orden.colaboradorTransporteId || '',
    colaboradorNombre: orden.colaboradorTransporteNombre || '',
    proveedorId: orden.proveedorId || '',
    proveedorNombre: orden.nombreProveedor || '',
    paisOrigen: orden.paisOrigen || 'USA',
    tcCompra: orden.tcCompra || 0,
    productos: orden.productos || [],
    subOrdenes: orden.subOrdenes || [],
    useSubOrdenes: (orden.subOrdenes || []).length > 0,
    cargosOC: orden.cargosOC || [],
    descuentosOC: orden.descuentosOC || [],
    impuestosOC: orden.impuestosOC || [],
    observaciones: orden.observaciones || '',
  };
}
