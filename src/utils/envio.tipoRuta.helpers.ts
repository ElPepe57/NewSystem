/**
 * envio.tipoRuta.helpers.ts — Clasificación de envíos en los 9 tipos de ruta
 * logística A-J del Modelo Envíos Transversal (S43).
 *
 * Mientras el campo canónico `tipoRutaLogistica` se agrega al tipo `Envio`
 * (diferido a S48), este helper DERIVA el tipo a partir de los campos
 * existentes del envío (origenTipo, esDDP, ordenCompraId, destinoCasillaPais,
 * recojoEnOrigen).
 *
 * 9 tipos soportados:
 *   A — Proveedor → Casilla Intl (OC sin DDP)
 *   B — DDP directo (OC con esDDP)
 *   C — Casilla Intl → Almacén Perú
 *   D — Recojo directo del colaborador (OC con recojoEnOrigen)
 *   E — Traslado interno almacén↔almacén Perú (aún no modelado)
 *   F — Despacho venta almacén→cliente (aún no modelado)
 *   G — Devolución cliente→almacén (aún no modelado)
 *   I — A terceros (marketing/samples, aún no modelado)
 *   J — Casilla Intl ↔ Casilla Intl
 *
 * E/F/G/I devuelven null hasta que S48+ agregue los campos necesarios.
 */
import type { Envio } from '../types/envio.types';

export type TipoRutaLogistica = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'I' | 'J';

export function deriveTipoRutaLogistica(envio: Envio): TipoRutaLogistica | null {
  const esDDP = (envio as any).esDDP === true;
  const origen = envio.origenTipo;
  const destinoTipo = envio.destinoTipo; // S49 — puede ser 'cliente' para Caso F
  const hayOC = !!envio.ordenCompraId;
  const origenPais = envio.origenCasillaPais;
  const destinoPais = envio.destinoCasillaPais;
  const recojoEnOrigen = (envio as any).recojoEnOrigen === true;
  const origenEsPeru = origenPais === 'Peru' || origenPais === 'Peru_local';
  const destinoEsPeru = destinoPais === 'Peru' || destinoPais === 'Peru_local';

  // D — Recojo directo: OC donde el colaborador recoge (unidades nacen en su casilla)
  if (hayOC && recojoEnOrigen) return 'D';

  // B — DDP directo: OC con esDDP=true (proveedor gestiona flete hasta Perú)
  if (hayOC && esDDP) return 'B';

  // A — Proveedor → Casilla (OC sin DDP, origen=proveedor)
  if (hayOC && origen === 'proveedor' && !esDDP) return 'A';

  // S49 — G: Devolución (origen=cliente, destino=casilla Perú)
  if (origen === 'cliente') {
    return 'G';
  }

  // S49 — F: Despacho venta (origen=casilla Perú, destino=cliente)
  if (origen === 'casilla' && destinoTipo === 'cliente' && origenEsPeru) {
    return 'F';
  }

  // S48 — E: Traslado interno Perú ↔ Perú (origen y destino ambos en Perú)
  // Debe evaluarse ANTES que C para no clasificar Perú→Perú como C.
  if (origen === 'casilla' && origenEsPeru && destinoEsPeru) {
    return 'E';
  }

  // C — Casilla internacional → Perú (origen=casilla NO Perú, destino Perú)
  if (origen === 'casilla' && !origenEsPeru && destinoEsPeru) {
    return 'C';
  }

  // J — Casilla ↔ Casilla intl (origen=casilla intl, destino NO Perú)
  if (origen === 'casilla' && !origenEsPeru && destinoPais && !destinoEsPeru) {
    return 'J';
  }

  // I — requiere destinoTipo explícito para almacén tercero (S50+)
  return null;
}

export interface TipoRutaInfo {
  codigo: TipoRutaLogistica;
  icono: string;       // Flecha emoji ej. "🏭→📦"
  nombreCorto: string; // Ej. "Proveedor-Casilla"
  nombreLargo: string; // Ej. "Proveedor → Casilla Internacional"
  color: 'slate' | 'sky' | 'teal' | 'amber' | 'orange' | 'yellow' | 'fuchsia' | 'violet';
}

export const INFO_TIPO_RUTA: Record<TipoRutaLogistica, TipoRutaInfo> = {
  A: {
    codigo: 'A',
    icono: '🏭→📦',
    nombreCorto: 'Proveedor-Casilla',
    nombreLargo: 'Proveedor → Casilla Internacional',
    color: 'slate',
  },
  B: {
    codigo: 'B',
    icono: '🏭→🇵🇪',
    nombreCorto: 'DDP Directo',
    nombreLargo: 'DDP · Proveedor directo a Perú',
    color: 'sky',
  },
  C: {
    codigo: 'C',
    icono: '📦→🇵🇪',
    nombreCorto: 'Casilla-Perú',
    nombreLargo: 'Casilla Internacional → Almacén Perú',
    color: 'teal',
  },
  D: {
    codigo: 'D',
    icono: '🏭→👤',
    nombreCorto: 'Recojo directo',
    nombreLargo: 'Compra directa del colaborador',
    color: 'amber',
  },
  E: {
    codigo: 'E',
    icono: '🏠↔🏠',
    nombreCorto: 'Traslado interno',
    nombreLargo: 'Almacén → Almacén interno (Perú)',
    color: 'slate',
  },
  F: {
    codigo: 'F',
    icono: '🏠→🛍️',
    nombreCorto: 'Despacho venta',
    nombreLargo: 'Almacén → Cliente (despacho venta)',
    color: 'orange',
  },
  G: {
    codigo: 'G',
    icono: '🛍️→🏠',
    nombreCorto: 'Devolución',
    nombreLargo: 'Cliente → Almacén (devolución)',
    color: 'yellow',
  },
  I: {
    codigo: 'I',
    icono: '🏠→🏢',
    nombreCorto: 'Terceros',
    nombreLargo: 'Almacén → Almacén de terceros',
    color: 'fuchsia',
  },
  J: {
    codigo: 'J',
    icono: '📦↔📦',
    nombreCorto: 'Casilla-Casilla',
    nombreLargo: 'Casilla ↔ Casilla Internacional',
    color: 'violet',
  },
};

/**
 * Cuenta la distribución de envíos por tipo de ruta logística.
 * Los envíos que no clasifican (null) se agregan bajo 'sin_clasificar'.
 */
export function contarEnviosPorTipoRuta(
  envios: Envio[]
): Record<TipoRutaLogistica, number> & { sin_clasificar: number } {
  const counts: Record<TipoRutaLogistica, number> & { sin_clasificar: number } = {
    A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, I: 0, J: 0,
    sin_clasificar: 0,
  };
  for (const e of envios) {
    const tipo = deriveTipoRutaLogistica(e);
    if (tipo) counts[tipo]++;
    else counts.sin_clasificar++;
  }
  return counts;
}

/**
 * Clase Tailwind para el badge de tipo de ruta según color.
 * Devuelve algo como "bg-teal-100 text-teal-800".
 */
export function badgeClassForTipoRuta(tipo: TipoRutaLogistica): string {
  const color = INFO_TIPO_RUTA[tipo].color;
  const map: Record<TipoRutaInfo['color'], string> = {
    slate: 'bg-slate-100 text-slate-800',
    sky: 'bg-sky-100 text-sky-800',
    teal: 'bg-teal-100 text-teal-800',
    amber: 'bg-amber-100 text-amber-800',
    orange: 'bg-orange-100 text-orange-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    fuchsia: 'bg-fuchsia-100 text-fuchsia-800',
    violet: 'bg-violet-100 text-violet-800',
  };
  return map[color];
}
