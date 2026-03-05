import React, { useState, useCallback } from 'react';
import { ScanLine, Plus, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { GradientHeader } from '../../components/common';
import { BarcodeScanner } from '../../components/common/BarcodeScanner';
import { ProductoResultCard } from '../../components/modules/escaner/ProductoResultCard';
import { ScanHistoryLog } from '../../components/modules/escaner/ScanHistoryLog';
import { ProductoService } from '../../services/producto.service';
import { barcodeLookupService } from '../../services/barcodeLookup.service';
import { useToastStore } from '../../store/toastStore';
import type { Producto } from '../../types/producto.types';
import type { ScanResult, ExternalProductInfo } from '../../types/escaner.types';

export const Escaner: React.FC = () => {
  const toast = useToastStore();

  const [currentResult, setCurrentResult] = useState<Producto | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');
  const [externalInfo, setExternalInfo] = useState<ExternalProductInfo | null>(null);

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
    } catch (error) {
      const result: ScanResult = {
        barcode,
        format: format || 'UNKNOWN',
        timestamp: new Date(),
        status: 'error'
      };
      setScanHistory(prev => [result, ...prev]);
      toast.error('Error al buscar producto');
    } finally {
      setIsSearching(false);
    }
  }, [isSearching, toast]);

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
    <div className="min-h-screen bg-gray-50">
      <GradientHeader
        title="Escaner de Productos"
        subtitle="Buscar productos por codigo de barras UPC/EAN"
        variant="blue"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* Mobile: single column stack. Desktop: two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left column: Scanner */}
          <div className="space-y-3 sm:space-y-4">
            {/* Header + continuous toggle */}
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

            {/* Scanner card */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
              <BarcodeScanner
                onScan={handleBarcodeScan}
                mode="both"
                disabled={isSearching}
              />
            </div>

            {/* Loading state */}
            {isSearching && (
              <div className="flex items-center justify-center gap-2 py-3">
                <div className="h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Buscando producto...</span>
              </div>
            )}

            {/* Result section - shown inline on mobile (below scanner), in right column on desktop */}
            <div className="lg:hidden space-y-3">
              <ResultSection
                currentResult={currentResult}
                notFoundBarcode={notFoundBarcode}
                externalInfo={externalInfo}
                isSearching={isSearching}
                onScanAgain={handleScanAgain}
              />
            </div>

            {/* Scan history */}
            <ScanHistoryLog
              history={scanHistory}
              onClear={() => setScanHistory([])}
              onSelectItem={handleHistorySelect}
            />
          </div>

          {/* Right column: Results (desktop only, hidden on mobile - shown inline above) */}
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
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Extracted result section to avoid duplication between mobile/desktop
const ResultSection: React.FC<{
  currentResult: Producto | null;
  notFoundBarcode: string;
  externalInfo: ExternalProductInfo | null;
  isSearching: boolean;
  onScanAgain: () => void;
}> = ({ currentResult, notFoundBarcode, externalInfo, isSearching, onScanAgain }) => (
  <>
    {/* Product found */}
    {currentResult && (
      <ProductoResultCard
        producto={currentResult}
        onScanAgain={onScanAgain}
      />
    )}

    {/* Product NOT found */}
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

          {/* External API info */}
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

    {/* Empty state */}
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
