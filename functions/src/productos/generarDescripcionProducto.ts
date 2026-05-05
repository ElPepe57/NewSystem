/**
 * generarDescripcionProducto · S3.2 · DEUDA-IA-001 · 2026-05-03
 *
 * Cloud Function callable que genera marketing comercial 3-niveles para un
 * producto usando Gemini Flash 2.0 (gratis · 1500 req/día).
 *
 * Input:
 *   {
 *     lineaCodigo: 'SKC' | 'SUP' | '',
 *     marca: string,
 *     nombreComercial: string,
 *     paisOrigen?: string,
 *     atributosSkincare?: { ... },
 *     atributosSuplementos?: { ... },
 *     contenidoNeto?: { valor: number, unidad: string },
 *     categorias?: string[],
 *     etiquetas?: string[],
 *     pesoLibras?: number,
 *   }
 *
 * Output:
 *   {
 *     tagline: string,         // ~10-15 palabras
 *     beneficios: string[],    // 3-5 bullets
 *     descripcion: string,     // ~80-120 palabras
 *   }
 *
 * Compliance:
 *   - Sin claims terapéuticos prohibidos por DIGEMID/INDECOPI Perú
 *   - En SUP agrega disclaimer auto al final de descripcion
 *   - Sin superlativos médicos (curar/eliminar/sanar/prevenir enfermedad)
 *
 * Rate limit:
 *   - Verifica auth (uid presente)
 *   - Sin rate-limit explícito por usuario en esta versión inicial
 *     (tier free Gemini = 1500 req/día · sobra)
 *   - TODO si se detecta abuso: agregar contador en Firestore por uid
 */

import * as functions from "firebase-functions/v1";
import axios from "axios";
import { getSecret } from "../secrets";

// ─── Tipos del request ──────────────────────────────────────────────────────

interface EtiquetaCatalogo {
  id: string;
  nombre: string;
  tipo: string; // 'descriptiva' | 'certificacion' | 'restriccion' | 'origen' | 'comercial' | 'ingrediente' | 'performance' | 'pack' | etc.
}

interface GenerarDescripcionRequest {
  lineaCodigo?: "SKC" | "SUP" | "";
  marca?: string;
  nombreComercial?: string;
  paisOrigen?: string;
  atributosSkincare?: {
    tipoProductoSKC?: string;
    ingredienteClave?: string;
    lineaProducto?: string;
    tipoPiel?: string[];
    preocupaciones?: string[];
    pasoRutina?: string;
    textura?: string;
    zonaAplicacion?: string[];
    spf?: number;
    pa?: string;
  };
  atributosSuplementos?: {
    presentacion?: string;
    momentoDia?: string[];
    tomaConComida?: string;
    edadRecomendada?: string;
    restricciones?: string[];
    sabor?: string;
    advertencias?: string;
    dosaje?: string;
  };
  contenidoNeto?: {
    valor: number;
    unidad: string;
  };
  categorias?: string[];
  etiquetas?: string[];
  pesoLibras?: number;
  /**
   * S3.5 (2026-05-05) · Onda 2 · Si true, devuelve también `atributosSugeridos`
   * con propuestas de IA para campos vacíos. Cuando se incluye, se debe pasar
   * `etiquetasCatalogo` para que la IA solo sugiera etiquetas existentes.
   */
  incluirAtributos?: boolean;
  etiquetasCatalogo?: EtiquetaCatalogo[];
}

interface AtributosSugeridos {
  // SUP-only
  momentoDia?: string[];           // CERRADO: Mañana, Tarde, Noche, Pre-entreno, Post-entreno, Cualquiera
  tomaConComida?: string;          // CERRADO: Con, En ayunas, Indiferente, Antes de dormir
  edadRecomendada?: string;        // CERRADO: Niños (3-12), Adolescentes (13-17), Adultos (18+), Adultos mayores (60+), Cualquier edad
  restricciones?: string[];        // FREE: ej. Vegano, Sin gluten, Halal
  // SKC-only
  zonaAplicacion?: string[];       // CERRADO: Rostro, Cuello, Manos, Cuerpo, Ojos, Labios
  pasoRutina?: string;             // CERRADO según mockup
  // Cross-línea
  etiquetaIds?: string[];          // IDs del maestro · solo de las que existen
}

