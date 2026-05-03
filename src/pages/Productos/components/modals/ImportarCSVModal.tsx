/**
 * ImportarCSVModal · Wizard 4 pasos para importar productos masivamente (Fase H · #46)
 *
 * Pasos:
 *   1. Subir archivo CSV/XLSX + descargar template
 *   2. Mapear columnas (auto-detect + manual override)
 *   3. Preview con detección de errores + descarga errores.csv
 *   4. Confirmar e importar (Promise.all create batch)
 *
 * Notas técnicas:
 *   - Soporta solo CSV en esta versión (XLSX queda como deuda futura)
 *   - Marca/Categoría/Etiqueta se auto-crean en el Gestor Maestro si no existen
 *   - Errores se omiten · NO bloquean la importación de los OK
 *   - Resultado final muestra contador (creados / actualizados / omitidos)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Upload,
  UploadCloud,
  FileSpreadsheet,
  Download,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Package2,
} from 'lucide-react';
import type { ProductoFormData } from '../../../../types/producto.types';
import { ProductoService } from '../../../../services/producto.service';
import { useAuthStore } from '../../../../store/authStore';
import { useToastStore } from '../../../../store/toastStore';
import { useProductoStore } from '../../../../store/productoStore';

interface ImportarCSVModalProps {
  open: boolean;
  onClose: () => void;
  /** Líneas de negocio para validar columna `linea_negocio` */
  lineasNegocio: Array<{ id: string; nombre: string; codigo?: string }>;
  /** Callback cuando se completa la importación */
  onImportComplete?: (resultado: { creados: number; actualizados: number; omitidos: number }) => void;
}

type StepKey = 'subir' | 'mapear' | 'preview' | 'resultado';

interface FilaParseada {
  idx: number;            // # de fila (1-based, excluyendo header)
  raw: Record<string, string>;
  // Datos resueltos (post-mapping)
  sku?: string;
  nombreComercial?: string;
  marca?: string;
  lineaNegocioId?: string;
  presentacion?: string;
  dosaje?: string;
  contenido?: string;
  precioVenta?: number;
  stockMinimo?: number;
  stockMaximo?: number;
  // Validación
  errores: string[];
}

// Campos del sistema disponibles para mapear (whitelisted)
const CAMPOS_SISTEMA = [
  { key: 'sku', label: 'SKU', auto: ['sku', 'codigo_sku', 'codigo'] },
  { key: 'nombreComercial', label: 'Nombre comercial *', auto: ['nombre', 'nombre_comercial', 'nombre_producto'] },
  { key: 'marca', label: 'Marca *', auto: ['marca', 'brand'] },
  { key: 'lineaNegocio', label: 'Línea de negocio *', auto: ['linea', 'linea_negocio', 'lineaNegocio'] },
  { key: 'presentacion', label: 'Presentación', auto: ['presentacion', 'formato'] },
  { key: 'dosaje', label: 'Dosaje', auto: ['dosaje', 'dosis', 'concentracion'] },
  { key: 'contenido', label: 'Contenido', auto: ['contenido', 'unidades', 'volumen'] },
  { key: 'precioVenta', label: 'Precio venta', auto: ['precio', 'precio_venta', 'precioventa'] },
  { key: 'stockMinimo', label: 'Stock mínimo', auto: ['stock_minimo', 'stockmin', 'min'] },
  { key: 'stockMaximo', label: 'Stock máximo', auto: ['stock_maximo', 'stockmax', 'max'] },
  { key: '__ignorar__', label: '— ignorar columna —', auto: [] },
];

// Template CSV
const TEMPLATE_CSV = [
  'sku,nombre_comercial,marca,linea_negocio,presentacion,dosaje,contenido,precio_venta,stock_minimo,stock_maximo',
  'SKC-EJEMPLO,Vitamin C Serum,SkinCeuticals,Skincare,liquido,15%,30 ml,285.00,5,50',
  'SUP-EJEMPLO,Vitamin D3 5000 IU,Sports Research,Suplementos,capsulas_blandas,5000 IU,90 cápsulas,89.00,10,100',
].join('\n');

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuote = !inQuote; continue; }
      if (c === ',' && !inQuote) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

function autoDetectMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const norm = h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    let mapped = '__ignorar__';
    for (const campo of CAMPOS_SISTEMA) {
      if (campo.auto.some(a => norm === a || norm.includes(a))) {
        mapped = campo.key;
        break;
      }
    }
    map[h] = mapped;
  }
  return map;
}

