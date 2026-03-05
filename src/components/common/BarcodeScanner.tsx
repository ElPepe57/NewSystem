import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Keyboard, ScanLine, X, RefreshCw, AlertCircle } from 'lucide-react';
import type { ScannerMode } from '../../types/escaner.types';

interface BarcodeScannerProps {
  onScan: (barcode: string, format?: string) => void;
  mode?: 'camera' | 'manual' | 'both';
  compact?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

// Scanner detection: keystrokes < 50ms apart = hardware scanner
const SCANNER_THRESHOLD_MS = 50;
const MIN_BARCODE_LENGTH = 6;
const SCAN_DEBOUNCE_MS = 1500;

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  mode = 'both',
  compact = false,
  autoFocus = true,
  placeholder = 'Escanear o escribir codigo de barras...',
  disabled = false
}) => {
  const [activeMode, setActiveMode] = useState<ScannerMode>(
    mode === 'manual' ? 'manual' : 'camera'
  );
  const [cameraError, setCameraError] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrcodeRef = useRef<any>(null);
  const lastScanRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });
  const keystrokeTimesRef = useRef<number[]>([]);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Start/stop camera when mode changes
  useEffect(() => {
    if (activeMode === 'camera' && !disabled) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [activeMode, disabled]);

  // Auto-focus manual input when switching to manual mode
  useEffect(() => {
    if (activeMode === 'manual' && autoFocus) {
      setTimeout(() => manualInputRef.current?.focus(), 100);
    }
  }, [activeMode, autoFocus]);

  const startCamera = async () => {
    if (!scannerRef.current) return;

    try {
      setCameraError('');
      const { Html5Qrcode } = await import('html5-qrcode');

      const scannerId = `barcode-scanner-${Date.now()}`;
      scannerRef.current.id = scannerId;

      const html5Qrcode = new Html5Qrcode(scannerId);
      html5QrcodeRef.current = html5Qrcode;

      // Responsive qrbox: smaller on mobile
      const isMobile = window.innerWidth < 640;
      const qrboxWidth = compact
        ? (isMobile ? 200 : 250)
        : (isMobile ? 240 : 300);
      const qrboxHeight = compact
        ? (isMobile ? 80 : 100)
        : (isMobile ? 100 : 120);

      await html5Qrcode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: qrboxWidth, height: qrboxHeight },
          aspectRatio: compact ? 2.0 : 1.5
        },
        (decodedText: string, result: any) => {
          handleCameraScan(decodedText, result?.result?.format?.formatName || 'UNKNOWN');
        },
        () => {}
      );

      setIsCameraActive(true);
    } catch (error: any) {
      console.error('Error starting camera:', error);
      if (error?.message?.includes('Permission') || error?.name === 'NotAllowedError') {
        setCameraError('Permiso de camara denegado. Habilita el acceso a la camara en la configuracion del navegador.');
      } else if (error?.message?.includes('not found') || error?.name === 'NotFoundError') {
        setCameraError('No se encontro una camara disponible en este dispositivo.');
      } else {
        setCameraError('Error al iniciar la camara. Intenta con el modo manual.');
      }
      setIsCameraActive(false);
    }
  };

  const stopCamera = async () => {
    try {
      if (html5QrcodeRef.current?.isScanning) {
        await html5QrcodeRef.current.stop();
      }
      html5QrcodeRef.current = null;
      setIsCameraActive(false);
    } catch (error) {
      html5QrcodeRef.current = null;
      setIsCameraActive(false);
    }
  };

  const handleCameraScan = useCallback((barcode: string, format: string) => {
    const now = Date.now();
    const last = lastScanRef.current;

    if (barcode === last.barcode && now - last.time < SCAN_DEBOUNCE_MS) {
      return;
    }

    lastScanRef.current = { barcode, time: now };
    onScan(barcode, format);
  }, [onScan]);

  const handleManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    keystrokeTimesRef.current.push(now);

    if (e.key === 'Enter') {
      e.preventDefault();
      const value = manualValue.trim();
      if (value.length >= MIN_BARCODE_LENGTH) {
        onScan(value, 'MANUAL');
        setManualValue('');
        keystrokeTimesRef.current = [];
      }
    }
  };

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualValue(value);

    const now = Date.now();
    const times = keystrokeTimesRef.current;

    if (times.length >= MIN_BARCODE_LENGTH && value.length >= MIN_BARCODE_LENGTH) {
      const recentTimes = times.slice(-value.length);
      const allRapid = recentTimes.every((t, i) =>
        i === 0 || (t - recentTimes[i - 1]) < SCANNER_THRESHOLD_MS
      );

      if (allRapid && (now - recentTimes[0]) < 500) {
        setTimeout(() => {
          const finalValue = manualInputRef.current?.value?.trim() || '';
          if (finalValue.length >= MIN_BARCODE_LENGTH) {
            onScan(finalValue, 'USB_SCANNER');
            setManualValue('');
            keystrokeTimesRef.current = [];
          }
        }, 100);
      }
    }
  };

  const handleManualSubmit = () => {
    const value = manualValue.trim();
    if (value.length >= MIN_BARCODE_LENGTH) {
      onScan(value, 'MANUAL');
      setManualValue('');
      keystrokeTimesRef.current = [];
    }
  };

  const showModeTabs = mode === 'both';

  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-3'}`}>
      {/* Mode tabs - touch friendly min height */}
      {showModeTabs && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setActiveMode('camera')}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-md text-sm font-medium transition-all ${
              activeMode === 'camera'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Camera className="h-4 w-4" />
            Camara
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('manual')}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-md text-sm font-medium transition-all ${
              activeMode === 'manual'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Keyboard className="h-4 w-4" />
            <span className="hidden sm:inline">Manual / USB</span>
            <span className="sm:hidden">Manual</span>
          </button>
        </div>
      )}

      {/* Camera view */}
      {activeMode === 'camera' && (
        <div className="relative">
          {cameraError ? (
            <div className={`flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg ${compact ? 'p-4' : 'p-5 sm:p-8'}`}>
              <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 text-amber-500 mb-2" />
              <p className="text-xs sm:text-sm text-gray-600 text-center mb-3 px-2">{cameraError}</p>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => { setCameraError(''); startCamera(); }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reintentar
                </button>
                {mode === 'both' && (
                  <button
                    type="button"
                    onClick={() => setActiveMode('manual')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Keyboard className="h-4 w-4" />
                    Modo Manual
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-lg bg-black">
              <div
                ref={scannerRef}
                className="w-full"
                style={{ minHeight: compact ? 160 : 220 }}
              />
              {isCameraActive && (
                <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-black/50 text-white text-xs rounded-full backdrop-blur-sm">
                    <ScanLine className="h-3 w-3 animate-pulse" />
                    Apunta al codigo de barras
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual input */}
      {activeMode === 'manual' && (
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <ScanLine className="h-4 w-4 text-gray-400" />
              </div>
              <input
                ref={manualInputRef}
                type="text"
                inputMode="numeric"
                value={manualValue}
                onChange={handleManualChange}
                onKeyDown={handleManualKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                autoFocus={autoFocus}
                className={`
                  block w-full pl-9 pr-3 py-3 sm:py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm
                  focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  placeholder:text-gray-400
                  ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
                `}
              />
            </div>
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={disabled || manualValue.trim().length < MIN_BARCODE_LENGTH}
              className="px-4 py-3 sm:py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Buscar
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            <span className="hidden sm:inline">Conecta un lector USB/Bluetooth o escribe el codigo manualmente y presiona Enter</span>
            <span className="sm:hidden">Escribe el codigo y presiona Buscar</span>
          </p>
        </div>
      )}
    </div>
  );
};
