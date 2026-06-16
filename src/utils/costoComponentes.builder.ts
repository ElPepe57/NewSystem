/**
 * costoComponentes.builder — Construcción de los ComponenteCostoUnidad[] congelados
 * de una unidad, a partir del producto + flete + costos landed prorrateados.
 *
 * Compartido entre los write-paths que congelan el CTRU de una unidad:
 *   - envio.recepcion.service.registrarRecepcion
 *   - ordenCompra.crud.service.aplicarRecojoEnOrigen
 *
 * REGLA "POR ÁMBITO" (decisión del usuario 2026-06-16):
 *   - Un costo del ENVÍO completo (scope='envio', default) se reparte entre TODAS
 *     las unidades del envío con DENOMINADOR ESTABLE → la cuota de cada unidad es
 *     la misma en cualquier recepción y no se re-toca a las ya congeladas.
 *   - Un costo de una ETAPA (scope='tanda') se reparte SOLO entre las unidades de
 *     esa tanda (ambito='etapa'), respetando la inmutabilidad de las demás etapas.
 */
import { Timestamp } from 'firebase/firestore';
import type { CostoLanded, EnvioUnidad, SubEnvioT1 } from '../types/envio.types';
import type { ComponenteCostoUnidad, CategoriaComponenteCosto } from '../types/ctru.types';
import { prorratearCosto, type ProductoInfo } from './prorrateoLanded';

/** Datos mínimos de la unidad para construir su componente 'producto' + flete legacy. */
export interface UnidadCostoBase {
  costoUnitarioUSD?: number;
  costoFleteUSD?: number;
  tcPago?: number;
  tcCompra?: number;
}

/** Mapea la categoría de un CostoLanded a la categoría del componente de costo. */
function categoriaDeLanded(costo: CostoLanded): CategoriaComponenteCosto {
  if ((costo.montoPEN ?? 0) < 0) return 'descuento';
  const txt = `${costo.categoriaCostoId || ''} ${costo.categoriaCostoNombre || ''}`.toLowerCase();
  if (txt.includes('flete') || txt.includes('transporte')) return 'flete';
  if (txt.includes('aduana') || txt.includes('impuesto') || txt.includes('arancel')) return 'impuesto';
  if (txt.includes('recojo') || txt.includes('pickup')) return 'recojo';
  return 'landed';
}

/**
 * Construye el mapa tandaId → unidades de esa tanda a partir de los SubEnvioT1.
 * Permite prorratear costos con scope='tanda' solo sobre su propia tanda.
 */
export function buildUnidadesPorTanda(
  subEnvios: SubEnvioT1[] | undefined,
  todasLasUnidades: EnvioUnidad[]
): Map<string, EnvioUnidad[]> {
  const map = new Map<string, EnvioUnidad[]>();
  if (!subEnvios || subEnvios.length === 0) return map;
  const porId = new Map(todasLasUnidades.map(u => [u.unidadId, u]));
  for (const tanda of subEnvios) {
    const unidades = (tanda.unidadesIds || [])
      .map(id => porId.get(id))
      .filter((u): u is EnvioUnidad => !!u);
    map.set(tanda.id, unidades);
  }
  return map;
}

/**
 * Prorratea los costos landed de un envío a sus unidades como ComponenteCostoUnidad[],
 * respetando el ámbito de cada costo. Devuelve Map unidadId → componentes landed.
 */
export function prorratearLandedAComponentes(
  costosLanded: CostoLanded[],
  todasLasUnidadesEnvio: EnvioUnidad[],
  unidadesPorTanda: Map<string, EnvioUnidad[]>,
  productosInfo: Map<string, ProductoInfo>,
  congeladoEn: Timestamp
): Map<string, ComponenteCostoUnidad[]> {
  const result = new Map<string, ComponenteCostoUnidad[]>();
  const push = (uid: string, comp: ComponenteCostoUnidad) => {
    const arr = result.get(uid);
    if (arr) arr.push(comp);
    else result.set(uid, [comp]);
  };

  for (const costo of costosLanded) {
    const esTanda = costo.scope === 'tanda' && !!costo.tandaId;
    const universo = esTanda
      ? (unidadesPorTanda.get(costo.tandaId as string) || [])
      : todasLasUnidadesEnvio;
    if (universo.length === 0) continue;

    const prorrateo = prorratearCosto(costo, universo, productosInfo);
    for (const [uid, monto] of prorrateo) {
      if (!monto) continue;
      push(uid, {
        categoria: categoriaDeLanded(costo),
        concepto: costo.descripcion || costo.categoriaCostoNombre || 'Costo landed',
        montoPEN: monto,
        fuente: 'envio',
        ambito: esTanda ? 'etapa' : 'envio',
        ...(esTanda ? { tandaId: costo.tandaId } : {}),
        ...(costo.categoriaCostoId ? { categoriaCostoId: costo.categoriaCostoId } : {}),
        congeladoEn,
      });
    }
  }

  return result;
}

/**
 * Construye la lista COMPLETA de componentes de costo de UNA unidad:
 * producto (capa base, siempre) + flete legacy per-unit (si aplica) + los
 * componentes landed ya prorrateados para esa unidad. El TC se toma de la unidad
 * (tcPago||tcCompra), congelado en la transacción.
 */
export function construirComponentesUnidad(
  unidad: UnidadCostoBase,
  landedComponentes: ComponenteCostoUnidad[],
  congeladoEn: Timestamp
): ComponenteCostoUnidad[] {
  const tc = unidad.tcPago || unidad.tcCompra || 0;
  const componentes: ComponenteCostoUnidad[] = [];

  // Producto (capa base) — siempre presente, aun sin costos landed.
  const costoUSD = unidad.costoUnitarioUSD || 0;
  componentes.push({
    categoria: 'producto',
    concepto: 'Compra del proveedor',
    montoPEN: costoUSD * tc,
    montoOrigenUSD: costoUSD,
    tc,
    fuente: 'oc',
    ambito: 'envio',
    congeladoEn,
  });

  // Flete legacy per-unit (flujo transferencia; en el flujo OC suele ser 0).
  const fleteUSD = unidad.costoFleteUSD || 0;
  if (fleteUSD > 0) {
    componentes.push({
      categoria: 'flete',
      concepto: 'Flete internacional',
      montoPEN: fleteUSD * tc,
      montoOrigenUSD: fleteUSD,
      tc,
      fuente: 'envio',
      ambito: 'envio',
      congeladoEn,
    });
  }

  componentes.push(...landedComponentes);
  return componentes;
}
