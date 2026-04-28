/**
 * useEntidadesPorTipo — S58c v2.1 fix
 *
 * Hook unificado para listar entidades del sistema según TipoEntidadCC.
 * Reemplaza el patrón anterior de usar `cuentaCorrienteService.getAll({tipo})`
 * que solo retornaba entidades con CC ya creada (es decir, con movimientos
 * previos). Esto causaba que clientes/empleados nuevos no apareciesen en
 * los selectors de "vincular a entidad" en wizards y forms.
 *
 * Ahora lee de los stores reales por tipo:
 *   - proveedor   → useProveedorStore
 *   - cliente     → useClienteStore
 *   - colaborador → useColaboradorStore
 *   - empleado    → usePlanillaStore (EmpleadoConPerfil)
 *
 * Devuelve una lista normalizada `EntidadOption` que cualquier combobox
 * puede consumir directamente.
 *
 * Uso:
 *   const { entidades, loading } = useEntidadesPorTipo(tipo);
 */

import { useEffect, useMemo } from 'react';
import { useProveedorStore } from '../store/proveedorStore';
import { useClienteStore } from '../store/clienteStore';
import { useColaboradorStore } from '../store/colaboradorStore';
import { usePlanillaStore } from '../store/planillaStore';
import type { TipoEntidadCC } from '../types/cuentaCorriente.types';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Opción normalizada de una entidad para combobox/selector.
 * Compatible con el patrón ComboboxOption del design system.
 */
export interface EntidadOption {
  /** ID de la entidad en su colección de origen. */
  id: string;
  /** Nombre principal. */
  nombre: string;
  /** Sub-info opcional (código, email, tipo, etc.). */
  subLabel?: string;
  /** Si está activa/inactiva. */
  activa: boolean;
}

export interface UseEntidadesPorTipoResult {
  entidades: EntidadOption[];
  loading: boolean;
  error: string | null;
  /** Solo las activas. */
  activas: EntidadOption[];
}

// ═════════════════════════════════════════════════════════════════════════
// HOOK
// ═════════════════════════════════════════════════════════════════════════

/**
 * Lista todas las entidades del sistema del tipo dado.
 *
 * Carga el store correspondiente al montar (si está vacío) y devuelve la
 * lista normalizada. Re-render automático cuando el store actualiza.
 */
export function useEntidadesPorTipo(
  tipo: TipoEntidadCC | undefined,
): UseEntidadesPorTipoResult {
  // ── Stores (siempre se llaman, requisito de hooks) ──
  const proveedores = useProveedorStore((s) => s.proveedores);
  const proveedoresLoading = useProveedorStore((s) => s.loading);
  const fetchProveedores = useProveedorStore((s) => s.fetchProveedores);

  const clientes = useClienteStore((s) => s.clientes);
  const clientesLoading = useClienteStore((s) => s.loading);
  const fetchClientes = useClienteStore((s) => s.fetchClientes);

  const colaboradores = useColaboradorStore((s) => s.colaboradores);
  const colaboradoresLoading = useColaboradorStore((s) => s.loading);
  const fetchColaboradores = useColaboradorStore((s) => s.fetchColaboradores);

  const empleados = usePlanillaStore((s) => s.empleados);
  const empleadosLoading = usePlanillaStore((s) => s.loadingEmpleados);
  const fetchEmpleados = usePlanillaStore((s) => s.fetchEmpleados);

  // ── Auto-cargar el store correspondiente ──
  useEffect(() => {
    if (!tipo) return;
    if (tipo === 'proveedor' && proveedores.length === 0 && !proveedoresLoading) {
      void fetchProveedores();
    }
    if (tipo === 'cliente' && clientes.length === 0 && !clientesLoading) {
      void fetchClientes();
    }
    if (tipo === 'colaborador' && colaboradores.length === 0 && !colaboradoresLoading) {
      void fetchColaboradores();
    }
    if (tipo === 'empleado' && empleados.length === 0 && !empleadosLoading) {
      void fetchEmpleados();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  // ── Normalizar a EntidadOption ──
  const result = useMemo<UseEntidadesPorTipoResult>(() => {
    if (!tipo) {
      return { entidades: [], loading: false, error: null, activas: [] };
    }

    let entidades: EntidadOption[] = [];
    let loading = false;

    switch (tipo) {
      case 'proveedor':
        entidades = proveedores.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          subLabel: p.codigo + (p.contacto ? ` · ${p.contacto}` : ''),
          activa: p.activo,
        }));
        loading = proveedoresLoading;
        break;

      case 'cliente':
        entidades = clientes.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          subLabel: c.codigo + (c.dniRuc ? ` · ${c.dniRuc}` : ''),
          activa: c.estado === 'activo',
        }));
        loading = clientesLoading;
        break;

      case 'colaborador':
        entidades = colaboradores.map((co) => ({
          id: co.id,
          nombre: co.nombre,
          subLabel:
            co.codigo +
            (co.tipo
              ? ` · ${co.tipo === 'viajero' ? 'Viajero' : co.tipo === 'courier_externo' ? 'Courier' : co.tipo === 'empresa' ? 'Almacén' : 'Transportista'}`
              : ''),
          activa: co.estado === 'activo',
        }));
        loading = colaboradoresLoading;
        break;

      case 'empleado':
        entidades = empleados.map((e) => ({
          id: e.uid,
          nombre: e.displayName || e.email,
          subLabel: e.cargo || e.role,
          activa: e.activo,
        }));
        loading = empleadosLoading;
        break;

      case 'tarjeta_credito':
        // Las tarjetas no aplican como "titular de cuenta" en estos selectors
        entidades = [];
        loading = false;
        break;
    }

    // Ordenar alfabético por nombre
    entidades.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es-PE', { sensitivity: 'base' }),
    );

    const activas = entidades.filter((e) => e.activa);

    return {
      entidades,
      loading,
      error: null,
      activas,
    };
  }, [
    tipo,
    proveedores,
    proveedoresLoading,
    clientes,
    clientesLoading,
    colaboradores,
    colaboradoresLoading,
    empleados,
    empleadosLoading,
  ]);

  return result;
}
