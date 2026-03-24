/**
 * Utilidades de texto centralizadas
 * Reemplaza las 6+ implementaciones duplicadas de normalizarTexto
 * y las 2 implementaciones duplicadas de levenshteinDistance
 */

/**
 * Normaliza texto para comparación y búsqueda de duplicados.
 * Convierte a minúsculas, elimina acentos, trim.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Normaliza texto para búsqueda estricta (elimina caracteres especiales).
 * Útil para detección de duplicados de marcas, clientes, etc.
 */
export function normalizarParaBusqueda(texto: string): string {
  return normalizarTexto(texto).replace(/[^a-z0-9\s]/g, '');
}

/**
 * Calcula la distancia de Levenshtein entre dos strings.
 * Usado para detección de similitud (fuzzy matching).
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calcula similitud entre dos strings (0-100, donde 100 = idénticos).
 */
export function calcularSimilitud(a: string, b: string): number {
  const normalA = normalizarTexto(a);
  const normalB = normalizarTexto(b);

  if (normalA === normalB) return 100;
  if (!normalA || !normalB) return 0;

  // Verificar contenido
  if (normalA.includes(normalB) || normalB.includes(normalA)) return 85;

  // Verificar tokens comunes
  const tokens1 = normalA.split(/\s+/);
  const tokens2 = normalB.split(/\s+/);
  const comunes = tokens1.filter(t => tokens2.includes(t));
  if (comunes.length > 0) {
    return Math.round((comunes.length / Math.max(tokens1.length, tokens2.length)) * 100);
  }

  // Levenshtein
  const maxLen = Math.max(normalA.length, normalB.length);
  if (maxLen === 0) return 100;

  const dist = levenshteinDistance(normalA, normalB);
  return Math.round((1 - dist / maxLen) * 100);
}
