import React, { useEffect, useMemo } from 'react';
import {
  Truck, UserCheck, Send, ShoppingBag, Package, MapPin,
  DollarSign, Home, Building2, AlertCircle, Zap, ChevronRight,
  Plane, Car, Plus, Trash2,
} from 'lucide-react';
import { cn } from '../../../../design-system';
import type { QuienPagaFlete, ProductoOrden } from '../../../../types/ordenCompra.types';
import { ProveedorAutocomplete } from '../../entidades/ProveedorAutocomplete';
import type { ProveedorSnapshot } from '../../entidades/ProveedorAutocomplete';
import { ProductoAutocomplete } from '../../entidades/ProductoAutocomplete';
import type { ProductoSnapshot } from '../../entidades/ProductoAutocomplete';
import { useColaboradorStore } from '../../../../store/colaboradorStore';
import { useProductoStore } from '../../../../store/productoStore';

// ─── Types ────────────────────────────────────────────────────────

/** Tramo 1: Cómo sale del proveedor */
export type SalidaProveedor = 'proveedor_envia' | 'recojo_en_origen';

/** Tramo 2: Cómo llega a Perú */
export type LlegadaPeru = 'ddp_directo' | 'viajero' | 'courier_internacional' | 'ya_en_peru';

/** Tramo 3: Cómo llega a tu almacén */
export type UltimaMilla = 'entrega_domicilio' | 'yo_recojo';

/** Quién paga al proveedor (determina a quién va la CxP) */
export type QuienPagaProveedor = 'yo_pague' | 'recogedor_paga';

export interface ConfigLogistica {
  // Pregunta 0: Proveedor
  proveedorId: string;
  proveedorNombre: string;
  paisOrigen: string;

  // Tramo 1: Salida del proveedor
  salidaProveedor: SalidaProveedor | null;
  fleteProveedorIncluido: boolean | null;
  costoShippingProveedor: number | null;
  tipoShipping: 'local' | 'internacional' | null;
  // Si recojo en origen: ¿quién paga al proveedor?
  quienPagaProveedor: QuienPagaProveedor | null;
  deudorId: string;         // ID de a quién le debo (proveedor o colaborador)
  deudorNombre: string;     // Nombre para display
  deudorTipo: 'proveedor' | 'colaborador' | '';

  // Tramo 2: Llegada a Perú
  llegadaPeru: LlegadaPeru | null;
  colaboradorId: string;
  colaboradorNombre: string;

  // Tramo 3: Última milla
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
  ultimaMilla: null,
  requiereRecojo: false,
};

interface WizardStepEntregaProps {
  config: ConfigLogistica;
  onChange: (config: ConfigLogistica) => void;
  // Product selection (added)
  productos: ProductoOrden[];
  onAddProducto: (producto: ProductoOrden) => void;
  onRemoveProducto: (index: number) => void;
  onUpdateProducto: (index: number, producto: ProductoOrden) => void;
}

// ─── Derive legacy types for downstream compatibility ─────────────

