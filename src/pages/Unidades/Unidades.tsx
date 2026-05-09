/**
 * Unidades · ruta legacy preservada como redirect (S3.6 M1 chk4.4)
 *
 * La página independiente `/unidades` fue fusionada en el módulo Inventario
 * como modo interno del tab "Inventario" (toggle Stock|Unidades). Para evitar
 * romper enlaces externos, bookmarks o navegación en código existente, esta
 * ruta se mantiene activa y redirige al nuevo destino:
 *
 *     /unidades  →  /inventario?modo=unidades
 *
 * El componente real de listado vive en
 * `src/pages/Inventario/components/sections/UnidadesListView.tsx`.
 *
 * En chk5 se evaluará si eliminar definitivamente la ruta /unidades del router
 * (App.tsx) y del Sidebar, pero solo después de validar que ningún consumer
 * externo (notificaciones, deep links de email, etc.) la use.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

export const Unidades: React.FC = () => {
  return <Navigate to="/inventario?modo=unidades" replace />;
};
