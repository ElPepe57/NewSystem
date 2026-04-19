import type { QuienPagaFlete } from '../../../../types/ordenCompra.types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos de los 3 tramos de ruta (S41 rework)
// ════════════════════════════════════════════════════════════════════════════

/** Tramo 1: Cómo sale la mercadería del proveedor */
export type SalidaProveedor = 'proveedor_envia' | 'recojo_en_origen';

/** Tramo 2: Cómo llega la mercadería a Perú */
export type LlegadaPeru =
  | 'ddp_directo'
  | 'viajero'
  | 'courier_internacional'
  | 'ya_en_peru';

/** Tramo 3: Última milla en Perú */
export type UltimaMilla = 'entrega_domicilio' | 'yo_recojo';

/** ¿Quién paga al proveedor? (determina destinatario de la CxP) */
export type QuienPagaProveedor = 'yo_pague' | 'recogedor_paga';

// ════════════════════════════════════════════════════════════════════════════
// ConfigLogistica — estado completo de la ruta
// ════════════════════════════════════════════════════════════════════════════

export interface ConfigLogistica {
  // ─── Proveedor ───
  proveedorId: string;
  proveedorNombre: string;
  paisOrigen: string;

  // ─── Tramo 1: Salida ───
  salidaProveedor: SalidaProveedor | null;
  fleteProveedorIncluido: boolean | null;
  costoShippingProveedor: number | null;
  tipoShipping: 'local' | 'internacional' | null;
  // Si recojo en origen: ¿quién paga al proveedor?
  quienPagaProveedor: QuienPagaProveedor | null;
  deudorId: string; // ID de a quién le debo (proveedor o colaborador)
  deudorNombre: string;
  deudorTipo: 'proveedor' | 'colaborador' | '';

  // ─── Tramo 2: Llegada a Perú ───
  llegadaPeru: LlegadaPeru | null;
  colaboradorId: string;
  colaboradorNombre: string;
  casillaDestinoId: string;
  casillaDestinoNombre: string;

  // ─── Tramo 3: Última milla ───
  ultimaMilla: UltimaMilla | null;
  requiereRecojo: boolean;
}

export const emptyConfig: ConfigLogistica = {
  proveedorId: '',
  proveedorNombre: '',
  paisOrigen: '',
  salidaProveedor: null,
  fleteProveedorIncluido: null,
  costoShippingProveedor: null,
  tipoShipping: null,
  quienPagaProveedor: null,
  deudorId: '',
  deudorNombre: '',
  deudorTipo: '',
  llegadaPeru: null,
  colaboradorId: '',
  colaboradorNombre: '',
  casillaDestinoId: '',
  casillaDestinoNombre: '',
  ultimaMilla: null,
  requiereRecojo: false,
};

// ════════════════════════════════════════════════════════════════════════════
// Derivación: modo de entrega legacy (para compatibilidad con el submit handler)
// ════════════════════════════════════════════════════════════════════════════

