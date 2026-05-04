/**
 * Productos · página principal del catálogo de SKUs.
 *
 * S3.4 (2026-05-04) · LIMPIEZA V1: el componente legacy `ProductosLegacy` y
 * todos sus imports asociados fueron eliminados (Etapa 4 · Fase 10 cleanup).
 * El módulo Productos ahora corre 100% en V2 (`ProductosPageV2`).
 *
 * Snapshot pre-limpieza: tag git `pre-limpieza-v1-2026-05-04` (+ commit 935c012)
 *  + backup de datos en `backups/productos-2026-05-04_19-22-43.json`
 */
import React from 'react';
import { ProductosPageV2 } from './components/shell';

export const Productos: React.FC = () => {
  return <ProductosPageV2 />;
};
