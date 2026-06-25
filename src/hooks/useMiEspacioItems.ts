/**
 * useMiEspacioItems · F10.F.1.J-SIDEBAR · 2026-05-27
 *
 * Custom hook que devuelve los items del grupo "Mi espacio" del sidebar
 * según los roles + sub-perfiles del usuario logueado.
 *
 * Lógica condicional canon (matriz v5.6 ACTO 2):
 *   - Mi perfil       · siempre (todos)
 *   - Mi planilla     · si datosLaborales !== null
 *   - Mi histórico    · si datosLaborales !== null
 *   - Mi capital      · si isSocio === true
 *   - Mi bandeja      · si canManageUsers === true (admin/gerente)
 *
 * Si el user es socio o admin SIN datosLaborales · "Mi planilla" se muestra
 * disabled con label "sin data" (estado pedagógico).
 *
 * Performance:
 *   - Fetch único de datosLaborales al primer mount · cacheado en state local
 *   - Re-fetch solo si profile.uid cambia (login distinto)
 *   - Badge contador de bandeja se carga lazy (separado · no bloquea sidebar)
 */
import { useEffect, useState, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  User,
  Briefcase,
  TrendingUp,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { usePermissions } from './usePermissions';
import { useBandejaSignal } from '../store/bandejaSignalStore';
import {
  collection,
  doc,
  query,
  where,
  getCountFromServer,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';

export interface MiEspacioItem {
  /** ID único del item · útil para tracking y keys de React */
  id: string;
  /** Icono lucide-react */
  icon: LucideIcon;
  /** Label visible en sidebar */
  label: string;
  /** Ruta de navegación */
  path: string;
  /** Badge opcional · número (contador) · ej: "7" en Mi bandeja */
  badge?: number;
  /** Color del badge · default amber */
  badgeColor?: 'amber' | 'rose' | 'sky' | 'emerald';
  /** Si true · item se renderiza disabled con label "sin data" */
  disabled?: boolean;
  /** Tooltip de razón cuando disabled */
  disabledReason?: string;
}

/**
 * Devuelve los items dinámicos del grupo "Mi espacio" según el contexto del user.
 */
export function useMiEspacioItems(): {
  items: MiEspacioItem[];
  loading: boolean;
} {
  const { profile, isSocio, canManageUsers } = usePermissions();
  // F4 · señal de re-fetch del badge tras una firma (no es reactivo · ver bandejaSignalStore).
  const bandejaVersion = useBandejaSignal((s) => s.version);
  const [hasDatosLaborales, setHasDatosLaborales] = useState<boolean | null>(null);
  const [bandejaCount, setBandejaCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // F10.F.1.J-SIDEBAR.fix · onSnapshot listener en tiempo real (vs getDoc 1-shot)
  // Razón: cuando el admin configura datosLaborales DESPUÉS de loguearse
  // (vía /usuarios → Ficha 360 → Editar Laborales), el sidebar debe activar
  // "Mi planilla" automáticamente sin requerir F5 manual.
  useEffect(() => {
    if (!profile?.uid) {
      setHasDatosLaborales(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Subscribe al doc /users/{uid}/private/datosLaborales · canon F2 path
    // chk5.PERF-LISTENERS · console.logs de cada snapshot/suscripción removidos (ruido).
    const ref = doc(db, COLLECTIONS.USERS, profile.uid, 'private', 'datosLaborales');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setHasDatosLaborales(snap.exists());
        setLoading(false);
      },
      () => {
        setHasDatosLaborales(false);
        setLoading(false);
      },
    );
    return () => {
      unsubscribe();
    };
  }, [profile?.uid]);

  // Fetch badge de Mi bandeja · solo si es admin/gerente
  // Lazy load · separado para no bloquear el sidebar
  useEffect(() => {
    if ((!canManageUsers && !isSocio) || !profile?.uid) {
      setBandejaCount(0);
      return;
    }
    let cancelled = false;
    const contar = (q: ReturnType<typeof query>): Promise<number> =>
      getCountFromServer(q).then((s) => s.data().count).catch(() => 0);
    const cargarContador = async () => {
      try {
        const promesas: Promise<number>[] = [];
        // RRHH (admin/gerente): usuarios + adelantos + bonos + liquidaciones
        if (canManageUsers) {
          promesas.push(
            contar(query(collection(db, COLLECTIONS.USERS), where('estado', 'in', ['pendiente_aprobacion', 'invitado_no_registrado']))),
            contar(query(collection(db, COLLECTIONS.ADELANTOS_NOMINA), where('estado', '==', 'pendiente'))),
            contar(query(collection(db, COLLECTIONS.CALCULOS_INCENTIVO), where('estado', '==', 'calculado'))),
            contar(query(collection(db, COLLECTIONS.LIQUIDACIONES_EMPLEADO), where('estado', '==', 'aprobada'))),
          );
        }
        // Egresos pendientes de firma de socio (F4 · aprox · cuenta los que ya tienen el flujo iniciado ·
        // los >umbral recién creados aparecen en la bandeja vía el hook · deuda: notificar al crear).
        if (isSocio) {
          promesas.push(
            contar(query(collection(db, COLLECTIONS.GASTOS), where('autorizacion.estado', '==', 'pendiente'))),
            contar(query(collection(db, COLLECTIONS.ORDENES_COMPRA), where('autorizacion.estado', '==', 'pendiente'))),
          );
        }
        const counts = await Promise.all(promesas);
        const total = counts.reduce((s, n) => s + n, 0);
        if (!cancelled) setBandejaCount(total);
      } catch {
        if (!cancelled) setBandejaCount(0);
      }
    };
    cargarContador();
    return () => {
      cancelled = true;
    };
  }, [canManageUsers, isSocio, profile?.uid, bandejaVersion]);

  // Construir items según contexto
  const items = useMemo<MiEspacioItem[]>(() => {
    const lista: MiEspacioItem[] = [
      {
        id: 'mi-perfil',
        icon: User,
        label: 'Mi perfil',
        path: '/perfil',
      },
    ];

    // Empleado · si tiene datosLaborales
    if (hasDatosLaborales === true) {
      lista.push({
        id: 'mi-planilla',
        icon: Briefcase,
        label: 'Mi planilla',
        path: '/perfil/mi-planilla',
      });
      lista.push({
        id: 'mi-historial',
        icon: TrendingUp,
        label: 'Mi histórico',
        path: '/perfil/mi-historial',
      });
    } else if (hasDatosLaborales === false && (isSocio || canManageUsers)) {
      // Multi-rol sin datosLaborales · mostrar item disabled pedagógico
      lista.push({
        id: 'mi-planilla-disabled',
        icon: Briefcase,
        label: 'Mi planilla',
        path: '/perfil/mi-planilla',
        disabled: true,
        disabledReason: 'Sin datos laborales · contactá al admin de RRHH',
      });
    }

    // Socio
    if (isSocio) {
      lista.push({
        id: 'mi-capital',
        icon: Coins,
        label: 'Mi capital',
        path: '/perfil/mi-capital',
      });
    }

    // Bandeja · admin/gerente (RRHH) o socio (egresos · F4)
    if (canManageUsers || isSocio) {
      lista.push({
        id: 'mi-bandeja',
        icon: ShieldCheck,
        label: 'Mi bandeja',
        path: '/perfil/mi-bandeja',
        badge: bandejaCount > 0 ? bandejaCount : undefined,
        badgeColor: 'amber',
      });
    }

    return lista;
  }, [hasDatosLaborales, isSocio, canManageUsers, bandejaCount]);

  return { items, loading };
}