export function deriveModoFromConfig(config: ConfigLogistica): {
  modoEntregaDetallado:
    | 'ddp_directo'
    | 'via_viajero'
    | 'via_courier'
    | 'recojo_propio'
    | null;
  quienPagaFlete: QuienPagaFlete | null;
} {
  if (!config.llegadaPeru) {
    return { modoEntregaDetallado: null, quienPagaFlete: null };
  }

  const modoMap: Record<
    LlegadaPeru,
    'ddp_directo' | 'via_viajero' | 'via_courier' | 'recojo_propio'
  > = {
    ddp_directo: 'ddp_directo',
    viajero: 'via_viajero',
    courier_internacional: 'via_courier',
    ya_en_peru: 'recojo_propio',
  };

  let flete: QuienPagaFlete | null = null;
  if (config.llegadaPeru === 'ddp_directo') flete = 'proveedor';
  else if (config.llegadaPeru === 'viajero') flete = 'viajero';
  else flete = 'comprador';

  return {
    modoEntregaDetallado: modoMap[config.llegadaPeru],
    quienPagaFlete: flete,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers de visibilidad condicional (qué preguntas se muestran en cada etapa)
// ════════════════════════════════════════════════════════════════════════════

export function getVisibilidadTramos(config: ConfigLogistica) {
  const hasProveedor = !!config.proveedorId;
  return {
    salidaProveedor: hasProveedor,
    fleteProveedor: hasProveedor && config.salidaProveedor === 'proveedor_envia',
    shippingCost:
      config.salidaProveedor === 'proveedor_envia' &&
      config.fleteProveedorIncluido === false,
    quienPagaProveedor: config.salidaProveedor === 'recojo_en_origen',
    llegadaPeru:
      config.salidaProveedor !== null &&
      (config.salidaProveedor === 'recojo_en_origen'
        ? config.quienPagaProveedor !== null &&
          (config.quienPagaProveedor === 'yo_pague' || !!config.deudorId)
        : config.salidaProveedor !== 'proveedor_envia' ||
          config.fleteProveedorIncluido !== null),
    colaboradorSelector:
      config.llegadaPeru === 'viajero' ||
      config.llegadaPeru === 'courier_internacional',
    ultimaMilla:
      config.llegadaPeru !== null && config.llegadaPeru !== 'ddp_directo',
    casillaDDP: config.llegadaPeru === 'ddp_directo',
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Consequences — qué va a pasar según la configuración elegida
// ════════════════════════════════════════════════════════════════════════════

export function getConsequences(config: ConfigLogistica): string[] {
  const items: string[] = [];

  // Tramo 1
  if (config.salidaProveedor === 'proveedor_envia') {
    if (config.fleteProveedorIncluido === true) {
      items.push('Shipping del proveedor incluido en el precio');
    } else if (config.fleteProveedorIncluido === false) {
      const costoStr = config.costoShippingProveedor
        ? ` (USD ${config.costoShippingProveedor.toFixed(2)})`
        : '';
      const tipoStr =
        config.tipoShipping === 'local'
          ? ' local'
          : config.tipoShipping === 'internacional'
            ? ' internacional'
            : '';
      items.push(
        `El proveedor cobra shipping${tipoStr}${costoStr} — se registrará como cargo de la OC`
      );
    }
  } else if (config.salidaProveedor === 'recojo_en_origen') {
    items.push('Alguien recoge en el almacén del proveedor');
    if (config.quienPagaProveedor === 'yo_pague') {
      items.push('Deuda con el proveedor — yo pagué directamente');
    } else if (config.quienPagaProveedor === 'recogedor_paga') {
      items.push(
        'Deuda con el recogedor — la CxP se genera contra quien pagó al proveedor'
      );
    }
  }

  // Tramo 2
  if (config.llegadaPeru === 'ddp_directo') {
    items.push(
      'El proveedor envía directo a Perú — flete internacional incluido'
    );
    items.push('Al confirmar: se crea envío automático (Proveedor → Almacén)');
  } else if (config.llegadaPeru === 'viajero') {
    items.push(
      `Viajero${config.colaboradorNombre ? ` (${config.colaboradorNombre})` : ''} trae el pedido a Perú`
    );
    items.push('Al confirmar: se crea envío automático (Proveedor → Viajero)');
    items.push('Costo del viajero se registra al recibir el envío');
  } else if (config.llegadaPeru === 'courier_internacional') {
    const courierStr = config.colaboradorNombre
      ? ` (${config.colaboradorNombre})`
      : '';
    items.push(`Courier internacional${courierStr} trae a Perú — tú pagas el flete`);
    items.push('Al confirmar: se crea envío automático con el courier');
  } else if (config.llegadaPeru === 'ya_en_peru') {
    items.push('Proveedor local o mercadería ya en Perú');
    items.push('No se crea envío internacional — solo logística local');
  }

  // Tramo 3
  if (config.ultimaMilla === 'yo_recojo') {
    items.push('Al recibir el envío se exigirá registrar el costo de recojo');
  } else if (config.ultimaMilla === 'entrega_domicilio') {
    items.push('Entrega directa en almacén — sin costo de recojo');
  }

  return items;
}
