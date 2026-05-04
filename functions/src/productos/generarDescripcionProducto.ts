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
}

interface GenerarDescripcionResponse {
  tagline: string;
  beneficios: string[];
  descripcion: string;
  /** S3.4 · 5-10 long-tail keywords para SEO orgánico Google + Mercado Libre */
  keywordsSEO: string[];
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

Usa solo los datos provistos. Si falta info no inventes datos · no inventes ingredientes que no estén listados.
Devuelve SOLO el JSON, sin markdown ni texto adicional.`;
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
              maxOutputTokens: 1500,
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