export function deriveModoFromConfig(config: ConfigLogistica): {
  modoEntregaDetallado: 'ddp_directo' | 'via_viajero' | 'via_courier' | 'recojo_propio' | null;
  quienPagaFlete: QuienPagaFlete | null;
} {
  if (!config.llegadaPeru) return { modoEntregaDetallado: null, quienPagaFlete: null };

  const modoMap: Record<LlegadaPeru, 'ddp_directo' | 'via_viajero' | 'via_courier' | 'recojo_propio'> = {
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

/** Get summary of consequences */
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
      const tipoStr = config.tipoShipping === 'local'
        ? ' local'
        : config.tipoShipping === 'internacional'
        ? ' internacional'
        : '';
      items.push(`El proveedor cobra shipping${tipoStr}${costoStr} — se registrará como cargo de la OC`);
    }
  } else if (config.salidaProveedor === 'recojo_en_origen') {
    items.push('Alguien recoge en el almacén del proveedor');
    if (config.quienPagaProveedor === 'yo_pague') {
      items.push('Deuda con el proveedor — yo pagué directamente');
    } else if (config.quienPagaProveedor === 'recogedor_paga') {
      items.push('Deuda con el recogedor — la CxP se genera contra quien pagó al proveedor');
    }
  }

  // Tramo 2
  if (config.llegadaPeru === 'ddp_directo') {
    items.push('El proveedor envía directo a Perú (DDP) — flete internacional incluido');
    items.push('Al confirmar: se crea envío automático (Proveedor → Almacén)');
  } else if (config.llegadaPeru === 'viajero') {
    items.push(`Viajero${config.colaboradorNombre ? ` (${config.colaboradorNombre})` : ''} trae el pedido a Perú`);
    items.push('Al confirmar: se crea envío automático (Proveedor → Viajero)');
    items.push('Costo del viajero se registra al recibir el envío');
  } else if (config.llegadaPeru === 'courier_internacional') {
    const courierStr = config.colaboradorNombre ? ` (${config.colaboradorNombre})` : '';
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

// ─── Option Button ────────────────────────────────────────────────

interface OptionProps {
  icon: typeof Truck;
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}

const Option: React.FC<OptionProps> = ({ icon: Icon, label, hint, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left w-full',
      selected
        ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
    )}
  >
    <div className={cn(
      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
      selected ? 'bg-teal-100' : 'bg-slate-100',
    )}>
      <Icon className={cn('w-4 h-4', selected ? 'text-teal-600' : 'text-slate-500')} />
    </div>
    <div className="min-w-0">
      <span className={cn('text-sm font-medium', selected ? 'text-teal-900' : 'text-slate-900')}>
        {label}
      </span>
      {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  </button>
);

// ─── Question Section ─────────────────────────────────────────────

interface QuestionProps {
  number: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  visible: boolean;
  answered: boolean;
}

const Question: React.FC<QuestionProps> = ({ number, title, subtitle, children, visible, answered }) => {
  if (!visible) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
          answered ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600',
        )}>
          {number}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="pl-8 space-y-2">
        {children}
      </div>
    </div>
  );
};

// ─── Shared select/input styles ───────────────────────────────────

const selectCls =
  'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none';

const inputCls =
  'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none';

// ─── Main Component ───────────────────────────────────────────────

