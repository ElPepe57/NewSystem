import { create } from 'zustand';

/**
 * bandejaSignalStore · F4 · señal global de "cambió algo aprobable".
 *
 * El badge de "Mi bandeja" (sidebar · useMiEspacioItems) cuenta con getCountFromServer 1-shot ·
 * no es reactivo. Para que el contador se refresque tras una firma SIN listeners persistentes,
 * cualquier handler que autorice un egreso (bandeja, Gastos, OC, Requerimientos) llama a `bump()`;
 * el effect del badge depende de `version` y re-fetcha. Re-fetch-on-action · barato · consistente.
 *
 * (Cuando los handlers RRHH de la bandeja dejen de ser stubs, que también llamen a bump() · así el
 * badge admin —hoy igual de 1-shot— queda cubierto por el mismo mecanismo.)
 */
interface BandejaSignalState {
  version: number;
  /** Incrementa la señal · dispara el re-fetch del badge. Llamar tras una firma/aprobación exitosa. */
  bump: () => void;
}

export const useBandejaSignal = create<BandejaSignalState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
