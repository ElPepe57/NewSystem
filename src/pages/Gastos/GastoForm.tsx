/**
 * GastoForm · form canon · Gastos rework v3
 *
 * chk5.C-FIX (2026-05-11) · refactor full pixel-perfect contra mockup canon
 * `gastos-rework-v3-final.html · Sección 2 · Nuevo gasto manual`.
 *
 * 5 secciones canon (compactas · NO más cascada 3-cards gradient):
 *   1 · Clasificación  · CategoriaPickerCanon (UN dropdown con breadcrumb)
 *   2 · Agente         · Toggle pills + autocomplete + create-inline
 *   3 · Monto          · PEN/USD toggle + input + equivalente
 *   4 · Fecha + Recurr · 2 cols compactas
 *   5 · Detalle        · descripción + venta asociada (si bloque=venta) + prorrateo + notas
 *
 * Canon respetado:
 *   - F8 · cero emojis en chrome · todos lucide-icons
 *   - F9 · breadcrumb separator ChevronRight
 *   - D-GR-5 · separación canon · el form NO incluye PagoUnificadoForm inline
 *     (el pago se gestiona desde la lista vía botón "Pagar" canónico)
 *   - F-Borradores · integración con `useWizardAutosave` + `BorradorBanner`
 *     (tipo='gasto' agregado al canon)
 *   - Lazy migration · preserva categorización legacy en edición de gastos antiguos
 *   - 3 tipos agente (Proveedor/Colaborador/Empleado) explícitos al top
 *   - Inline-create de proveedor + categoría/sub preservados (D-INLINE-8)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Info, Search, Calendar, DollarSign, Banknote, AlertCircle,
  // chk5.C-FIX · lucide canon F8/F9 (cero emojis)
  Check, X as XIcon, AlertTriangle, Package, ShoppingBag, ChevronRight,
  Users, User as UserIcon, Briefcase, Plus, ChevronDown, Repeat,
  Hash, Save, FileText,
} from 'lucide-react';
import { Button, Input, AutocompleteInput } from '../../components/common';
import { Modal } from '../../components/common/Modal';
import { useGastoStore } from '../../store/gastoStore';
import { useAuthStore } from '../../store/authStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useToastStore } from '../../store/toastStore';
import { tesoreriaService } from '../../services/tesoreria.service';
import { VentaService } from '../../services/venta.service';
import type { Gasto, GastoFormData, EstadoGasto } from '../../types/gasto.types';
import type { CuentaCaja, MetodoTesoreria } from '../../types/tesoreria.types';
import type { Venta } from '../../types/venta.types';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import { useEntidadesPorTipo } from '../../hooks/useEntidadesPorTipo';
import { useProveedorStore } from '../../store/proveedorStore';
import { ProveedorForm } from '../../components/modules/ordenCompra/ProveedorForm';
import type { ProveedorFormData } from '../../types/ordenCompra.types';
import { useCategoriaCostoStore } from '../../store/categoriaCostoStore';
import type { BloqueCosto } from '../../types/categoriaCosto.types';
import { toDateOrNow } from '../../utils/dateFormatters';
import { getBloqueDelGasto } from '../../utils/gasto.bloque';
// chk5.C-FIX · canon F-Borradores · autoguardado 2 capas
import { useWizardAutosave } from '../../hooks/useWizardAutosave';

interface GastoFormProps {
  onClose: () => void;
  gastoEditar?: Gasto | null;
}

// ════════════════════════════════════════════════════════════════════════════
// Config canon · pills agente + bloque
// ════════════════════════════════════════════════════════════════════════════

type TipoAgente = 'proveedor' | 'colaborador' | 'empleado';

const AGENTE_CONFIG: Record<TipoAgente, { Icon: React.ComponentType<{ className?: string }>; label: string; createLabel: string }> = {
  proveedor:   { Icon: Briefcase, label: 'Proveedor',   createLabel: '+ Crear nuevo proveedor inline' },
  colaborador: { Icon: Users,     label: 'Colaborador', createLabel: '+ Crear nuevo colaborador inline' },
  empleado:    { Icon: UserIcon,  label: 'Empleado',    createLabel: '+ Crear nuevo empleado inline' },
};

const BLOQUE_CONFIG: Record<BloqueCosto, {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  pillClasses: string;
  derivedInfo: string;
}> = {
  producto: {
    Icon: Package, label: 'Producto',
    pillClasses: 'bg-blue-100 text-blue-700',
    derivedInfo: 'Bloque PRODUCTO · prorratea al CTRU · afecta margen por unidad',
  },
  venta: {
    Icon: ShoppingBag, label: 'Venta',
    pillClasses: 'bg-purple-100 text-purple-700',
    derivedInfo: 'Bloque VENTA · resta margen contribución de cada venta',
  },
  periodo: {
    Icon: Calendar, label: 'Período',
    pillClasses: 'bg-amber-100 text-amber-700',
    derivedInfo: 'Bloque PERÍODO · NO afecta CTRU · va al P&L del mes (overhead)',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════════════════

export const GastoForm: React.FC<GastoFormProps> = ({ onClose, gastoEditar }) => {
  const isEditing = !!gastoEditar;
  const { user } = useAuthStore();
  const { crearGasto, actualizarGasto, gastos } = useGastoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const toast = useToastStore();
  const { lineasActivas, fetchLineasActivas } = useLineaNegocioStore();
  const [tipoCambio, setTipoCambio] = useState<number>(0);
  const [lineaNegocioId, setLineaNegocioId] = useState<string | null>(
    gastoEditar?.lineaNegocioId ?? null
  );

  useEffect(() => {
    fetchLineasActivas();
  }, [fetchLineasActivas]);

  // ── Estado del form ─────────────────────────────────────────────────────
  const [formData, setFormData] = useState<GastoFormData>(() => {
    if (gastoEditar) {
      return {
        tipo: gastoEditar.tipo || 'otros',
        categoriaCostoId: gastoEditar.categoriaCostoId,
        descripcion: gastoEditar.descripcion || '',
        moneda: gastoEditar.moneda || 'PEN',
        montoOriginal: gastoEditar.montoOriginal || 0,
        tipoCambio: gastoEditar.tipoCambio || tipoCambio || 0,
        esProrrateable: gastoEditar.esProrrateable || false,
        prorrateoTipo: gastoEditar.prorrateoTipo || 'unidad',
        fecha: gastoEditar.fecha?.toDate?.() || new Date(),
        frecuencia: gastoEditar.frecuencia || 'unico',
        estado: gastoEditar.estado || 'pendiente',
        impactaCTRU: gastoEditar.impactaCTRU || false,
        ventaId: gastoEditar.ventaId,
        proveedor: gastoEditar.proveedor,
        proveedorId: gastoEditar.proveedorId,
        proveedorTipo: gastoEditar.proveedorTipo,
        proveedorNombre: gastoEditar.proveedorNombre,
        numeroComprobante: gastoEditar.numeroComprobante,
        notas: gastoEditar.notas,
      };
    }
    return {
      tipo: 'otros',
      descripcion: '',
      moneda: 'PEN',
      montoOriginal: 0,
      tipoCambio: tipoCambio || 0,
      esProrrateable: false,
      prorrateoTipo: 'unidad',
      fecha: new Date(),
      frecuencia: 'unico',
      estado: 'pendiente',
      impactaCTRU: false,
    };
  });

  // ── Cascada Bloque > Padre > Sub (lógica preservada del legacy) ─────────
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState<BloqueCosto | null>(null);
  const [categoriaPadreId, setCategoriaPadreId] = useState<string | null>(null);
  const [subcategoriaId, setSubcategoriaId] = useState<string | null>(null);
  // chk5.C-FIX · dropdown canon · controla si está abierto el panel selector
  const [categoriaPickerOpen, setCategoriaPickerOpen] = useState(false);

  // ── Cargar TC ───────────────────────────────────────────────────────────
  useEffect(() => {
    const loadTC = async () => {
      const tc = await getTCDelDia();
      if (tc) {
        setTipoCambio(tc.compra);
        if (!gastoEditar?.tipoCambio) {
          setFormData(prev => ({ ...prev, tipoCambio: tc.compra }));
        }
      }
    };
    loadTC();
  }, [getTCDelDia]);

  const [loading, setLoading] = useState(false);

  // ── Cuentas tesorería (preservado · útil si edit-mode de gasto ya pagado) ─
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [cuentaOrigenId, setCuentaOrigenId] = useState<string>('');
  const [loadingCuentas, setLoadingCuentas] = useState(true);
  const [metodoPago, setMetodoPago] = useState<MetodoTesoreria>('efectivo');
  const [referenciaPago, setReferenciaPago] = useState<string>('');

  // ── Ventas para asociar gastos del bloque 'venta' (preservado) ──────────
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);
  const [busquedaVenta, setBusquedaVenta] = useState('');

  useEffect(() => {
    const cargarVentas = async () => {
      if (bloqueSeleccionado !== 'venta') {
        setVentas([]);
        setVentaSeleccionada(null);
        return;
      }
      try {
        setLoadingVentas(true);
        const ventasRecientes = await VentaService.getVentasRecientes(30);
        setVentas(ventasRecientes);
        if (gastoEditar?.ventaId && !ventaSeleccionada) {
          const ventaAsociada = ventasRecientes.find(v => v.id === gastoEditar.ventaId);
          if (ventaAsociada) setVentaSeleccionada(ventaAsociada);
          else {
            const ventaDirecta = await VentaService.getById(gastoEditar.ventaId);
            if (ventaDirecta) setVentaSeleccionada(ventaDirecta);
          }
        }
      } catch (error) { console.error('Error al cargar ventas:', error); }
      finally { setLoadingVentas(false); }
    };
    cargarVentas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloqueSeleccionado]);

  const ventasFiltradas = useMemo(() => {
    const ventasArr = Array.isArray(ventas) ? ventas : [];
    if (!busquedaVenta.trim()) return ventasArr.slice(0, 10);
    const term = busquedaVenta.toLowerCase();
    return ventasArr.filter(v => {
      const nv = (v.numeroVenta ?? '').toLowerCase();
      const nc = (v.nombreCliente ?? '').toLowerCase();
      return nv.includes(term) || nc.includes(term);
    }).slice(0, 10);
  }, [ventas, busquedaVenta]);

  useEffect(() => {
    const cargarCuentas = async () => {
      try {
        setLoadingCuentas(true);
        const todasCuentas = await tesoreriaService.getCuentas();
        const cuentasActivas = todasCuentas.filter(c => c.activa);
        setCuentas(cuentasActivas);
        const cuentaPEN = cuentasActivas.find(c =>
          (c.moneda === 'PEN' || c.esBiMoneda) && c.esCuentaPorDefecto && c.metodoPagoAsociado === 'efectivo'
        );
        if (cuentaPEN) setCuentaOrigenId(cuentaPEN.id);
        else if (cuentasActivas.length > 0) setCuentaOrigenId(cuentasActivas[0].id);
      } catch (error) { console.error('Error al cargar cuentas:', error); }
      finally { setLoadingCuentas(false); }
    };
    cargarCuentas();
  }, []);

  // Pre-pobla pago si edit-mode de gasto pagado (preservado)
  useEffect(() => {
    if (!loadingCuentas && cuentas.length > 0 && gastoEditar && gastoEditar.estado === 'pagado') {
      const pagoExistente = gastoEditar.pagos?.[0];
      if (pagoExistente) {
        if (pagoExistente.cuentaOrigenId) setCuentaOrigenId(pagoExistente.cuentaOrigenId);
        if (pagoExistente.metodoPago) setMetodoPago(pagoExistente.metodoPago as MetodoTesoreria);
        if (pagoExistente.referencia) setReferenciaPago(pagoExistente.referencia);
      } else if (gastoEditar.metodoPago) {
        setMetodoPago(gastoEditar.metodoPago as MetodoTesoreria);
      }
    }
  }, [gastoEditar, loadingCuentas, cuentas]);

  useEffect(() => {
    if (!loadingCuentas && cuentas.length > 0 && !(gastoEditar && gastoEditar.estado === 'pagado')) {
      const cuentaMoneda = cuentas.find(c => (c.esBiMoneda || c.moneda === formData.moneda) && c.activa);
      if (cuentaMoneda) setCuentaOrigenId(cuentaMoneda.id);
    }
  }, [formData.moneda, loadingCuentas, cuentas, gastoEditar]);

  // ── Categorías canon árbol (preservado) ─────────────────────────────────
  const arbolCategorias = useCategoriaCostoStore((s) => s.arbol);
  const fetchArbolCategorias = useCategoriaCostoStore((s) => s.fetchArbol);
  const cargandoCategorias = useCategoriaCostoStore((s) => s.loading);
  // chk5.C-FIX-B7 · expone error real del store si el fetch falla (rules deny, etc.)
  const errorCategorias = useCategoriaCostoStore((s) => s.error);

  useEffect(() => {
    // chk5.C-FIX-B7 · log diagnóstico para identificar issues de timing
    if (import.meta.env.DEV) {
      console.log('[GastoForm] fetchArbol disparado · arbol pre-fetch:', arbolCategorias);
    }
    fetchArbolCategorias()
      .then(() => {
        if (import.meta.env.DEV) {
          const state = useCategoriaCostoStore.getState();
          console.log('[GastoForm] fetchArbol completado · arbol:', state.arbol, '· error:', state.error);
          if (state.arbol) {
            console.log('[GastoForm] padres por bloque:', {
              producto: state.arbol.producto?.padres.length ?? 0,
              venta: state.arbol.venta?.padres.length ?? 0,
              periodo: state.arbol.periodo?.padres.length ?? 0,
            });
          }
        }
      })
      .catch((err) => {
        console.error('[GastoForm] fetchArbol FALLÓ:', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deriveBloqueInicial = (): BloqueCosto | null => {
    if (!gastoEditar) return null;
    return getBloqueDelGasto(gastoEditar, arbolCategorias);
  };

  useEffect(() => {
    if (!arbolCategorias) return;
    if (bloqueSeleccionado !== null) return;
    const bloqueInicial = deriveBloqueInicial();
    if (!bloqueInicial) return;
    setBloqueSeleccionado(bloqueInicial);

    if (gastoEditar?.categoriaCostoId) {
      const datos = arbolCategorias[bloqueInicial];
      if (datos.padres.some((p) => p.id === gastoEditar.categoriaCostoId)) {
        setCategoriaPadreId(gastoEditar.categoriaCostoId);
        setSubcategoriaId(null);
      } else {
        for (const padreId of Object.keys(datos.hijos)) {
          if (datos.hijos[padreId].some((h) => h.id === gastoEditar.categoriaCostoId)) {
            setCategoriaPadreId(padreId);
            setSubcategoriaId(gastoEditar.categoriaCostoId);
            return;
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arbolCategorias]);

  const handleSeleccionarBloque = (bloque: BloqueCosto) => {
    setBloqueSeleccionado(bloque);
    setCategoriaPadreId(null);
    setSubcategoriaId(null);
    setFormData((prev) => ({ ...prev, categoriaCostoId: undefined }));
  };

  const handleSeleccionarCategoriaPadre = (padreId: string) => {
    setCategoriaPadreId(padreId);
    setSubcategoriaId(null);
    setFormData((prev) => ({ ...prev, categoriaCostoId: padreId }));
  };

  const handleSeleccionarSubcategoria = (subId: string) => {
    setSubcategoriaId(subId);
    setFormData((prev) => ({ ...prev, categoriaCostoId: subId }));
  };

  // Sugerencias dinámicas tipo · histórico por bloque
  const sugerenciasActuales = useMemo<string[]>(() => {
    if (!bloqueSeleccionado) return [];
    const set = new Set<string>();
    for (const g of gastos) {
      if (!g.tipo) continue;
      if (getBloqueDelGasto(g, arbolCategorias) === bloqueSeleccionado) set.add(g.tipo);
    }
    return Array.from(set);
  }, [gastos, bloqueSeleccionado, arbolCategorias]);

  const categoriasPadreDelBloque = bloqueSeleccionado && arbolCategorias
    ? arbolCategorias[bloqueSeleccionado]?.padres ?? []
    : [];
  const subcategoriasDelPadre = bloqueSeleccionado && categoriaPadreId && arbolCategorias
    ? arbolCategorias[bloqueSeleccionado]?.hijos?.[categoriaPadreId] ?? []
    : [];

  // ── Inline create de categoría/subcategoría (D-INLINE-8 preservado) ─────
  const crearCategoriaStore = useCategoriaCostoStore((s) => s.crearCategoria);
  const [showCategoriaInline, setShowCategoriaInline] = useState<null | 'padre' | 'subcategoria'>(null);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('');
  const [loadingCategoriaInline, setLoadingCategoriaInline] = useState(false);

  const handleCrearCategoriaInline = async () => {
    if (!user?.uid) { toast.error('No se pudo identificar al usuario'); return; }
    if (!bloqueSeleccionado) { toast.warning('Selecciona primero el bloque'); return; }
    if (!nuevaCategoriaNombre.trim()) { toast.warning('Ingresa el nombre de la categoria'); return; }
    if (showCategoriaInline === 'subcategoria' && !categoriaPadreId) {
      toast.warning('Selecciona primero la categoria padre'); return;
    }
    try {
      setLoadingCategoriaInline(true);
      const orden = showCategoriaInline === 'subcategoria'
        ? (subcategoriasDelPadre.length + 1) * 10
        : (categoriasPadreDelBloque.length + 1) * 10;
      const newId = await crearCategoriaStore(
        {
          nombre: nuevaCategoriaNombre.trim(),
          bloque: bloqueSeleccionado,
          categoriaPadreId: showCategoriaInline === 'subcategoria' ? (categoriaPadreId ?? undefined) : undefined,
          activa: true,
          orden,
        },
        user.uid,
      );
      if (showCategoriaInline === 'padre') handleSeleccionarCategoriaPadre(newId);
      else handleSeleccionarSubcategoria(newId);
      toast.success(`Categoría "${nuevaCategoriaNombre.trim()}" creada y seleccionada`);
      setShowCategoriaInline(null);
      setNuevaCategoriaNombre('');
    } catch (e) {
      console.error('Error creando categoria inline', e);
      toast.error('No se pudo crear la categoria');
    } finally { setLoadingCategoriaInline(false); }
  };

  // ── Agente del gasto (preservado · ahora con toggle pills al top) ───────
  const proveedoresEnt = useEntidadesPorTipo('proveedor');
  const colaboradoresEnt = useEntidadesPorTipo('colaborador');
  const empleadosEnt = useEntidadesPorTipo('empleado');

  const createProveedorStore = useProveedorStore((s) => s.createProveedor);
  const [showProveedorInline, setShowProveedorInline] = useState(false);
  const [loadingProveedorInline, setLoadingProveedorInline] = useState(false);

  // chk5.C-FIX · estado canon · tipo agente seleccionado (pill activa)
  const [agenteTipoSel, setAgenteTipoSel] = useState<TipoAgente>(
    (gastoEditar?.proveedorTipo as TipoAgente) || 'proveedor'
  );
  const [agenteBusqueda, setAgenteBusqueda] = useState('');

  const entidadesDelTipo = agenteTipoSel === 'proveedor'
    ? proveedoresEnt.activas
    : agenteTipoSel === 'colaborador'
      ? colaboradoresEnt.activas
      : empleadosEnt.activas;

  const entidadesFiltradas = useMemo(() => {
    if (!agenteBusqueda.trim()) return entidadesDelTipo.slice(0, 8);
    const term = agenteBusqueda.toLowerCase();
    return entidadesDelTipo.filter(e =>
      e.nombre?.toLowerCase().includes(term) ||
      e.subLabel?.toLowerCase().includes(term)
    ).slice(0, 8);
  }, [entidadesDelTipo, agenteBusqueda]);

  const handleSeleccionarEntidad = (entidadId: string) => {
    const e = entidadesDelTipo.find(x => x.id === entidadId);
    if (!e) return;
    setFormData((prev) => ({
      ...prev,
      proveedorId: e.id,
      proveedorTipo: agenteTipoSel,
      proveedorNombre: e.nombre,
      proveedor: prev.proveedor || e.nombre,
    }));
    setAgenteBusqueda('');
  };

  const handleLimpiarAgente = () => {
    setFormData((prev) => ({
      ...prev,
      proveedorId: undefined,
      proveedorTipo: undefined,
      proveedorNombre: undefined,
    }));
  };

  const handleCrearProveedorInline = async (data: ProveedorFormData) => {
    if (!user?.uid) { toast.error('No se pudo identificar al usuario'); return; }
    try {
      setLoadingProveedorInline(true);
      const newId = await createProveedorStore(data, user.uid);
      setFormData((prev) => ({
        ...prev,
        proveedorId: newId,
        proveedorTipo: 'proveedor',
        proveedorNombre: data.nombre,
        proveedor: prev.proveedor || data.nombre,
      }));
      setAgenteTipoSel('proveedor');
      toast.success(`Proveedor "${data.nombre}" creado y vinculado`);
      setShowProveedorInline(false);
    } catch (e) {
      console.error('Error creando proveedor inline', e);
      toast.error('No se pudo crear el proveedor');
    } finally { setLoadingProveedorInline(false); }
  };

  // KPIs del agente seleccionado (mini-card · preservado)
  const agenteKpis = useMemo(() => {
    if (!formData.proveedorId) return null;
    const ahora = new Date();
    const inicio12m = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);
    const gastosDelAgente = gastos.filter((g) => g.proveedorId === formData.proveedorId);
    const ultimos12m = gastosDelAgente.filter((g) => toDateOrNow(g.fecha) >= inicio12m);
    const total12m = ultimos12m.reduce((acc, g) => acc + (g.montoPEN || 0), 0);
    const promedio = ultimos12m.length > 0 ? total12m / ultimos12m.length : 0;
    return { cantidad12m: ultimos12m.length, total12m, promedio, cantidadTotal: gastosDelAgente.length };
  }, [formData.proveedorId, gastos]);

  // ── Handler de change genérico ───────────────────────────────────────────
  const handleChange = (field: keyof GastoFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'esProrrateable') {
      setFormData(prev => ({ ...prev, impactaCTRU: value }));
    }
  };

  // ── canon F-Borradores · autoguardado 2 capas ────────────────────────────
  // Solo activo en modo CREATE (en edit no tiene sentido el borrador).
  const wizardState = useMemo(() => ({
    formData,
    bloqueSeleccionado,
    categoriaPadreId,
    subcategoriaId,
    agenteTipoSel,
    lineaNegocioId,
    ventaSeleccionada,
  }), [formData, bloqueSeleccionado, categoriaPadreId, subcategoriaId, agenteTipoSel, lineaNegocioId, ventaSeleccionada]);

  const buildResumen = (s: typeof wizardState): string | undefined => {
    if (s.formData.descripcion) return s.formData.descripcion;
    if (s.formData.proveedorNombre) return s.formData.proveedorNombre;
    return undefined;
  };
  const buildMonto = (s: typeof wizardState): number | undefined => {
    if (s.formData.montoOriginal > 0) {
      if (s.formData.moneda === 'USD' && s.formData.tipoCambio) {
        return s.formData.montoOriginal * s.formData.tipoCambio;
      }
      return s.formData.montoOriginal;
    }
    return undefined;
  };

  const {
    borradorExistente,
    forceSave,
    clearDraft,
  } = useWizardAutosave({
    tipo: 'gasto',
    state: wizardState,
    pasoActual: 0,
    enabled: !isEditing, // solo create-mode
    buildResumen,
    buildMonto,
  });

  // chk5.C-FIX · canon F-Borradores · pre-carga del borrador al montar
  // (solo una vez · cuando el hook devuelve `borradorExistente` por primera vez)
  const borradorPreCargado = React.useRef(false);
  useEffect(() => {
    if (isEditing) return;
    if (borradorPreCargado.current) return;
    if (!borradorExistente?.estado) return;

    const snapshot = borradorExistente.estado as Partial<typeof wizardState>;
    if (snapshot.formData) {
      setFormData((prev) => ({
        ...prev,
        ...snapshot.formData!,
        // fecha viene serializada como string · convertir a Date
        fecha: snapshot.formData!.fecha ? new Date(snapshot.formData!.fecha as any) : prev.fecha,
      }));
    }
    if (snapshot.bloqueSeleccionado !== undefined) setBloqueSeleccionado(snapshot.bloqueSeleccionado);
    if (snapshot.categoriaPadreId !== undefined) setCategoriaPadreId(snapshot.categoriaPadreId);
    if (snapshot.subcategoriaId !== undefined) setSubcategoriaId(snapshot.subcategoriaId);
    if (snapshot.agenteTipoSel) setAgenteTipoSel(snapshot.agenteTipoSel);
    if (snapshot.lineaNegocioId !== undefined) setLineaNegocioId(snapshot.lineaNegocioId);
    if (snapshot.ventaSeleccionada !== undefined) setVentaSeleccionada(snapshot.ventaSeleccionada as Venta | null);

    borradorPreCargado.current = true;
    toast.info('Continuando desde tu borrador guardado');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borradorExistente, isEditing]);

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.warning('Debe iniciar sesión'); return; }
    if (!formData.categoriaCostoId) { toast.warning('Selecciona una categoría'); return; }
    if (!formData.descripcion.trim()) { toast.warning('Ingresa una descripción'); return; }
    if (formData.montoOriginal <= 0) { toast.warning('El monto debe ser mayor a 0'); return; }
    if (formData.moneda === 'USD' && !formData.tipoCambio) {
      toast.warning('Especifica el tipo de cambio para gastos en USD'); return;
    }
    if (bloqueSeleccionado === 'venta' && !ventaSeleccionada) {
      toast.warning('Los gastos del bloque Venta deben asociarse a una venta'); return;
    }

    setLoading(true);
    try {
      const lineaSel = lineasActivas.find(l => l.id === lineaNegocioId);
      const gastoData = {
        ...formData,
        cuentaOrigenId: cuentaOrigenId || undefined,
        metodoPago: metodoPago || undefined,
        referenciaPago: referenciaPago || undefined,
        lineaNegocioId: lineaNegocioId || null,
        lineaNegocioNombre: lineaSel?.nombre || null,
      };
      if (isEditing && gastoEditar) {
        await actualizarGasto(gastoEditar.id, gastoData, user.uid);
        toast.success('Gasto actualizado exitosamente');
      } else {
        await crearGasto(gastoData, user.uid);
        // chk5.C-FIX · canon F-Borradores · al confirmar el form, limpia borrador
        await clearDraft();
        toast.success('Gasto registrado exitosamente');
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message, isEditing ? 'Error al actualizar gasto' : 'Error al crear gasto');
    } finally { setLoading(false); }
  };

  // ── Handler "Guardar borrador" (cierra modal · borrador queda persistido) ─
  const handleGuardarBorrador = async () => {
    if (isEditing) { onClose(); return; }
    try {
      await forceSave();
      toast.info('Borrador guardado · podrás continuar desde el banner amber en la página');
    } catch {
      /* silencioso · al menos localStorage quedó persistido */
    }
    onClose();
  };

  // ── Render helpers ──────────────────────────────────────────────────────
  const bloqueConf = bloqueSeleccionado ? BLOQUE_CONFIG[bloqueSeleccionado] : null;
  const padreSeleccionado = categoriaPadreId
    ? categoriasPadreDelBloque.find(p => p.id === categoriaPadreId)
    : null;
  const hijoSeleccionado = subcategoriaId
    ? subcategoriasDelPadre.find(h => h.id === subcategoriaId)
    : null;

  const categoriaBreadcrumb = bloqueConf
    ? [
        { label: bloqueConf.label, pillClasses: bloqueConf.pillClasses, Icon: bloqueConf.Icon },
        ...(padreSeleccionado ? [{ label: padreSeleccionado.nombre, plain: true }] : []),
        ...(hijoSeleccionado ? [{ label: hijoSeleccionado.nombre, plain: true }] : []),
      ]
    : [];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Editar gasto' : 'Nuevo gasto manual'}
      size="lg"
      contentPadding="none"
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">

        {/* Banner edit-mode si gasto ya pagado */}
        {isEditing && gastoEditar?.estado === 'pagado' && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>Este gasto ya está pagado. Cambiar monto/método actualizará el movimiento en tesorería. Cambiar estado a "Pendiente" anulará el movimiento.</span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN 1 · CLASIFICACIÓN (canon · dropdown breadcrumb)
            ═══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            1 · Clasificación
          </div>
          <label className="text-[10px] text-slate-600 font-medium">Categoría *</label>

          {/* Dropdown trigger · muestra breadcrumb derivado o placeholder */}
          <button
            type="button"
            onClick={() => setCategoriaPickerOpen((o) => !o)}
            className={`w-full flex items-center gap-2 px-3 py-2 bg-white border rounded-lg cursor-pointer transition-colors ${
              formData.categoriaCostoId
                ? 'border-teal-300 ring-2 ring-teal-100'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {formData.categoriaCostoId ? (
              <>
                <Briefcase className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                <div className="flex-1 flex items-center gap-1 flex-wrap text-sm">
                  {categoriaBreadcrumb.map((item, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                      {'pillClasses' in item ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${item.pillClasses}`}>
                          {item.Icon && <item.Icon className="w-3 h-3" />}
                          {item.label}
                        </span>
                      ) : (
                        <span className="text-slate-700 font-medium">{item.label}</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </>
            ) : (
              <>
                <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="flex-1 text-sm text-slate-400 text-left">
                  {cargandoCategorias || arbolCategorias === null
                    ? 'Cargando categorías...'
                    : 'Selecciona una categoría'}
                </span>
              </>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${categoriaPickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Panel expandible · 3 tabs bloque + listado categoría/sub */}
          {categoriaPickerOpen && (
            <div className="mt-2 border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
              {/* Tabs bloque */}
              <div className="flex border-b border-slate-200">
                {(['producto', 'venta', 'periodo'] as BloqueCosto[]).map((b) => {
                  const cfg = BLOQUE_CONFIG[b];
                  const BIcon = cfg.Icon;
                  const activo = bloqueSeleccionado === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleSeleccionarBloque(b)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors ${
                        activo
                          ? `${cfg.pillClasses} border-b-2 border-current`
                          : 'text-slate-500 hover:bg-slate-50 border-b-2 border-transparent'
                      }`}
                    >
                      <BIcon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* Contenido del bloque seleccionado */}
              {bloqueSeleccionado && (
                <div className="p-3 max-h-72 overflow-y-auto">
                  {/* chk5.C-FIX · race condition fix · `arbol === null` significa
                      "todavía no se hizo el primer fetch" → mostrar loading.
                      chk5.C-FIX-B7 · si hay error en el store, mostrarlo en vez
                      de loading infinito (típicamente: rules deny, network, auth). */}
                  {errorCategorias ? (
                    <div className="bg-rose-50 border border-rose-200 rounded p-2 text-[11px] text-rose-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold">Error cargando categorías</p>
                        <p className="mt-0.5 break-words">{errorCategorias}</p>
                        <p className="mt-1 text-[10px] text-rose-700">
                          Posibles causas: (1) tu usuario no está activo, (2) firestore.rules bloquea la lectura,
                          (3) error de red. Revisá la consola del navegador (F12) para detalles.
                        </p>
                      </div>
                    </div>
                  ) : cargandoCategorias || arbolCategorias === null ? (
                    <div className="text-xs text-slate-400 italic text-center py-3">Cargando categorías...</div>
                  ) : categoriasPadreDelBloque.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p>No hay categorías cargadas en el bloque <strong>"{bloqueSeleccionado}"</strong>.</p>
                        <p className="mt-1">Pasos para cargar las 64 categorías canon (16 padres + 48 subs):</p>
                        <code className="block bg-white px-2 py-1 rounded mt-1 font-mono text-[10px]">
                          node scripts/seed-categorias-costos-completo.mjs --execute
                        </code>
                        <p className="mt-1 text-[10px] text-amber-700">
                          Requiere <code className="font-mono">GOOGLE_APPLICATION_CREDENTIALS</code> apuntando al proyecto activo · idempotente (re-ejecutable).
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                        Categorías padre · selecciona una
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mb-3">
                        {categoriasPadreDelBloque.map((padre) => {
                          const isSel = categoriaPadreId === padre.id;
                          const numHijos = arbolCategorias?.[bloqueSeleccionado]?.hijos?.[padre.id]?.length ?? 0;
                          return (
                            <button
                              key={padre.id}
                              type="button"
                              onClick={() => handleSeleccionarCategoriaPadre(padre.id)}
                              className={`px-2.5 py-1.5 rounded text-[11px] font-medium text-left border transition-colors ${
                                isSel
                                  ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-200 text-teal-900'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="font-bold">{padre.nombre}</div>
                              {numHijos > 0 && (
                                <div className="text-[9px] text-slate-500">{numHijos} sub</div>
                              )}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => { setNuevaCategoriaNombre(''); setShowCategoriaInline('padre'); }}
                          className="px-2.5 py-1.5 rounded text-[11px] font-bold text-teal-700 bg-white border-2 border-dashed border-teal-300 hover:bg-teal-50 flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Nueva categoría
                        </button>
                      </div>

                      {/* Subcategorías del padre seleccionado */}
                      {categoriaPadreId && (
                        <>
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 mt-2">
                            Subcategoría {subcategoriasDelPadre.length === 0 ? '(opcional · no hay subs)' : '· opcional'}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {subcategoriasDelPadre.map((sub) => {
                              const isSel = subcategoriaId === sub.id;
                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() => { handleSeleccionarSubcategoria(sub.id); setCategoriaPickerOpen(false); }}
                                  className={`px-2.5 py-1.5 rounded text-[11px] font-medium text-left border transition-colors ${
                                    isSel
                                      ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-200 text-teal-900'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  {sub.nombre}
                                </button>
                              );
                            })}
                            {subcategoriaId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSubcategoriaId(null);
                                  setFormData((prev) => ({ ...prev, categoriaCostoId: categoriaPadreId ?? undefined }));
                                }}
                                className="px-2.5 py-1.5 rounded text-[11px] text-slate-500 border-2 border-dashed border-slate-300 hover:border-slate-400 flex items-center justify-center gap-1"
                              >
                                <XIcon className="w-3 h-3" />
                                Sin sub
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setNuevaCategoriaNombre(''); setShowCategoriaInline('subcategoria'); }}
                              className="px-2.5 py-1.5 rounded text-[11px] font-bold text-teal-700 bg-white border-2 border-dashed border-teal-300 hover:bg-teal-50 flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Nueva sub
                            </button>
                          </div>
                          {/* Botón cerrar panel cuando ya hay padre */}
                          <div className="pt-3 mt-2 border-t border-slate-100 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setCategoriaPickerOpen(false)}
                              className="text-[11px] font-medium text-teal-700 hover:text-teal-800"
                            >
                              Confirmar selección
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {!bloqueSeleccionado && (
                <div className="p-4 text-center text-xs text-slate-400 italic">
                  Elegí un bloque para ver sus categorías
                </div>
              )}
            </div>
          )}

          {/* Info derivada del bloque */}
          {bloqueConf && !categoriaPickerOpen && (
            <div className="text-[10px] text-slate-500 mt-1 italic">
              {bloqueConf.derivedInfo}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN 2 · AGENTE DEL GASTO (canon · 3 pills + autocomplete)
            ═══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            2 · Agente del gasto
          </div>

          {/* Pills toggle 3 tipos */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {(Object.keys(AGENTE_CONFIG) as TipoAgente[]).map((tipo) => {
              const cfg = AGENTE_CONFIG[tipo];
              const TipoIcon = cfg.Icon;
              const activo = agenteTipoSel === tipo;
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => { setAgenteTipoSel(tipo); setAgenteBusqueda(''); }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                    activo
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <TipoIcon className="w-3 h-3" />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Estado · entidad seleccionada o autocomplete */}
          {formData.proveedorId && formData.proveedorTipo === agenteTipoSel ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50/40 border border-emerald-200 rounded-lg">
              <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="text-sm text-slate-900 font-medium flex-1 truncate">
                {formData.proveedorNombre || formData.proveedor}
              </span>
              <button
                type="button"
                onClick={handleLimpiarAgente}
                className="text-[11px] text-slate-500 hover:text-rose-600 font-medium"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg">
                <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={agenteBusqueda}
                  onChange={(e) => setAgenteBusqueda(e.target.value)}
                  placeholder={`Buscar ${AGENTE_CONFIG[agenteTipoSel].label.toLowerCase()}...`}
                  className="text-sm flex-1 outline-none"
                />
              </div>
              {agenteBusqueda && entidadesFiltradas.length > 0 && (
                <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto bg-white shadow-sm">
                  {entidadesFiltradas.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => handleSeleccionarEntidad(e.id)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    >
                      <div className="text-sm text-slate-900 font-medium truncate">{e.nombre}</div>
                      {e.subLabel && (
                        <div className="text-[10px] text-slate-500 truncate">{e.subLabel}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {agenteBusqueda && entidadesFiltradas.length === 0 && (
                <div className="text-[11px] text-slate-400 italic py-2">
                  No se encontró "{agenteBusqueda}".
                </div>
              )}
            </div>
          )}

          {/* CTA crear inline */}
          {agenteTipoSel === 'proveedor' && (
            <button
              type="button"
              onClick={() => setShowProveedorInline(true)}
              className="text-[11px] text-teal-700 font-medium mt-1.5 hover:underline inline-flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              Crear nuevo proveedor inline
            </button>
          )}

          {/* Mini-card KPIs si agente seleccionado */}
          {formData.proveedorId && agenteKpis && (
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-blue-50 rounded p-1.5">
                <div className="text-[9px] uppercase text-blue-700 font-bold">Gastos 12m</div>
                <div className="text-sm font-bold tabular-nums text-blue-900">{agenteKpis.cantidad12m}</div>
              </div>
              <div className="bg-blue-50 rounded p-1.5">
                <div className="text-[9px] uppercase text-blue-700 font-bold">Total 12m</div>
                <div className="text-[11px] font-bold tabular-nums text-blue-900">
                  {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(agenteKpis.total12m)}
                </div>
              </div>
              <div className="bg-blue-50 rounded p-1.5">
                <div className="text-[9px] uppercase text-blue-700 font-bold">Promedio</div>
                <div className="text-[11px] font-bold tabular-nums text-blue-900">
                  {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(agenteKpis.promedio)}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN 3 · MONTO (canon · pills PEN/USD + input + equivalente)
            ═══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            3 · Monto
          </div>

          {/* Pills PEN/USD */}
          <div className="flex items-center gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => handleChange('moneda', 'PEN')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                formData.moneda === 'PEN'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Banknote className="w-3 h-3" />
              PEN · S/
            </button>
            <button
              type="button"
              onClick={() => handleChange('moneda', 'USD')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                formData.moneda === 'USD'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <DollarSign className="w-3 h-3" />
              USD · $
            </button>
          </div>

          {/* Input monto */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-500 font-medium text-sm">
                {formData.moneda === 'USD' ? '$' : 'S/'}
              </span>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.montoOriginal || ''}
                onChange={(e) => handleChange('montoOriginal', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="text-sm flex-1 outline-none tabular-nums text-right font-bold"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-500 font-medium text-[11px]">TC</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={formData.tipoCambio || ''}
                onChange={(e) => handleChange('tipoCambio', parseFloat(e.target.value) || 0)}
                placeholder="3.700"
                className="text-sm flex-1 outline-none tabular-nums text-right"
              />
            </div>
          </div>

          {/* Equivalente cross-moneda */}
          {formData.montoOriginal > 0 && (formData.tipoCambio ?? 0) > 0 && (
            <div className="mt-1.5 text-[10px] text-slate-500 italic flex items-center gap-2">
              <span>Equivalente:</span>
              <span className="font-bold tabular-nums text-slate-700">
                {formData.moneda === 'PEN'
                  ? `$ ${(formData.montoOriginal / (formData.tipoCambio ?? 1)).toFixed(2)} USD`
                  : `S/ ${(formData.montoOriginal * (formData.tipoCambio ?? 1)).toFixed(2)} PEN`}
              </span>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN 4 · FECHA + RECURRENCIA (canon · grid 2 cols)
            ═══════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-600 font-medium">Fecha del gasto *</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg mt-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                type="date"
                required
                value={formData.fecha.toISOString().split('T')[0]}
                onChange={(e) => handleChange('fecha', new Date(e.target.value))}
                className="text-sm flex-1 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-600 font-medium">Recurrencia</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg mt-1">
              <Repeat className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <select
                value={formData.frecuencia}
                onChange={(e) => handleChange('frecuencia', e.target.value)}
                className="text-sm flex-1 outline-none bg-transparent"
              >
                <option value="unico">Único · no se repite</option>
                <option value="mensual">Mensual</option>
                <option value="quincenal">Quincenal</option>
                <option value="semanal">Semanal</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECCIÓN 5 · DETALLE (canon)
            ═══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            5 · Detalle
          </div>

          {/* Tipo de gasto (autocomplete por bloque · preservado) */}
          <div className="mb-2">
            <AutocompleteInput
              label="Tipo de gasto"
              value={formData.tipo}
              onChange={(value) => handleChange('tipo', value)}
              suggestions={sugerenciasActuales}
              placeholder="Ej. Sueldo Juan · mayo 2026"
              allowCreate={true}
              createLabel="Crear"
              required
            />
          </div>

          {/* Descripción */}
          <Input
            label="Descripción *"
            type="text"
            required
            value={formData.descripcion}
            onChange={(e) => handleChange('descripcion', e.target.value)}
            placeholder="Detalle específico del gasto"
          />

          {/* Asociar a venta (solo bloque=venta) */}
          {bloqueSeleccionado === 'venta' && (
            <div className="mt-2.5 p-2.5 bg-purple-50/40 border border-purple-200 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-purple-700 font-bold mb-1.5 flex items-center gap-1">
                <Hash className="w-3 h-3" />
                Asociar a venta (obligatorio)
              </div>
              {ventaSeleccionada ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-purple-900 truncate">
                      {ventaSeleccionada.numeroVenta}
                    </div>
                    <div className="text-[10px] text-purple-700 truncate">
                      {ventaSeleccionada.nombreCliente || 'Sin cliente'} · S/ {ventaSeleccionada.totalPEN?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setVentaSeleccionada(null); handleChange('ventaId', undefined); }}
                    className="text-[11px] text-purple-700 hover:text-purple-900 font-medium"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-purple-200 rounded text-xs">
                    <Search className="w-3 h-3 text-purple-400" />
                    <input
                      type="text"
                      value={busquedaVenta}
                      onChange={(e) => setBusquedaVenta(e.target.value)}
                      placeholder="Buscar por número o cliente..."
                      className="flex-1 outline-none"
                    />
                  </div>
                  {loadingVentas ? (
                    <div className="text-[10px] text-slate-400 italic">Cargando ventas...</div>
                  ) : ventasFiltradas.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto border border-purple-200 rounded bg-white">
                      {ventasFiltradas.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => { setVentaSeleccionada(v); handleChange('ventaId', v.id); setBusquedaVenta(''); }}
                          className="w-full px-2 py-1.5 text-left text-[11px] hover:bg-purple-50 border-b border-purple-100 last:border-0"
                        >
                          <div className="font-bold text-slate-900">{v.numeroVenta}</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {v.nombreCliente || 'Sin cliente'} · S/ {v.totalPEN?.toFixed(2) || '0.00'}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">Sin resultados</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prorrateo (solo bloques producto/periodo) */}
          {(bloqueSeleccionado === 'producto' || bloqueSeleccionado === 'periodo') && (
            <label className="mt-2.5 flex items-start gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={formData.esProrrateable}
                onChange={(e) => handleChange('esProrrateable', e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
              />
              <span>
                <span className="font-medium text-slate-900">Gasto prorrateable</span>
                <span className="block text-[10px] text-slate-500">Se distribuye entre unidades disponibles y afecta CTRU dinámico</span>
              </span>
            </label>
          )}

          {/* Línea de negocio */}
          <div className="mt-2.5">
            <label className="text-[10px] text-slate-600 font-medium">Línea de negocio</label>
            <select
              value={lineaNegocioId || ''}
              onChange={(e) => setLineaNegocioId(e.target.value || null)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Compartido (todas las líneas)</option>
              {lineasActivas.map((linea) => (
                <option key={linea.id} value={linea.id}>{linea.nombre}</option>
              ))}
            </select>
          </div>

          {/* Notas opcionales */}
          <div className="mt-2.5">
            <label className="text-[10px] text-slate-600 font-medium">Notas (opcional)</label>
            <textarea
              value={formData.notas || ''}
              onChange={(e) => handleChange('notas', e.target.value)}
              rows={2}
              placeholder="Notas internas, referencias o contexto adicional"
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none resize-none"
            />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            BANNER · SEPARACIÓN CANON D-GR-5
            ═══════════════════════════════════════════════════════════════ */}
        {!isEditing && (
          <div className="bg-sky-50/50 border border-sky-200 rounded p-2.5 text-[10px] text-sky-800 flex items-start gap-1.5">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              <span className="font-bold">Separación canon:</span> este form solo REGISTRA el gasto.
              El pago se gestiona después desde la lista (botón <span className="font-bold">Pagar</span>) usando el modal canónico <code className="font-mono text-[10px]">PagoUnificadoForm</code>.
            </span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ACCIONES BOTTOM (canon)
            ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            Cancelar
          </button>
          {!isEditing && (
            <button
              type="button"
              onClick={handleGuardarBorrador}
              disabled={loading}
              className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md px-3 py-1.5 ml-auto inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              Guardar borrador
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className={`text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md px-4 py-1.5 inline-flex items-center gap-1 disabled:opacity-50 ${isEditing ? 'ml-auto' : ''}`}
          >
            {loading ? 'Procesando...' : (isEditing ? 'Actualizar gasto' : 'Crear gasto')}
          </button>
        </div>
      </form>

      {/* ═══════════════════════════════════════════════════════════════════
          MODALES INLINE (preservados · D-INLINE-8)
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Inline create de categoría/sub */}
      {showCategoriaInline && (
        <Modal
          isOpen={true}
          onClose={() => { setShowCategoriaInline(null); setNuevaCategoriaNombre(''); }}
          title={showCategoriaInline === 'padre' ? 'Nueva categoría padre' : 'Nueva subcategoría'}
          size="md"
        >
          <div className="space-y-4 p-1">
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-xs text-pink-900">
              <strong>Crear sin abandonar el gasto.</strong>{' '}
              {showCategoriaInline === 'padre'
                ? `La nueva categoría se agregará al bloque "${bloqueSeleccionado}".`
                : `La nueva subcategoría se agregará dentro de "${categoriasPadreDelBloque.find(p => p.id === categoriaPadreId)?.nombre}".`}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Contexto</div>
              <div className="flex items-center gap-2">
                {bloqueSeleccionado && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${BLOQUE_CONFIG[bloqueSeleccionado].pillClasses}`}>
                    {(() => {
                      const BIcon = BLOQUE_CONFIG[bloqueSeleccionado].Icon;
                      return <BIcon className="w-3 h-3" />;
                    })()}
                    <span>{BLOQUE_CONFIG[bloqueSeleccionado].label}</span>
                  </span>
                )}
                {showCategoriaInline === 'subcategoria' && categoriaPadreId && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                    <span className="font-bold text-slate-700">
                      {categoriasPadreDelBloque.find(p => p.id === categoriaPadreId)?.nombre}
                    </span>
                  </>
                )}
              </div>
            </div>
            <Input
              label={showCategoriaInline === 'padre' ? 'Nombre de la categoría' : 'Nombre de la subcategoría'}
              value={nuevaCategoriaNombre}
              onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
              placeholder={showCategoriaInline === 'padre' ? 'Ej. Personal' : 'Ej. Sueldo Juan'}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowCategoriaInline(null); setNuevaCategoriaNombre(''); }}>Cancelar</Button>
              <Button onClick={handleCrearCategoriaInline} disabled={loadingCategoriaInline}>
                {loadingCategoriaInline ? 'Creando...' : 'Crear'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Inline create de proveedor (preservado) */}
      {showProveedorInline && (
        <Modal
          isOpen={true}
          onClose={() => setShowProveedorInline(false)}
          title="Nuevo proveedor inline"
          size="lg"
        >
          <ProveedorForm
            onSubmit={handleCrearProveedorInline}
            onCancel={() => setShowProveedorInline(false)}
            loading={loadingProveedorInline}
          />
        </Modal>
      )}
    </Modal>
  );
};
