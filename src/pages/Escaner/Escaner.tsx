import React, { useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ScanLine, ToggleLeft, ToggleRight, Search, ClipboardCheck, Truck, PackageCheck, ArrowRightLeft, ArrowLeft } from 'lucide-react';
import { GradientHeader } from '../../components/common';
import { BarcodeScanner } from '../../components/common/BarcodeScanner';
import { Tabs } from '../../components/common/Tabs';
import { ModoConsulta } from '../../components/modules/escaner/modos/ModoConsulta';
import { ModoAuditoria } from '../../components/modules/escaner/modos/ModoAuditoria';
import { ModoRecepcion } from '../../components/modules/escaner/modos/ModoRecepcion';
import { ModoDespacho } from '../../components/modules/escaner/modos/ModoDespacho';
import { ModoTransferencia } from '../../components/modules/escaner/modos/ModoTransferencia';
import type { ModoConsultaHandle } from '../../components/modules/escaner/modos/ModoConsulta';
import type { ModoAuditoriaHandle } from '../../components/modules/escaner/modos/ModoAuditoria';
import type { ModoRecepcionHandle } from '../../components/modules/escaner/modos/ModoRecepcion';
import type { ModoDespachoHandle } from '../../components/modules/escaner/modos/ModoDespacho';
import type { ModoTransferenciaHandle } from '../../components/modules/escaner/modos/ModoTransferencia';
import type { ScannerModoId } from '../../types/escanerModos.types';
import type { Tab } from '../../components/common/Tabs';

const SCANNER_TABS: Tab[] = [
  { id: 'consulta', label: 'Consulta', icon: <Search className="h-3.5 w-3.5" /> },
  { id: 'auditoria', label: 'Auditoria', icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
  { id: 'recepcion', label: 'Recepcion', icon: <Truck className="h-3.5 w-3.5" /> },
  { id: 'despacho', label: 'Despacho', icon: <PackageCheck className="h-3.5 w-3.5" /> },
  { id: 'transferencia', label: 'Transferencia', icon: <ArrowRightLeft className="h-3.5 w-3.5" /> },
];

const MODE_SUBTITLES: Record<ScannerModoId, string> = {
  consulta: 'Buscar productos por codigo de barras UPC/EAN',
  auditoria: 'Conteo fisico vs stock del sistema',
  recepcion: 'Recibir productos de transferencias pendientes',
  despacho: 'Validar y despachar pedidos',
  transferencia: 'Mover productos entre almacenes',
};

const VALID_MODES: ScannerModoId[] = ['consulta', 'auditoria', 'recepcion', 'despacho', 'transferencia'];

export const Escaner: React.FC = () => {
  const [searchParams] = useSearchParams();
  const modoParam = searchParams.get('modo') as ScannerModoId | null;
  const transferenciaIdParam = searchParams.get('transferenciaId');
  const navigate = useNavigate();

  const [activeMode, setActiveMode] = useState<ScannerModoId>(
    modoParam && VALID_MODES.includes(modoParam) ? modoParam : 'consulta'
  );
  const [continuousMode, setContinuousMode] = useState(false);

  // Refs for each mode's scan handler
  const consultaRef = useRef<ModoConsultaHandle>(null);
  const auditoriaRef = useRef<ModoAuditoriaHandle>(null);
  const recepcionRef = useRef<ModoRecepcionHandle>(null);
  const despachoRef = useRef<ModoDespachoHandle>(null);
  const transferenciaRef = useRef<ModoTransferenciaHandle>(null);

  // Delegate scan to active mode
  const handleGlobalScan = useCallback((barcode: string, format?: string) => {
    switch (activeMode) {
      case 'consulta':
        consultaRef.current?.handleScan(barcode, format);
        break;
      case 'auditoria':
        auditoriaRef.current?.handleScan(barcode, format);
        break;
      case 'recepcion':
        recepcionRef.current?.handleScan(barcode, format);
        break;
      case 'despacho':
        despachoRef.current?.handleScan(barcode, format);
        break;
      case 'transferencia':
        transferenciaRef.current?.handleScan(barcode, format);
        break;
    }
  }, [activeMode]);

  return (
    <div className="min-h-screen bg-gray-50">
      <GradientHeader
        title="Escaner de Productos"
        subtitle={MODE_SUBTITLES[activeMode]}
        variant="blue"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* Banner de contexto cuando viene de Transferencias */}
        {transferenciaIdParam && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <ArrowLeft className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">Recepción de transferencia</span>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/transferencias?transferenciaId=${transferenciaIdParam}`)}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 underline flex-shrink-0"
            >
              Volver a Transferencias
            </button>
          </div>
        )}

        {/* Mode tabs */}
        <div className="mb-4">
          <Tabs
            tabs={SCANNER_TABS}
            activeTab={activeMode}
            onChange={(id) => setActiveMode(id as ScannerModoId)}
            variant="pills"
            size="sm"
            scrollable
          />
        </div>

        {/* Scanner section - always visible */}
        <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ScanLine className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
              Escanear
            </h2>
            <button
              type="button"
              onClick={() => setContinuousMode(!continuousMode)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 hover:text-gray-900 py-1"
            >
              {continuousMode ? (
                <ToggleRight className="h-5 w-5 text-primary-600" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-gray-400" />
              )}
              <span className="hidden sm:inline">Modo continuo</span>
              <span className="sm:hidden">Continuo</span>
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
            <BarcodeScanner
              onScan={handleGlobalScan}
              mode="both"
            />
          </div>
        </div>

        {/* Active mode content */}
        {activeMode === 'consulta' && (
          <ModoConsulta ref={consultaRef} />
        )}
        {activeMode === 'auditoria' && (
          <ModoAuditoria ref={auditoriaRef} />
        )}
        {activeMode === 'recepcion' && (
          <ModoRecepcion ref={recepcionRef} preselectedTransferenciaId={transferenciaIdParam} />
        )}
        {activeMode === 'despacho' && (
          <ModoDespacho ref={despachoRef} />
        )}
        {activeMode === 'transferencia' && (
          <ModoTransferencia ref={transferenciaRef} />
        )}
      </div>
    </div>
  );
};
