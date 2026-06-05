import { create } from 'zustand';
import { casillaCrudService } from '../services/casilla.crud.service';
import type { Casilla, CasillaFormData } from '../types/casilla.types';

// NOTA: el hook conserva el nombre `useAlmacenStore` por retrocompat con sus ~10
// consumidores. El modelo legacy `Almacen` se eliminó por completo (chk5.ENVIOS-UNIF):
// la única fuente de verdad es la colección `casillas` (tipo Casilla). Un almacén de
// la empresa es una casilla de tipo `almacen_propio`.

interface CasillaState {
  casillas: Casilla[];
  casillasLoading: boolean;

  fetchCasillas: () => Promise<void>;
  getCasillasByColaborador: (colaboradorId: string) => Casilla[];
  getCasillaPrincipal: (colaboradorId: string) => Casilla | undefined;
  crearCasilla: (data: CasillaFormData, userId: string) => Promise<string>;
}

export const useAlmacenStore = create<CasillaState>((set, get) => ({
  casillas: [],
  casillasLoading: false,

  fetchCasillas: async () => {
    set({ casillasLoading: true });
    try {
      // chk5.ENVIOS-CONTADOR · `unidadesActuales` se DERIVA del conteo REAL de
      // unidades 'disponible' (fuente única de verdad). El contador denormalizado
      // guardado se desincroniza (ej. al borrar unidades de prueba) → mostraba
      // "fantasmas" (20 uds en una casilla vacía).
      const [casillas, conteoLive] = await Promise.all([
        casillaCrudService.getAll(),
        casillaCrudService.contarDisponiblesPorCasilla(),
      ]);
      const casillasLive = casillas.map(c => ({
        ...c,
        unidadesActuales: conteoLive[c.id] ?? 0,
      }));
      set({ casillas: casillasLive, casillasLoading: false });
    } catch {
      set({ casillasLoading: false });
    }
  },

  getCasillasByColaborador: (colaboradorId: string): Casilla[] => {
    return get().casillas.filter(c => c.colaboradorId === colaboradorId && c.estado === 'activa');
  },

  getCasillaPrincipal: (colaboradorId: string): Casilla | undefined => {
    const del = get().getCasillasByColaborador(colaboradorId);
    return del.find(c => c.esPrincipal) || del[0];
  },

  crearCasilla: async (data: CasillaFormData, userId: string): Promise<string> => {
    const id = await casillaCrudService.crear(data, userId);
    await get().fetchCasillas();
    return id;
  },
}));
