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
import { datosLaboralesService } from '../services/datosLaborales.service';
import {
  collection,
  query,
  where,
  getCountFromServer,
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
  const [hasDatosLaborales, setHasDatosLaborales] = useState<boolean | null>(null);
  const [bandejaCount, setBandejaCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch datosLaborales · una vez por sesión del user
  useEffect(() => {
    if (!profile?.uid) {
      setHasDatosLaborales(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    datosLaboralesService
      .get(profile.uid)
      .then((dl) => {
        if (cancelled) return;
        setHasDatosLaborales(dl !== null);
      })
      .catch(() => {
        if (cancelled) return;
        setHasDatosLaborales(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  // Fetch badge de Mi bandeja · solo si es admin/gerente
  // Lazy load · separado para no bloquear el sidebar
  useEffect(() => {
    if (!canManageUsers || !profile?.uid) {
      setBandejaCount(0);
      return;
    }
    let cancelled = false;
    const cargarContador = async () => {
      try {
        // Aprobaciones agregadas: usuarios pendientes + adelantos pendientes + bonos calculados + liquidaciones aprobadas
        const usersQ = query(
          collection(db, COLLECTIONS.USERS),
          where('estado', 'in', ['pendiente_aprobacion', 'invitado_no_registrado']),
        );
        const adelantosQ = query(
          collection(db, COLLECTIONS.ADELANTOS_NOMINA),
          where('estado', '==', 'pendiente'),
        );
        const bonosQ = query(
          collection(db, COLLECTIONS.CALCULOS_INCENTIVO),
          where('estado', '==', 'calculado'),
        );
        const liquidQ = query(
          collection(db, COLLECTIONS.LIQUIDACIONES_EMPLEADO),
          where('estado', '==', 'aprobada'),
        );
        const [u, a, b, l] = await Promise.all([
          getCountFromServer(usersQ).catch(() => null),
          getCountFromServer(adelantosQ).catch(() => null),
          getCountFromServer(bonosQ).catch(() => null),
          getCountFromServer(liquidQ).catch(() => null),
        ]);
        const total =
          (u?.data().count ?? 0) +
          (a?.data().count ?? 0) +
          (b?.data().count ?? 0) +
          (l?.data().count ?? 0);
        if (!cancelled) setBandejaCount(total);
      } catch {
        if (!cancelled) setBandejaCount(0);
      }
    };
    cargarContador();
    return () => {
      cancelled = true;
    };
  }, [canManageUsers, profile?.uid]);

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

    // Admin · bandeja
    if (canManageUsers) {
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
