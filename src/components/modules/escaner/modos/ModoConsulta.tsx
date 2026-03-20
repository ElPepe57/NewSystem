import React, { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { ScanLine, Plus, Search, Link2 } from 'lucide-react';
import { ProductoResultCard } from '../ProductoResultCard';
import { ScanHistoryLog } from '../ScanHistoryLog';
import { VincularUPCModal } from '../VincularUPCModal';
import { ProductoService } from '../../../../services/producto.service';
import { barcodeLookupService } from '../../../../services/barcodeLookup.service';
import { scanHistoryService } from '../../../../services/scanHistory.service';
import { useToastStore } from '../../../../store/toastStore';
import { useAuthStore } from '../../../../store/authStore';
import type { Producto } from '../../../../types/producto.types';
import type { ScanResult, ExternalProductInfo } from '../../../../types/escaner.types';

export interface ModoConsultaHandle {
  handleScan: (barcode: string, format?: string) => void;
}

export const ModoConsulta = forwardRef<ModoConsultaHandle>((_props, ref) => {
  const toast = useToastStore();
  const { user } = useAuthStore();

  const [currentResult, setCurrentResult] = useState<Producto | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');
  const [externalInfo, setExternalInfo] = useState<ExternalProductInfo | null>(null);
  const [showVincularModal, setShowVincularModal] = useState(false);

  // Load persisted history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const records = await scanHistoryService.getRecent(50);
        const mapped: ScanResult[] = records.map(r => ({
          barcode: r.barcode,
          format: r.format,
          timestamp: r.timestamp?.toDate?.() || new Date(),
          status: r.status,
          productoId: r.productoId,
          productoNombre: r.productoNombre,
          productoSKU: r.productoSKU,
          firestoreId: r.id,
        }));
        setScanHistory(mapped);
      } catch {
        // Silently fail - in-memory fallback
      }
    };
    loadHistory();
  }, []);

  const handleBarcodeScan = useCallback(async (barcode: string, format?: string) => {
    if (isSearching) return;
    setIsSearching(true);
    setExternalInfo(null);

    try {
      const producto = await ProductoService.getByCodigoUPC(barcode);

      const result: ScanResult = {
        barcode,
        format: format || 'UNKNOWN',
        timestamp: new Date(),
        status: producto ? 'found' : 'not_found',
        productoId: producto?.id,
        productoNombre: producto ? `${producto.marca} ${producto.nombreComercial}` : undefined,
        productoSKU: producto?.sku,
      };

      // Persist to Firestore
      if (user?.uid) {
        try {
          const docId = await scanHistoryService.save({
            barcode,
            format: format || 'UNKNOWN',
            status: producto ? 'found' : 'not_found',
            productoId: producto?.id,
            productoNombre: result.productoNombre,
            productoSKU: producto?.sku,
            userId: user.uid,
            source: 'escaner',
          });
          result.firestoreId = docId;
        } catch { /* silent */ }
      }

      setScanHistory(prev => [result, ...prev]);

      if (producto) {
        setCurrentResult(producto);
        setNotFoundBarcode('');
        toast.success(`${producto.marca} ${producto.nombreComercial}`, 'Producto encontrado');
      } else {
        setCurrentResult(null);
        setNotFoundBarcode(barcode);
        toast.warning(`Codigo ${barcode} no encontrado en el sistema`);

        const external = await barcodeLookupService.lookup(barcode);
        if (external) {
          setExternalInfo(external);
        }
      }
    } catch {
      const errResult: ScanResult = {
        barcode,
        format: format || 'UNKNOWN',
        timestamp: new Date(),
        status: 'error'
      };
      if (user?.uid) {
        try {
          const docId = await scanHistoryService.save({
            barcode, format: format || 'UNKNOWN', status: 'error',
            userId: user.uid, source: 'escaner',
          });
          errResult.firestoreId = docId;
        } catch { /* silent */ }
      }
      setScanHistory(prev => [errResult, ...prev]);
      toast.error('Error al buscar producto');
    } finally {
      setIsSearching(false);
    }
  }, [isSearching, toast, user]);

  // Expose handleScan to parent via ref
  useImperativeHandle(ref, () => ({
    handleScan: handleBarcodeScan,
  }), [handleBarcodeScan]);

  const handleClearHistory = useCallback(async () => {
    setScanHistory([]);
    try { await scanHistoryService.deleteAll(); } catch { /* silent */ }
  }, []);

  const handleDeleteHistoryItem = useCallback(async (result: ScanResult) => {
    setScanHistory(prev => prev.filter(r => r !== result));
    if (result.firestoreId) {
      try { await scanHistoryService.deleteOne(result.firestoreId); } catch { /* silent */ }
    }
  }, []);

  const handleVincularLinked = useCallback((producto: Producto) => {
    setCurrentResult(producto);
    setNotFoundBarcode('');
    setExternalInfo(null);
    setScanHistory(prev => prev.map(r =>
      r.barcode === producto.codigoUPC && r.status === 'not_found'
        ? { ...r, status: 'found' as const, productoId: producto.id, productoNombre: `${producto.marca} ${producto.nombreComercial}`, productoSKU: producto.sku }
        : r
    ));
  }, []);

  const handleScanAgain = () => {
    setCurrentResult(null);
    setNotFoundBarcode('');
    setExternalInfo(null);
  };

  const handleHistorySelect = async (result: ScanResult) => {
    if (result.status === 'found' && result.productoId) {
      try {
        const producto = await ProductoService.getById(result.productoId);
        if (producto) {
          setCurrentResult(producto);
          setNotFoundBarcode('');
          setExternalInfo(null);
        }
      } catch {
        toast.error('Error al cargar producto');
      }
    } else {
      handleBarcodeScan(result.barcode, result.format);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left: History */}
        <div className="space-y-3 sm:space-y-4">
          {/* Loading state */}
          {isSearching && (
            <div className="flex items-center justify-center gap-2 py-3">
              <div className="h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">Buscando producto...</span>
            </div>
          )}

          {/* Result section - shown inline on mobile */}
          <div className="lg:hidden space-y-3">
            <ResultSection
              currentResult={currentResult}
              notFoundBarcode={notFoundBarcode}
              externalInfo={externalInfo}
              isSearching={isSearching}
              onScanAgain={handleScanAgain}
              onVincular={() => setShowVincularModal(true)}
            />
          </div>

          {/* Scan history */}
          <ScanHistoryLog
            history={scanHistory}
            onClear={handleClearHistory}
            onSelectItem={handleHistorySelect}
            onDeleteItem={handleDeleteHistoryItem}
          />
        </div>

        {/* Right: Results (desktop only) */}
        <div className="hidden lg:block space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Search className="h-5 w-5 text-primary-600" />
            Resultado
          </h2>
          <ResultSection
            currentResult={currentResult}
            notFoundBarcode={notFoundBarcode}
            externalInfo={externalInfo}
            isSearching={isSearching}
            onScanAgain={handleScanAgain}
            onVincular={() => setShowVincularModal(true)}
          />
        </div>
      </div>

      {/* Vincular UPC Modal */}
      <VincularUPCModal
        isOpen={showVincularModal}
        onClose={() => setShowVincularModal(false)}
        barcode={notFoundBarcode}
        onLinked={handleVincularLinked}
      />
    </>
  );
});

