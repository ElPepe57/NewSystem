/**
 * useDatosBancariosTercero · DEUDA-PAGOFORM-001 Fase 2
 *
 * Hook unificado para hacer lookup de los `datosBancarios[]` de un tercero
 * (proveedor / cliente / colaborador) cuando se va a registrar un pago a su
 * favor. Sirve como fuente de "destino del pago" cuando el tercero no tiene
 * caja recaudadora pero sí cuentas/billeteras donde recibe el dinero.
 *
 * Uso típico:
 *   const { datosBancarios, terceroNombre, terceroTipo, loading } =
 *     useDatosBancariosTercero({ proveedorId });
 *
 * Si se pasa más de un id, prevalece en este orden: proveedor → cliente → colaborador.
 *
 * El hook usa el cache de los stores existentes (no hace red en cada render).
 * Solo dispara fetch si el tercero no está en memoria.
 */

import { useEffect, useState, useMemo } from 'react';
import { useProveedorStore } from '../store/proveedorStore';
import { useClienteStore } from '../store/clienteStore';
import { useColaboradorStore } from '../store/colaboradorStore';
import type { DatoBancarioPasivo } from '../types/tesoreria.types';

export interface UseDatosBancariosTerceroProps {
  proveedorId?: string;
  clienteId?: string;
  colaboradorId?: string;
}

export type TerceroTipo = 'proveedor' | 'cliente' | 'colaborador' | null;

export interface UseDatosBancariosTerceroResult {
  /** Lista de datos bancarios del tercero (vacía si no aplica). */
  datosBancarios: DatoBancarioPasivo[];
  /** Nombre del tercero para mostrar en banner / selector. */
  terceroNombre: string | null;
  /** Tipo del tercero resuelto (en orden de prioridad). */
  terceroTipo: TerceroTipo;
  /** ID del tercero resuelto (mismo que el de entrada). */
  terceroId: string | null;
  /** True mientras se hace fetch desde Firestore. */
  loading: boolean;
  /** True si NO hay datos bancarios cargados aún del tercero. */
  vacio: boolean;
}

export function useDatosBancariosTercero(
  props: UseDatosBancariosTerceroProps,
): UseDatosBancariosTerceroResult {
  const { proveedorId, clienteId, colaboradorId } = props;

  const proveedoresCache = useProveedorStore((s) => s.proveedores);
  const proveedoresActivosCache = useProveedorStore((s) => s.proveedoresActivos);
  const getProveedorById = useProveedorStore((s) => s.getById);

  const clientesCache = useClienteStore((s) => s.clientes);
  const getClienteById = useClienteStore((s) => s.getById);

  const colaboradoresCache = useColaboradorStore((s) => s.colaboradores);

  const [proveedorRemoto, setProveedorRemoto] = useState<any | null>(null);
  const [clienteRemoto, setClienteRemoto] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Resolver desde cache primero (sin red).
  const proveedorEnCache = useMemo(() => {
    if (!proveedorId) return null;
    const todos = [...proveedoresCache, ...proveedoresActivosCache];
    return todos.find((p) => p.id === proveedorId) || null;
  }, [proveedorId, proveedoresCache, proveedoresActivosCache]);

  const clienteEnCache = useMemo(() => {
    if (!clienteId) return null;
    return clientesCache.find((c) => c.id === clienteId) || null;
  }, [clienteId, clientesCache]);

  const colaboradorEnCache = useMemo(() => {
    if (!colaboradorId) return null;
    return colaboradoresCache.find((c) => c.id === colaboradorId) || null;
  }, [colaboradorId, colaboradoresCache]);

  // Si no está en cache, hacer fetch.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (proveedorId && !proveedorEnCache) {
        setLoading(true);
        try {
          const p = await getProveedorById(proveedorId);
          if (!cancelado) setProveedorRemoto(p);
        } finally {
          if (!cancelado) setLoading(false);
        }
      } else {
        setProveedorRemoto(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [proveedorId, proveedorEnCache, getProveedorById]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (clienteId && !clienteEnCache) {
        setLoading(true);
        try {
          const c = await getClienteById(clienteId);
          if (!cancelado) setClienteRemoto(c);
        } finally {
          if (!cancelado) setLoading(false);
        }
      } else {
        setClienteRemoto(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [clienteId, clienteEnCache, getClienteById]);

  const proveedor = proveedorEnCache || proveedorRemoto;
  const cliente = clienteEnCache || clienteRemoto;
  const colaborador = colaboradorEnCache;

  // Prioridad: proveedor → cliente → colaborador
  const resuelto = useMemo<{
    datos: DatoBancarioPasivo[];
    nombre: string | null;
    tipo: TerceroTipo;
    id: string | null;
  }>(() => {
    if (proveedor) {
      return {
        datos: proveedor.datosBancarios || [],
        nombre: proveedor.nombre || proveedor.razonSocial || null,
        tipo: 'proveedor',
        id: proveedor.id,
      };
    }
    if (cliente) {
      return {
        datos: cliente.datosBancarios || [],
        nombre: cliente.nombre || cliente.nombreCorto || null,
        tipo: 'cliente',
        id: cliente.id,
      };
    }
    if (colaborador) {
      return {
        datos: colaborador.datosBancarios || [],
        nombre: colaborador.nombre || null,
        tipo: 'colaborador',
        id: colaborador.id,
      };
    }
    return { datos: [], nombre: null, tipo: null, id: null };
  }, [proveedor, cliente, colaborador]);

  return {
    datosBancarios: resuelto.datos,
    terceroNombre: resuelto.nombre,
    terceroTipo: resuelto.tipo,
    terceroId: resuelto.id,
    loading,
    vacio: resuelto.datos.length === 0,
  };
}
