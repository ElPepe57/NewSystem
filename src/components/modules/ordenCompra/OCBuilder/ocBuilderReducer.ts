import type {
  OCBuilderState,
  OCBuilderAction,
  OCDraftGroup,
  PoolProducto,
  OCBuilderProducto,
} from './ocBuilderTypes';
import {
  buildPool,
  autoGroupByProveedor,
  getNextGroupColor,
  recalcPool,
  generateGroupId,
  distributeOrigenes,
} from './ocBuilderUtils';

export const initialState: OCBuilderState = {
  requerimientos: [],
  pool: [],
  groups: [],
  activeGroupId: null,
  tcGlobal: 3.5,
  tcMode: 'global',
  currentStep: 0,
  isCreating: false,
  creationProgress: null,
  creationErrors: [],
  createdOCs: [],
};

export function ocBuilderReducer(state: OCBuilderState, action: OCBuilderAction): OCBuilderState {
  switch (action.type) {
    // ============ INIT ============
    case 'INIT': {
      const pool = buildPool(action.payload.requerimientos);
      return {
        ...initialState,
        requerimientos: action.payload.requerimientos,
        pool,
        tcGlobal: action.payload.tcSugerido || 3.5,
      };
    }

    // ============ GROUPS ============
    case 'ADD_GROUP': {
      const newGroup: OCDraftGroup = {
        id: generateGroupId(),
        nombre: action.payload?.nombre || `OC ${state.groups.length + 1}`,
        color: getNextGroupColor(state.groups),
        proveedor: null,
        almacenDestino: action.payload?.almacenDestino || null,
        productos: [],
        tcCompra: state.tcGlobal,
        porcentajeTax: 0,
        costoEnvioProveedorUSD: 0,
        otrosGastosCompraUSD: 0,
        descuentoUSD: 0,
        observaciones: '',
      };
      const groups = [...state.groups, newGroup];
      return {
        ...state,
        groups,
        activeGroupId: state.activeGroupId || newGroup.id,
      };
    }

    case 'REMOVE_GROUP': {
      const removedGroup = state.groups.find(g => g.id === action.payload.groupId);
      if (!removedGroup) return state;

      const groups = state.groups.filter(g => g.id !== action.payload.groupId);
      const pool = recalcPool(state.pool, groups);
      const activeGroupId = state.activeGroupId === action.payload.groupId
        ? (groups[0]?.id || null)
        : state.activeGroupId;

      return { ...state, groups, pool, activeGroupId };
    }

    case 'SET_ACTIVE_GROUP':
      return { ...state, activeGroupId: action.payload.groupId };

    case 'RENAME_GROUP':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, nombre: action.payload.nombre } : g
        ),
      };

    // ============ PRODUCT ASSIGNMENT ============
    case 'ASSIGN_PRODUCT': {
      const { productoId, groupId, cantidad } = action.payload;
      const poolItem = state.pool.find(p => p.productoId === productoId);
      if (!poolItem) return state;

      const available = poolItem.cantidadOriginal - poolItem.cantidadAsignada;
      const toAssign = Math.min(cantidad, available);
      if (toAssign <= 0) return state;

      // Build the product for the group
      const existingInGroup = state.groups
        .find(g => g.id === groupId)?.productos
        .find(p => p.productoId === productoId);

      const groups = state.groups.map(g => {
        if (g.id !== groupId) return g;

        if (existingInGroup) {
          return {
            ...g,
            productos: g.productos.map(p =>
              p.productoId === productoId
                ? {
                    ...p,
                    cantidad: p.cantidad + toAssign,
                    origenes: distributeOrigenes(
                      poolItem.origenes,
                      p.cantidad + toAssign,
                      poolItem.cantidadOriginal
                    ),
                  }
                : p
            ),
          };
        }

        const newProduct: OCBuilderProducto = {
          productoId: poolItem.productoId,
          sku: poolItem.sku,
          marca: poolItem.marca,
          nombreComercial: poolItem.nombreComercial,
          presentacion: poolItem.presentacion,
          contenido: poolItem.contenido,
          dosaje: poolItem.dosaje,
          sabor: poolItem.sabor,
          cantidad: toAssign,
          costoUnitarioUSD: poolItem.costoUnitarioUSD,
          proveedorSugerido: poolItem.proveedorSugerido,
          urlReferencia: poolItem.urlReferencia,
          origenes: distributeOrigenes(poolItem.origenes, toAssign, poolItem.cantidadOriginal),
        };

        return { ...g, productos: [...g.productos, newProduct] };
      });

      const pool = recalcPool(state.pool, groups);
      return { ...state, groups, pool };
    }

    case 'UNASSIGN_PRODUCT': {
      const { productoId, groupId } = action.payload;
      const groups = state.groups.map(g => {
        if (g.id !== groupId) return g;
        return { ...g, productos: g.productos.filter(p => p.productoId !== productoId) };
      });
      const pool = recalcPool(state.pool, groups);
      return { ...state, groups, pool };
    }

    case 'UPDATE_PRODUCT_IN_GROUP': {
      const { groupId, productoId, changes } = action.payload;
      const groups = state.groups.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          productos: g.productos.map(p =>
            p.productoId === productoId ? { ...p, ...changes } : p
          ),
        };
      });
      // If cantidad changed, recalc pool
      if (changes.cantidad !== undefined) {
        const pool = recalcPool(state.pool, groups);
        return { ...state, groups, pool };
      }
      return { ...state, groups };
    }

    // ============ AUTO-GROUPING ============
    case 'AUTO_GROUP_BY_PROVEEDOR': {
      const grouped = autoGroupByProveedor(state.pool);
      const newGroups: OCDraftGroup[] = [];
      let colorIdx = 0;

      grouped.forEach((products, proveedorName) => {
        const group: OCDraftGroup = {
          id: generateGroupId(),
          nombre: proveedorName,
          color: ((['blue', 'emerald', 'amber', 'purple', 'rose', 'cyan', 'orange', 'indigo'] as const)[colorIdx % 8]),
          proveedor: null,
          almacenDestino: null,
          productos: products.map(p => ({
            productoId: p.productoId,
            sku: p.sku,
            marca: p.marca,
            nombreComercial: p.nombreComercial,
            presentacion: p.presentacion,
            contenido: p.contenido,
            dosaje: p.dosaje,
            sabor: p.sabor,
            cantidad: p.cantidadOriginal,
            costoUnitarioUSD: p.costoUnitarioUSD,
            proveedorSugerido: p.proveedorSugerido,
            urlReferencia: p.urlReferencia,
            origenes: [...p.origenes],
          })),
          tcCompra: state.tcGlobal,
          porcentajeTax: 0,
          costoEnvioProveedorUSD: 0,
          otrosGastosCompraUSD: 0,
          descuentoUSD: 0,
          observaciones: '',
        };
        newGroups.push(group);
        colorIdx++;
      });

      const pool = recalcPool(state.pool, newGroups);
      return {
        ...state,
        groups: newGroups,
        pool,
        activeGroupId: newGroups[0]?.id || null,
      };
    }

    case 'ASSIGN_ALL_TO_GROUP': {
      const { groupId } = action.payload;
      const group = state.groups.find(g => g.id === groupId);
      if (!group) return state;

      const unassigned = state.pool.filter(p => p.cantidadOriginal - p.cantidadAsignada > 0);
      if (unassigned.length === 0) return state;

      const newProducts: OCBuilderProducto[] = [...group.productos];
      for (const p of unassigned) {
        const remaining = p.cantidadOriginal - p.cantidadAsignada;
        if (remaining <= 0) continue;
        const existing = newProducts.find(gp => gp.productoId === p.productoId);
        if (existing) {
          existing.cantidad += remaining;
          existing.origenes = distributeOrigenes(p.origenes, existing.cantidad, p.cantidadOriginal);
        } else {
          newProducts.push({
            productoId: p.productoId,
            sku: p.sku,
            marca: p.marca,
            nombreComercial: p.nombreComercial,
            presentacion: p.presentacion,
            contenido: p.contenido,
            dosaje: p.dosaje,
            sabor: p.sabor,
            cantidad: remaining,
            costoUnitarioUSD: p.costoUnitarioUSD,
            proveedorSugerido: p.proveedorSugerido,
            urlReferencia: p.urlReferencia,
            origenes: distributeOrigenes(p.origenes, remaining, p.cantidadOriginal),
          });
        }
      }

      const groups = state.groups.map(g =>
        g.id === groupId ? { ...g, productos: newProducts } : g
      );
      const pool = recalcPool(state.pool, groups);
      return { ...state, groups, pool };
    }

    case 'RESET_GROUPS': {
      const pool = state.pool.map(p => ({
        ...p,
        cantidadAsignada: 0,
        cantidad: p.cantidadOriginal,
      }));
      return { ...state, groups: [], pool, activeGroupId: null };
    }

    // ============ GROUP CONFIG ============
    case 'SET_GROUP_PROVEEDOR':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, proveedor: action.payload.proveedor } : g
        ),
      };

    case 'SET_GROUP_DESTINO':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, almacenDestino: action.payload.almacen } : g
        ),
      };

    case 'SET_GROUP_TC':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, tcCompra: action.payload.tc } : g
        ),
      };

    case 'SET_GROUP_TAX':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, porcentajeTax: action.payload.porcentajeTax } : g
        ),
      };

    case 'SET_GROUP_ENVIO':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, costoEnvioProveedorUSD: action.payload.costoEnvioProveedorUSD } : g
        ),
      };

    case 'SET_GROUP_OTROS':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, otrosGastosCompraUSD: action.payload.otrosGastosCompraUSD } : g
        ),
      };

    case 'SET_GROUP_DESCUENTO':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, descuentoUSD: action.payload.descuentoUSD } : g
        ),
      };

    case 'SET_GROUP_OBSERVACIONES':
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.groupId ? { ...g, observaciones: action.payload.observaciones } : g
        ),
      };

    // ============ GLOBAL ============
    case 'SET_TC_GLOBAL': {
      const newState = { ...state, tcGlobal: action.payload.tc };
      if (state.tcMode === 'global') {
        newState.groups = state.groups.map(g => ({ ...g, tcCompra: action.payload.tc }));
      }
      return newState;
    }

    case 'SET_TC_MODE':
      return { ...state, tcMode: action.payload.mode };

    // ============ NAVIGATION ============
    case 'SET_STEP':
      return { ...state, currentStep: action.payload.step };

    // ============ DRAFT RESTORE ============
    case 'RESTORE_DRAFT': {
      const { groups, tcGlobal, tcMode, currentStep, activeGroupId } = action.payload;
      // Recalcular el pool basado en los productos ya asignados en los grupos restaurados
      const pool = recalcPool(state.pool, groups);
      return {
        ...state,
        groups,
        pool,
        tcGlobal,
        tcMode,
        currentStep,
        activeGroupId,
      };
    }

    // ============ CREATION ============
    case 'START_CREATION':
      return { ...state, isCreating: true, creationProgress: null, creationErrors: [], createdOCs: [] };

    case 'CREATION_PROGRESS':
      return { ...state, creationProgress: action.payload };

    case 'CREATION_ERROR':
      return {
        ...state,
        creationErrors: [...state.creationErrors, action.payload],
      };

    case 'CREATION_SUCCESS':
      return {
        ...state,
        createdOCs: [...state.createdOCs, action.payload],
      };

    case 'CREATION_COMPLETE':
      return { ...state, isCreating: false };

    default:
      return state;
  }
}
