import type { ProductoOrden } from '../../../../types/ordenCompra.types';

// ════════════════════════════════════════════════════════════════════════════
// getEmojiPorProducto — heurística de emoji temático por producto
// ════════════════════════════════════════════════════════════════════════════

/**
 * Devuelve un emoji + color de fondo temático para un producto.
 * Prioridad:
 *   1. Keyword match en nombreComercial/marca (ej: "Omega 3" → 🫐)
 *   2. TipoProductoSKC si tiene atributos skincare
 *   3. Fallback por línea (SUP 💊 / SKC 🧴 / otro 📦)
 */

export interface EmojiTematico {
  emoji: string;
  bgClass: string;  // gradient tailwind
}

// ─── Mapeo por keyword en el nombre ─────────────────────────────────────────
// Claves en minúscula
const KEYWORD_MAP: Array<{ keywords: string[]; emoji: string; bg: string }> = [
  { keywords: ['omega', 'fish oil', 'aceite de pescado'], emoji: '🫐', bg: 'from-orange-100 to-amber-100' },
  { keywords: ['magnesio', 'magnesium'], emoji: '🌿', bg: 'from-emerald-100 to-green-100' },
  { keywords: ['resveratrol', 'grape'], emoji: '🍇', bg: 'from-purple-100 to-violet-100' },
  { keywords: ['vitamina c', 'vitamin c', 'ácido ascórbico'], emoji: '🍋', bg: 'from-yellow-100 to-amber-100' },
  { keywords: ['vitamina d', 'vitamin d', 'cholecalciferol'], emoji: '☀️', bg: 'from-yellow-100 to-orange-100' },
  { keywords: ['vitamina b', 'b12', 'b complex', 'folato'], emoji: '💊', bg: 'from-red-100 to-pink-100' },
  { keywords: ['calcio', 'calcium'], emoji: '🦴', bg: 'from-slate-100 to-gray-100' },
  { keywords: ['zinc'], emoji: '✨', bg: 'from-blue-100 to-sky-100' },
  { keywords: ['colágeno', 'collagen'], emoji: '💆', bg: 'from-pink-100 to-rose-100' },
  { keywords: ['melatonina', 'melatonin'], emoji: '🌙', bg: 'from-indigo-100 to-purple-100' },
  { keywords: ['probiótico', 'probiotic', 'lactobacillus'], emoji: '🦠', bg: 'from-green-100 to-emerald-100' },
  { keywords: ['ashwagandha'], emoji: '🌱', bg: 'from-green-100 to-lime-100' },
  { keywords: ['curcuma', 'cúrcuma', 'turmeric', 'curcumin'], emoji: '🟡', bg: 'from-amber-100 to-yellow-100' },
  { keywords: ['proteína', 'protein', 'whey'], emoji: '🥛', bg: 'from-blue-100 to-cyan-100' },
  { keywords: ['creatina', 'creatine'], emoji: '💪', bg: 'from-red-100 to-orange-100' },
  { keywords: ['pre workout', 'pre-workout', 'preentreno'], emoji: '⚡', bg: 'from-yellow-100 to-red-100' },
  { keywords: ['biotina', 'biotin'], emoji: '💇', bg: 'from-pink-100 to-rose-100' },
  { keywords: ['hierro', 'iron'], emoji: '🩸', bg: 'from-red-100 to-rose-100' },
  { keywords: ['l-teanina', 'l-theanine', 'teanina'], emoji: '🍵', bg: 'from-green-100 to-emerald-100' },
  // Skincare comunes
  { keywords: ['sérum', 'serum'], emoji: '💧', bg: 'from-sky-100 to-blue-100' },
  { keywords: ['crema', 'cream', 'moisturizer'], emoji: '🧴', bg: 'from-pink-100 to-rose-100' },
  { keywords: ['protector solar', 'sunscreen', 'spf'], emoji: '☀️', bg: 'from-yellow-100 to-orange-100' },
  { keywords: ['tónico', 'toner'], emoji: '💦', bg: 'from-sky-100 to-cyan-100' },
  { keywords: ['limpiador', 'cleanser', 'cleanse'], emoji: '🧼', bg: 'from-blue-100 to-sky-100' },
  { keywords: ['mascarilla', 'mask'], emoji: '🎭', bg: 'from-purple-100 to-pink-100' },
  { keywords: ['exfoliante', 'exfoliant', 'scrub'], emoji: '🪣', bg: 'from-amber-100 to-yellow-100' },
];

// ─── Mapeo por tipoProductoSKC ──────────────────────────────────────────────
const SKC_TYPE_MAP: Record<string, { emoji: string; bg: string }> = {
  serum: { emoji: '💧', bg: 'from-sky-100 to-blue-100' },
  crema: { emoji: '🧴', bg: 'from-pink-100 to-rose-100' },
  tonico: { emoji: '💦', bg: 'from-sky-100 to-cyan-100' },
  limpiador: { emoji: '🧼', bg: 'from-blue-100 to-sky-100' },
  aceite_limpiador: { emoji: '🧴', bg: 'from-amber-100 to-orange-100' },
  exfoliante: { emoji: '🪣', bg: 'from-amber-100 to-yellow-100' },
  mascarilla: { emoji: '🎭', bg: 'from-purple-100 to-pink-100' },
  protector_solar: { emoji: '☀️', bg: 'from-yellow-100 to-orange-100' },
  esencia: { emoji: '🌸', bg: 'from-pink-100 to-rose-100' },
  ampolla: { emoji: '💎', bg: 'from-indigo-100 to-purple-100' },
  contorno_ojos: { emoji: '👁️', bg: 'from-slate-100 to-gray-100' },
  bruma: { emoji: '💨', bg: 'from-sky-100 to-blue-100' },
  balsamo: { emoji: '🌿', bg: 'from-emerald-100 to-green-100' },
  parches: { emoji: '🩹', bg: 'from-pink-100 to-rose-100' },
  peeling: { emoji: '🍊', bg: 'from-orange-100 to-amber-100' },
  mist: { emoji: '💨', bg: 'from-sky-100 to-blue-100' },
  otro: { emoji: '🧴', bg: 'from-slate-100 to-gray-100' },
};

export function getEmojiPorProducto(
  producto: Pick<ProductoOrden, 'nombreComercial' | 'marca' | 'atributosSkincare'>
): EmojiTematico {
  const texto = `${producto.nombreComercial ?? ''} ${producto.marca ?? ''}`.toLowerCase();

  // 1. Match por keyword en el nombre
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some((kw) => texto.includes(kw))) {
      return { emoji: entry.emoji, bgClass: `bg-gradient-to-br ${entry.bg}` };
    }
  }

  // 2. Mapeo por tipo SKC
  if (producto.atributosSkincare?.tipoProductoSKC) {
    const tipo = producto.atributosSkincare.tipoProductoSKC;
    const match = SKC_TYPE_MAP[tipo];
    if (match) return { emoji: match.emoji, bgClass: `bg-gradient-to-br ${match.bg}` };
  }

  // 3. Fallback
  if (producto.atributosSkincare) {
    return { emoji: '🧴', bgClass: 'bg-gradient-to-br from-slate-100 to-gray-100' };
  }
  return { emoji: '💊', bgClass: 'bg-gradient-to-br from-slate-100 to-gray-100' };
}