interface GenerarDescripcionResponse {
  tagline: string;
  beneficios: string[];
  descripcion: string;
  /** S3.4 · 5-10 long-tail keywords para SEO orgánico Google + Mercado Libre */
  keywordsSEO: string[];
  /** S3.5 · Atributos sugeridos por IA cuando incluirAtributos=true */
  atributosSugeridos?: AtributosSugeridos;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildContextoProducto(input: GenerarDescripcionRequest): string {
  const lines: string[] = [];

  lines.push(`Marca: ${input.marca || "N/A"}`);
  lines.push(`Nombre comercial: ${input.nombreComercial || "N/A"}`);
  if (input.paisOrigen) lines.push(`País de origen: ${input.paisOrigen}`);
  if (input.contenidoNeto) {
    lines.push(`Contenido del envase: ${input.contenidoNeto.valor} ${input.contenidoNeto.unidad}`);
  }
  if (input.pesoLibras) lines.push(`Peso unitario: ${input.pesoLibras} lb`);

  // Línea de negocio
  if (input.lineaCodigo === "SKC") {
    lines.push("Línea de negocio: Skincare (cosmética facial)");
    const skc = input.atributosSkincare ?? {};
    if (skc.tipoProductoSKC) lines.push(`Tipo de producto: ${skc.tipoProductoSKC}`);
    if (skc.ingredienteClave) lines.push(`Ingrediente clave: ${skc.ingredienteClave}`);
    if (skc.lineaProducto) lines.push(`Línea de marca: ${skc.lineaProducto}`);
    if (skc.tipoPiel?.length) lines.push(`Tipo de piel: ${skc.tipoPiel.join(", ")}`);
    if (skc.preocupaciones?.length) {
      lines.push(`Preocupaciones que aborda: ${skc.preocupaciones.join(", ")}`);
    }
    if (skc.pasoRutina) lines.push(`Paso de rutina: ${skc.pasoRutina}`);
    if (skc.textura) lines.push(`Textura: ${skc.textura}`);
    if (skc.zonaAplicacion?.length) lines.push(`Zona de aplicación: ${skc.zonaAplicacion.join(", ")}`);
    if (skc.spf) lines.push(`SPF: ${skc.spf}`);
    if (skc.pa) lines.push(`PA: ${skc.pa}`);
  } else if (input.lineaCodigo === "SUP") {
    lines.push("Línea de negocio: Suplementos y vitaminas");
    const sup = input.atributosSuplementos ?? {};
    if (sup.presentacion) lines.push(`Presentación: ${sup.presentacion}`);
    if (sup.dosaje) lines.push(`Composición / dosaje: ${sup.dosaje}`);
    if (sup.sabor) lines.push(`Sabor: ${sup.sabor}`);
    if (sup.momentoDia?.length) lines.push(`Momento del día: ${sup.momentoDia.join(", ")}`);
    if (sup.tomaConComida) lines.push(`Toma: ${sup.tomaConComida}`);
    if (sup.edadRecomendada) lines.push(`Edad recomendada: ${sup.edadRecomendada}`);
    if (sup.restricciones?.length) {
      lines.push(`Restricciones / certificaciones: ${sup.restricciones.join(", ")}`);
    }
    if (sup.advertencias) lines.push(`Advertencias: ${sup.advertencias}`);
  }

  if (input.categorias?.length) lines.push(`Categorías: ${input.categorias.join(", ")}`);
  if (input.etiquetas?.length) lines.push(`Etiquetas: ${input.etiquetas.join(", ")}`);

  return lines.join("\n");
}

function buildPrompt(input: GenerarDescripcionRequest): string {
  const contexto = buildContextoProducto(input);
  const esSUP = input.lineaCodigo === "SUP";

  return `Eres un copywriter SEO especializado en eCommerce de bienestar para el mercado peruano (Google Perú + Mercado Libre Perú). Tu copy debe vender honestamente Y posicionar orgánicamente en buscadores.

═══ REGLAS DE COMPLIANCE (OBLIGATORIAS · prohibido violarlas) ═══
- PROHIBIDO claims terapéuticos: NO uses "cura", "elimina enfermedad", "sana", "trata", "previene enfermedad", "remedio", "medicamento".
- PROHIBIDO comparativos absolutos sin sustento: NO digas "el mejor", "único en el mercado", "el más efectivo del Perú".
- PROHIBIDO superlativos cuantitativos sin respaldo: NO prometas porcentajes específicos.
- SÍ permitido beneficios honestos: hidrata, ilumina, suaviza, repara barrera, mejora apariencia, refuerza, complementa, contribuye a, apoya, aporta.
- Tono: cálido, profesional, español neutro de Perú · evita anglicismos innecesarios · 0 emojis.
${esSUP ? `
DISCLAIMER OBLIGATORIO PARA SUPLEMENTOS:
- Al final del campo "descripcion", agrega esta línea exacta separada por punto y aparte:
  "Este producto no reemplaza una dieta balanceada · consulte a su médico antes de consumir."
` : ""}
═══ REGLAS SEO ORGÁNICO (Google + Mercado Libre) ═══
1. **Keyword principal** = el problema que resuelve / categoría de producto + ingrediente clave (ej. "vitamina D3 5000 UI", "sérum de vitamina C", "proteína whey isolate"). Identifícala desde los datos provistos.
2. **Long-tail (cómo busca el cliente real)**: incluí frases que la gente realmente tipea. Ej: "vitamina D3 5000 UI cápsulas para huesos" en vez de "Vitamin D3 5000 IU".
3. **Densidad natural**: la keyword principal debe aparecer 3-5 veces en TOTAL (tagline + 1 bullet + apertura de descripción + cierre). NUNCA hacer keyword stuffing.
4. **LSI / variaciones semánticas**: incluí sinónimos y términos relacionados naturalmente. Ej. para D3: colecalciferol, vitamina del sol, salud ósea, sistema inmune, calcio.
5. **Primer párrafo de la descripción**: empieza con la keyword principal en las primeras 60 palabras (Google da peso al inicio).
6. **Intent comercial**: incluí 1-2 frases que capturen búsquedas con verbos comerciales suaves: "diseñado para", "ideal para quienes", "complemento clave para".
7. **Tagline es el meta-title SEO**: 50-65 caracteres · arranca con marca o keyword principal · concreto y útil · evita relleno.
8. **Beneficios = bullets escaneables**: cada uno empieza con verbo de acción + nombra el beneficio + mini-contexto del cómo. Evitar bullets genéricos tipo "alta calidad".

═══ DATOS DEL PRODUCTO ═══
${contexto}

═══ INSTRUCCIONES DE OUTPUT (JSON estricto · 4 campos) ═══
- "tagline": 50-65 caracteres · arranca con marca o keyword principal · honesto y útil · ej. "Vitamina D3 5000 UI · 60 cápsulas · salud ósea e inmune"
- "beneficios": array de 4-5 strings · cada bullet 60-100 caracteres · empieza con verbo de acción · incluye 1 LSI keyword en al menos 2 bullets
- "descripcion": 120-180 palabras · 2-3 párrafos cortos · primer párrafo carga keyword principal + LSI · segundo párrafo desarrolla beneficios concretos · cierre con CTA suave (a quién va dirigido)${esSUP ? " · TERMINA con el disclaimer DIGEMID obligatorio mencionado arriba" : ""}
- "keywordsSEO": array de 5-10 long-tail keywords (frases de 3-7 palabras) · variadas por intent (informacional, comercial, comparativo) · usables en meta-tags y atributos de Mercado Libre
${input.incluirAtributos ? buildSeccionAtributos(input) : ""}
Usa solo los datos provistos. Si falta info no inventes datos · no inventes ingredientes que no estén listados.
Devuelve SOLO el JSON, sin markdown ni texto adicional.`;
}

/**
 * S3.5 · Onda 2 · Sección adicional del prompt cuando se piden atributos sugeridos.
 * Incluye listado de etiquetas válidas (filtrado del maestro) para que la IA
 * solo elija de ellas y no invente nuevas.
 */
function buildSeccionAtributos(input: GenerarDescripcionRequest): string {
  const esSUP = input.lineaCodigo === "SUP";
  const esSKC = input.lineaCodigo === "SKC";
  const cat = input.etiquetasCatalogo ?? [];

  // Filtrar etiquetas por tipo · solo descriptivas/restricciones/certificaciones/ingrediente/performance
  const tiposPermitidos = ["descriptiva", "restriccion", "certificacion", "ingrediente", "performance"];
  const candidatas = cat.filter(e => tiposPermitidos.includes(e.tipo));
  const etiquetasPorTipo: Record<string, EtiquetaCatalogo[]> = {};
  for (const e of candidatas) {
    etiquetasPorTipo[e.tipo] = etiquetasPorTipo[e.tipo] || [];
    etiquetasPorTipo[e.tipo].push(e);
  }

  let listadoEtiquetas = "";
  for (const [tipo, lista] of Object.entries(etiquetasPorTipo)) {
    listadoEtiquetas += `\n  ${tipo.toUpperCase()}: ${lista.map(e => `"${e.nombre}" (id=${e.id})`).join(" · ")}`;
  }

  return `

═══ ATRIBUTOS SUGERIDOS (campo "atributosSugeridos") ═══
Sugerí valores para los siguientes campos SI tenés alta confianza derivable del nombre / marca / categoría / dosaje / industria. Si tenés DUDA · DEJÁ VACÍO o array vacío. Cero invención.
${esSUP ? `
SUP-only:
- "momentoDia": array · solo de estos valores cerrados: "Mañana", "Tarde", "Noche", "Pre-entreno", "Post-entreno", "Cualquiera"
   Ejemplos típicos por tipo de producto:
   · Melatonina/sueño → ["Noche"]
   · Multivitamínico → ["Mañana"]
   · Vitamina D3 → ["Mañana"]
   · Pre-workout → ["Pre-entreno"]
   · Proteína → ["Post-entreno"]
   · Probiótico → ["Mañana"] (en ayunas)
   Si no es claro, vacío [].
- "tomaConComida": una de "Con", "En ayunas", "Indiferente", "Antes de dormir"
   Reglas:
   · Liposolubles (D, E, K, A, Omega 3) → "Con"
   · Hidrosolubles (C, complejo B) → "Indiferente"
   · Probióticos → "En ayunas"
   · Melatonina → "Antes de dormir"
   · Enzimas digestivas → "Con"
   Si no es claro, vacío "".
- "edadRecomendada": una de "Niños (3-12)", "Adolescentes (13-17)", "Adultos (18+)", "Adultos mayores (60+)", "Cualquier edad"
   Reglas:
   · Si el nombre contiene "Kids", "Niños", "Children" → "Niños (3-12)"
   · Si contiene "Adolescentes" o "Teens" → "Adolescentes (13-17)"
   · Si contiene "+50", "+60", "Mayores", "Senior" → "Adultos mayores (60+)"
   · Por defecto adultos → "Adultos (18+)"
- "restricciones": array de strings · cualquier valor descriptivo · solo si HAY EVIDENCIA en nombre/marca/contexto. Ejemplos:
   · "Vegano" si el nombre dice "Vegan" o marca conocida vegana
   · "Sin gluten" si dice "Gluten-Free"
   · "Halal" / "Kosher" si dice los términos
   · "Non-GMO" si dice los términos
   Si no es claro, vacío [].
` : ""}${esSKC ? `
SKC-only:
- "zonaAplicacion": array · solo de "Rostro", "Cuello", "Manos", "Cuerpo", "Ojos", "Labios"
   Reglas:
   · Crema facial / Sérum facial → ["Rostro"]
   · Eye Cream / contorno de ojos → ["Ojos"]
   · Crema de manos → ["Manos"]
   · Lip balm / labial → ["Labios"]
   · Crema corporal → ["Cuerpo"]
   · Productos generales de skincare → ["Rostro"] (default)
- "pasoRutina": uno de "Limpiador", "Tónico", "Esencia", "Sérum", "Crema", "Protector solar", "Mascarilla", "Exfoliante", "Aceite"
   Inferir directamente del Tipo de producto SKC y del nombre.
` : ""}
- "etiquetaIds": array de IDs · SOLO de las etiquetas listadas abajo · NO inventes etiquetas nuevas. Sugerí 3-7 que apliquen al producto:${listadoEtiquetas || "\n   (catálogo no provisto)"}

REGLA CRÍTICA: si la confianza es baja, vacío. Es mejor no sugerir que sugerir mal.`;
}

// ─── Schema JSON · structured output ────────────────────────────────────────

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    tagline: {
      type: "string",
      description: "50-65 caracteres · arranca con marca o keyword principal SEO",
    },
    beneficios: {
      type: "array",
      items: { type: "string" },
      description: "4-5 bullets escaneables 60-100 chars c/u",
    },
    descripcion: {
      type: "string",
      description: "Texto narrativo 120-180 palabras · keyword principal en primer párrafo · LSI en cuerpo",
    },
    keywordsSEO: {
      type: "array",
      items: { type: "string" },
      description: "5-10 long-tail keywords (3-7 palabras c/u) para meta-tags y Mercado Libre",
    },
    atributosSugeridos: {
      type: "object",
      description: "S3.5 · Atributos sugeridos cuando incluirAtributos=true",
      properties: {
        momentoDia: { type: "array", items: { type: "string" } },
        tomaConComida: { type: "string" },
        edadRecomendada: { type: "string" },
        restricciones: { type: "array", items: { type: "string" } },
        zonaAplicacion: { type: "array", items: { type: "string" } },
        pasoRutina: { type: "string" },
        etiquetaIds: { type: "array", items: { type: "string" } },
      },
    },
  },
  required: ["tagline", "beneficios", "descripcion", "keywordsSEO"],
};

