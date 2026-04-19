import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Building2,
  Warehouse,
  Truck,
  UserCheck,
  Home,
  Car,
  Plane,
  DollarSign,
  Info,
  AlertCircle,
  Check,
  MapPin,
  Users,
  Package,
} from 'lucide-react';
import { cn } from '../../../../design-system';
import type { OCWizardState } from './ocWizardTypes';
import type { OCWizardAction } from './ocWizardReducer';
import { emptyConfig } from './configLogistica';
import type {
  ConfigLogistica,
  SalidaProveedor,
  LlegadaPeru,
  UltimaMilla,
  QuienPagaProveedor,
} from './configLogistica';
import { useProveedorStore } from '../../../../store/proveedorStore';
import { useColaboradorStore } from '../../../../store/colaboradorStore';
import { useAlmacenStore } from '../../../../store/casillaStore';
import type { Proveedor } from '../../../../types/ordenCompra.types';
import type { Casilla } from '../../../../types/casilla.types';
import type { Colaborador } from '../../../../types/colaborador.types';

// ════════════════════════════════════════════════════════════════════════════
// StepRuta — Paso 1 OCWizardV3 (reescritura completa alineada al mockup S40)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Estructura fiel al mockup `rework-maestro-s40.html` pane-oc-1:
 *
 *   Sección 1 — ¿A quién le compras? (proveedor con cards ricas)
 *   Sección 2 — ¿Cómo llega la mercadería? (tipo: vía casilla / DDP)
 *                 + selector Casilla de tránsito (cards con avatar)
 *                 + selector Almacén destino final Perú (cards compactas)
 *   Sección 3 — Tramo 1 Salida del proveedor
 *                 + panel morado condicional (Recojo en origen → deudor alternativo)
 *   Sección 4 — Tramo 2 Cruce a Perú (3 cards)
 *                 + selector colaborador/courier agrupado
 *   Sección 5 — Tramo 3 Última milla en Perú (3 cards + paneles contextuales)
 */

interface StepRutaProps {
  state: OCWizardState;
  dispatch: React.Dispatch<OCWizardAction>;
}

// ─── Main component ─────────────────────────────────────────────────────────

