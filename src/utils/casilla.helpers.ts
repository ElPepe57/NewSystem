/**
 * Helpers para trabajar con Casillas compartidas entre colaboradores (S42g).
 */
import type { Casilla } from '../types/casilla.types';

/**
 * Devuelve TRUE si el colaborador (id) es dueño principal o secundario de la casilla.
 */
export function casillaPerteneceA(casilla: Casilla, colaboradorId: string): boolean {
  if (casilla.colaboradorId === colaboradorId) return true;
  if (casilla.colaboradoresSecundariosIds?.includes(colaboradorId)) return true;
  return false;
}

/**
 * Filtra casillas por un colaborador, considerando principales y secundarios.
 */
export function casillasDelColaborador(casillas: Casilla[], colaboradorId: string): Casilla[] {
  return casillas.filter((c) => casillaPerteneceA(c, colaboradorId));
}

/**
 * Determina si la casilla es "compartida" desde la perspectiva de un colaborador
 * (es decir, el colaborador la usa pero NO es el principal).
 */
export function esCasillaCompartida(casilla: Casilla, colaboradorId: string): boolean {
  return (
    casilla.colaboradorId !== colaboradorId &&
    !!casilla.colaboradoresSecundariosIds?.includes(colaboradorId)
  );
}

/**
 * Lista todos los nombres de colaboradores asociados a una casilla (principal + secundarios).
 */
export function todosLosColaboradoresDeCasilla(casilla: Casilla): string[] {
  const nombres = [casilla.colaboradorNombre];
  if (casilla.colaboradoresSecundariosNombres) {
    nombres.push(...casilla.colaboradoresSecundariosNombres);
  }
  return nombres;
}