export const WizardStepEntrega: React.FC<WizardStepEntregaProps> = ({
  config,
  onChange,
  productos,
  onAddProducto,
  onRemoveProducto,
  onUpdateProducto,
}) => {
  const { colaboradores, fetchColaboradores, getByTipo } = useColaboradorStore();
  const { productos: catalogoProductos, fetchProductos, loading: loadingProductos } = useProductoStore();

  useEffect(() => {
    if (colaboradores.length === 0) fetchColaboradores();
  }, []);

  useEffect(() => {
    if (catalogoProductos.length === 0) fetchProductos();
  }, []);

  const viajeros = getByTipo('viajero');
  const couriers = getByTipo('courier_externo');

  const consequences = useMemo(() => getConsequences(config), [config]);

  // Proveedor snapshot for autocomplete
  const proveedorValue: ProveedorSnapshot | null = config.proveedorId
    ? { proveedorId: config.proveedorId, nombre: config.proveedorNombre, pais: config.paisOrigen }
    : null;

  const handleProveedorChange = (snap: ProveedorSnapshot | null) => {
    if (!snap) {
      onChange({ ...emptyConfig }); // Reset everything
      return;
    }
    onChange({
      ...config,
      proveedorId: snap.proveedorId,
      proveedorNombre: snap.nombre,
      paisOrigen: snap.pais || '',
      // Reset downstream
      salidaProveedor: null,
      fleteProveedorIncluido: null,
      costoShippingProveedor: null,
      tipoShipping: null,
      llegadaPeru: null,
      colaboradorId: '',
      colaboradorNombre: '',
      ultimaMilla: null,
      requiereRecojo: false,
    });
  };

  // Visibility logic
  const hasProveedor = !!config.proveedorId;
  const show = {
    salidaProveedor: hasProveedor,
    fleteProveedor: hasProveedor && config.salidaProveedor === 'proveedor_envia',
    shippingCost: config.salidaProveedor === 'proveedor_envia' && config.fleteProveedorIncluido === false,
    quienPagaProveedor: config.salidaProveedor === 'recojo_en_origen',
    llegadaPeru:
      config.salidaProveedor !== null &&
      (config.salidaProveedor === 'recojo_en_origen'
        ? config.quienPagaProveedor !== null && (config.quienPagaProveedor === 'yo_pague' || !!config.deudorId)
        : config.salidaProveedor !== 'proveedor_envia' || config.fleteProveedorIncluido !== null),
    colaboradorSelector:
      config.llegadaPeru === 'viajero' || config.llegadaPeru === 'courier_internacional',
    ultimaMilla: config.llegadaPeru !== null && config.llegadaPeru !== 'ddp_directo',
  };

  const update = (partial: Partial<ConfigLogistica>) => {
    const next = { ...config, ...partial };

    // Reset downstream when upstream changes
    if ('salidaProveedor' in partial) {
      next.fleteProveedorIncluido = null;
      next.costoShippingProveedor = null;
      next.tipoShipping = null;
      next.quienPagaProveedor = null;
      next.deudorId = '';
      next.deudorNombre = '';
      next.deudorTipo = '';
      next.llegadaPeru = null;
      next.colaboradorId = '';
      next.colaboradorNombre = '';
      next.ultimaMilla = null;
      next.requiereRecojo = false;
    }
    if ('quienPagaProveedor' in partial) {
      // Auto-set deudor based on who pays
      if (partial.quienPagaProveedor === 'yo_pague') {
        next.deudorId = config.proveedorId;
        next.deudorNombre = config.proveedorNombre;
        next.deudorTipo = 'proveedor';
      } else if (partial.quienPagaProveedor === 'recogedor_paga') {
        next.deudorId = '';
        next.deudorNombre = '';
        next.deudorTipo = 'colaborador';
      }
      next.llegadaPeru = null;
      next.colaboradorId = '';
      next.colaboradorNombre = '';
      next.ultimaMilla = null;
      next.requiereRecojo = false;
    }
    if ('fleteProveedorIncluido' in partial) {
      next.costoShippingProveedor = null;
      next.tipoShipping = null;
      next.llegadaPeru = null;
      next.colaboradorId = '';
      next.colaboradorNombre = '';
      next.ultimaMilla = null;
      next.requiereRecojo = false;
    }
    if ('llegadaPeru' in partial) {
      next.colaboradorId = '';
      next.colaboradorNombre = '';
      next.ultimaMilla = null;
      next.requiereRecojo = false;
      // DDP = entrega a domicilio implícita
      if (partial.llegadaPeru === 'ddp_directo') {
        next.ultimaMilla = 'entrega_domicilio';
        next.requiereRecojo = false;
      }
    }
    if ('ultimaMilla' in partial) {
      next.requiereRecojo = partial.ultimaMilla === 'yo_recojo';
    }

    onChange(next);
  };

  // ---- Product handlers ----

  const handleSelectProducto = (snapshot: ProductoSnapshot | null) => {
    if (!snapshot) return;
    // Enrich from catalog to get contenido, dosaje, sabor, pesoLibras
    const catalogItem = catalogoProductos.find(p => p.id === snapshot.productoId);
    const nuevo: ProductoOrden = {
      productoId: snapshot.productoId,
      sku: snapshot.sku,
      marca: snapshot.marca,
      nombreComercial: snapshot.nombreComercial,
      presentacion: snapshot.presentacion,
      contenido: catalogItem?.contenido || undefined,
      dosaje: catalogItem?.dosaje || undefined,
      sabor: catalogItem?.sabor || undefined,
      pesoLibras: catalogItem?.pesoLibras || undefined,
      cantidad: 1,
      costoUnitario: 0,
      subtotal: 0,
    };
    onAddProducto(nuevo);
  };

  const handleFieldChange = (
    index: number,
    field: 'cantidad' | 'costoUnitario',
    raw: string,
  ) => {
    const p = productos[index];
    const value = field === 'cantidad' ? parseInt(raw, 10) || 0 : parseFloat(raw) || 0;
    const updated: ProductoOrden = {
      ...p,
      [field]: value,
      subtotal:
        field === 'cantidad'
          ? value * (p.costoUnitario || 0)
          : (p.cantidad || 0) * value,
    };
    onUpdateProducto(index, updated);
  };

  const productosSubtotal = useMemo(
    () => productos.reduce((sum, p) => sum + (p.costoUnitario || 0) * (p.cantidad || 0), 0),
    [productos],
  );

  // Dynamic question numbering
  const qNum = {
    salida: 2,
    flete: 3,
    llegada: show.fleteProveedor ? 4 : 3,
    ultimaMilla: show.fleteProveedor ? 5 : 4,
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Ruta de la mercadería</h2>
        <p className="text-sm text-slate-500 mt-1">
          Define cómo llega el pedido desde el proveedor hasta tu almacén
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">

        {/* PREGUNTA 0: Proveedor */}
        <Question number={1} title="¿A quién le compras?" visible={true} answered={hasProveedor}>
          <ProveedorAutocomplete
            value={proveedorValue}
            onChange={handleProveedorChange}
            placeholder="Buscar proveedor..."
            required
          />
          {hasProveedor && config.paisOrigen && (
            <p className="text-xs text-teal-600 mt-1">
              Proveedor: <strong>{config.proveedorNombre}</strong> · País: {config.paisOrigen}
            </p>
          )}
        </Question>

        {/* TRAMO 1: Salida del proveedor */}
        <Question
          number={qNum.salida}
          title="¿Cómo sale del proveedor?"
          subtitle="Tramo 1: Del almacén del proveedor al punto de salida"
          visible={show.salidaProveedor}
          answered={!!config.salidaProveedor}
        >
          <Option
            icon={Truck}
            label="El proveedor lo envía"
            hint="El proveedor despacha desde su almacén (Amazon, Asian Beauty, etc.)"
            selected={config.salidaProveedor === 'proveedor_envia'}
            onClick={() => update({ salidaProveedor: 'proveedor_envia' })}
          />
          <Option
            icon={MapPin}
            label="Alguien lo recoge en origen"
            hint="Un viajero, agente o yo recogemos en el almacén/fábrica del proveedor"
            selected={config.salidaProveedor === 'recojo_en_origen'}
            onClick={() => update({ salidaProveedor: 'recojo_en_origen' })}
          />
        </Question>

        {/* TRAMO 1.5: ¿El shipping del proveedor está incluido? */}
        {show.fleteProveedor && (
          <Question
            number={qNum.flete}
            title="¿El shipping del proveedor está incluido?"
            subtitle="Ej: Amazon cobra Shipping & Handling, pero con Subscribe & Save es gratis"
            visible={show.fleteProveedor}
            answered={config.fleteProveedorIncluido !== null}
          >
            <Option
              icon={DollarSign}
              label="Sí, el shipping está incluido"
              hint="No hay cargo adicional por el envío del proveedor (ej: Subscribe & Save)"
              selected={config.fleteProveedorIncluido === true}
              onClick={() => update({ fleteProveedorIncluido: true })}
            />
            <Option
              icon={AlertCircle}
              label="No, el proveedor cobra shipping"
              hint="Hay un cargo de shipping que se debe registrar (ej: Amazon Shipping $15)"
              selected={config.fleteProveedorIncluido === false}
              onClick={() => update({ fleteProveedorIncluido: false })}
            />

            {/* Shipping cost detail */}
            {show.shippingCost && (
              <div className="pl-0 mt-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Tipo de shipping
                    </label>
                    <select
                      value={config.tipoShipping || ''}
                      onChange={(e) =>
                        onChange({
                          ...config,
                          tipoShipping: (e.target.value as 'local' | 'internacional') || null,
                        })
                      }
                      className={selectCls}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="local">Shipping local (dentro del país del proveedor)</option>
                      <option value="internacional">Shipping internacional</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Costo USD
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={config.costoShippingProveedor ?? ''}
                        onChange={(e) =>
                          onChange({
                            ...config,
                            costoShippingProveedor: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        placeholder="0.00"
                        className={cn(inputCls, 'pl-7')}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Este costo se registrará como cargo en la OC
                </p>
              </div>
            )}
          </Question>
        )}

        {/* TRAMO 1.5b: ¿Quién paga al proveedor? (solo recojo en origen) */}
        {show.quienPagaProveedor && (
          <Question
            number={qNum.flete}
            title="¿Quién paga al proveedor?"
            subtitle="Determina a quién va dirigida la cuenta por pagar"
            visible={show.quienPagaProveedor}
            answered={config.quienPagaProveedor !== null}
          >
            <Option
              icon={DollarSign}
              label="Yo pagué directamente al proveedor"
              hint="La deuda (CxP) es con el proveedor — flujo de pago normal"
              selected={config.quienPagaProveedor === 'yo_pague'}
              onClick={() => update({ quienPagaProveedor: 'yo_pague' })}
            />
            <Option
              icon={UserCheck}
              label="El que recoge paga por mí"
              hint="La deuda (CxP) es con quien pagó — el pago se registra contra el colaborador"
              selected={config.quienPagaProveedor === 'recogedor_paga'}
              onClick={() => update({ quienPagaProveedor: 'recogedor_paga' })}
            />
            {/* Selector de deudor cuando recogedor paga */}
            {config.quienPagaProveedor === 'recogedor_paga' && (
              <div className="mt-3 pl-11">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  ¿Quién pagó por ti?
                </label>
                {viajeros.length > 0 ? (
                  <select
                    value={config.deudorId}
                    onChange={e => {
                      const allColabs = [...viajeros, ...couriers];
                      const selected = allColabs.find(c => c.id === e.target.value);
                      if (!selected) {
                        onChange({ ...config, deudorId: '', deudorNombre: '', deudorTipo: 'colaborador' });
                        return;
                      }
                      // Auto-configure tramo 2 based on collaborator type
                      const esViajero = viajeros.some(v => v.id === selected.id);
                      onChange({
                        ...config,
                        deudorId: selected.id,
                        deudorNombre: selected.nombre,
                        deudorTipo: 'colaborador',
                        // Auto-set llegadaPeru + colaborador (skip the question)
                        llegadaPeru: esViajero ? 'viajero' : 'courier_internacional',
                        colaboradorId: selected.id,
                        colaboradorNombre: selected.nombre,
                      });
                    }}
                    className={selectCls}
                  >
                    <option value="">Seleccionar persona...</option>
                    {viajeros.map(v => (
                      <option key={v.id} value={v.id}>{v.nombre} (viajero)</option>
                    ))}
                    {couriers.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} (courier)</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={config.deudorNombre}
                    onChange={e => onChange({ ...config, deudorNombre: e.target.value, deudorTipo: 'colaborador' })}
                    placeholder="Nombre de quien pagó..."
                    className={inputCls}
                  />
                )}
                {config.deudorNombre && (
                  <p className="text-xs text-teal-600 mt-1">
                    La CxP de esta OC se registrará contra: <strong>{config.deudorNombre}</strong>
                  </p>
                )}
              </div>
            )}
          </Question>
        )}

        {/* TRAMO 2: ¿Cómo llega a Perú? */}
        <Question
          number={qNum.llegada}
          title="¿Cómo llega a Perú?"
          subtitle="Tramo 2: Transporte internacional"
          visible={show.llegadaPeru}
          answered={!!config.llegadaPeru}
        >
          {/* DDP y "Ya en Perú" solo disponibles cuando el proveedor envía (no recojo) */}
          {config.salidaProveedor !== 'recojo_en_origen' && (
            <Option
              icon={Truck}
              label="El proveedor envía directo a Perú (DDP)"
              hint="El proveedor incluye el flete internacional. Llega a tu puerta sin costo extra."
              selected={config.llegadaPeru === 'ddp_directo'}
              onClick={() => update({ llegadaPeru: 'ddp_directo' })}
            />
          )}
          <Option
            icon={UserCheck}
            label="Un viajero lo trae"
            hint="Una persona que viaja lo trae en su equipaje o carga"
            selected={config.llegadaPeru === 'viajero'}
            onClick={() => update({ llegadaPeru: 'viajero' })}
          />
          <Option
            icon={Plane}
            label="Courier internacional (yo contrato)"
            hint="Yo contrato DHL, FedEx, etc. para traerlo a Perú"
            selected={config.llegadaPeru === 'courier_internacional'}
            onClick={() => update({ llegadaPeru: 'courier_internacional' })}
          />
          {config.salidaProveedor !== 'recojo_en_origen' && (
            <Option
              icon={Building2}
              label="Ya está en Perú"
              hint="Proveedor local o la mercadería ya se encuentra en el país"
              selected={config.llegadaPeru === 'ya_en_peru'}
              onClick={() => update({ llegadaPeru: 'ya_en_peru' })}
            />
          )}
        </Question>

        {/* Viajero selector */}
        {config.llegadaPeru === 'viajero' && (
          <div className="pl-8">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              ¿Quién es el viajero?
            </label>
            {viajeros.length > 0 ? (
              <select
                value={config.colaboradorId}
                onChange={(e) => {
                  const selected = viajeros.find((v) => v.id === e.target.value);
                  onChange({
                    ...config,
                    colaboradorId: e.target.value,
                    colaboradorNombre: selected?.nombre ?? '',
                  });
                }}
                className={selectCls}
              >
                <option value="">Seleccionar viajero...</option>
                {viajeros.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={config.colaboradorNombre}
                onChange={(e) => onChange({ ...config, colaboradorNombre: e.target.value })}
                placeholder="Ej: Angie Price"
                className={inputCls}
              />
            )}
          </div>
        )}

        {/* Courier selector */}
        {config.llegadaPeru === 'courier_internacional' && (
          <div className="pl-8">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              ¿Qué courier?
            </label>
            {couriers.length > 0 ? (
              <select
                value={config.colaboradorId}
                onChange={(e) => {
                  const selected = couriers.find((c) => c.id === e.target.value);
                  onChange({
                    ...config,
                    colaboradorId: e.target.value,
                    colaboradorNombre: selected?.nombre ?? '',
                  });
                }}
                className={selectCls}
              >
                <option value="">Seleccionar courier...</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={config.colaboradorNombre}
                onChange={(e) => onChange({ ...config, colaboradorNombre: e.target.value })}
                placeholder="Ej: DHL, FedEx"
                className={inputCls}
              />
            )}
          </div>
        )}

        {/* TRAMO 3: Última milla */}
        <Question
          number={qNum.ultimaMilla}
          title="¿Cómo llega a tu almacén?"
          subtitle="Tramo 3: Última milla en Perú"
          visible={show.ultimaMilla}
          answered={!!config.ultimaMilla}
        >
          <Option
            icon={Home}
            label="Me lo entregan en mi almacén"
            hint="El transportista/viajero entrega en la puerta de mi almacén"
            selected={config.ultimaMilla === 'entrega_domicilio'}
            onClick={() => update({ ultimaMilla: 'entrega_domicilio' })}
          />
          <Option
            icon={Car}
            label="Yo lo recojo"
            hint="Voy a recoger al aeropuerto, terminal, casilla del viajero, etc."
            selected={config.ultimaMilla === 'yo_recojo'}
            onClick={() => update({ ultimaMilla: 'yo_recojo' })}
          />

          {/* Recojo warning */}
          {config.ultimaMilla === 'yo_recojo' && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Al recibir el envío se exigirá registrar el costo de recojo
              </p>
            </div>
          )}
        </Question>

        {/* PRODUCTOS — only shown once proveedor is selected */}
        {config.proveedorId && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">Productos</span>
                {productos.length > 0 && (
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                    {productos.length}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Existing product rows */}
              {productos.map((item, index) => (
                <div
                  key={`${item.productoId}-${index}`}
                  className={cn(
                    'p-3 rounded-lg border transition-all',
                    item.costoUnitario > 0
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-slate-50 border-dashed border-slate-300',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-xs font-medium text-teal-700 flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-slate-900 truncate block">{item.nombreComercial}</span>
                        <span className="text-xs text-slate-400">{item.sku} · {item.presentacion}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveProducto(index)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      aria-label="Eliminar producto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => handleFieldChange(index, 'cantidad', e.target.value)}
                        className="w-20 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-slate-500 mb-0.5">Precio USD / ud.</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.costoUnitario || ''}
                          onChange={(e) => handleFieldChange(index, 'costoUnitario', e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-right"
                        />
                      </div>
                    </div>
                    <div className="text-right min-w-[70px]">
                      <div className="text-[10px] text-slate-500">Subtotal</div>
                      <div className="text-sm font-semibold text-slate-900">
                        ${((item.cantidad || 0) * (item.costoUnitario || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add product autocomplete */}
              <div className="pt-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Agregar producto
                </label>
                {loadingProductos ? (
                  <div className="w-full py-3 text-sm text-slate-400 text-center border border-dashed border-slate-300 rounded-lg">
                    Cargando catálogo...
                  </div>
                ) : (
                  <ProductoAutocomplete
                    productos={catalogoProductos}
                    value={null}
                    onChange={handleSelectProducto}
                    placeholder="Buscar producto por nombre, SKU o marca..."
                    showInvestigacionSugerencia={false}
                    proveedorSeleccionado={config.proveedorNombre || undefined}
                  />
                )}
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  Seleccionar agrega el producto a la lista
                </p>
              </div>

              {/* Subtotal footer */}
              {productosSubtotal > 0 && (
                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <span className="text-sm text-slate-500">Subtotal productos</span>
                  <span className="text-base font-bold text-slate-900">${productosSubtotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Consequences panel */}
        {consequences.length > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-semibold text-teal-800 uppercase tracking-wide">
                Lo que va a pasar
              </span>
            </div>
            {consequences.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-teal-800">{c}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