export const StepRuta: React.FC<StepRutaProps> = ({ state, dispatch }) => {
  const config = state.configLogistica;

  // ─── Stores ────────────────────────────────────────────────────────────
  const { proveedores, fetchProveedores } = useProveedorStore();
  const { colaboradores, fetchColaboradores, getByTipo } = useColaboradorStore();
  const { casillas, fetchCasillas } = useAlmacenStore();

  useEffect(() => {
    if (proveedores.length === 0) fetchProveedores();
    if (colaboradores.length === 0) fetchColaboradores();
    if (casillas.length === 0) fetchCasillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viajeros = getByTipo('viajero');
  const couriers = getByTipo('courier_externo');

  // Clasificación de casillas según país
  const casillasOrigen = useMemo(
    () => casillas.filter((c) => c.pais !== 'Peru' && c.estado === 'activa'),
    [casillas]
  );
  const almacenesPeru = useMemo(
    () => casillas.filter((c) => c.pais === 'Peru' && c.estado === 'activa'),
    [casillas]
  );

  // S42q — Selectores colapsables: al elegir una opción, el grid colapsa a solo
  // la seleccionada + botón "Cambiar" para reexpandir. Mejora UX cuando la lista
  // es larga (6-10 casillas visibles).
  // S42r — Mismo patrón aplicado al proveedor (lista puede tener 10+ entradas)
  const [proveedorExpandedOverride, setProveedorExpandedOverride] = useState(false);
  // S42x — También al tipo de ruta (2 cards grandes)
  const [tipoRutaExpandedOverride, setTipoRutaExpandedOverride] = useState(false);
  const [casillaExpandedOverride, setCasillaExpandedOverride] = useState(false);
  const [almacenExpandedOverride, setAlmacenExpandedOverride] = useState(false);
  // S42ab — Colapsable también en los 3 Tramos (Salida, Cruce, Última milla)
  const [tramo1ExpandedOverride, setTramo1ExpandedOverride] = useState(false);
  const [tramo2ExpandedOverride, setTramo2ExpandedOverride] = useState(false);
  const [tramo3ExpandedOverride, setTramo3ExpandedOverride] = useState(false);

  const proveedorSeleccionado = useMemo(
    () => proveedores.find((p) => p.id === config.proveedorId),
    [proveedores, config.proveedorId]
  );
  // S42v — Viajeros asociados a la casilla seleccionada (principal + secundarios)
  // Útil para el Tramo 2 "Vía viajero": prioriza quienes ya usan esa casilla.
  const viajerosAsociadosIds = useMemo(() => {
    const ids = new Set<string>();
    const casilla = casillasOrigen.find((c) => c.id === config.casillaDestinoId);
    if (!casilla) return ids;
    ids.add(casilla.colaboradorId);
    casilla.colaboradoresSecundariosIds?.forEach((id) => ids.add(id));
    return ids;
  }, [casillasOrigen, config.casillaDestinoId]);
  const viajerosDeCasilla = useMemo(
    () => viajeros.filter((v) => viajerosAsociadosIds.has(v.id)),
    [viajeros, viajerosAsociadosIds]
  );
  const casillaSeleccionada = useMemo(
    () => casillasOrigen.find((c) => c.id === config.casillaDestinoId),
    [casillasOrigen, config.casillaDestinoId]
  );
  const almacenPeruSeleccionado = useMemo(
    () =>
      config.llegadaPeru === 'ddp_directo' && config.casillaDestinoId
        ? almacenesPeru.find((a) => a.id === config.casillaDestinoId)
        : null,
    [almacenesPeru, config.casillaDestinoId, config.llegadaPeru]
  );

  const showProveedorList = !proveedorSeleccionado || proveedorExpandedOverride;
  const showCasillaGrid = !casillaSeleccionada || casillaExpandedOverride;
  const showAlmacenGrid = !almacenPeruSeleccionado || almacenExpandedOverride;

  // ─── Search casilla de tránsito (S42s) ────────────────────────────────
  const [searchCasilla, setSearchCasilla] = useState('');
  const casillasOrigenFiltradas = useMemo(() => {
    if (!searchCasilla.trim()) return casillasOrigen;
    const q = searchCasilla.toLowerCase().trim();
    return casillasOrigen.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.codigo?.toLowerCase().includes(q)) ||
        (c.ciudad?.toLowerCase().includes(q)) ||
        (c.direccion?.toLowerCase().includes(q)) ||
        (c.colaboradorNombre?.toLowerCase().includes(q))
    );
  }, [casillasOrigen, searchCasilla]);

  // ─── Search proveedor ───────────────────────────────────────────────────
  const [searchProveedor, setSearchProveedor] = useState('');
  const proveedoresFiltrados = useMemo(() => {
    const proveedoresActivos = proveedores.filter((p) => p.activo);
    if (!searchProveedor.trim()) return proveedoresActivos;
    const q = searchProveedor.toLowerCase().trim();
    return proveedoresActivos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.pais && p.pais.toLowerCase().includes(q))
    );
  }, [proveedores, searchProveedor]);

  // ─── Tipo de ruta (derivado de llegadaPeru) ─────────────────────────────
  // Mockup: 2 cards grandes "Vía casilla" vs "DDP directo"
  // En datos: se refleja en llegadaPeru ('ddp_directo' = DDP, otros = Vía casilla)
  const tipoRutaSeleccionado: 'via_casilla' | 'ddp' | null =
    config.llegadaPeru === 'ddp_directo'
      ? 'ddp'
      : config.salidaProveedor || config.llegadaPeru
        ? 'via_casilla'
        : null;

  const showTipoRutaGrid = !tipoRutaSeleccionado || tipoRutaExpandedOverride;

  // ─── Handlers ───────────────────────────────────────────────────────────
  const updateConfig = (partial: Partial<ConfigLogistica>) => {
    const next: ConfigLogistica = { ...config, ...partial };

    // Reset downstream cuando cambia tipo de ruta
    if ('llegadaPeru' in partial && partial.llegadaPeru === 'ddp_directo') {
      next.salidaProveedor = null;
      next.fleteProveedorIncluido = null;
      next.tipoShipping = null;
      next.colaboradorId = '';
      next.colaboradorNombre = '';
      next.ultimaMilla = 'entrega_domicilio';
      next.requiereRecojo = false;
    }

    if ('salidaProveedor' in partial) {
      next.fleteProveedorIncluido = null;
      next.costoShippingProveedor = null;
      next.tipoShipping = null;
      next.quienPagaProveedor = null;
      next.deudorId = '';
      next.deudorNombre = '';
      next.deudorTipo = '';
    }

    if ('quienPagaProveedor' in partial) {
      if (partial.quienPagaProveedor === 'yo_pague') {
        next.deudorId = config.proveedorId;
        next.deudorNombre = config.proveedorNombre;
        next.deudorTipo = 'proveedor';
      }
      // Si es 'recogedor_paga', el usuario elige deudor en el panel morado
    }

    if ('ultimaMilla' in partial) {
      next.requiereRecojo = partial.ultimaMilla === 'yo_recojo';
    }

    dispatch({ type: 'SET_CONFIG_LOGISTICA', config: next } as OCWizardAction);
  };

  const handleSelectProveedor = (p: Proveedor) => {
    const next: ConfigLogistica = {
      ...emptyConfig,
      proveedorId: p.id,
      proveedorNombre: p.nombre,
      paisOrigen: p.pais || '',
    };
    dispatch({ type: 'SET_CONFIG_LOGISTICA', config: next } as OCWizardAction);
    dispatch({
      type: 'SET_PROVEEDOR',
      id: p.id,
      nombre: p.nombre,
    } as OCWizardAction);
    dispatch({ type: 'SET_PAIS_ORIGEN', pais: p.pais || '' } as OCWizardAction);
  };

  const handleSelectCasillaTransito = (c: Casilla) => {
    // La casilla de tránsito también define colaborador (si es de viajero)
    // El mockup trata a la casilla como el selector principal; el colaborador
    // lo resolvemos como el owner de la casilla.
    updateConfig({
      casillaDestinoId: c.id,
      casillaDestinoNombre: c.nombre,
      // Si la casilla tiene colaborador asociado, se pre-selecciona
      ...(c.colaboradorId && {
        colaboradorId: c.colaboradorId,
        colaboradorNombre: c.colaboradorNombre || c.nombre,
      }),
    });
  };

  const handleSelectAlmacenPeru = (a: Casilla) => {
    // En el mockup, el almacén destino final Perú se usa como destino final
    // efectivo. Se guarda en un campo distinto, pero re-usamos casillaDestinoId
    // si es DDP (cuando no hay tránsito).
    if (config.llegadaPeru === 'ddp_directo') {
      updateConfig({
        casillaDestinoId: a.id,
        casillaDestinoNombre: a.nombre,
      });
    } else {
      // Para vía casilla, el almacén Perú se guarda aparte (no mapea directo al
      // modelo actual; lo guardamos en paisOrigen... no — lo omitimos por ahora
      // y dejamos un TODO para ampliar el modelo)
      // S41 auditoría: el modelo no tiene campo "almacenFinalPeruId" aparte de
      // casillaDestinoId. Como el envío T1 tiene destino=casilla y luego casilla→Peru
      // crea otro envío, el almacén final se resolverá en el envío casilla→Peru.
      // Por ahora solo almacenamos el id en un campo genérico del estado.
      updateConfig({
        // Reutilizamos un campo existente: usamos la misma casillaDestino
        // para que al menos quede algo. El sistema real reparte en 2 envíos.
        // TODO: Ampliar modelo con 'almacenFinalPeruId' en sesión dedicada.
      });
      // Guardamos como nota:
      // eslint-disable-next-line no-console
      console.info('[StepRuta] Almacén Perú seleccionado:', a.id, a.nombre);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════ */}
      {/* SECCIÓN 1 — Proveedor                                */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section
        numero={1}
        titulo="¿A quién le compras?"
        subtitulo="Selecciona el proveedor o registra uno nuevo."
        headerRight={
          proveedorSeleccionado && !proveedorExpandedOverride ? (
            <button
              type="button"
              onClick={() => setProveedorExpandedOverride(true)}
              className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
            >
              Cambiar
            </button>
          ) : null
        }
      >
        {/* S42r — Colapsable: si hay proveedor seleccionado y no se forzó expandir, solo muestra la card */}
        {!showProveedorList && proveedorSeleccionado ? (
          <div className="space-y-2">
            <ProveedorCard
              proveedor={proveedorSeleccionado}
              selected
              onClick={() => setProveedorExpandedOverride(true)}
            />
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchProveedor}
                onChange={(e) => setSearchProveedor(e.target.value)}
                placeholder="Buscar proveedor por nombre, código o país..."
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Lista cards proveedores */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
              {proveedoresFiltrados.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400 italic">
                  {searchProveedor ? 'Sin resultados' : 'No hay proveedores activos'}
                </div>
              ) : (
                proveedoresFiltrados.map((p) => (
                  <ProveedorCard
                    key={p.id}
                    proveedor={p}
                    selected={config.proveedorId === p.id}
                    onClick={() => {
                      handleSelectProveedor(p);
                      setProveedorExpandedOverride(false); // colapsar al seleccionar
                    }}
                  />
                ))
              )}

              {/* Botón crear nuevo */}
              <button
                type="button"
                onClick={() => {
                  // TODO: abrir modal de crear proveedor inline
                  // eslint-disable-next-line no-alert
                  alert('Crear proveedor inline — pendiente de conectar al modal');
                }}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl p-3 text-sm text-slate-500 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear nuevo proveedor
              </button>
            </div>
          </>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECCIÓN 2 — ¿Cómo llega la mercadería?               */}
      {/* ═══════════════════════════════════════════════════ */}
      {config.proveedorId && (
        <Section
          numero={2}
          titulo="¿Cómo llega la mercadería?"
          subtitulo="Define la ruta anticipada. Al confirmar la OC se creará automáticamente el envío proveedor → destino."
          headerRight={
            tipoRutaSeleccionado && !tipoRutaExpandedOverride ? (
              <button
                type="button"
                onClick={() => setTipoRutaExpandedOverride(true)}
                className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
              >
                Cambiar
              </button>
            ) : null
          }
        >
          {/* S42x — Colapsable: si hay tipo de ruta seleccionado, muestra solo esa card.
               S42y fix — en modo colapsado, el click de la card re-expande (no re-selecciona). */}
          {!showTipoRutaGrid && tipoRutaSeleccionado ? (
            // ═══ MODO COLAPSADO: solo la card seleccionada, click re-expande ═══
            <div className="mb-4">
              {tipoRutaSeleccionado === 'via_casilla' ? (
                <TipoCardGrande
                  icon={<Warehouse className="w-5 h-5 text-sky-600" />}
                  iconBg="bg-sky-100"
                  titulo="Vía casilla de tránsito"
                  subtitulo="Proveedor → casilla (USA/CN) → Perú"
                  selected
                  onClick={() => setTipoRutaExpandedOverride(true)}
                />
              ) : (
                <TipoCardGrande
                  icon={<Plane className="w-5 h-5 text-amber-600" />}
                  iconBg="bg-amber-100"
                  titulo="Entrega directa a Perú"
                  subtitulo="El proveedor despacha directo a Perú sin pasar por casilla intermedia"
                  selected
                  onClick={() => setTipoRutaExpandedOverride(true)}
                />
              )}
            </div>
          ) : (
            // ═══ MODO EXPANDIDO: ambas cards, click selecciona + colapsa ═══
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <TipoCardGrande
                icon={<Warehouse className="w-5 h-5 text-sky-600" />}
                iconBg="bg-sky-100"
                titulo="Vía casilla de tránsito"
                subtitulo="Proveedor → casilla (USA/CN) → Perú"
                selected={tipoRutaSeleccionado === 'via_casilla'}
                onClick={() => {
                  const cambio: Partial<ConfigLogistica> = {};
                  if (config.llegadaPeru === 'ddp_directo') {
                    cambio.llegadaPeru = null;
                    cambio.casillaDestinoId = '';
                    cambio.casillaDestinoNombre = '';
                  }
                  if (!config.salidaProveedor) {
                    cambio.salidaProveedor = 'proveedor_envia';
                  }
                  if (Object.keys(cambio).length > 0) updateConfig(cambio);
                  setTipoRutaExpandedOverride(false); // colapsar al seleccionar
                }}
              />
              <TipoCardGrande
                icon={<Plane className="w-5 h-5 text-amber-600" />}
                iconBg="bg-amber-100"
                titulo="Entrega directa a Perú"
                subtitulo="El proveedor despacha directo a Perú sin pasar por casilla intermedia"
                selected={tipoRutaSeleccionado === 'ddp'}
                onClick={() => {
                  updateConfig({ llegadaPeru: 'ddp_directo' });
                  setTipoRutaExpandedOverride(false); // colapsar al seleccionar
                }}
              />
            </div>
          )}

          {/* Casilla de tránsito (solo si vía casilla) — S42s buscador + 1-col */}
          {tipoRutaSeleccionado === 'via_casilla' && (
            <div className="mb-4">
              {/* Header colapsable */}
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Casilla de tránsito{' '}
                  <span className="text-slate-400 font-normal">(USA/China)</span>
                </label>
                {casillaSeleccionada && !casillaExpandedOverride && (
                  <button
                    type="button"
                    onClick={() => setCasillaExpandedOverride(true)}
                    className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
                  >
                    Cambiar
                  </button>
                )}
              </div>

              {casillasOrigen.length === 0 ? (
                <EmptyHint>
                  No hay casillas de tránsito activas.{' '}
                  <a href="/red-logistica" className="underline font-medium">
                    Crear una en Red Logística
                  </a>
                </EmptyHint>
              ) : !showCasillaGrid && casillaSeleccionada ? (
                /* Colapsado: solo la seleccionada, 1-col */
                <div className="space-y-2">
                  <CasillaTransitoCard
                    casilla={casillaSeleccionada}
                    colaborador={colaboradores.find((x) => x.id === casillaSeleccionada.colaboradorId)}
                    selected
                    onClick={() => setCasillaExpandedOverride(true)}
                  />
                </div>
              ) : (
                /* Expandido: search + lista 1-col (igual patrón que Proveedor) */
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchCasilla}
                      onChange={(e) => setSearchCasilla(e.target.value)}
                      placeholder="Buscar por nombre, código, ciudad o dirección..."
                      className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                    {casillasOrigenFiltradas.length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-400 italic">
                        {searchCasilla ? 'Sin resultados' : 'No hay casillas disponibles'}
                      </div>
                    ) : (
                      casillasOrigenFiltradas.map((c) => (
                        <CasillaTransitoCard
                          key={c.id}
                          casilla={c}
                          colaborador={colaboradores.find((x) => x.id === c.colaboradorId)}
                          selected={config.casillaDestinoId === c.id}
                          onClick={() => {
                            handleSelectCasillaTransito(c);
                            setCasillaExpandedOverride(false); // colapsar al seleccionar
                            setSearchCasilla(''); // limpiar búsqueda
                          }}
                        />
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* S42u — Almacén destino final Perú: SOLO aplica a "Entrega directa a Perú" (DDP).
               En "Vía casilla" el destino del envío 1 es la casilla de tránsito, y el almacén
               Perú final se decide después en el envío 2 (casilla → Perú) desde /envios. */}
          {tipoRutaSeleccionado === 'ddp' && (
            <div>
              {/* S42q — Header colapsable */}
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Almacén destino final{' '}
                  <span className="text-slate-400 font-normal">(Perú)</span>
                </label>
                {almacenPeruSeleccionado && !almacenExpandedOverride && (
                  <button
                    type="button"
                    onClick={() => setAlmacenExpandedOverride(true)}
                    className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
                  >
                    Cambiar
                  </button>
                )}
              </div>
              {almacenesPeru.length === 0 ? (
                <EmptyHint>
                  No hay almacenes Perú activos.{' '}
                  <a href="/red-logistica" className="underline font-medium">
                    Crear uno en Red Logística
                  </a>
                </EmptyHint>
              ) : tipoRutaSeleccionado === 'ddp' && !showAlmacenGrid && almacenPeruSeleccionado ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <AlmacenPeruCard
                    almacen={almacenPeruSeleccionado}
                    selected
                    onClick={() => setAlmacenExpandedOverride(true)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {almacenesPeru.map((a) => (
                    <AlmacenPeruCard
                      key={a.id}
                      almacen={a}
                      selected={
                        tipoRutaSeleccionado === 'ddp'
                          ? config.casillaDestinoId === a.id
                          : false
                      }
                      onClick={() => {
                        handleSelectAlmacenPeru(a);
                        setAlmacenExpandedOverride(false); // colapsar al seleccionar (solo DDP usa este campo realmente)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* TRAMO 1 — Salida del proveedor                       */}
      {/* ═══════════════════════════════════════════════════ */}
      {config.proveedorId && tipoRutaSeleccionado === 'via_casilla' && (() => {
        const showTramo1 = !config.salidaProveedor || tramo1ExpandedOverride;
        return (
          <SectionTramo
            numero={1}
            titulo="Salida del proveedor"
            subtitulo="¿Cómo sale la mercadería del proveedor?"
            headerRight={
              config.salidaProveedor && !tramo1ExpandedOverride ? (
                <button
                  type="button"
                  onClick={() => setTramo1ExpandedOverride(true)}
                  className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
                >
                  Cambiar
                </button>
              ) : null
            }
          >
            {showTramo1 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <TipoCardMedio
                  icon={<Truck className="w-4 h-4 text-sky-600" />}
                  titulo="Proveedor envía"
                  subtitulo="El proveedor despacha a la casilla"
                  selected={config.salidaProveedor === 'proveedor_envia'}
                  onClick={() => {
                    updateConfig({ salidaProveedor: 'proveedor_envia' });
                    setTramo1ExpandedOverride(false);
                  }}
                />
                <TipoCardMedio
                  icon={<UserCheck className="w-4 h-4 text-purple-600" />}
                  titulo="Recojo en origen"
                  subtitulo="Colaborador recoge del proveedor"
                  selected={config.salidaProveedor === 'recojo_en_origen'}
                  onClick={() => {
                    updateConfig({ salidaProveedor: 'recojo_en_origen' });
                    setTramo1ExpandedOverride(false);
                  }}
                />
              </div>
            ) : (
              <div className="mb-3">
                {config.salidaProveedor === 'proveedor_envia' ? (
                  <TipoCardMedio
                    icon={<Truck className="w-4 h-4 text-sky-600" />}
                    titulo="Proveedor envía"
                    subtitulo="El proveedor despacha a la casilla"
                    selected
                    onClick={() => setTramo1ExpandedOverride(true)}
                  />
                ) : (
                  <TipoCardMedio
                    icon={<UserCheck className="w-4 h-4 text-purple-600" />}
                    titulo="Recojo en origen"
                    subtitulo="Colaborador recoge del proveedor"
                    selected
                    onClick={() => setTramo1ExpandedOverride(true)}
                  />
                )}
              </div>
            )}

            {/* Panel morado — Recojo en origen + deudor alternativo */}
            {config.salidaProveedor === 'recojo_en_origen' && (
              <PanelRecojoEnOrigen
                config={config}
                viajeros={viajeros}
                couriers={couriers}
                onUpdate={updateConfig}
              />
            )}
          </SectionTramo>
        );
      })()}

      {/* ═══════════════════════════════════════════════════ */}
      {/* TRAMO 2 — Cruce a Perú                               */}
      {/* ═══════════════════════════════════════════════════ */}
      {config.proveedorId &&
        tipoRutaSeleccionado === 'via_casilla' &&
        (config.salidaProveedor === 'proveedor_envia' ||
          (config.salidaProveedor === 'recojo_en_origen' &&
            config.quienPagaProveedor)) && (() => {
          // S42ab — Tramo 2 colapsable
          const tramo2Options: Record<string, { icon: React.ReactNode; titulo: string; subtitulo: string; value: LlegadaPeru }> = {
            viajero: { icon: <UserCheck className="w-5 h-5 text-blue-600" />, titulo: 'Vía viajero', subtitulo: 'Colaborador transporta', value: 'viajero' },
            courier_internacional: { icon: <Truck className="w-5 h-5 text-orange-600" />, titulo: 'Courier internacional', subtitulo: 'FedEx, DHL, UPS', value: 'courier_internacional' },
            ya_en_peru: { icon: <Plane className="w-5 h-5 text-amber-600" />, titulo: 'Ya está en Perú', subtitulo: 'Sin cruce internacional', value: 'ya_en_peru' },
          };
          const tramo2Sel = config.llegadaPeru && tramo2Options[config.llegadaPeru];
          const showTramo2 = !tramo2Sel || tramo2ExpandedOverride;
          return (
          <SectionTramo
            numero={2}
            titulo="Cruce a Perú"
            subtitulo="¿Cómo llega la mercadería desde la casilla hasta Perú?"
            headerRight={
              tramo2Sel && !tramo2ExpandedOverride ? (
                <button
                  type="button"
                  onClick={() => setTramo2ExpandedOverride(true)}
                  className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
                >
                  Cambiar
                </button>
              ) : null
            }
          >
            {showTramo2 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                {Object.values(tramo2Options).map((opt) => (
                  <TipoCardCompactoCenter
                    key={opt.value}
                    icon={opt.icon}
                    titulo={opt.titulo}
                    subtitulo={opt.subtitulo}
                    selected={config.llegadaPeru === opt.value}
                    onClick={() => {
                      updateConfig({ llegadaPeru: opt.value });
                      setTramo2ExpandedOverride(false);
                    }}
                  />
                ))}
              </div>
            ) : tramo2Sel ? (
              <div className="mb-3">
                <TipoCardCompactoCenter
                  icon={tramo2Sel.icon}
                  titulo={tramo2Sel.titulo}
                  subtitulo={tramo2Sel.subtitulo}
                  selected
                  onClick={() => setTramo2ExpandedOverride(true)}
                />
              </div>
            ) : null}

            {/* Selector colaborador/courier — S42w: SOLO los asociados a la casilla */}
            {(config.llegadaPeru === 'viajero' ||
              config.llegadaPeru === 'courier_internacional') && (
              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {config.llegadaPeru === 'viajero' ? 'Viajero' : 'Courier internacional'}{' '}
                  <span className="text-slate-400 font-normal">
                    (opcional, puedes asignarlo después)
                  </span>
                </label>
                {config.llegadaPeru === 'viajero' && viajerosDeCasilla.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                    Esta casilla no tiene viajeros asociados aún.{' '}
                    <a href="/red-logistica" target="_blank" rel="noreferrer" className="underline font-medium">
                      Asocia uno en Red Logística
                    </a>{' '}
                    o déjalo sin asignar por ahora.
                  </div>
                ) : (
                  <select
                    value={config.colaboradorId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const todos = [...viajeros, ...couriers];
                      const sel = todos.find((c) => c.id === id);
                      updateConfig({
                        colaboradorId: id,
                        colaboradorNombre: sel?.nombre ?? '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Sin asignar — decidir después</option>
                    {/* Vía viajero: SOLO viajeros asociados a la casilla (principal + secundarios) */}
                    {config.llegadaPeru === 'viajero' && viajerosDeCasilla.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nombre}
                        {v.metricas?.enviosCompletados
                          ? ` — ${v.metricas.enviosCompletados} envíos previos`
                          : ''}
                      </option>
                    ))}
                    {/* Courier internacional: servicios independientes */}
                    {config.llegadaPeru === 'courier_internacional' && couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </SectionTramo>
          );
        })()}

      {/* ═══════════════════════════════════════════════════ */}
      {/* TRAMO 3 — Última milla en Perú                       */}
      {/* ═══════════════════════════════════════════════════ */}
      {config.proveedorId &&
        config.llegadaPeru &&
        config.llegadaPeru !== 'ddp_directo' && (() => {
          // S42ab — Tramo 3 colapsable
          const tramo3Options: Record<string, { icon: React.ReactNode; titulo: string; subtitulo: string; value: UltimaMilla; onClick: () => void }> = {
            yo_recojo: {
              icon: <Car className="w-5 h-5 text-emerald-600" />,
              titulo: 'Yo recojo',
              subtitulo: 'Voy por la mercadería · gasto movilidad',
              value: 'yo_recojo',
              onClick: () => {
                updateConfig({ ultimaMilla: 'yo_recojo' });
                setTramo3ExpandedOverride(false);
              },
            },
            entrega_domicilio: {
              icon: <Warehouse className="w-5 h-5 text-sky-600" />,
              titulo: 'Colaborador local',
              subtitulo: 'De mi red logística',
              value: 'entrega_domicilio',
              onClick: () => {
                updateConfig({ ultimaMilla: 'entrega_domicilio' });
                setTramo3ExpandedOverride(false);
              },
            },
          };
          const tramo3Sel = config.ultimaMilla && tramo3Options[config.ultimaMilla];
          const showTramo3 = !tramo3Sel || tramo3ExpandedOverride;
          return (
          <SectionTramo
            numero={3}
            titulo="Última milla en Perú"
            subtitulo="¿Cómo llega al almacén destino una vez en Perú?"
            headerRight={
              tramo3Sel && !tramo3ExpandedOverride ? (
                <button
                  type="button"
                  onClick={() => setTramo3ExpandedOverride(true)}
                  className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
                >
                  Cambiar
                </button>
              ) : null
            }
          >
            {showTramo3 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                {Object.values(tramo3Options).map((opt) => (
                  <TipoCardCompactoCenter
                    key={opt.value}
                    icon={opt.icon}
                    titulo={opt.titulo}
                    subtitulo={opt.subtitulo}
                    selected={config.ultimaMilla === opt.value}
                    onClick={opt.onClick}
                  />
                ))}
                <TipoCardCompactoCenter
                  icon={<UserCheck className="w-5 h-5 text-purple-600" />}
                  titulo="Viajero absorbe"
                  subtitulo="Si su servicio lo incluye"
                  selected={false}
                  onClick={() => {
                    // eslint-disable-next-line no-alert
                    alert(
                      'Opción "Viajero absorbe" — requiere ampliación del modelo. Usa "Colaborador local" por ahora.'
                    );
                  }}
                />
              </div>
            ) : tramo3Sel ? (
              <div className="mb-3">
                <TipoCardCompactoCenter
                  icon={tramo3Sel.icon}
                  titulo={tramo3Sel.titulo}
                  subtitulo={tramo3Sel.subtitulo}
                  selected
                  onClick={() => setTramo3ExpandedOverride(true)}
                />
              </div>
            ) : null}

            {/* Panel emerald — Yo recojo */}
            {config.ultimaMilla === 'yo_recojo' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-emerald-900">
                    <strong>Tú recoges personalmente</strong> en la agencia/aduana y llevas
                    al almacén. Registra solo el <strong>gasto de movilidad</strong> (taxi,
                    combustible, pasajes).
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Gasto de movilidad (S/){' '}
                    <span className="text-slate-400 font-normal">
                      — opcional, se confirma en recepción
                    </span>
                  </label>
                  <div className="relative w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      S/
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="15.00"
                      className="w-full pl-9 pr-3 py-2 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white tabular-nums"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Panel sky — Colaborador local */}
            {config.ultimaMilla === 'entrega_domicilio' && (
              <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-3">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-sky-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-sky-900">
                    Un <strong>proveedor registrado de tu red logística</strong> recoge y
                    lleva al almacén.
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Colaborador de la red logística
                  </label>
                  <select className="w-full px-3 py-2 border border-sky-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="">Seleccionar...</option>
                    {colaboradores
                      .filter((c) => c.tipo === 'transportista_local')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                          {c.metricas?.enviosCompletados
                            ? ` — ${c.metricas.enviosCompletados} entregas`
                            : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {/* S42aa — Selector "¿Quién paga el transporte local?" ahora conectado al modelo */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-2">
                    ¿Quién paga el transporte local?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <TipoCardPequeno
                      icon={<DollarSign className="w-3.5 h-3.5 text-emerald-600" />}
                      titulo="Yo pago al recoger"
                      subtitulo="Gasto directo cuando llega"
                      selected={config.quienPagaTransporteLocal === 'yo_pague'}
                      onClick={() => updateConfig({ quienPagaTransporteLocal: 'yo_pague' })}
                    />
                    <TipoCardPequeno
                      icon={<UserCheck className="w-3.5 h-3.5 text-amber-600" />}
                      titulo="Colaborador adelanta (CxP)"
                      subtitulo="Él paga agencia/aduana/taxi y me genera deuda"
                      selected={config.quienPagaTransporteLocal === 'recogedor_paga'}
                      onClick={() => updateConfig({ quienPagaTransporteLocal: 'recogedor_paga' })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Costo estimado (S/){' '}
                    <span className="text-slate-400 font-normal">
                      — opcional, se confirma en recepción
                    </span>
                  </label>
                  <div className="relative w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      S/
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="35.00"
                      value={config.costoTransporteLocalPEN ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateConfig({ costoTransporteLocalPEN: v === '' ? null : parseFloat(v) });
                      }}
                      className="w-full pl-9 pr-3 py-2 border border-sky-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white tabular-nums"
                    />
                  </div>
                </div>
              </div>
            )}
          </SectionTramo>
          );
        })()}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Panel Recojo en Origen — deudor alternativo
// ════════════════════════════════════════════════════════════════════════════

const PanelRecojoEnOrigen: React.FC<{
  config: ConfigLogistica;
  viajeros: Colaborador[];
  couriers: Colaborador[];
  onUpdate: (partial: Partial<ConfigLogistica>) => void;
}> = ({ config, viajeros, couriers, onUpdate }) => {
  return (
    <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-purple-900">
          <strong>Recojo en origen</strong> — el colaborador va por la mercadería al
          proveedor. Define quién le paga al proveedor, porque cambia la cuenta por
          pagar.
        </div>
      </div>

      {/* Colaborador que recoge */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
          Colaborador que recoge
        </label>
        <select
          value={config.colaboradorId}
          onChange={(e) => {
            const id = e.target.value;
            const todos = [...viajeros, ...couriers];
            const sel = todos.find((c) => c.id === id);
            onUpdate({
              colaboradorId: id,
              colaboradorNombre: sel?.nombre ?? '',
            });
          }}
          className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">Seleccionar...</option>
          {viajeros.length > 0 && (
            <>
              <option disabled>─── Viajeros ───</option>
              {viajeros.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre} — viajero
                  {v.metricas?.enviosCompletados
                    ? ` · ${v.metricas.enviosCompletados} envíos previos`
                    : ''}
                </option>
              ))}
            </>
          )}
          {couriers.length > 0 && (
            <>
              <option disabled>─── Couriers externos ───</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} — courier externo
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* ¿Quién paga al proveedor? */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-2">
          ¿Quién paga los productos al proveedor?
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <TipoCardPequeno
            icon={<DollarSign className="w-3.5 h-3.5 text-emerald-600" />}
            titulo="Yo pago al proveedor"
            subtitulo="CxP normal con el proveedor"
            selected={config.quienPagaProveedor === 'yo_pague'}
            onClick={() => {
              onUpdate({
                quienPagaProveedor: 'yo_pague',
                deudorId: config.proveedorId,
                deudorNombre: config.proveedorNombre,
                deudorTipo: 'proveedor',
              });
            }}
          />
          <TipoCardPequeno
            icon={<UserCheck className="w-3.5 h-3.5 text-amber-600" />}
            titulo={
              config.colaboradorNombre
                ? `${config.colaboradorNombre.split(' ')[0]} paga (le debo)`
                : 'Colaborador paga (le debo)'
            }
            subtitulo={
              config.colaboradorId
                ? 'CxP cambia al colaborador · genera deuda'
                : 'Selecciona primero un colaborador arriba'
            }
            selected={config.quienPagaProveedor === 'recogedor_paga'}
            disabled={!config.colaboradorId}
            onClick={() => {
              if (!config.colaboradorId) return;
              onUpdate({
                quienPagaProveedor: 'recogedor_paga',
                deudorId: config.colaboradorId,
                deudorNombre: config.colaboradorNombre,
                deudorTipo: 'colaborador',
              });
            }}
          />
        </div>
      </div>

      {/* Aclaración contable */}
      <div className="p-2 bg-white border border-purple-200 rounded-lg text-[11px] text-slate-600 flex items-start gap-1.5">
        <Info className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
        <div>
          Campo técnico <code className="text-[10px] bg-slate-100 px-1 rounded">deudorId</code>{' '}
          de la OC apuntará a{' '}
          <strong>{config.proveedorNombre || 'el proveedor'}</strong> si tú pagas, o a{' '}
          <strong>{config.colaboradorNombre || 'el colaborador'}</strong> si él adelanta.
          Afecta <em>PagoUnificadoForm</em>, Tesorería y CxP de Reportes.
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Subcomponentes de presentación
// ════════════════════════════════════════════════════════════════════════════

const Section: React.FC<{
  numero: number;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  /** S42r — Slot opcional del header derecho (botón "Cambiar", etc.) */
  headerRight?: React.ReactNode;
}> = ({ numero, titulo, subtitulo, children, headerRight }) => (
  <section>
    <div className="flex items-center justify-between mb-1">
      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-[10px] flex items-center justify-center font-bold">
          {numero}
        </span>
        {titulo}
      </h3>
      {headerRight}
    </div>
    {subtitulo && <p className="text-xs text-slate-500 mb-3">{subtitulo}</p>}
    {children}
  </section>
);

const SectionTramo: React.FC<{
  numero: number;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}> = ({ numero, titulo, subtitulo, children, headerRight }) => (
  <section className="border-t border-slate-100 pt-5">
    <div className="flex items-center justify-between mb-1">
      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
        <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-[10px] flex items-center justify-center font-bold">
          {numero}
        </span>
        {titulo}
      </h3>
      {headerRight}
    </div>
    {subtitulo && <p className="text-xs text-slate-500 mb-3">{subtitulo}</p>}
    {children}
  </section>
);

const ProveedorCard: React.FC<{
  proveedor: Proveedor;
  selected: boolean;
  onClick: () => void;
}> = ({ proveedor, selected, onClick }) => {
  const flag = getFlagByPais(proveedor.pais);
  const colorIcon = proveedor.tipo === 'distribuidor' ? 'sky' : 'pink';
  const ocPrevias = proveedor.metricas?.ordenesCompra ?? 0;
  const tipoLabel = (() => {
    const map: Record<string, string> = {
      fabricante: 'Fabricante',
      distribuidor: 'Distribuidor',
      mayorista: 'Mayorista',
      minorista: 'Minorista',
    };
    return map[proveedor.tipo] ?? proveedor.tipo;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full border-2 rounded-xl p-3 text-left transition-all',
        selected
          ? 'border-teal-500 bg-teal-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            colorIcon === 'sky' ? 'bg-sky-100' : 'bg-pink-100'
          )}
        >
          <Building2
            className={cn(
              'w-5 h-5',
              colorIcon === 'sky' ? 'text-sky-700' : 'text-pink-600'
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm truncate">
              {proveedor.nombre}
            </span>
            <span className="text-base flex-shrink-0">{flag}</span>
            <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
              {proveedor.codigo}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-medium">
              {tipoLabel}
            </span>
            <span className="text-slate-400">·</span>
            <span>{proveedor.pais || 'País sin definir'}</span>
            {ocPrevias > 0 && (
              <>
                <span className="text-slate-400">·</span>
                <span>
                  <strong>{ocPrevias}</strong> OC
                  {ocPrevias !== 1 ? 's' : ''} previa{ocPrevias !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>
        {selected && (
          <div className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>
    </button>
  );
};

const TipoCardGrande: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  titulo: string;
  subtitulo: string;
  selected: boolean;
  onClick: () => void;
}> = ({ icon, iconBg, titulo, subtitulo, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full relative border-2 rounded-xl p-4 text-left transition-all',
      selected
        ? 'border-teal-500 bg-teal-50 shadow-sm'
        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
    )}
  >
    {selected && (
      <div className="absolute top-2 right-2">
        <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      </div>
    )}
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0',
          iconBg
        )}
      >
        {icon}
      </div>
      <div>
        <div className="font-semibold text-slate-900 text-sm">{titulo}</div>
        <div className="text-xs text-slate-500 mt-0.5">{subtitulo}</div>
      </div>
    </div>
  </button>
);

const TipoCardMedio: React.FC<{
  icon: React.ReactNode;
  titulo: string;
  subtitulo: string;
  selected: boolean;
  onClick: () => void;
}> = ({ icon, titulo, subtitulo, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full relative border-2 rounded-xl p-3 text-left transition-all',
      selected
        ? 'border-teal-500 bg-teal-50 shadow-sm'
        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
    )}
  >
    {selected && (
      <div className="absolute top-2 right-2">
        <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      </div>
    )}
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="font-semibold text-slate-900 text-sm">{titulo}</span>
    </div>
    <div className="text-xs text-slate-500">{subtitulo}</div>
  </button>
);

const TipoCardCompactoCenter: React.FC<{
  icon: React.ReactNode;
  titulo: string;
  subtitulo: string;
  selected: boolean;
  onClick: () => void;
}> = ({ icon, titulo, subtitulo, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full relative border-2 rounded-xl p-3 text-center transition-all',
      selected
        ? 'border-teal-500 bg-teal-50 shadow-sm'
        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
    )}
  >
    {selected && (
      <div className="absolute top-1 right-1">
        <div className="w-4 h-4 rounded-full bg-teal-600 flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
    )}
    <div className="flex justify-center mb-1">{icon}</div>
    <div className="font-semibold text-slate-900 text-xs">{titulo}</div>
    <div className="text-[10px] text-slate-500 mt-0.5">{subtitulo}</div>
  </button>
);

const TipoCardPequeno: React.FC<{
  icon: React.ReactNode;
  titulo: string;
  subtitulo: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, titulo, subtitulo, selected, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'w-full relative border-2 rounded-xl p-3 text-left transition-all',
      disabled && 'opacity-50 cursor-not-allowed',
      !disabled && selected && 'border-teal-500 bg-teal-50 shadow-sm',
      !disabled &&
        !selected &&
        'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
    )}
  >
    {selected && (
      <div className="absolute top-1.5 right-1.5">
        <div className="w-4 h-4 rounded-full bg-teal-600 flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
    )}
    <div className="flex items-center gap-1.5 mb-0.5">
      {icon}
      <span className="font-semibold text-slate-900 text-xs">{titulo}</span>
    </div>
    <div className="text-[11px] text-slate-500">{subtitulo}</div>
  </button>
);

const CasillaTransitoCard: React.FC<{
  casilla: Casilla;
  colaborador?: Colaborador;
  selected: boolean;
  onClick: () => void;
}> = ({ casilla, colaborador, selected, onClick }) => {
  const nombreDisplay = colaborador?.nombre ?? casilla.nombre;
  const iniciales = nombreDisplay
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const flag = getFlagByPais(casilla.pais);
  const enviosPrevios = colaborador?.metricas?.enviosCompletados ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full border-2 rounded-xl p-3 text-left transition-all',
        selected
          ? 'border-teal-500 bg-teal-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
          {iniciales || <Users className="w-3.5 h-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {nombreDisplay}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">{casilla.codigo}</div>
        </div>
        <span className="text-base flex-shrink-0">{flag}</span>
      </div>
      <div className="text-[11px] text-slate-600">
        {colaborador?.tipo === 'viajero' ? 'Casilla viajero' : 'Casilla'}
        {enviosPrevios > 0 && ` · ${enviosPrevios} envíos`}
      </div>
      {/* S42p — Dirección de referencia de la casilla */}
      {(casilla.direccion || casilla.ciudad) && (
        <div className="mt-1.5 flex items-start gap-1 text-[11px] text-slate-500">
          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
          <span className="truncate" title={[casilla.direccion, casilla.ciudad].filter(Boolean).join(', ')}>
            {[casilla.direccion, casilla.ciudad].filter(Boolean).join(', ')}
          </span>
        </div>
      )}
    </button>
  );
};

const AlmacenPeruCard: React.FC<{
  almacen: Casilla;
  selected: boolean;
  onClick: () => void;
}> = ({ almacen, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full border-2 rounded-xl p-3 text-left transition-all',
      selected
        ? 'border-teal-500 bg-teal-50 shadow-sm'
        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
    )}
  >
    <div className="flex items-center gap-2 mb-1">
      <MapPin
        className={cn('w-4 h-4', selected ? 'text-teal-600' : 'text-slate-500')}
      />
      <span className="text-xs font-semibold text-slate-900 font-mono">
        {almacen.codigo}
      </span>
      <span className="text-sm flex-shrink-0">🇵🇪</span>
    </div>
    <div className="text-xs font-medium text-slate-700 truncate">
      {almacen.nombre}
    </div>
    {/* S42p — Dirección de referencia del almacén */}
    {(almacen.direccion || almacen.ciudad) && (
      <div className="text-[11px] text-slate-500 mt-1 truncate" title={[almacen.direccion, almacen.ciudad].filter(Boolean).join(', ')}>
        {[almacen.direccion, almacen.ciudad].filter(Boolean).join(', ')}
      </div>
    )}
  </button>
);

const EmptyHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
    <div>{children}</div>
  </div>
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFlagByPais(pais?: string): string {
  if (!pais) return '🌐';
  const flags: Record<string, string> = {
    USA: '🇺🇸',
    'Estados Unidos': '🇺🇸',
    CHINA: '🇨🇳',
    China: '🇨🇳',
    COREA: '🇰🇷',
    Corea: '🇰🇷',
    'Corea del Sur': '🇰🇷',
    JAPÓN: '🇯🇵',
    Japón: '🇯🇵',
    MÉXICO: '🇲🇽',
    México: '🇲🇽',
    PERÚ: '🇵🇪',
    Perú: '🇵🇪',
    Peru: '🇵🇪',
  };
  return flags[pais] ?? '🌐';
}
