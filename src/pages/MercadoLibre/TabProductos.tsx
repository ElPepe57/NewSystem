import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Package,
  RefreshCw,
  LinkIcon,
  Unlink,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  Trophy,
  DollarSign,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import { useMercadoLibreStore } from '../../store/mercadoLibreStore';
import { useProductoStore } from '../../store/productoStore';
import { Modal } from '../../components/common/Modal';
import { PricingIntelPanel } from '../../components/modules/mercadoLibre/PricingIntelPanel';
import { BuyBoxBadge } from './BuyBoxBadge';
import type { MLProductMap, MLProductGroup } from '../../types/mercadoLibre.types';
import type { Producto } from '../../types/producto.types';

// ---- MOBILE: LISTING SUB-ITEM ----
const MobileListingItem: React.FC<{ listing: MLProductMap }> = ({ listing }) => {
  const listingType = listing.mlListingType || (listing.mlCatalogProductId ? 'catalogo' : 'clasica');

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/50">
      <span className="w-1 h-8 bg-gray-200 rounded-full shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            listingType === 'catalogo' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {listingType === 'catalogo' ? 'Catálogo' : 'Clásica'}
          </span>
          <span className="text-xs font-medium text-gray-700">S/ {listing.mlPrice?.toFixed(2)}</span>
          {listing.buyBoxStatus && listingType === 'catalogo' && (
            <BuyBoxBadge listing={listing} />
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">{listing.mlItemId}</p>
      </div>
      <a
        href={listing.mlPermalink}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 text-gray-400 hover:text-amber-600 rounded-lg shrink-0"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
};

// ---- MOBILE: PRODUCT GROUP CARD ----
export const ProductGroupCard: React.FC<{
  group: MLProductGroup;
  stockERP?: number;
  onVincular: (pm: MLProductMap) => void;
  onDesvincular: (pm: MLProductMap) => void;
}> = ({ group, stockERP, onVincular, onDesvincular }) => {
  const [expanded, setExpanded] = useState(false);
  const hasMultiple = group.listings.length > 1;
  const primaryListing = group.listings[0];

  const prices = group.listings.map((l) => l.mlPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceDisplay = minPrice === maxPrice
    ? `S/ ${minPrice.toFixed(2)}`
    : `S/ ${minPrice.toFixed(2)} – ${maxPrice.toFixed(2)}`;

  const stockMismatch = group.vinculado && stockERP !== undefined && stockERP !== group.stockML;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header: imagen + titulo + badge */}
      <div className="flex items-start gap-3 p-3">
        {primaryListing.mlThumbnail && (
          <img src={primaryListing.mlThumbnail} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">{primaryListing.mlTitle}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <p className="text-[10px] text-gray-400">{primaryListing.mlItemId}</p>
            {hasMultiple && (
              <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                {group.listings.length} pub.
              </span>
            )}
            {group.vinculado ? (
              <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">Vinculado</span>
            ) : (
              <span className="text-[10px] font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full">Pendiente</span>
            )}
          </div>
        </div>
        {/* Acciones */}
        <div className="flex items-center gap-0.5 shrink-0">
          {group.vinculado ? (
            <button
              onClick={() => onDesvincular(primaryListing)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
              title="Desvincular"
            >
              <Unlink className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => onVincular(primaryListing)}
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
              title="Vincular"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
          )}
          <a
            href={primaryListing.mlPermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Datos: grid compacto */}
      <div className="grid grid-cols-3 gap-px bg-gray-100 border-t border-gray-100">
        <div className="bg-white px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Precio</p>
          <p className="text-sm font-semibold text-gray-900">{priceDisplay}</p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Stock ML</p>
          <p className="text-sm font-semibold text-gray-900">{group.stockML}</p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Stock ERP</p>
          {group.vinculado ? (
            <p className={`text-sm font-semibold ${stockMismatch ? 'text-orange-600' : 'text-gray-900'}`}>
              {stockERP ?? '—'} {stockMismatch && <AlertTriangle className="w-3 h-3 inline" />}
            </p>
          ) : (
            <p className="text-sm text-gray-300">—</p>
          )}
        </div>
      </div>

      {/* SKU + Producto ERP + Competencia */}
      <div className="border-t border-gray-100 px-3 py-2 space-y-1.5">
        {group.mlSku && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">SKU</span>
            <span className="text-xs text-gray-600 font-mono">{group.mlSku}</span>
          </div>
        )}
        {group.vinculado && group.productoNombre && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-gray-400 shrink-0">ERP</span>
            <span className="text-xs text-gray-700 font-medium truncate">{group.productoNombre}</span>
          </div>
        )}
        {!group.vinculado && (
          <button
            onClick={() => onVincular(primaryListing)}
            className="w-full text-xs text-amber-600 hover:text-amber-700 font-medium py-1 text-center"
          >
            Vincular producto
          </button>
        )}
        {/* Buy Box badge inline */}
        {primaryListing.mlListingType === 'catalogo' && primaryListing.buyBoxStatus && (
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-gray-400">Competencia</span>
            <BuyBoxBadge listing={primaryListing} />
          </div>
        )}
      </div>

      {/* Expand sub-listings */}
      {hasMultiple && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 py-2 border-t border-gray-100 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {expanded ? 'Ocultar publicaciones' : `Ver ${group.listings.length} publicaciones`}
          </button>
          {expanded && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {group.listings.map((listing) => (
                <MobileListingItem key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---- LISTING SUB-ROW (publicacion individual dentro de un grupo) ----
const ListingSubRow: React.FC<{ listing: MLProductMap }> = ({ listing }) => {
  const { updatePrice } = useMercadoLibreStore();
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState(String(listing.mlPrice));
  const [savingPrice, setSavingPrice] = useState(false);

  const listingType = listing.mlListingType || (listing.mlCatalogProductId ? 'catalogo' : 'clasica');

  const handleSavePrice = async () => {
    const newPrice = parseFloat(priceValue);
    if (isNaN(newPrice) || newPrice <= 0 || newPrice === listing.mlPrice) {
      setEditingPrice(false);
      return;
    }
    setSavingPrice(true);
    try {
      await updatePrice(listing.id, newPrice);
      setEditingPrice(false);
    } catch {
      // error in store
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <tr className="bg-gray-50/50 hover:bg-gray-100/50">
      <td className="px-2 py-2"></td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2 pl-4">
          <span className="w-1 h-6 bg-gray-200 rounded-full" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                listingType === 'catalogo'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {listingType === 'catalogo' ? 'Catálogo' : 'Clásica'}
              </span>
              <p className="text-xs text-gray-500 truncate max-w-[160px]">{listing.mlTitle}</p>
            </div>
            <p className="text-[10px] text-gray-400">{listing.mlItemId}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-xs text-gray-500">{listing.mlSku || '—'}</td>
      <td className="px-4 py-2">
        {editingPrice ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">S/</span>
            <input
              type="number"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePrice();
                if (e.key === 'Escape') setEditingPrice(false);
              }}
              className="w-20 px-1.5 py-0.5 border border-amber-300 rounded text-xs focus:ring-amber-500 focus:border-amber-500"
              autoFocus
              step="0.01"
              min="0.01"
            />
            {savingPrice ? (
              <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
            ) : (
              <>
                <button onClick={handleSavePrice} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => setEditingPrice(false)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => { setPriceValue(String(listing.mlPrice)); setEditingPrice(true); }}
            className="group flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-amber-600"
            title="Editar precio en ML"
          >
            S/ {listing.mlPrice?.toFixed(2)}
            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </td>
      <td className="px-4 py-2 text-xs text-gray-500">{listing.mlAvailableQuantity}</td>
      <td className="px-4 py-2" colSpan={2}></td>
      <td className="px-4 py-2">
        <BuyBoxBadge listing={listing} />
      </td>
      <td className="px-4 py-2"></td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end">
          <a
            href={listing.mlPermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Ver en ML"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </td>
    </tr>
  );
};

// ---- PRODUCT GROUP ROW (agrupado por SKU) ----
const ProductGroupRow: React.FC<{
  group: MLProductGroup;
  stockERP?: number;
  onVincular: (pm: MLProductMap) => void;
  onDesvincular: (pm: MLProductMap) => void;
}> = ({ group, stockERP, onVincular, onDesvincular }) => {
  const [expanded, setExpanded] = useState(false);
  const hasMultiple = group.listings.length > 1;
  const primaryListing = group.listings[0];

  const prices = group.listings.map((l) => l.mlPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceDisplay = minPrice === maxPrice
    ? `S/ ${minPrice.toFixed(2)}`
    : `S/ ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`;

  return (
    <>
      {/* Fila principal del grupo */}
      <tr className="hover:bg-gray-50">
        <td className="px-2 py-3">
          {hasMultiple ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-0.5 text-gray-400 hover:text-gray-600 rounded"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4 h-4 block" />
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {primaryListing.mlThumbnail && (
              <img src={primaryListing.mlThumbnail} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{primaryListing.mlTitle}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-gray-400">{primaryListing.mlItemId}</p>
                {hasMultiple && (
                  <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                    {group.listings.length} publicaciones
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{group.mlSku || '—'}</td>
        <td className="px-4 py-3 text-sm font-medium">{priceDisplay}</td>
        <td className="px-4 py-3 text-sm">{group.stockML}</td>
        <td className="px-4 py-3 text-sm">
          {group.vinculado ? (
            stockERP !== undefined && stockERP !== group.stockML ? (
              <span className="inline-flex items-center gap-1 text-orange-700 font-medium">
                {stockERP}
                <AlertTriangle className="w-3 h-3" />
              </span>
            ) : (
              <span className="text-gray-600">{stockERP ?? '—'}</span>
            )
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          {group.vinculado ? (
            <div>
              <p className="text-sm font-medium text-gray-900">{group.productoNombre}</p>
              <p className="text-xs text-gray-400">{group.productoSku}</p>
            </div>
          ) : (
            <button
              onClick={() => onVincular(primaryListing)}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium hover:underline"
            >
              Vincular producto
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <BuyBoxBadge listing={primaryListing} />
        </td>
        <td className="px-4 py-3">
          {group.vinculado ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Vinculado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" /> Pendiente
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {group.vinculado ? (
              <button
                onClick={() => onDesvincular(primaryListing)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Desvincular grupo"
              >
                <Unlink className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onVincular(primaryListing)}
                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                title="Vincular"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
            )}
            <a
              href={primaryListing.mlPermalink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Ver en ML"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </td>
      </tr>

      {/* Sub-filas expandidas: publicaciones individuales */}
      {expanded && hasMultiple && group.listings.map((listing) => (
        <ListingSubRow key={listing.id} listing={listing} />
      ))}
    </>
  );
};

// ---- MODAL VINCULAR PRODUCTO ----
const VincularProductoModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  mlProduct: MLProductMap | null;
  onSelect: (producto: Producto) => Promise<void>;
}> = ({ isOpen, onClose, mlProduct, onSelect }) => {
  const { productos, fetchProductos } = useProductoStore();
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && productos.length === 0) {
      fetchProductos();
    }
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen, productos.length, fetchProductos]);

  const filtered = useMemo(() => {
    if (!search) return productos.filter((p) => p.estado === 'activo');
    const s = search.toLowerCase();
    return productos.filter(
      (p) =>
        p.estado === 'activo' &&
        (p.nombreComercial.toLowerCase().includes(s) ||
          p.sku.toLowerCase().includes(s) ||
          p.marca.toLowerCase().includes(s))
    );
  }, [productos, search]);

  const handleSelect = async (producto: Producto) => {
    setSaving(true);
    try {
      await onSelect(producto);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vincular con Producto ERP"
      subtitle={mlProduct?.mlTitle || ''}
      size="md"
    >
      <div className="space-y-4">
        {/* Info del producto ML */}
        {mlProduct && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            {mlProduct.mlThumbnail && (
              <img src={mlProduct.mlThumbnail} alt="" className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{mlProduct.mlTitle}</p>
              <p className="text-xs text-gray-500">
                {mlProduct.mlItemId} · SKU: {mlProduct.mlSku || '—'} · S/ {mlProduct.mlPrice?.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Buscador */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
            autoFocus
          />
        </div>

        {/* Lista de productos */}
        <div className="max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              {search ? 'No se encontraron productos' : 'Cargando productos...'}
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                disabled={saving}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 transition-colors text-left disabled:opacity-50"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.marca} {p.nombreComercial}
                  </p>
                  <p className="text-xs text-gray-500">
                    SKU: {p.sku} · {p.presentacion} {p.contenido} · Stock: {p.stockDisponible ?? 0}
                  </p>
                </div>
                <LinkIcon className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          {filtered.length} producto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>
    </Modal>
  );
};

// ---- PRODUCTOS TAB ----
export interface TabProductosProps {
  productMaps: MLProductMap[];
  productGroups: MLProductGroup[];
  syncing: boolean;
  syncingStock: boolean;
  syncingBuyBox: boolean;
  onSync: () => void;
  onSyncStock: () => void;
  onSyncBuyBox: () => void;
}

export const TabProductos: React.FC<TabProductosProps> = ({
  productMaps,
  productGroups,
  syncing,
  syncingStock,
  syncingBuyBox,
  onSync,
  onSyncStock,
  onSyncBuyBox,
}) => {
  const [view, setView] = useState<'productos' | 'precios'>('productos');
  const [filter, setFilter] = useState<'todos' | 'vinculados' | 'sin_vincular'>('todos');
  const [search, setSearch] = useState('');
  const [vinculandoPM, setVinculandoPM] = useState<MLProductMap | null>(null);
  const { vincularProducto, desvincularProducto } = useMercadoLibreStore();
  const { productos, fetchProductos } = useProductoStore();

  useEffect(() => {
    if (productos.length === 0) fetchProductos();
  }, [productos.length, fetchProductos]);

  const stockERPMap = useMemo(() => {
    const map = new Map<string, number>();
    productos.forEach((p) => {
      const stock = p.stockEfectivoML ?? p.stockDisponiblePeru ?? p.stockDisponible ?? 0;
      map.set(p.id, stock);
    });
    return map;
  }, [productos]);

  const filteredGroups = useMemo(() => {
    return productGroups.filter((g) => {
      if (filter === 'vinculados' && !g.vinculado) return false;
      if (filter === 'sin_vincular' && g.vinculado) return false;
      if (search) {
        const s = search.toLowerCase();
        return g.listings.some(
          (p) =>
            p.mlTitle.toLowerCase().includes(s) ||
            p.mlSku?.toLowerCase().includes(s) ||
            p.productoNombre?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [productGroups, filter, search]);

  const handleVincular = (pm: MLProductMap) => {
    setVinculandoPM(pm);
  };

  const handleDesvincular = async (pm: MLProductMap) => {
    const siblings = productMaps.filter((p) => p.mlSku && p.mlSku === pm.mlSku && p.id !== pm.id);
    const msg = siblings.length > 0
      ? `¿Desvincular "${pm.mlTitle}" y ${siblings.length} publicacion(es) hermana(s) del producto ERP?`
      : `¿Desvincular "${pm.mlTitle}" del producto ERP?`;
    if (!confirm(msg)) return;
    try {
      await desvincularProducto(pm.id);
    } catch {
      // error handled in store
    }
  };

  const handleSelectProducto = async (producto: Producto) => {
    if (!vinculandoPM) return;
    try {
      await vincularProducto(
        vinculandoPM.id,
        producto.id,
        producto.sku,
        `${producto.marca} ${producto.nombreComercial}`
      );
      setVinculandoPM(null);
    } catch {
      // error handled in store
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar — responsive */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
            {(['todos', 'vinculados', 'sin_vincular'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === f
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="sm:hidden">{f === 'todos' ? 'Todos' : f === 'vinculados' ? 'Vinc.' : 'Pend.'}</span>
                <span className="hidden sm:inline">{f === 'todos' ? 'Todos' : f === 'vinculados' ? 'Vinculados' : 'Sin vincular'}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSyncBuyBox}
            disabled={syncingBuyBox}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg disabled:opacity-50"
            title="Consultar estado de competencia (Buy Box) en ML"
          >
            <Trophy className={`w-3.5 h-3.5 ${syncingBuyBox ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{syncingBuyBox ? 'Consultando...' : 'Buy Box'}</span>
          </button>
          <button
            onClick={onSyncStock}
            disabled={syncingStock}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg disabled:opacity-50"
            title="Sincronizar stock del ERP hacia ML"
          >
            <ArrowUpDown className={`w-3.5 h-3.5 ${syncingStock ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{syncingStock ? 'Sincronizando...' : 'Sync Stock'}</span>
          </button>
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
          <div className="w-px h-6 bg-gray-200" />
          <button
            onClick={() => setView(view === 'productos' ? 'precios' : 'productos')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm rounded-lg transition-colors ${
              view === 'precios'
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={view === 'precios' ? 'Ver productos' : 'Ver pricing inteligente'}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{view === 'precios' ? 'Productos' : 'Precios'}</span>
          </button>
        </div>
      </div>

      {/* Pricing Intel view */}
      {view === 'precios' ? (
        <PricingIntelPanel productMaps={productMaps} />
      ) : (
        <div className="space-y-4">
          {/* Product list */}
          {productMaps.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No hay productos sincronizados</p>
              <button
                onClick={onSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizar ahora
              </button>
            </div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="w-8 px-2 py-3"></th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Producto ML</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">SKU ML</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Precio</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Stock ML</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Stock ERP</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Producto ERP</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Competencia</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Estado</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredGroups.map((group) => (
                      <ProductGroupRow
                        key={group.groupKey}
                        group={group}
                        stockERP={group.productoId ? stockERPMap.get(group.productoId) : undefined}
                        onVincular={handleVincular}
                        onDesvincular={handleDesvincular}
                      />
                    ))}
                  </tbody>
                </table>
                {filteredGroups.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">No se encontraron productos</p>
                )}
              </div>

              {/* Mobile: cards */}
              <div className="md:hidden space-y-3">
                {filteredGroups.map((group) => (
                  <ProductGroupCard
                    key={group.groupKey}
                    group={group}
                    stockERP={group.productoId ? stockERPMap.get(group.productoId) : undefined}
                    onVincular={handleVincular}
                    onDesvincular={handleDesvincular}
                  />
                ))}
                {filteredGroups.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">No se encontraron productos</p>
                )}
              </div>
            </>
          )}

          {/* Modal de vinculación */}
          <VincularProductoModal
            isOpen={!!vinculandoPM}
            onClose={() => setVinculandoPM(null)}
            mlProduct={vinculandoPM}
            onSelect={handleSelectProducto}
          />
        </div>
      )}
    </div>
  );
};
