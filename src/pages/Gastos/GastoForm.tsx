import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Info, Search, Link, Calendar, DollarSign, CreditCard, Banknote, AlertCircle, CheckCircle } from 'lucide-react';
import { PagoUnificadoForm } from '../../components/modules/pagos/PagoUnificadoForm';
import type { PagoUnificadoResult } from '../../components/modules/pagos/PagoUnificadoForm';
import { Button, Input, Select, AutocompleteInput } from '../../components/common';
import { Modal } from '../../components/common/Modal';
import { useGastoStore } from '../../store/gastoStore';
import { useAuthStore } from '../../store/authStore';
import { useTipoCambioStore } from '../../store/tipoCambioStore';
import { useToastStore } from '../../store/toastStore';
import { tesoreriaService } from '../../services/tesoreria.service';
import { VentaService } from '../../services/venta.service';
import { CATEGORIAS_GASTO, type Gasto, type GastoFormData, type CategoriaGasto, type MonedaGasto, type EstadoGasto } from '../../types/gasto.types';
import type { CuentaCaja, MetodoTesoreria } from '../../types/tesoreria.types';
import type { Venta } from '../../types/venta.types';
import { useLineaNegocioStore } from '../../store/lineaNegocioStore';
import { Combobox } from '../../design-system/components/forms';
import { useEntidadesPorTipo } from '../../hooks/useEntidadesPorTipo';
import { useProveedorStore } from '../../store/proveedorStore';
import { ProveedorForm } from '../../components/modules/ordenCompra/ProveedorForm';
import type { ProveedorFormData } from '../../types/ordenCompra.types';
import { useCategoriaCostoStore } from '../../store/categoriaCostoStore';
import type { BloqueCosto } from '../../types/categoriaCosto.types';

interface GastoFormProps {
  onClose: () => void;
  gastoEditar?: Gasto | null;
}