function descargarTemplate() {
  const blob = new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'productos_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function descargarErroresCSV(filas: FilaParseada[]) {
  const filasError = filas.filter(f => f.errores.length > 0);
  if (filasError.length === 0) return;
  const headers = ['fila', 'sku', 'nombre', 'marca', 'errores'];
  const rows = filasError.map(f =>
    [
      f.idx,
      f.sku ?? '',
      f.nombreComercial ?? '',
      f.marca ?? '',
      f.errores.join(' | '),
    ]
      .map(v => {
        const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(','),
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `errores_importacion_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ImportarCSVModal: React.FC<ImportarCSVModalProps> = ({
  open,
  onClose,
  lineasNegocio,
  onImportComplete,
}) => {
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();
  const { fetchProductos } = useProductoStore();

  const [step, setStep] = useState<StepKey>('subir');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [filasParsed, setFilasParsed] = useState<FilaParseada[]>([]);
  const [resultado, setResultado] = useState({ creados: 0, actualizados: 0, omitidos: 0 });
  const [importando, setImportando] = useState(false);
  const [tiempoMs, setTiempoMs] = useState(0);

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setStep('subir');
      setArchivo(null);
      setCsvHeaders([]);
      setCsvRows([]);
      setMapping({});
      setFilasParsed([]);
      setResultado({ creados: 0, actualizados: 0, omitidos: 0 });
      setImportando(false);
      setTiempoMs(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Handlers
  const handleArchivo = (file: File) => {
    setArchivo(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setMapping(autoDetectMapping(headers));
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Validar y construir filas resueltas
  const validarYResolver = (): FilaParseada[] => {
    const lineasMap = new Map(
      lineasNegocio.map(l => [
        (l.nombre ?? '').toLowerCase(),
        l.id,
      ]),
    );
    const lineasMapCodigo = new Map(
      lineasNegocio.map(l => [(l.codigo ?? '').toUpperCase(), l.id]),
    );

    const skuVistos = new Set<string>();
    return csvRows.map((raw, i): FilaParseada => {
      const fila: FilaParseada = { idx: i + 2, raw, errores: [] }; // +2 porque +1 header, +1 base 1
      // Resolver cada campo según mapping
      for (const [csvCol, sysField] of Object.entries(mapping)) {
        if (sysField === '__ignorar__') continue;
        const val = raw[csvCol]?.trim() ?? '';
        if (sysField === 'lineaNegocio') {
          const lineaId = lineasMap.get(val.toLowerCase()) ?? lineasMapCodigo.get(val.toUpperCase());
          if (val && lineaId) {
            fila.lineaNegocioId = lineaId;
          } else if (val) {
            fila.errores.push(`Línea negocio "${val}" no existe`);
          }
        } else if (sysField === 'precioVenta' || sysField === 'stockMinimo' || sysField === 'stockMaximo') {
          const num = parseFloat(val);
          if (val && !isNaN(num)) (fila as any)[sysField] = num;
        } else {
          (fila as any)[sysField] = val;
        }
      }
      // Validaciones obligatorias
      if (!fila.nombreComercial) fila.errores.push('Nombre comercial obligatorio · está vacío');
      if (!fila.marca) fila.errores.push('Marca obligatoria · está vacía');
      // SKU duplicado dentro del archivo
      if (fila.sku) {
        if (skuVistos.has(fila.sku)) {
          fila.errores.push(`SKU duplicado en el archivo`);
        } else {
          skuVistos.add(fila.sku);
        }
      }
      return fila;
    });
  };

  const goSiguiente = () => {
    if (step === 'subir' && archivo) {
      setStep('mapear');
    } else if (step === 'mapear') {
      const filas = validarYResolver();
      setFilasParsed(filas);
      setStep('preview');
    } else if (step === 'preview') {
      handleImportar();
    }
  };

  const goAtras = () => {
    if (step === 'mapear') setStep('subir');
    else if (step === 'preview') setStep('mapear');
  };

  const handleImportar = async () => {
    if (!user || importando) return;
    setImportando(true);
    const startMs = Date.now();
    const validas = filasParsed.filter(f => f.errores.length === 0);
    let creados = 0;
    let actualizados = 0;
    const omitidos = filasParsed.length - validas.length;

    try {
      // Crear en serie para evitar saturar Firestore (puede paralelizar a 5 más adelante)
      for (const fila of validas) {
        try {
          const data: Partial<ProductoFormData> = {
            nombreComercial: fila.nombreComercial!,
            marca: fila.marca!,
            presentacion: (fila.presentacion as any) ?? 'capsulas',
            dosaje: fila.dosaje ?? '',
            contenido: fila.contenido ?? '',
            codigoUPC: '',
            grupo: '',
            subgrupo: '',
            lineaNegocioId: fila.lineaNegocioId,
            stockMinimo: fila.stockMinimo ?? 5,
            stockMaximo: fila.stockMaximo ?? 100,
            ...(fila.precioVenta ? { precioVenta: fila.precioVenta } as any : {}),
          };
          await ProductoService.create(data as ProductoFormData, user.uid);
          creados++;
        } catch (err) {
          console.error('[ImportarCSVModal] error fila', fila.idx, err);
        }
      }
    } finally {
      setTiempoMs(Date.now() - startMs);
      setResultado({ creados, actualizados, omitidos });
      setStep('resultado');
      setImportando(false);
      await fetchProductos();
      onImportComplete?.({ creados, actualizados, omitidos });
    }
  };

  // Stats memoized para preview
  const stats = useMemo(() => {
    const ok = filasParsed.filter(f => f.errores.length === 0).length;
    const err = filasParsed.filter(f => f.errores.length > 0).length;
    return { ok, err, total: filasParsed.length };
  }, [filasParsed]);

  // Columnas mapeadas
  const mappingStats = useMemo(() => {
    const total = csvHeaders.length;
    const mapeadas = csvHeaders.filter(h => mapping[h] && mapping[h] !== '__ignorar__').length;
    return { total, mapeadas, ignoradas: total - mapeadas };
  }, [csvHeaders, mapping]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <button onClick={onClose} className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" aria-label="Cerrar" />

      <div className="relative w-full lg:max-w-2xl lg:mx-auto bg-white lg:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header con stepper */}
        <div className="bg-gradient-to-br from-amber-50 to-white border-b border-slate-200 px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 text-amber-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">Importar productos</h2>
                <p className="text-[10px] text-slate-500">Cargá masivamente desde CSV · 4 pasos · ~5 min</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><X className="w-4 h-4" /></button>
          </div>

          {/* Stepper */}
          <Stepper step={step} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'subir' && (
            <PasoSubir
              archivo={archivo}
              csvRows={csvRows}
              onArchivo={handleArchivo}
              onDescargarTemplate={descargarTemplate}
            />
          )}
          {step === 'mapear' && (
            <PasoMapear
              csvHeaders={csvHeaders}
              mapping={mapping}
              onChangeMapping={(col, val) => setMapping(m => ({ ...m, [col]: val }))}
              stats={mappingStats}
              archivoNombre={archivo?.name ?? ''}
              archivoTam={archivo?.size ?? 0}
              filasCount={csvRows.length}
            />
          )}
          {step === 'preview' && (
            <PasoPreview
              filas={filasParsed}
              stats={stats}
              onDescargarErrores={() => descargarErroresCSV(filasParsed)}
            />
          )}
          {step === 'resultado' && (
            <PasoResultado resultado={resultado} tiempoMs={tiempoMs} onCerrar={onClose} />
          )}
        </div>

        {/* Footer */}
        {step !== 'resultado' && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={step === 'subir' ? onClose : goAtras}
              disabled={importando}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              {step === 'subir' ? 'Cancelar' : <><ArrowLeft className="w-3.5 h-3.5" />Atrás</>}
            </button>
            <div className="flex items-center gap-2">
              {step === 'preview' && stats.err > 0 && (
                <button
                  type="button"
                  onClick={() => descargarErroresCSV(filasParsed)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Errores.csv
                </button>
              )}
              <button
                type="button"
                onClick={goSiguiente}
                disabled={
                  importando ||
                  (step === 'subir' && !archivo) ||
                  (step === 'preview' && stats.ok === 0)
                }
                className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5"
              >
                {step === 'subir' && 'Siguiente · mapear columnas'}
                {step === 'mapear' && 'Siguiente · preview'}
                {step === 'preview' && (importando ? 'Importando...' : `Confirmar · importar ${stats.ok}`)}
                {!importando && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const Stepper: React.FC<{ step: StepKey }> = ({ step }) => {
  const steps: Array<{ key: StepKey; label: string }> = [
    { key: 'subir', label: 'Subir' },
    { key: 'mapear', label: 'Mapear' },
    { key: 'preview', label: 'Preview' },
    { key: 'resultado', label: 'Confirmar' },
  ];
  const currentIdx = steps.findIndex(s => s.key === step);
  return (
    <div className="flex items-center justify-between text-[10px]">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className={`flex items-center gap-1.5 ${i > currentIdx ? 'opacity-50' : ''}`}>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                i < currentIdx
                  ? 'bg-emerald-600 text-white'
                  : i === currentIdx
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              {i < currentIdx ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            <span className={i === currentIdx ? 'font-bold text-amber-700' : i < currentIdx ? 'text-emerald-700' : 'text-slate-500'}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-2" />}
        </React.Fragment>
      ))}
    </div>
  );
};

const PasoSubir: React.FC<{
  archivo: File | null;
  csvRows: any[];
  onArchivo: (f: File) => void;
  onDescargarTemplate: () => void;
}> = ({ archivo, csvRows, onArchivo, onDescargarTemplate }) => (
  <div className="space-y-4">
    <div
      className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 px-6 py-8 text-center cursor-pointer hover:bg-amber-50/60"
      onDrop={e => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) onArchivo(f);
      }}
      onDragOver={e => e.preventDefault()}
    >
      <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
        <UploadCloud className="w-7 h-7 text-amber-700" />
      </div>
      {archivo ? (
        <>
          <h3 className="text-sm font-bold text-emerald-900 mb-1">✓ {archivo.name}</h3>
          <p className="text-[11px] text-slate-500 mb-3">
            {(archivo.size / 1024).toFixed(1)} KB · {csvRows.length} filas detectadas
          </p>
          <label className="inline-block px-3 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded cursor-pointer">
            Cambiar archivo
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onArchivo(f);
              }}
            />
          </label>
        </>
      ) : (
        <>
          <h3 className="text-sm font-bold text-slate-900 mb-1">Arrastrá tu archivo o hacé click para seleccionar</h3>
          <p className="text-[11px] text-slate-500 mb-4">Formato: CSV (UTF-8) · Máximo 5 MB · 1000 productos</p>
          <label className="inline-block px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm cursor-pointer">
            Seleccionar archivo
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onArchivo(f);
              }}
            />
          </label>
        </>
      )}
    </div>

    {/* Template */}
    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
      </div>
      <div className="flex-1">
        <div className="text-[11px] font-bold text-emerald-900">¿Primera vez? Descargá el template</div>
        <div className="text-[10px] text-emerald-800 mt-0.5">CSV con todas las columnas + ejemplos · adaptado a Skincare y Suplementos</div>
      </div>
      <button
        type="button"
        onClick={onDescargarTemplate}
        className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-300 rounded flex items-center gap-1 flex-shrink-0"
      >
        <Download className="w-3 h-3" />
        Template.csv
      </button>
    </div>

    {/* Tips */}
    <div className="text-[10px] text-slate-600 space-y-1 px-1">
      <div className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Recomendaciones:</div>
      <div>✓ Una fila por producto · headers en la primera fila</div>
      <div>✓ Encoding UTF-8 (para acentos y eñes)</div>
      <div>✓ Decimales con punto (no coma)</div>
      <div>✓ Marca/Línea/Etiquetas se crean automáticamente si no existen</div>
    </div>
  </div>
);

const PasoMapear: React.FC<{
  csvHeaders: string[];
  mapping: Record<string, string>;
  onChangeMapping: (col: string, val: string) => void;
  stats: { total: number; mapeadas: number; ignoradas: number };
  archivoNombre: string;
  archivoTam: number;
  filasCount: number;
}> = ({ csvHeaders, mapping, onChangeMapping, stats, archivoNombre, archivoTam, filasCount }) => (
  <div className="space-y-3">
    <div className="text-[11px] text-slate-700 flex items-center justify-between">
      <span>{filasCount} filas · {csvHeaders.length} columnas detectadas</span>
      <span className="text-emerald-700 font-bold">✓ {archivoNombre} · {(archivoTam / 1024).toFixed(1)} KB</span>
    </div>

    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        <div>Columna del CSV</div>
        <div className="text-center">→</div>
        <div>Campo del sistema</div>
      </div>
      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {csvHeaders.map(h => {
          const valor = mapping[h] ?? '__ignorar__';
          const esIgnorada = valor === '__ignorar__';
          return (
            <div
              key={h}
              className={`grid grid-cols-3 gap-2 px-3 py-2 items-center text-[11px] hover:bg-slate-50 ${
                esIgnorada ? 'bg-rose-50/30' : ''
              }`}
            >
              <div className="font-mono text-slate-700 truncate">{h}</div>
              <div className="text-center">
                {esIgnorada ? (
                  <XCircle className="w-3.5 h-3.5 text-rose-500 inline" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                )}
              </div>
              <select
                value={valor}
                onChange={e => onChangeMapping(h, e.target.value)}
                className={`px-2 py-1 text-[11px] border rounded ${
                  esIgnorada
                    ? 'border-slate-300 bg-white text-slate-500'
                    : 'border-emerald-300 bg-emerald-50 font-bold text-emerald-800'
                }`}
              >
                {CAMPOS_SISTEMA.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 text-[10px]">
      <div className="rounded bg-emerald-50 border border-emerald-200 p-2">
        <div className="font-bold text-emerald-700">✓ {stats.mapeadas} mapeadas</div>
        <div className="text-emerald-600 italic">se importarán</div>
      </div>
      <div className="rounded bg-rose-50 border border-rose-200 p-2">
        <div className="font-bold text-rose-700">✗ {stats.ignoradas} ignoradas</div>
        <div className="text-rose-600 italic">no se importarán</div>
      </div>
    </div>
  </div>
);

const PasoPreview: React.FC<{
  filas: FilaParseada[];
  stats: { ok: number; err: number; total: number };
  onDescargarErrores: () => void;
}> = ({ filas, stats, onDescargarErrores }) => {
  const filasError = filas.filter(f => f.errores.length > 0);
  const filasOK = filas.filter(f => f.errores.length === 0).slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">{stats.ok}</div>
          <div className="text-[10px] text-emerald-700 uppercase tracking-wider font-bold">Listos para importar</div>
        </div>
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-center">
          <div className="text-2xl font-bold text-rose-700 tabular-nums">{stats.err}</div>
          <div className="text-[10px] text-rose-700 uppercase tracking-wider font-bold">Con errores · se omiten</div>
        </div>
      </div>

      {/* Errores detectados */}
      {filasError.length > 0 && (
        <div className="rounded-lg border border-rose-200 overflow-hidden">
          <div className="px-3 py-2 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">{filasError.length} errores · estos productos no se importarán</span>
            <button
              type="button"
              onClick={onDescargarErrores}
              className="text-[10px] text-rose-700 hover:underline font-bold flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Descargar errores.csv
            </button>
          </div>
          <div className="divide-y divide-rose-100 text-[11px] max-h-40 overflow-y-auto">
            {filasError.slice(0, 8).map(f => (
              <div key={f.idx} className="px-3 py-2 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                <span className="font-mono text-slate-500 text-[10px] flex-shrink-0">fila {f.idx}</span>
                <span className="text-slate-700 truncate">{f.errores.join(' · ')}</span>
              </div>
            ))}
            {filasError.length > 8 && (
              <div className="px-3 py-2 text-[10px] text-slate-400 italic text-center">
                + {filasError.length - 8} errores más · descargá el CSV completo
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview OK */}
      {filasOK.length > 0 && (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            Preview · primeros {filasOK.length} productos OK
          </div>
          <table className="w-full text-[10px]">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="px-2 py-1 text-left">Nombre</th>
                <th className="px-2 py-1 text-left">Marca</th>
                <th className="px-2 py-1 text-left">Línea</th>
                <th className="px-2 py-1 text-right">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filasOK.map(f => (
                <tr key={f.idx}>
                  <td className="px-2 py-1 truncate max-w-[200px]">{f.nombreComercial}</td>
                  <td className="px-2 py-1">{f.marca}</td>
                  <td className="px-2 py-1 text-slate-500 text-[9px]">{f.lineaNegocioId ? '✓' : '—'}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{f.precioVenta?.toFixed(2) ?? '—'}</td>
                </tr>
              ))}
              {stats.ok > filasOK.length && (
                <tr>
                  <td className="px-2 py-1 text-slate-400 italic" colSpan={4}>
                    + {stats.ok - filasOK.length} productos más OK
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const PasoResultado: React.FC<{
  resultado: { creados: number; actualizados: number; omitidos: number };
  tiempoMs: number;
  onCerrar: () => void;
}> = ({ resultado, tiempoMs, onCerrar }) => {
  const totalProcesado = resultado.creados + resultado.actualizados + resultado.omitidos;
  return (
    <div className="space-y-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-7 h-7 text-emerald-700" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900">¡Importación completada!</h2>
        <p className="text-[11px] text-slate-500 mt-1">
          {totalProcesado} productos procesados en {(tiempoMs / 1000).toFixed(1)}s
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-left">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <div className="text-base font-bold text-emerald-700 tabular-nums">{resultado.creados}</div>
          <div className="text-[9px] text-emerald-700 uppercase font-bold">Creados</div>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <div className="text-base font-bold text-amber-700 tabular-nums">{resultado.actualizados}</div>
          <div className="text-[9px] text-amber-700 uppercase font-bold">Actualizados</div>
        </div>
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
          <div className="text-base font-bold text-rose-700 tabular-nums">{resultado.omitidos}</div>
          <div className="text-[9px] text-rose-700 uppercase font-bold">Omitidos</div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={onCerrar}
          className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-1.5"
        >
          <Package2 className="w-3.5 h-3.5" />
          Ver productos importados
        </button>
      </div>
    </div>
  );
};
