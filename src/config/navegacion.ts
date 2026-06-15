/**
 * src/config/navegacion.ts
 * 2026-06-13 · Fuente ÚNICA de la navegación del sistema (grupos → items → permiso).
 *
 * Consumida por:
 *   · Sidebar (navegación lateral)
 *   · MisAreas (perfil · "a qué secciones tengo acceso" · derivado de permisos)
 *
 * DRY: un solo lugar define qué secciones existen, a qué grupo pertenecen y qué
 * permiso requiere cada una. Antes vivía como const local en Sidebar.tsx.
 */
import type { FC } from 'react';
import {
  ShoppingCart, ShoppingBag, FileText, ClipboardList, Droplets,
  Package, Warehouse, Box, ArrowRightLeft, Network, ScanLine, Boxes,
  Users, Banknote, Landmark, BrainCircuit,
  Coins, DollarSign, Receipt, BookOpen, Wallet,
  TrendingUp, Calculator, Zap, Activity, Target, MapPin, BarChart3,
  Palette, Database, Settings, Shield,
} from 'lucide-react';
import { PERMISOS } from '../types/auth.types';

export interface MenuItem {
  icon: FC<{ className?: string }>;
  label: string;
  path: string;
  permiso?: string;
}

export interface MenuGroup {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
  items: MenuItem[];
  defaultOpen?: boolean;
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'comercial',
    label: 'Comercial',
    icon: ShoppingBag,
    defaultOpen: true,
    items: [
      { icon: ShoppingCart, label: 'Compras', path: '/compras', permiso: PERMISOS.VER_ORDENES_COMPRA },
      { icon: ShoppingBag, label: 'Ventas', path: '/ventas', permiso: PERMISOS.VER_VENTAS },
      { icon: FileText, label: 'Cotizaciones', path: '/cotizaciones', permiso: PERMISOS.VER_COTIZACIONES },
      { icon: ClipboardList, label: 'Requerimientos', path: '/requerimientos', permiso: PERMISOS.VER_REQUERIMIENTOS },
      { icon: Droplets, label: 'Mercado Libre', path: '/mercado-libre', permiso: PERMISOS.VER_VENTAS },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: Boxes,
    defaultOpen: true,
    items: [
      { icon: Package, label: 'Productos', path: '/productos', permiso: PERMISOS.VER_INVENTARIO },
      { icon: Warehouse, label: 'Stock', path: '/inventario', permiso: PERMISOS.VER_INVENTARIO },
      { icon: Box, label: 'Unidades', path: '/inventario?modo=unidades', permiso: PERMISOS.GESTIONAR_INVENTARIO },
      { icon: ArrowRightLeft, label: 'Envíos', path: '/envios', permiso: PERMISOS.TRANSFERIR_UNIDADES },
      { icon: Network, label: 'Red Logística', path: '/red-logistica', permiso: PERMISOS.VER_INVENTARIO },
      { icon: ScanLine, label: 'Escaner', path: '/escaner', permiso: PERMISOS.VER_INVENTARIO },
    ],
  },
  {
    id: 'equipo',
    label: 'Equipo',
    icon: Users,
    defaultOpen: true,
    items: [
      { icon: Users, label: 'Usuarios', path: '/usuarios', permiso: PERMISOS.GESTIONAR_USUARIOS },
      { icon: Banknote, label: 'Planilla', path: '/planilla', permiso: PERMISOS.VER_PLANILLA },
      { icon: Landmark, label: 'Inversionistas', path: '/inversionistas', permiso: PERMISOS.VER_INVERSIONISTAS },
      { icon: BrainCircuit, label: 'Notas IA', path: '/notas-ia', permiso: PERMISOS.VER_DASHBOARD },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas y Contabilidad',
    icon: Wallet,
    defaultOpen: false,
    items: [
      { icon: Coins, label: 'Finanzas', path: '/finanzas', permiso: PERMISOS.VER_TESORERIA },
      { icon: DollarSign, label: 'Tipo de Cambio', path: '/tipo-cambio', permiso: PERMISOS.VER_TESORERIA },
      { icon: Receipt, label: 'Gastos', path: '/gastos', permiso: PERMISOS.VER_GASTOS },
      { icon: BookOpen, label: 'Contabilidad', path: '/contabilidad', permiso: PERMISOS.VER_TESORERIA },
    ],
  },
  {
    id: 'analisis',
    label: 'Análisis',
    icon: BarChart3,
    defaultOpen: true,
    items: [
      { icon: TrendingUp, label: 'Reportes', path: '/reportes', permiso: PERMISOS.VER_REPORTES },
      { icon: Calculator, label: 'Costos CTRU', path: '/ctru', permiso: PERMISOS.VER_CTRU },
      { icon: Zap, label: 'Intel. Productos', path: '/productos-intel', permiso: PERMISOS.VER_INVENTARIO },
      { icon: BrainCircuit, label: 'Cost Intelligence', path: '/intel-productos', permiso: PERMISOS.VER_INVENTARIO },
      { icon: Activity, label: 'Rendimiento FX', path: '/rendimiento-cambiario', permiso: PERMISOS.VER_TESORERIA },
      { icon: Target, label: 'Proyeccion', path: '/proyeccion', permiso: PERMISOS.VER_CTRU },
      { icon: MapPin, label: 'Mapa Ventas', path: '/mapa-ventas', permiso: PERMISOS.VER_REPORTES },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    icon: Shield,
    defaultOpen: false,
    items: [
      { icon: Palette, label: 'Líneas de Negocio', path: '/lineas-negocio', permiso: PERMISOS.GESTIONAR_CONFIGURACION },
      { icon: Database, label: 'Maestros', path: '/maestros', permiso: PERMISOS.GESTIONAR_CONFIGURACION },
      { icon: Activity, label: 'Auditoría', path: '/auditoria', permiso: PERMISOS.VER_AUDITORIA },
      { icon: Settings, label: 'Configuración', path: '/configuracion', permiso: PERMISOS.GESTIONAR_CONFIGURACION },
    ],
  },
];

/**
 * Color por grupo · canon de gobernanza de color (grupoColor.ts).
 * Usado por MisAreas para pintar cada grupo de secciones con su identidad.
 */
export const GRUPO_COLOR: Record<string, { fg: string; bg: string; ring: string; hover: string }> = {
  comercial:  { fg: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'ring-blue-200',   hover: 'hover:bg-blue-100' },
  inventario: { fg: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-200', hover: 'hover:bg-orange-100' },
  equipo:     { fg: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-200', hover: 'hover:bg-violet-100' },
  finanzas:   { fg: 'text-teal-600',   bg: 'bg-teal-50',   ring: 'ring-teal-200',   hover: 'hover:bg-teal-100' },
  analisis:   { fg: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'ring-indigo-200', hover: 'hover:bg-indigo-100' },
  admin:      { fg: 'text-slate-600',  bg: 'bg-slate-50',  ring: 'ring-slate-200',  hover: 'hover:bg-slate-100' },
};