export const GastoForm: React.FC<GastoFormProps> = ({ onClose, gastoEditar }) => {
  const isEditing = !!gastoEditar;
  const { user } = useAuthStore();
  const { crearGasto, actualizarGasto, gastos } = useGastoStore();
  const { getTCDelDia } = useTipoCambioStore();
  const toast = useToastStore();
  const { lineasActivas, fetchLineasActivas } = useLineaNegocioStore();
  const [tipoCambio, setTipoCambio] = React.useState<number>(0);
  const [lineaNegocioId, setLineaNegocioId] = useState<string | null>(
    gastoEditar?.lineaNegocioId ?? null
  );

  // Cargar líneas de negocio
  useEffect(() => {
    fetchLineasActivas();
  }, [fetchLineasActivas]);

  // Modal registration ahora lo maneja el componente Modal

  const [formData, setFormData] = useState<GastoFormData>(() => {
    if (gastoEditar) {
      return {
        tipo: gastoEditar.tipo || 'otros',
        categoria: gastoEditar.categoria || 'GO',
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
      categoria: 'GO',
      descripcion: '',
      moneda: 'PEN',
      montoOriginal: 0,
      tipoCambio: tipoCambio || 0,
      esProrrateable: false,
      prorrateoTipo: 'unidad',
      fecha: new Date(),
      frecuencia: 'unico',
      estado: 'pendiente',
      impactaCTRU: false
    };
  });

  // Cargar tipo de cambio al montar
  React.useEffect(() => {
    const loadTC = async () => {
      const tc = await getTCDelDia();
      if (tc) {
        setTipoCambio(tc.compra);
        // Solo setear TC si no estamos editando (o si el gasto no tenía TC)
        if (!gastoEditar?.tipoCambio) {
          setFormData(prev => ({ ...prev, tipoCambio: tc.compra }));
        }
      }
    };
    loadTC();
  }, [getTCDelDia]);

  const [loading, setLoading] = useState(false);

  // Estado para cuentas de tesorería (de dónde sale el dinero)
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([]);
  const [cuentaOrigenId, setCuentaOrigenId] = useState<string>('');
  const [loadingCuentas, setLoadingCuentas] = useState(true);
  const [metodoPago, setMetodoPago] = useState<MetodoTesoreria>('efectivo');
  const [referenciaPago, setReferenciaPago] = useState<string>('');
  const [pagoConfirmado, setPagoConfirmado] = useState(false);

  // Estado para ventas (para asociar gastos GV/GD)
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);
  const [busquedaVenta, setBusquedaVenta] = useState('');

  // Cargar ventas recientes cuando se selecciona GV o GD
  useEffect(() => {
    const cargarVentas = async () => {
      if (formData.categoria !== 'GV' && formData.categoria !== 'GD') {
        setVentas([]);
        setVentaSeleccionada(null);
        return;
      }

      try {
        setLoadingVentas(true);
        const ventasRecientes = await VentaService.getVentasRecientes(30);
        setVentas(ventasRecientes);

        // Si estamos editando y el gasto tiene ventaId, buscar la venta asociada
        if (gastoEditar?.ventaId && !ventaSeleccionada) {
          const ventaAsociada = ventasRecientes.find(v => v.id === gastoEditar.ventaId);
          if (ventaAsociada) {
            setVentaSeleccionada(ventaAsociada);
          } else {
            // La venta vinculada no está en las recientes (puede ser más antigua), buscarla directamente
            const ventaDirecta = await VentaService.getById(gastoEditar.ventaId);
            if (ventaDirecta) {
              setVentaSeleccionada(ventaDirecta);
            }
          }
        }
      } catch (error) {
        console.error('Error al cargar ventas:', error);
      } finally {
        setLoadingVentas(false);
      }
    };

    cargarVentas();
  }, [formData.categoria]);

  // Filtrar ventas por búsqueda (con validación segura)
  const ventasFiltradas = useMemo(() => {
    const ventasArr = Array.isArray(ventas) ? ventas : [];
    if (!busquedaVenta.trim()) return ventasArr.slice(0, 10);
    const termino = busquedaVenta.toLowerCase();
    return ventasArr
      .filter(v => {
        const numeroVenta = (v.numeroVenta ?? '').toLowerCase();
        const nombreCliente = (v.nombreCliente ?? '').toLowerCase();
        return numeroVenta.includes(termino) || nombreCliente.includes(termino);
      })
      .slice(0, 10);
  }, [ventas, busquedaVenta]);

  // Obtener tipos de gasto existentes para sugerencias (por categoría)
  const tiposSugeridos = useMemo(() => {
    const tiposPorCategoria: Record<CategoriaGasto, string[]> = {
      GV: [],
      GD: [],
      GA: [],
      GO: []
    };

    // Agregar tipos existentes de los gastos
    gastos.forEach(g => {
      if (g.categoria && g.tipo && !tiposPorCategoria[g.categoria]?.includes(g.tipo)) {
        tiposPorCategoria[g.categoria]?.push(g.tipo);
      }
    });

    // Agregar ejemplos predefinidos de cada categoría
    Object.entries(CATEGORIAS_GASTO).forEach(([cat, info]) => {
      info.ejemplos.forEach(ejemplo => {
        if (!tiposPorCategoria[cat as CategoriaGasto].includes(ejemplo)) {
          tiposPorCategoria[cat as CategoriaGasto].push(ejemplo);
        }
      });
    });

    return tiposPorCategoria;
  }, [gastos]);

  // Sugerencias actuales según categoría seleccionada
  const sugerenciasActuales = useMemo(() => {
    return tiposSugeridos[formData.categoria] || [];
  }, [tiposSugeridos, formData.categoria]);

  // Cargar cuentas disponibles
  useEffect(() => {
    const cargarCuentas = async () => {
      try {
        setLoadingCuentas(true);
        const todasCuentas = await tesoreriaService.getCuentas();
        const cuentasActivas = todasCuentas.filter(c => c.activa);
        setCuentas(cuentasActivas);

        const cuentaPEN = cuentasActivas.find(c =>
          (c.moneda === 'PEN' || c.esBiMoneda) &&
          c.esCuentaPorDefecto &&
          c.metodoPagoAsociado === 'efectivo'
        );

        if (cuentaPEN) {
          setCuentaOrigenId(cuentaPEN.id);
        } else if (cuentasActivas.length > 0) {
          setCuentaOrigenId(cuentasActivas[0].id);
        }
      } catch (error) {
        console.error('Error al cargar cuentas:', error);
      } finally {
        setLoadingCuentas(false);
      }
    };

    cargarCuentas();
  }, []);

  // Pre-poblar campos de pago cuando se edita un gasto pagado
  useEffect(() => {
    if (!loadingCuentas && cuentas.length > 0 && gastoEditar && gastoEditar.estado === 'pagado') {
      const pagoExistente = gastoEditar.pagos?.[0];
      if (pagoExistente) {
        // Pre-poblar desde pagos[0]
        if (pagoExistente.cuentaOrigenId) setCuentaOrigenId(pagoExistente.cuentaOrigenId);
        if (pagoExistente.metodoPago) setMetodoPago(pagoExistente.metodoPago as MetodoTesoreria);
        if (pagoExistente.referencia) setReferenciaPago(pagoExistente.referencia);
      } else {
        // Legacy: pre-poblar desde campos del gasto
        if ((gastoEditar as any).cuentaOrigenId) setCuentaOrigenId((gastoEditar as any).cuentaOrigenId);
        if (gastoEditar.metodoPago) setMetodoPago(gastoEditar.metodoPago as MetodoTesoreria);
      }
      return; // No aplicar lógica de cuenta por defecto
    }
  }, [gastoEditar, loadingCuentas, cuentas]);

  // Actualizar cuenta por defecto cuando cambia la moneda (solo para gastos nuevos o no pagados)
  useEffect(() => {
    if (!loadingCuentas && cuentas.length > 0 && !(gastoEditar && gastoEditar.estado === 'pagado')) {
      const cuentaMoneda = cuentas.find(c =>
        (c.esBiMoneda || c.moneda === formData.moneda) &&
        c.activa
      );
      if (cuentaMoneda) {
        setCuentaOrigenId(cuentaMoneda.id);
      }
    }
  }, [formData.moneda, loadingCuentas, cuentas, gastoEditar]);

  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaOrigenId);

  // Info de la categoría seleccionada
  const categoriaInfo = CATEGORIAS_GASTO[formData.categoria];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.warning('Debe iniciar sesión');
      return;
    }

    if (!formData.tipo.trim()) {
      toast.warning('Debe ingresar un tipo de gasto');
      return;
    }

    if (!formData.descripcion.trim()) {
      toast.warning('Debe ingresar una descripción');
      return;
    }

    if (formData.montoOriginal <= 0) {
      toast.warning('El monto debe ser mayor a 0');
      return;
    }

    if (formData.moneda === 'USD' && !formData.tipoCambio) {
      toast.warning('Debe especificar el tipo de cambio para gastos en USD');
      return;
    }

    // Validar que GV y GD tengan venta asociada
    if ((formData.categoria === 'GV' || formData.categoria === 'GD') && !ventaSeleccionada) {
      toast.warning('Los gastos de Venta y Distribución deben asociarse a una venta');
      return;
    }

    setLoading(true);

    try {
      const lineaSeleccionada = lineasActivas.find(l => l.id === lineaNegocioId);
      const gastoData = {
        ...formData,
        cuentaOrigenId: cuentaOrigenId || undefined,
        metodoPago: metodoPago || undefined,
        referenciaPago: referenciaPago || undefined,
        lineaNegocioId: lineaNegocioId || null,
        lineaNegocioNombre: lineaSeleccionada?.nombre || null
      };

      if (isEditing && gastoEditar) {
        await actualizarGasto(gastoEditar.id, gastoData, user.uid);
        toast.success('Gasto actualizado exitosamente');
      } else {
        await crearGasto(gastoData, user.uid);
        toast.success('Gasto registrado exitosamente');
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message, isEditing ? 'Error al actualizar gasto' : 'Error al crear gasto');
    } finally {
      setLoading(false);
    }
  };

  // ── S58b F5 — Combobox de entidades para vincular proveedor estructurado ──
  // S58c v2.1 fix · usa stores reales (no CC) para listar TODAS las entidades.
  // Combina proveedores + colaboradores + empleados (los gastos no van a clientes).
  const proveedoresEnt = useEntidadesPorTipo('proveedor');
  const colaboradoresEnt = useEntidadesPorTipo('colaborador');
  const empleadosEnt = useEntidadesPorTipo('empleado');

  // ── TAREA-PROVEEDOR-GASTOS F2 · Inline form modal-in-modal (D-INLINE-8) ──
  // Permite crear un proveedor sin abandonar el form de gasto · al guardar,
  // refresca la lista del Combobox y auto-selecciona el nuevo proveedor.
  const createProveedorStore = useProveedorStore((s) => s.createProveedor);
  const [showProveedorInline, setShowProveedorInline] = useState(false);
  const [loadingProveedorInline, setLoadingProveedorInline] = useState(false);

  // ── TAREA-GASTOFORM-V2 · Cascada Bloque > Categoria > Subcategoria ──
  // Modelo de 3 niveles aprobado en S40 (ACUERDOS_REINGENIERIA_2026-04-10).
  // Reemplaza el selector legacy de CategoriaGasto (GV/GD/GA/GO @deprecated)
  // con seleccion en cascada que persiste categoriaCostoId.
  const arbolCategorias = useCategoriaCostoStore((s) => s.arbol);
  const fetchArbolCategorias = useCategoriaCostoStore((s) => s.fetchArbol);
  const cargandoCategorias = useCategoriaCostoStore((s) => s.loading);

  useEffect(() => {
    fetchArbolCategorias();
  }, [fetchArbolCategorias]);

  // Derivar bloque inicial desde gastoEditar (si tiene categoriaCostoId, buscar en arbol;
  // si solo tiene categoria legacy, mapear: GA→producto · GD/GV→venta · GO→periodo)
  const deriveBloqueInicial = (): BloqueCosto | null => {
    if (gastoEditar?.categoriaCostoId && arbolCategorias) {
      // Buscar en cada bloque si la categoria pertenece
      for (const bloque of ['producto', 'venta', 'periodo'] as BloqueCosto[]) {
        const datos = arbolCategorias[bloque];
        if (!datos) continue;
        if (datos.padres.some((p) => p.id === gastoEditar.categoriaCostoId)) return bloque;
        for (const padreId of Object.keys(datos.hijos)) {
          if (datos.hijos[padreId].some((h) => h.id === gastoEditar.categoriaCostoId)) return bloque;
        }
      }
    }
    if (!gastoEditar?.categoria) return null;
    if (gastoEditar.categoria === 'GA') return 'producto';
    if (gastoEditar.categoria === 'GD' || gastoEditar.categoria === 'GV') return 'venta';
    return 'periodo'; // GO
  };

  const [bloqueSeleccionado, setBloqueSeleccionado] = useState<BloqueCosto | null>(null);
  const [categoriaPadreId, setCategoriaPadreId] = useState<string | null>(null);
  const [subcategoriaId, setSubcategoriaId] = useState<string | null>(null);

  // Inicializar la cascada cuando el arbol esta listo (importante para edicion)
  useEffect(() => {
    if (!arbolCategorias) return;
    if (bloqueSeleccionado !== null) return; // ya inicializado
    const bloqueInicial = deriveBloqueInicial();
    if (!bloqueInicial) return;
    setBloqueSeleccionado(bloqueInicial);

    if (gastoEditar?.categoriaCostoId) {
      const datos = arbolCategorias[bloqueInicial];
      // ¿es padre o hijo?
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

  // Handler · al elegir bloque, resetea niveles 2 y 3
  const handleSeleccionarBloque = (bloque: BloqueCosto) => {
    setBloqueSeleccionado(bloque);
    setCategoriaPadreId(null);
    setSubcategoriaId(null);
    // Auto-derivar categoria legacy del bloque (mantener compat hasta migracion total)
    const legacy: CategoriaGasto =
      bloque === 'producto' ? 'GA' : bloque === 'venta' ? 'GD' : 'GO';
    setFormData((prev) => ({ ...prev, categoria: legacy, categoriaCostoId: undefined }));
  };

  // Handler · al elegir categoria padre, resetea subcategoria y persiste categoriaCostoId
  const handleSeleccionarCategoriaPadre = (padreId: string) => {
    setCategoriaPadreId(padreId);
    setSubcategoriaId(null);
    setFormData((prev) => ({ ...prev, categoriaCostoId: padreId }));
  };

  // Handler · al elegir subcategoria, persiste su id como categoriaCostoId
  const handleSeleccionarSubcategoria = (subId: string) => {
    setSubcategoriaId(subId);
    setFormData((prev) => ({ ...prev, categoriaCostoId: subId }));
  };

  // Datos derivados del arbol para los selectores
  const categoriasPadreDelBloque = bloqueSeleccionado && arbolCategorias
    ? arbolCategorias[bloqueSeleccionado]?.padres ?? []
    : [];
  const subcategoriasDelPadre = bloqueSeleccionado && categoriaPadreId && arbolCategorias
    ? arbolCategorias[bloqueSeleccionado]?.hijos?.[categoriaPadreId] ?? []
    : [];

  // ── F3 · Inline create de categoria/subcategoria (D-INLINE-8) ──
  const crearCategoriaStore = useCategoriaCostoStore((s) => s.crearCategoria);
  const [showCategoriaInline, setShowCategoriaInline] = useState<null | 'padre' | 'subcategoria'>(null);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('');
  const [loadingCategoriaInline, setLoadingCategoriaInline] = useState(false);

  const handleCrearCategoriaInline = async () => {
    if (!user?.uid) {
      toast.error('No se pudo identificar al usuario');
      return;
    }
    if (!bloqueSeleccionado) {
      toast.warning('Selecciona primero el bloque');
      return;
    }
    if (!nuevaCategoriaNombre.trim()) {
      toast.warning('Ingresa el nombre de la categoria');
      return;
    }
    if (showCategoriaInline === 'subcategoria' && !categoriaPadreId) {
      toast.warning('Selecciona primero la categoria padre');
      return;
    }
    try {
      setLoadingCategoriaInline(true);
      const nivel = showCategoriaInline === 'subcategoria' ? 1 : 0;
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
      // Auto-seleccionar la nueva
      if (showCategoriaInline === 'padre') {
        handleSeleccionarCategoriaPadre(newId);
      } else {
        handleSeleccionarSubcategoria(newId);
      }
      // El store ya refresca el arbol (linea 52 del store)
      void nivel; // referenciado para futuros usos (no afecta runtime)
      toast.success(`Categoria "${nuevaCategoriaNombre.trim()}" creada y seleccionada`);
      setShowCategoriaInline(null);
      setNuevaCategoriaNombre('');
    } catch (e) {
      console.error('Error creando categoria inline', e);
      toast.error('No se pudo crear la categoria');
    } finally {
      setLoadingCategoriaInline(false);
    }
  };

  // ── F3 · KPIs del proveedor seleccionado (mini-card debajo del Combobox) ──
  const proveedorKpis = useMemo(() => {
    if (!formData.proveedorId) return null;
    const ahora = new Date();
    const inicio12m = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);
    const gastosDelProveedor = gastos.filter((g) => g.proveedorId === formData.proveedorId);
    const ultimos12m = gastosDelProveedor.filter((g) => {
      const f = g.fecha?.toDate?.() ?? new Date(g.fecha as any);
      return f >= inicio12m;
    });
    const total12m = ultimos12m.reduce((acc, g) => acc + (g.montoPEN || 0), 0);
    const promedio = ultimos12m.length > 0 ? total12m / ultimos12m.length : 0;
    // Próximo vencimiento (pendientes con fecha futura)
    const pendientes = gastosDelProveedor
      .filter((g) => g.estado === 'pendiente' || g.estado === 'parcial')
      .map((g) => ({ g, fecha: g.fecha?.toDate?.() ?? new Date(g.fecha as any) }))
      .filter(({ fecha }) => !isNaN(fecha.getTime()))
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const proximo = pendientes[0];
    return {
      cantidad12m: ultimos12m.length,
      total12m,
      promedio,
      cantidadTotal: gastosDelProveedor.length,
      proximo,
    };
  }, [formData.proveedorId, gastos]);

  const handleCrearProveedorInline = async (data: ProveedorFormData) => {
    if (!user?.uid) {
      toast.error('No se pudo identificar al usuario');
      return;
    }
    try {
      setLoadingProveedorInline(true);
      const newId = await createProveedorStore(data, user.uid);
      // El store ya refresca proveedoresActivos · auto-seleccionamos el nuevo
      setFormData((prev) => ({
        ...prev,
        proveedorId: newId,
        proveedorTipo: 'proveedor',
        proveedorNombre: data.nombre,
        proveedor: prev.proveedor || data.nombre,
      }));
      toast.success(`Proveedor "${data.nombre}" creado y vinculado`);
      setShowProveedorInline(false);
    } catch (e) {
      console.error('Error creando proveedor inline', e);
      toast.error('No se pudo crear el proveedor');
    } finally {
      setLoadingProveedorInline(false);
    }
  };
  const entidadesLoading =
    proveedoresEnt.loading || colaboradoresEnt.loading || empleadosEnt.loading;
  const totalEntidades =
    proveedoresEnt.activas.length +
    colaboradoresEnt.activas.length +
    empleadosEnt.activas.length;

  const proveedorComboboxValue = formData.proveedorId
    ? `${formData.proveedorTipo}_${formData.proveedorId}`
    : undefined;

  const handleSeleccionarEntidad = (compositeKey: string) => {
    if (!compositeKey) {
      // Limpiar vinculación
      setFormData((prev) => ({
        ...prev,
        proveedorId: undefined,
        proveedorTipo: undefined,
        proveedorNombre: undefined,
      }));
      return;
    }
    // Parsear "tipo_entidadId"
    const idx = compositeKey.indexOf('_');
    if (idx < 0) return;
    const tipo = compositeKey.slice(0, idx) as
      | 'proveedor'
      | 'colaborador'
      | 'empleado';
    const entidadId = compositeKey.slice(idx + 1);
    const fuente =
      tipo === 'proveedor'
        ? proveedoresEnt.activas
        : tipo === 'colaborador'
          ? colaboradoresEnt.activas
          : empleadosEnt.activas;
    const e = fuente.find((x) => x.id === entidadId);
    if (!e) return;
    setFormData((prev) => ({
      ...prev,
      proveedorId: e.id,
      proveedorTipo: tipo,
      proveedorNombre: e.nombre,
      // Auto-llenar el texto libre con el nombre de la entidad
      proveedor: prev.proveedor || e.nombre,
    }));
  };

  const handleChange = (field: keyof GastoFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Si cambia la categoría, actualizar impactaCTRU según la configuración por defecto
    if (field === 'categoria') {
      const catInfo = CATEGORIAS_GASTO[value as CategoriaGasto];
      setFormData(prev => ({
        ...prev,
        categoria: value,
        esProrrateable: catInfo.impactaCTRU,
        impactaCTRU: catInfo.impactaCTRU,
        tipo: 'otros' // Resetear tipo al cambiar categoría
      }));
    }

    // Ajustar impactaCTRU automáticamente si esProrrateable cambia
    if (field === 'esProrrateable') {
      setFormData(prev => ({
        ...prev,
        impactaCTRU: value
      }));
    }
  };

  // Colores según categoría
  const getCategoriaColor = (cat: CategoriaGasto) => {
    const colors: Record<CategoriaGasto, string> = {
      GV: 'bg-purple-50 border-purple-200 text-purple-800',
      GD: 'bg-sky-50 border-sky-200 text-sky-800',
      GA: 'bg-amber-50 border-amber-200 text-amber-800',
      GO: 'bg-emerald-50 border-emerald-200 text-emerald-800'
    };
    return colors[cat];
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Editar Gasto' : 'Nuevo Gasto'}
      size="xl"
      contentPadding="none"
    >

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Banner informativo para gastos pagados */}
          {isEditing && gastoEditar?.estado === 'pagado' && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>Este gasto está pagado. Cambiar el monto, cuenta o método actualizará el movimiento en tesorería. Cambiar a "Pendiente" anulará el movimiento.</span>
            </div>
          )}

          {/* Sección 1: Categorización (TAREA-GASTOFORM-V2 · cascada 3 niveles) · canon mockup gastoform-v2-3-niveles-s58f.html · chk5.A2 */}
          <div className="space-y-5">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Categorización del Gasto</h3>

            {/* ════════════════════════════════════════════════════════
                NIVEL 1 · Selector de Bloque (paso 1 de 3)
                ════════════════════════════════════════════════════════ */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                <label className="text-sm font-bold uppercase tracking-wider text-slate-700">Tipo de gasto · Bloque</label>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">paso 1 de 3</span>
              </div>
              <p className="text-xs text-slate-500 mb-3 ml-9">¿A qué caja de costos pertenece? Define si afecta CTRU o margen.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 ml-9">
                {/* Producto */}
                <button
                  type="button"
                  onClick={() => handleSeleccionarBloque('producto')}
                  className={`rounded-2xl overflow-hidden text-left transition-all relative ${
                    bloqueSeleccionado === 'producto'
                      ? 'ring-2 ring-blue-500 ring-offset-2'
                      : 'ring-1 ring-blue-200 hover:ring-blue-400'
                  }`}
                >
                  {bloqueSeleccionado === 'producto' && (
                    <span className="absolute top-2 right-2 bg-white text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-blue-300 z-10">✓ SELECCIONADO</span>
                  )}
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-3">
                    <div className="text-2xl mb-1">📦</div>
                    <div className="text-base font-bold">Producto</div>
                  </div>
                  <div className="bg-blue-50 p-3">
                    <div className="text-xs text-blue-900 mb-1">Costos directos de traer producto</div>
                    <div className="text-[10px] text-blue-600 italic">→ flete · aranceles · seguros</div>
                    <div className="mt-2 text-[10px] text-blue-700 font-semibold">⓵ Impacta CTRU</div>
                  </div>
                </button>

                {/* Venta */}
                <button
                  type="button"
                  onClick={() => handleSeleccionarBloque('venta')}
                  className={`rounded-2xl overflow-hidden text-left transition-all relative ${
                    bloqueSeleccionado === 'venta'
                      ? 'ring-2 ring-purple-500 ring-offset-2'
                      : 'ring-1 ring-purple-200 hover:ring-purple-400'
                  }`}
                >
                  {bloqueSeleccionado === 'venta' && (
                    <span className="absolute top-2 right-2 bg-white text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-purple-300 z-10">✓ SELECCIONADO</span>
                  )}
                  <div className="bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white p-3">
                    <div className="text-2xl mb-1">🛒</div>
                    <div className="text-base font-bold">Venta</div>
                  </div>
                  <div className="bg-purple-50 p-3">
                    <div className="text-xs text-purple-900 mb-1">Costos directos por cada venta</div>
                    <div className="text-[10px] text-purple-600 italic">→ comisión ML · delivery · empaque</div>
                    <div className="mt-2 text-[10px] text-purple-700 font-semibold">⓵ Resta margen contribución</div>
                  </div>
                </button>

                {/* Período */}
                <button
                  type="button"
                  onClick={() => handleSeleccionarBloque('periodo')}
                  className={`rounded-2xl overflow-hidden text-left transition-all relative ${
                    bloqueSeleccionado === 'periodo'
                      ? 'ring-2 ring-amber-500 ring-offset-2'
                      : 'ring-1 ring-amber-200 hover:ring-amber-400'
                  }`}
                >
                  {bloqueSeleccionado === 'periodo' && (
                    <span className="absolute top-2 right-2 bg-white text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-amber-300 z-10">✓ SELECCIONADO</span>
                  )}
                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-3">
                    <div className="text-2xl mb-1">📅</div>
                    <div className="text-base font-bold">Período</div>
                  </div>
                  <div className="bg-amber-50 p-3">
                    <div className="text-xs text-amber-900 mb-1">Gastos fijos del mes</div>
                    <div className="text-[10px] text-amber-600 italic">→ planilla · alquiler · servicios</div>
                    <div className="mt-2 text-[10px] text-amber-700 font-semibold">⓵ Resta margen operativo</div>
                  </div>
                </button>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                NIVEL 2 · Categoría padre (paso 2 de 3 · filtrada por bloque)
                ════════════════════════════════════════════════════════ */}
            {bloqueSeleccionado && (
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-700">Categoría padre</label>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">paso 2 de 3</span>
                  <span className="text-[11px] text-slate-500">filtrado por bloque "{bloqueSeleccionado === 'producto' ? 'Producto' : bloqueSeleccionado === 'venta' ? 'Venta' : 'Período'}"</span>
                  {cargandoCategorias && <span className="text-[11px] text-slate-400 italic">cargando...</span>}
                </div>
                <p className="text-xs text-slate-500 mb-3 ml-9">{categoriasPadreDelBloque.length} categorías disponibles · seleccionar una.</p>
                {categoriasPadreDelBloque.length === 0 && !cargandoCategorias ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 ml-9">
                    ⚠ No hay categorías cargadas en el bloque "{bloqueSeleccionado}". Si recién instalaste el sistema, ejecuta el seed:
                    <code className="block bg-white px-2 py-1 rounded mt-1 font-mono text-[10px]">node scripts/reingenieria/03-seed-categorias-costos.mjs --execute</code>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-9">
                    {categoriasPadreDelBloque.map((padre) => {
                      const isSelected = categoriaPadreId === padre.id;
                      const numHijos = arbolCategorias?.[bloqueSeleccionado]?.hijos?.[padre.id]?.length ?? 0;
                      const icono = (padre as any).icono;
                      return (
                        <button
                          key={padre.id}
                          type="button"
                          onClick={() => handleSeleccionarCategoriaPadre(padre.id)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
                              : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-sm'
                          }`}
                        >
                          {icono && <div className="text-base mb-1">{icono}</div>}
                          <div className={`text-xs font-bold ${isSelected ? 'text-amber-900' : 'text-slate-900'}`}>{padre.nombre}</div>
                          {numHijos > 0 && (
                            <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
                              {numHijos} sub{isSelected ? ' · seleccionado' : ''}
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {/* F3 · Inline create categoria padre */}
                    <button
                      type="button"
                      onClick={() => {
                        setNuevaCategoriaNombre('');
                        setShowCategoriaInline('padre');
                      }}
                      className="p-3 rounded-xl border-2 border-dashed border-pink-300 text-left transition-all hover:border-pink-500 hover:bg-pink-50"
                      title="Crear nueva categoria padre · D-INLINE-8"
                    >
                      <div className="text-base mb-1">+</div>
                      <div className="text-xs font-bold text-pink-700">Nueva categoría</div>
                      <div className="text-[10px] text-pink-500 mt-0.5">inline desde Maestros</div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                NIVEL 3 · Subcategoría (paso 3 de 3 · opcional · filtrada por padre)
                ════════════════════════════════════════════════════════ */}
            {bloqueSeleccionado && categoriaPadreId && subcategoriasDelPadre.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-700">Subcategoría · opcional</label>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">paso 3 de 3</span>
                  <span className="text-[11px] text-slate-500">filtrado por categoría "{categoriasPadreDelBloque.find(p => p.id === categoriaPadreId)?.nombre}"</span>
                </div>
                <p className="text-xs text-slate-500 mb-3 ml-9">{subcategoriasDelPadre.length} subcategorías disponibles · puedes elegir una o dejar solo la categoría padre.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-9">
                  {subcategoriasDelPadre.map((hijo) => {
                    const isSelected = subcategoriaId === hijo.id;
                    const icono = (hijo as any).icono;
                    return (
                      <button
                        key={hijo.id}
                        type="button"
                        onClick={() => handleSeleccionarSubcategoria(hijo.id)}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
                            : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-sm'
                        }`}
                      >
                        <div className={`text-[11px] font-bold ${isSelected ? 'text-amber-900' : 'text-slate-900'}`}>
                          {icono ? `${icono} ` : ''}{hijo.nombre}
                        </div>
                        {isSelected && <div className="text-[10px] text-amber-700 font-semibold mt-0.5">seleccionado</div>}
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
                      className="p-2.5 rounded-xl border-2 border-dashed border-slate-300 text-[11px] text-slate-500 hover:border-slate-400"
                    >
                      ✕ Sin subcategoría
                    </button>
                  )}
                  {/* F3 · Inline create subcategoria */}
                  <button
                    type="button"
                    onClick={() => {
                      setNuevaCategoriaNombre('');
                      setShowCategoriaInline('subcategoria');
                    }}
                    className="p-2.5 rounded-xl border-2 border-dashed border-pink-300 text-[11px] text-pink-700 font-bold hover:border-pink-500 hover:bg-pink-50"
                    title="Crear nueva subcategoria · D-INLINE-8"
                  >
                    + Nueva sub
                  </button>
                </div>
              </div>
            )}

            {/* Permitir crear subcategoria aunque la categoria padre no tenga ninguna */}
            {bloqueSeleccionado && categoriaPadreId && subcategoriasDelPadre.length === 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-700">Subcategoría · opcional</label>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">paso 3 de 3</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNuevaCategoriaNombre('');
                    setShowCategoriaInline('subcategoria');
                  }}
                  className="ml-9 px-4 py-2 rounded-xl border-2 border-dashed border-pink-300 text-xs text-pink-700 font-semibold hover:border-pink-500 hover:bg-pink-50"
                >
                  + Crear primera subcategoría de "{categoriasPadreDelBloque.find(p => p.id === categoriaPadreId)?.nombre}"
                </button>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                BANNER SÍNTESIS · categorización completa + impacto contable
                ════════════════════════════════════════════════════════ */}
            {bloqueSeleccionado && categoriaPadreId && (() => {
              const blockBgGrad = bloqueSeleccionado === 'producto' ? 'from-blue-50 to-indigo-50 border-blue-300'
                : bloqueSeleccionado === 'venta' ? 'from-purple-50 to-fuchsia-50 border-purple-300'
                : 'from-amber-50 to-orange-50 border-amber-300';
              const blockTextColor = bloqueSeleccionado === 'producto' ? 'text-blue-700'
                : bloqueSeleccionado === 'venta' ? 'text-purple-700'
                : 'text-amber-700';
              const blockTitleColor = bloqueSeleccionado === 'producto' ? 'text-blue-900'
                : bloqueSeleccionado === 'venta' ? 'text-purple-900'
                : 'text-amber-900';
              const pillGrad = bloqueSeleccionado === 'producto' ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                : bloqueSeleccionado === 'venta' ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600'
                : 'bg-gradient-to-br from-amber-500 to-orange-600';
              const pillEmoji = bloqueSeleccionado === 'producto' ? '📦 Producto'
                : bloqueSeleccionado === 'venta' ? '🛒 Venta'
                : '📅 Período';
              const impactoLabel = bloqueSeleccionado === 'producto' ? 'Prorratea a unidades · CTRU'
                : bloqueSeleccionado === 'venta' ? 'Resta margen contribución'
                : 'Resta margen operativo';
              const padre = categoriasPadreDelBloque.find(p => p.id === categoriaPadreId);
              const hijo = subcategoriaId ? subcategoriasDelPadre.find(s => s.id === subcategoriaId) : null;
              const padreIcono = padre ? (padre as any).icono : '';
              const hijoIcono = hijo ? (hijo as any).icono : '';

              return (
                <div className={`bg-gradient-to-r ${blockBgGrad} border rounded-xl p-4`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${blockTextColor}`}>
                        Categorización completa
                      </div>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className={`${pillGrad} text-white px-2.5 py-1 rounded-full text-xs font-bold`}>
                          {pillEmoji}
                        </span>
                        <span className="text-slate-400">›</span>
                        <span className={`font-bold ${blockTitleColor}`}>
                          {padreIcono ? `${padreIcono} ` : ''}{padre?.nombre}
                        </span>
                        {hijo && (
                          <>
                            <span className="text-slate-400">›</span>
                            <span className={`font-bold ${blockTitleColor}`}>
                              {hijoIcono ? `${hijoIcono} ` : ''}{hijo.nombre}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] uppercase text-slate-500 font-semibold">Impacto contable</div>
                      <div className={`text-sm font-bold ${blockTextColor}`}>{impactoLabel}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Sección: Línea de Negocio */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Línea de Negocio</h3>
            <div>
              <select
                value={lineaNegocioId || ''}
                onChange={(e) => setLineaNegocioId(e.target.value || null)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Compartido (todas las líneas)</option>
                {lineasActivas.map((linea) => (
                  <option key={linea.id} value={linea.id}>
                    {linea.nombre}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Dejar como "Compartido" para gastos que aplican a todas las líneas de negocio
              </p>
            </div>
          </div>

          {/* Sección 2: Asociar a Venta (solo para GV y GD) */}
          {(formData.categoria === 'GV' || formData.categoria === 'GD') && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Link className="h-5 w-5" />
                Asociar a Venta
              </h3>

              {ventaSeleccionada ? (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-purple-900">
                        {ventaSeleccionada.numeroVenta}
                      </div>
                      <div className="text-sm text-purple-700">
                        {ventaSeleccionada.nombreCliente || 'Sin cliente'}
                      </div>
                      <div className="text-xs text-purple-600 mt-1">
                        Total: S/ {ventaSeleccionada.totalPEN?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVentaSeleccionada(null);
                        handleChange('ventaId', undefined);
                      }}
                    >
                      Cambiar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={busquedaVenta}
                      onChange={(e) => setBusquedaVenta(e.target.value)}
                      placeholder="Buscar por número de venta o cliente..."
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  {loadingVentas ? (
                    <div className="text-sm text-slate-500 text-center py-4">
                      Cargando ventas...
                    </div>
                  ) : ventasFiltradas.length === 0 ? (
                    <div className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-lg">
                      No se encontraron ventas recientes
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y">
                      {ventasFiltradas.map((venta) => (
                        <button
                          key={venta.id}
                          type="button"
                          onClick={() => {
                            setVentaSeleccionada(venta);
                            handleChange('ventaId', venta.id);
                            setBusquedaVenta('');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium text-slate-900">{venta.numeroVenta}</div>
                            <div className="text-sm text-slate-500">
                              {venta.nombreCliente || 'Sin cliente'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-slate-900">
                              S/ {venta.totalPEN?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {venta.fechaCreacion?.toDate?.()?.toLocaleDateString('es-PE') || ''}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Los gastos GV/GD deben asociarse a una venta para trazabilidad
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sección 3: Tipo y Descripción */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Detalle del Gasto</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <AutocompleteInput
                label="Tipo de Gasto"
                value={formData.tipo}
                onChange={(value) => handleChange('tipo', value)}
                suggestions={sugerenciasActuales}
                placeholder="Escribe o selecciona..."
                allowCreate={true}
                createLabel="Crear"
                required
              />

              <Input
                label="Descripción"
                type="text"
                required
                value={formData.descripcion}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                placeholder="Detalle específico del gasto"
              />
            </div>
          </div>

          {/* Sección 3: Monto y Moneda */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
              Monto del Gasto
            </h3>

            {/* Selector de Moneda Visual */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Moneda *</label>
              <div className="flex gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('moneda', 'PEN')}
                  className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg border-2 text-sm sm:text-base font-medium transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                    formData.moneda === 'PEN'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="sm:hidden">S/ PEN</span>
                  <span className="hidden sm:inline">S/ Soles (PEN)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('moneda', 'USD')}
                  className={`flex-1 py-2 sm:py-3 px-3 sm:px-4 rounded-lg border-2 text-sm sm:text-base font-medium transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                    formData.moneda === 'USD'
                      ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-200'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="sm:hidden">$ USD</span>
                  <span className="hidden sm:inline">$ Dólares (USD)</span>
                </button>
              </div>
            </div>

            {/* Monto y Tipo de Cambio */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label htmlFor="gasto-monto" className="block text-sm font-medium text-slate-700 mb-1">
                  Monto {formData.moneda === 'USD' ? '($)' : '(S/)'} *
                </label>
                <input
                  id="gasto-monto"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.montoOriginal || ''}
                  onChange={(e) => handleChange('montoOriginal', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-lg font-medium"
                />
              </div>
              <div>
                <label htmlFor="gasto-tipocambio" className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de Cambio *
                </label>
                <input
                  id="gasto-tipocambio"
                  type="number"
                  required
                  min="0"
                  step="0.001"
                  value={formData.tipoCambio || ''}
                  onChange={(e) => handleChange('tipoCambio', parseFloat(e.target.value) || 0)}
                  placeholder="3.700"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="text-xs text-slate-500 mt-1">TC del día para equivalencias</p>
              </div>
            </div>

            {/* Preview de equivalencias */}
            {formData.montoOriginal > 0 && (formData.tipoCambio ?? 0) > 0 && (
              <div className="bg-emerald-50 p-3 sm:p-4 rounded-lg border border-slate-200">
                <div className="text-xs sm:text-sm font-medium text-slate-700 mb-2">Equivalencias:</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div className={`p-2 sm:p-3 rounded-lg ${formData.moneda === 'PEN' ? 'bg-emerald-100 ring-2 ring-emerald-300' : 'bg-white'}`}>
                    <div className="text-[10px] sm:text-xs text-slate-500">En Soles</div>
                    <div className="text-sm sm:text-lg font-bold text-emerald-700">
                      S/ {formData.moneda === 'PEN'
                        ? formData.montoOriginal.toFixed(2)
                        : (formData.montoOriginal * (formData.tipoCambio ?? 1)).toFixed(2)}
                    </div>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-lg ${formData.moneda === 'USD' ? 'bg-sky-100 ring-2 ring-sky-300' : 'bg-white'}`}>
                    <div className="text-[10px] sm:text-xs text-slate-500">En Dólares</div>
                    <div className="text-sm sm:text-lg font-bold text-sky-700">
                      $ {formData.moneda === 'USD'
                        ? formData.montoOriginal.toFixed(2)
                        : (formData.montoOriginal / (formData.tipoCambio ?? 1)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sección 4: CTRU y Prorrateo - Solo para GA y GO */}
          {(formData.categoria === 'GA' || formData.categoria === 'GO') && (
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">Impacto en CTRU</h3>

              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.esProrrateable}
                    onChange={(e) => handleChange('esProrrateable', e.target.checked)}
                    className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Gasto Prorrateable
                    </div>
                    <div className="text-xs text-slate-500">
                      Este gasto se distribuirá entre todas las unidades disponibles y afectará el CTRU dinámico
                    </div>
                  </div>
                </label>

                {formData.esProrrateable && (
                  <Select
                    label="Tipo de Prorrateo"
                    value={formData.prorrateoTipo}
                    onChange={(e) => handleChange('prorrateoTipo', e.target.value)}
                    options={[
                      { value: 'unidad', label: 'Por Unidad (todas las unidades disponibles)' },
                      { value: 'oc', label: 'Por Orden de Compra' },
                      { value: 'manual', label: 'Manual' }
                    ]}
                  />
                )}
              </div>
            </div>
          )}

          {/* Info para GV y GD */}
          {(formData.categoria === 'GV' || formData.categoria === 'GD') && (
            <div className="bg-slate-50 p-4 rounded-lg border">
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Nota:</span> Los gastos de Venta y Distribución no afectan el CTRU.
                  Se descuentan directamente de la utilidad de cada venta cuando se asocian desde el módulo de Ventas.
                </div>
              </div>
            </div>
          )}

          {/* Sección 5: Estado y Fecha */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              Estado y Fecha
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label htmlFor="gasto-fecha" className="block text-sm font-medium text-slate-700 mb-1">Fecha del Gasto *</label>
                <input
                  id="gasto-fecha"
                  type="date"
                  required
                  value={formData.fecha.toISOString().split('T')[0]}
                  onChange={(e) => handleChange('fecha', new Date(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('estado', 'pendiente')}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.estado === 'pendiente'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Pendiente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('estado', 'pagado')}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      formData.estado === 'pagado'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Pagado
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sección 6: Información de Pago - Solo si está pagado */}
          {formData.estado === 'pagado' && (
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 overflow-hidden">
              {pagoConfirmado ? (
                <div className="p-4 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <div>
                    <div className="font-medium text-emerald-800">Pago configurado</div>
                    <div className="text-sm text-emerald-600">
                      {metodoPago} — {formData.moneda === 'USD' ? '$' : 'S/'} {formData.montoOriginal.toFixed(2)}
                    </div>
                  </div>
                  <button type="button" onClick={() => setPagoConfirmado(false)}
                    className="ml-auto text-xs text-emerald-600 underline">Modificar</button>
                </div>
              ) : (
                <div className="p-4">
                  <PagoUnificadoForm
                    origen="gasto"
                    titulo="Pago del gasto"
                    montoTotal={formData.montoOriginal}
                    montoPendiente={formData.montoOriginal}
                    monedaOriginal={formData.moneda as 'PEN' | 'USD'}
                    tcDocumento={formData.tipoCambio}
                    onSubmit={(datos: PagoUnificadoResult) => {
                      setMetodoPago(datos.metodoPago as MetodoTesoreria);
                      setCuentaOrigenId(datos.cuentaOrigenId);
                      setReferenciaPago(datos.referencia || '');
                      if (datos.tipoCambio > 0) {
                        setTipoCambio(datos.tipoCambio);
                        setFormData(prev => ({ ...prev, tipoCambio: datos.tipoCambio }));
                      }
                      setPagoConfirmado(true);
                    }}
                    onCancel={() => {
                      // Cambiar estado a pendiente si cancela el pago
                      setFormData(prev => ({ ...prev, estado: 'pendiente' }));
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Sección 7: Información Adicional */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Información Adicional</h3>

            {/* S58b F5 — Vincular a CC + texto libre */}
            <div className="space-y-3">
              <Combobox<string>
                label="Vincular a entidad (opcional · habilita CC)"
                value={proveedorComboboxValue}
                onChange={handleSeleccionarEntidad}
                groups={[
                  ...(proveedoresEnt.activas.length > 0
                    ? [
                        {
                          label: `Proveedores · ${proveedoresEnt.activas.length}`,
                          options: proveedoresEnt.activas.map((e) => ({
                            value: `proveedor_${e.id}`,
                            label: e.nombre,
                            subLabel: e.subLabel,
                          })),
                        },
                      ]
                    : []),
                  ...(colaboradoresEnt.activas.length > 0
                    ? [
                        {
                          label: `Colaboradores · ${colaboradoresEnt.activas.length}`,
                          options: colaboradoresEnt.activas.map((e) => ({
                            value: `colaborador_${e.id}`,
                            label: e.nombre,
                            subLabel: e.subLabel,
                          })),
                        },
                      ]
                    : []),
                  ...(empleadosEnt.activas.length > 0
                    ? [
                        {
                          label: `Empleados · ${empleadosEnt.activas.length}`,
                          options: empleadosEnt.activas.map((e) => ({
                            value: `empleado_${e.id}`,
                            label: e.nombre,
                            subLabel: e.subLabel,
                          })),
                        },
                      ]
                    : []),
                ]}
                placeholder={
                  entidadesLoading
                    ? 'Cargando...'
                    : totalEntidades === 0
                      ? 'No hay entidades activas registradas'
                      : 'Sin vínculo (legacy)'
                }
                hint={
                  formData.proveedorId
                    ? '✓ Pagos de este gasto crearán movimientos en CC del proveedor'
                    : 'Sin vínculo: el gasto no afectará el saldo CC del proveedor (modo legacy)'
                }
                emptyMessage="No hay entidades activas"
              />

              {/* TAREA-PROVEEDOR-GASTOS F3 · Mini-card del proveedor con KPIs */}
              {formData.proveedorId && proveedorKpis && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                      {(formData.proveedorNombre || formData.proveedor || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-blue-900 truncate">
                        {formData.proveedorNombre || formData.proveedor}
                      </div>
                      <div className="text-[10px] text-blue-700 uppercase tracking-wider font-semibold">
                        Proveedor vinculado · {formData.proveedorTipo}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white rounded-lg p-2">
                      <div className="text-[10px] uppercase text-slate-500 font-bold">Gastos 12m</div>
                      <div className="text-base font-bold tabular-nums text-blue-900">{proveedorKpis.cantidad12m}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <div className="text-[10px] uppercase text-slate-500 font-bold">Total 12m</div>
                      <div className="text-base font-bold tabular-nums text-blue-900">
                        {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(proveedorKpis.total12m)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <div className="text-[10px] uppercase text-slate-500 font-bold">Promedio</div>
                      <div className="text-base font-bold tabular-nums text-blue-900">
                        {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(proveedorKpis.promedio)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <div className="text-[10px] uppercase text-slate-500 font-bold">Próximo</div>
                      {proveedorKpis.proximo ? (
                        <div className="text-xs font-bold text-amber-700 tabular-nums">
                          {(() => {
                            const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                            const f = proveedorKpis.proximo.fecha;
                            return `${f.getDate()} ${meses[f.getMonth()]}`;
                          })()}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">—</div>
                      )}
                    </div>
                  </div>
                  {proveedorKpis.cantidadTotal > 0 && (
                    <div className="mt-2 text-[10px] text-blue-700 italic">
                      Histórico total: {proveedorKpis.cantidadTotal} gastos vinculados a este proveedor
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                {formData.proveedorId && (
                  <button
                    type="button"
                    onClick={() => handleSeleccionarEntidad('')}
                    className="text-[11px] text-slate-500 hover:text-slate-700 underline"
                  >
                    Quitar vínculo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowProveedorInline(true)}
                  className="text-[11px] text-pink-600 hover:text-pink-800 font-semibold inline-flex items-center gap-1"
                  title="Crear un proveedor nuevo sin abandonar este gasto · TAREA-PROVEEDOR-GASTOS"
                >
                  + Nuevo proveedor
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Input
                  label="Proveedor / descripción libre (Opcional)"
                  type="text"
                  value={formData.proveedor || ''}
                  onChange={(e) => handleChange('proveedor', e.target.value)}
                  placeholder="Nombre del proveedor"
                />

                <Input
                  label="Nº Comprobante (Opcional)"
                  type="text"
                  value={formData.numeroComprobante || ''}
                  onChange={(e) => handleChange('numeroComprobante', e.target.value)}
                  placeholder="Factura, boleta, etc."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="gasto-notas" className="block text-sm font-medium text-slate-700">
                Notas (Opcional)
              </label>
              <textarea
                id="gasto-notas"
                value={formData.notas || ''}
                onChange={(e) => handleChange('notas', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Observaciones adicionales..."
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Guardando...' : isEditing ? 'Actualizar Gasto' : 'Guardar Gasto'}
            </Button>
          </div>
        </form>

        {/* F3 · Modal inline crear categoria/subcategoria · D-INLINE-8 */}
        {showCategoriaInline && (
          <Modal
            isOpen={true}
            onClose={() => {
              setShowCategoriaInline(null);
              setNuevaCategoriaNombre('');
            }}
            title={showCategoriaInline === 'padre' ? 'Nueva categoría padre' : 'Nueva subcategoría'}
            size="md"
          >
            <div className="space-y-4">
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-xs text-pink-900">
                <strong>💡 Crear sin abandonar el gasto.</strong>{' '}
                {showCategoriaInline === 'padre'
                  ? `La nueva categoría se agregará al bloque "${bloqueSeleccionado}" y quedará disponible inmediatamente.`
                  : `La nueva subcategoría se agregará dentro de "${categoriasPadreDelBloque.find(p => p.id === categoriaPadreId)?.nombre}".`}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Contexto</div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                    bloqueSeleccionado === 'producto' ? 'bg-blue-100 text-blue-800'
                    : bloqueSeleccionado === 'venta' ? 'bg-purple-100 text-purple-800'
                    : 'bg-amber-100 text-amber-800'
                  }`}>
                    {bloqueSeleccionado === 'producto' ? '📦 Producto'
                      : bloqueSeleccionado === 'venta' ? '🛒 Venta'
                      : '📅 Período'}
                  </span>
                  {showCategoriaInline === 'subcategoria' && categoriaPadreId && (
                    <>
                      <span className="text-slate-300">›</span>
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
                placeholder={
                  showCategoriaInline === 'padre'
                    ? bloqueSeleccionado === 'producto' ? 'Ej. Inspecciones, Certificados...'
                    : bloqueSeleccionado === 'venta' ? 'Ej. Garantías, Postventa...'
                    : 'Ej. Capacitación, Eventos...'
                    : `Ej. ${bloqueSeleccionado === 'periodo' ? 'Streaming, Cursos online' : 'Variante específica'}`
                }
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCategoriaInline(null);
                    setNuevaCategoriaNombre('');
                  }}
                  disabled={loadingCategoriaInline}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCrearCategoriaInline}
                  disabled={loadingCategoriaInline || !nuevaCategoriaNombre.trim()}
                >
                  {loadingCategoriaInline ? 'Creando...' : 'Crear y seleccionar'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* TAREA-PROVEEDOR-GASTOS F2 · Modal inline · D-INLINE-8 */}
        {showProveedorInline && (
          <Modal
            isOpen={true}
            onClose={() => setShowProveedorInline(false)}
            title="Nuevo proveedor"
            size="lg"
          >
            <div className="space-y-3">
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-xs text-pink-900">
                <strong>💡 Crear proveedor sin abandonar el gasto.</strong>{' '}
                Al guardar, el proveedor se vincula automáticamente al gasto en
                curso · queda disponible para todos los gastos futuros.
              </div>
              <ProveedorForm
                onSubmit={handleCrearProveedorInline}
                onCancel={() => setShowProveedorInline(false)}
                loading={loadingProveedorInline}
              />
            </div>
          </Modal>
        )}
    </Modal>
  );
};