// ─── Cloud Function ─────────────────────────────────────────────────────────

export const generarDescripcionProducto = functions
  .runWith({ memory: "512MB", timeoutSeconds: 60 })
  .https.onCall(
    async (
      data: GenerarDescripcionRequest,
      context,
    ): Promise<GenerarDescripcionResponse> => {
      // Auth obligatorio
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Requiere autenticación",
        );
      }

      // Validación mínima
      if (!data.marca || !data.nombreComercial) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "marca y nombreComercial son requeridos",
        );
      }
      if (data.lineaCodigo && data.lineaCodigo !== "SKC" && data.lineaCodigo !== "SUP") {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `lineaCodigo inválido: ${data.lineaCodigo} (solo SKC, SUP o vacío)`,
        );
      }

      const apiKey = getSecret("GEMINI_API_KEY");
      if (!apiKey) {
        functions.logger.error("[generarDescripcion] GEMINI_API_KEY no configurada");
        throw new functions.https.HttpsError(
          "internal",
          "API key no configurada",
        );
      }

      const prompt = buildPrompt(data);

      try {
        // S3.4 (2026-05-04) · Modelo actualizado a gemini-2.5-flash. El gemini-2.0-flash
        // devolvía 404 porque Google rotó los nombres. gemini-2.5-flash es el nuevo
        // tier estable Flash · sigue siendo gratis dentro del free tier.
        functions.logger.info("[generarDescripcion] Invocando Gemini 2.5 Flash", {
          uid: context.auth.uid,
          marca: data.marca,
          nombre: data.nombreComercial,
          linea: data.lineaCodigo,
        });

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              // S3.4 (2026-05-04) · 1500 tokens · suficiente con holgura para
              // tagline (~30) + 4 beneficios (~150) + descripción 180 palabras
              // (~270) + keywordsSEO 10 frases (~100) + estructura JSON (~50)
              // ≈ 600 tokens reales · 1500 da 2.5x de margen.
              // Costo aprox: $0.0003 USD/producto en tier paid · gratis en free.
              // S3.5 · subido de 1500 a 2500 para acomodar bloque atributosSugeridos opcional
              maxOutputTokens: 2500,
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
              // thinkingBudget=0 desactiva el modo thinking de Gemini 2.5 Flash
              // → todos los tokens van directos al JSON output · más rápido y económico.
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 30000,
          },
        );

        const rawText: string =
          response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (!rawText) {
          functions.logger.error("[generarDescripcion] Respuesta vacía de Gemini", {
            response: response.data,
          });
          throw new functions.https.HttpsError("internal", "Respuesta vacía de Gemini");
        }

        // Parse JSON · responseSchema garantiza estructura pero limpiamos por las dudas
        let parsed: GenerarDescripcionResponse;
        try {
          const cleanJson = rawText
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();
          parsed = JSON.parse(cleanJson);
        } catch (parseErr) {
          functions.logger.error("[generarDescripcion] No se pudo parsear JSON", {
            rawText: rawText.substring(0, 500),
            error: parseErr,
          });
          throw new functions.https.HttpsError("internal", "Respuesta IA mal formada");
        }

        // Validación de estructura
        if (
          typeof parsed.tagline !== "string" ||
          !Array.isArray(parsed.beneficios) ||
          typeof parsed.descripcion !== "string" ||
          !Array.isArray(parsed.keywordsSEO)
        ) {
          throw new functions.https.HttpsError(
            "internal",
            "Estructura de respuesta inválida",
          );
        }

        // Limites de seguridad
        if (parsed.beneficios.length === 0) {
          throw new functions.https.HttpsError("internal", "Sin beneficios generados");
        }
        if (parsed.beneficios.length > 8) {
          parsed.beneficios = parsed.beneficios.slice(0, 8);
        }
        // S3.4 · Cap keywords SEO a 10 (más es spam · Google premia precisión)
        if (parsed.keywordsSEO.length > 10) {
          parsed.keywordsSEO = parsed.keywordsSEO.slice(0, 10);
        }

        functions.logger.info("[generarDescripcion] Éxito", {
          uid: context.auth.uid,
          taglineLen: parsed.tagline.length,
          beneficiosCount: parsed.beneficios.length,
          descripcionLen: parsed.descripcion.length,
          keywordsCount: parsed.keywordsSEO.length,
        });

        return parsed;
      } catch (err: any) {
        if (err instanceof functions.https.HttpsError) throw err;
        functions.logger.error("[generarDescripcion] Error inesperado", {
          message: err?.message,
          stack: err?.stack,
        });
        throw new functions.https.HttpsError(
          "internal",
          `Error generando descripción: ${err?.message || "desconocido"}`,
        );
      }
    },
  );
