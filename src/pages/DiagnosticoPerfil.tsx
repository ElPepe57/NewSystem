/**
 * DiagnosticoPerfil · F10.F.1.J-SIDEBAR.diag · 2026-05-28
 *
 * Página temporal de diagnóstico visual para debug del sidebar "Mi planilla".
 * NO es producción · sirve para que el user me muestre por screenshot
 * exactamente qué está pasando con su user.
 *
 * URL: /diagnostico-perfil
 *
 * Muestra:
 *   - UID del user logueado · roles · permisos clave
 *   - Existencia del doc /users/{uid}/private/datosLaborales (canon F2)
 *   - Existencia del doc /users/{uid}/private/laboral (legacy planilla)
 *   - Contenido completo de ambos docs si existen
 *   - State del hook useMiEspacioItems
 *   - Errores de Firestore rules si hay
 *
 * REMOVER después del diagnóstico.
 */
import React, { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { usePermissions } from '../hooks/usePermissions';
import { useMiEspacioItems } from '../hooks/useMiEspacioItems';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  User,
  Database,
  ShieldCheck,
  FileText,
} from 'lucide-react';

interface DocState {
  exists: boolean | null;
  data: any;
  error: string | null;
}

const initialDoc: DocState = { exists: null, data: null, error: null };

const StatusIcon: React.FC<{ exists: boolean | null }> = ({ exists }) => {
  if (exists === null) return <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />;
  if (exists === true) return <CheckCircle className="w-5 h-5 text-emerald-600" />;
  return <XCircle className="w-5 h-5 text-rose-600" />;
};