ModoConsulta.displayName = 'ModoConsulta';

// Extracted result section
const ResultSection: React.FC<{
  currentResult: Producto | null;
  notFoundBarcode: string;
  externalInfo: ExternalProductInfo | null;
  isSearching: boolean;
  onScanAgain: () => void;
  onVincular: () => void;
}> = ({ currentResult, notFoundBarcode, externalInfo, isSearching, onScanAgain, onVincular }) => (
  <>
    {currentResult && (
      <ProductoResultCard
        producto={currentResult}
        onScanAgain={onScanAgain}
      />
    )}

    {notFoundBarcode && !currentResult && (
      <div className="bg-white border border-amber-200 rounded-xl p-4 sm:p-6">
        <div className="text-center">
          <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
            <ScanLine className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
            Producto no encontrado
          </h3>
          <p className="text-sm text-gray-500 mb-1">
            Codigo: <span className="font-mono font-medium text-xs sm:text-sm">{notFoundBarcode}</span>
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Este codigo no esta registrado en el sistema
          </p>

          {externalInfo && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
              <p className="text-xs text-blue-600 font-medium mb-1">
                Info de {externalInfo.source === 'openfoodfacts' ? 'Open Food Facts' : 'API externa'}:
              </p>
              {externalInfo.brand && (
                <p className="text-sm text-gray-800">
                  <span className="text-gray-500">Marca:</span> {externalInfo.brand}
                </p>
              )}
              {externalInfo.name && (
                <p className="text-sm text-gray-800">
                  <span className="text-gray-500">Nombre:</span> {externalInfo.name}
                </p>
              )}
              {externalInfo.category && (
                <p className="text-sm text-gray-800 truncate">
                  <span className="text-gray-500">Categoria:</span> {externalInfo.category}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={onVincular}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Link2 className="h-4 w-4" />
              Vincular a Producto
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = `/productos?crear=true&upc=${encodeURIComponent(notFoundBarcode)}${externalInfo?.brand ? `&marca=${encodeURIComponent(externalInfo.brand)}` : ''}${externalInfo?.name ? `&nombre=${encodeURIComponent(externalInfo.name)}` : ''}`;
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Crear Producto
            </button>
            <button
              type="button"
              onClick={onScanAgain}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ScanLine className="h-4 w-4" />
              Escanear Otro
            </button>
          </div>
        </div>
      </div>
    )}

    {!currentResult && !notFoundBarcode && !isSearching && (
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 text-center">
        <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
          <ScanLine className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
        </div>
        <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-1.5 sm:mb-2">
          Listo para escanear
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
          Usa la camara o un lector para escanear el codigo de barras de un suplemento
        </p>
      </div>
    )}
  </>
);