export const DiagnosticoPerfil: React.FC = () => {
  const { profile, roles, isSocio, canManageUsers, isAdmin } = usePermissions();
  const { items, loading } = useMiEspacioItems();

  const [docCanon, setDocCanon] = useState<DocState>(initialDoc);
  const [docLegacy, setDocLegacy] = useState<DocState>(initialDoc);

  // Listener path CANON (datosLaborales)
  useEffect(() => {
    if (!profile?.uid) return;
    const ref = doc(db, COLLECTIONS.USERS, profile.uid, 'private', 'datosLaborales');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setDocCanon({
          exists: snap.exists(),
          data: snap.exists() ? snap.data() : null,
          error: null,
        });
      },
      (err) => {
        setDocCanon({ exists: false, data: null, error: err.message });
      },
    );
    return () => unsub();
  }, [profile?.uid]);

  // Listener path LEGACY (laboral)
  useEffect(() => {
    if (!profile?.uid) return;
    const ref = doc(db, COLLECTIONS.USERS, profile.uid, 'private', 'laboral');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setDocLegacy({
          exists: snap.exists(),
          data: snap.exists() ? snap.data() : null,
          error: null,
        });
      },
      (err) => {
        setDocLegacy({ exists: false, data: null, error: err.message });
      },
    );
    return () => unsub();
  }, [profile?.uid]);

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <p className="text-[14px] text-slate-600">No hay user logueado</p>
      </div>
    );
  }

  const hasMiPlanilla = items.some((i) => i.id === 'mi-planilla');
  const hasMiPlanillaDisabled = items.some((i) => i.id === 'mi-planilla-disabled');

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-100 to-amber-50 ring-1 ring-amber-300 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-amber-600 rounded-2xl flex items-center justify-center text-white">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-[18px] font-bold text-amber-900">🔍 Diagnóstico · Mi planilla no se activa</h1>
            <p className="text-[12px] text-amber-800 mt-1">
              Esta página muestra el estado real de Firestore + el hook. Sacale screenshot y envialo
              para identificar el problema raíz.
            </p>
          </div>
        </div>
      </div>

      {/* 1 · Identidad del user */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-[14px] font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
          <User className="w-4 h-4 text-purple-700" />
          1 · Identidad del user logueado
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">UID</span>
            <span className="font-mono text-[11px] text-slate-900 break-all max-w-[200px]">{profile.uid}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">Email</span>
            <span className="font-semibold text-slate-900">{profile.email}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">DisplayName</span>
            <span className="font-semibold text-slate-900">{profile.displayName}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">Roles</span>
            <span className="font-semibold text-slate-900">{roles.join(' · ')}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">isAdmin</span>
            <span className={isAdmin ? 'text-emerald-700 font-bold' : 'text-slate-500'}>{String(isAdmin)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">isSocio</span>
            <span className={isSocio ? 'text-emerald-700 font-bold' : 'text-slate-500'}>{String(isSocio)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">canManageUsers</span>
            <span className={canManageUsers ? 'text-emerald-700 font-bold' : 'text-slate-500'}>{String(canManageUsers)}</span>
          </div>
        </div>
      </div>

      {/* 2 · Path CANON · /private/datosLaborales */}
      <div className="bg-white border-2 border-purple-200 rounded-xl p-5">
        <h2 className="text-[14px] font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
          <Database className="w-4 h-4 text-purple-700" />
          2 · Path CANON · <code className="bg-purple-50 px-1 rounded">/users/{'{uid}'}/private/datosLaborales</code>
        </h2>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2 flex items-center gap-3">
          <StatusIcon exists={docCanon.exists} />
          <div className="flex-1">
            <div className="text-[12px] font-bold text-slate-900">
              {docCanon.exists === null ? 'Cargando...' : docCanon.exists ? 'EXISTE ✅' : 'NO EXISTE ❌'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono break-all">
              users/{profile.uid}/private/datosLaborales
            </div>
          </div>
        </div>
        {docCanon.error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-[11px] text-rose-800">
            <strong>Error:</strong> {docCanon.error}
          </div>
        )}
        {docCanon.exists && docCanon.data && (
          <details className="mt-2">
            <summary className="text-[11px] text-slate-600 cursor-pointer hover:text-slate-900">
              Ver contenido del documento (click)
            </summary>
            <pre className="mt-2 bg-slate-900 text-emerald-300 text-[10px] p-3 rounded overflow-auto max-h-60">
              {JSON.stringify(docCanon.data, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {/* 3 · Path LEGACY · /private/laboral */}
      <div className="bg-white border-2 border-amber-200 rounded-xl p-5">
        <h2 className="text-[14px] font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
          <Database className="w-4 h-4 text-amber-700" />
          3 · Path LEGACY · <code className="bg-amber-50 px-1 rounded">/users/{'{uid}'}/private/laboral</code>
        </h2>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2 flex items-center gap-3">
          <StatusIcon exists={docLegacy.exists} />
          <div className="flex-1">
            <div className="text-[12px] font-bold text-slate-900">
              {docLegacy.exists === null ? 'Cargando...' : docLegacy.exists ? 'EXISTE ⚠️ (path viejo)' : 'NO EXISTE ✓'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono break-all">
              users/{profile.uid}/private/laboral
            </div>
          </div>
        </div>
        {docLegacy.exists && docLegacy.data && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 mb-2">
              ⚠️ <strong>Detecté el bug:</strong> tus datos están en el path LEGACY · el hook lee del path CANON.
              Necesitamos migrar este doc o ajustar el hook para leer ambos.
            </div>
            <details>
              <summary className="text-[11px] text-slate-600 cursor-pointer hover:text-slate-900">
                Ver contenido del documento (click)
              </summary>
              <pre className="mt-2 bg-slate-900 text-amber-300 text-[10px] p-3 rounded overflow-auto max-h-60">
                {JSON.stringify(docLegacy.data, null, 2)}
              </pre>
            </details>
          </>
        )}
        {docLegacy.error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-[11px] text-rose-800">
            <strong>Error:</strong> {docLegacy.error}
          </div>
        )}
      </div>

      {/* 4 · State del hook useMiEspacioItems */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-[14px] font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-sky-700" />
          4 · State del hook useMiEspacioItems
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-[12px]">
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">loading</span>
            <span className={loading ? 'text-amber-700 font-bold' : 'text-slate-500'}>{String(loading)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">items.length</span>
            <span className="font-bold text-slate-900 tabular-nums">{items.length}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">Mi planilla enabled?</span>
            <span className={hasMiPlanilla ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
              {hasMiPlanilla ? '✅ SÍ' : hasMiPlanillaDisabled ? '⚠️ disabled' : '❌ NO'}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[11px] text-slate-500 mb-1">Items del Mi espacio actual:</div>
          <ol className="space-y-1">
            {items.map((item) => (
              <li
                key={item.id}
                className={`text-[12px] ${item.disabled ? 'text-slate-400' : 'text-slate-900 font-semibold'}`}
              >
                {item.disabled ? '⚠️' : '✅'} {item.label}{' '}
                <code className="text-[10px] text-slate-500">{item.path}</code>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* 5 · Diagnóstico final */}
      <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200 rounded-xl p-5">
        <h2 className="text-[14px] font-bold text-emerald-900 mb-3 inline-flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          5 · Conclusión del diagnóstico
        </h2>
        <div className="text-[12px] text-emerald-900 space-y-2">
          {!docCanon.exists && !docLegacy.exists && (
            <p>
              <strong>❌ Caso A · ningún doc existe.</strong> El form de Datos laborales NO terminó de guardar.
              Posibles causas: error silencioso · permisos · navegación interrumpida. Volvé a intentar y mirá
              si aparece error.
            </p>
          )}
          {docCanon.exists && (
            <p>
              <strong>✅ Caso B · doc CANON existe.</strong> El path correcto está poblado. Si "Mi planilla"
              sigue desactivado, el problema es de cache del bundle (hard refresh) o del hook (revisa
              State).
            </p>
          )}
          {!docCanon.exists && docLegacy.exists && (
            <p>
              <strong>⚠️ Caso C · doc en path LEGACY.</strong> Tus datos están en el path viejo. Necesitamos
              MIGRAR este doc al path canon · te creo un script de migración + ajusto el hook para leer
              ambos paths temporalmente.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiagnosticoPerfil;
