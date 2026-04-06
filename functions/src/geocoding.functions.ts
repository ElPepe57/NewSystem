/**
 * Cloud Function: Geocoding automático de ventas
 *
 * Trigger: onCreate en colección ventas
 * Solo procesa ventas que tienen direccionEntrega pero no coordenadas.
 * Usa Google Geocoding API para obtener lat/lng y lo guarda en el documento.
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { getSecret } from "./secrets";

const db = admin.firestore();

/**
 * Calcula un geohash simple de precisión 6 (~1.2km)
 * Implementación ligera sin dependencia externa
 */
function encodeGeohash(lat: number, lng: number, precision = 6): string {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let hash = "";
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        idx = idx * 2 + 1;
        lngMin = mid;
      } else {
        idx = idx * 2;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = idx * 2 + 1;
        latMin = mid;
      } else {
        idx = idx * 2;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

/**
 * Llama a Google Geocoding API para convertir dirección a coordenadas
 */
async function geocodificarDireccion(direccion: string, apiKey: string): Promise<{
  lat: number;
  lng: number;
  placeId: string;
  distrito?: string;
  provincia?: string;
} | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccion)}&language=es&region=pe&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.results?.length) {
      functions.logger.warn("Geocoding sin resultados", { direccion, status: data.status });
      return null;
    }

    const result = data.results[0];
    const { lat, lng } = result.geometry.location;
    const placeId = result.place_id;

    // Extraer distrito y provincia de los address_components
    let distrito: string | undefined;
    let provincia: string | undefined;

    for (const comp of result.address_components || []) {
      const types: string[] = comp.types || [];
      if (types.includes("sublocality_level_1") || types.includes("locality")) {
        distrito = distrito || comp.long_name;
      }
      if (types.includes("administrative_area_level_2")) {
        provincia = comp.long_name;
      }
    }

    return { lat, lng, placeId, distrito, provincia };
  } catch (error) {
    functions.logger.error("Error en geocoding", { direccion, error });
    return null;
  }
}

/**
 * Trigger: cuando se crea una venta sin coordenadas pero con dirección,
 * se geocodifica automáticamente.
 */
export const geocodificaCoordenadasVenta = functions
  .region("us-central1")
  .firestore.document("ventas/{ventaId}")
  .onCreate(async (snap) => {
    const venta = snap.data();

    // Solo procesar si: no tiene coordenadas Y tiene dirección
    if (venta.coordenadas?.lat || !venta.direccionEntrega) {
      return null;
    }

    let apiKey: string;
    try {
      apiKey = getSecret("GOOGLE_MAPS_API_KEY");
    } catch {
      functions.logger.warn("GOOGLE_MAPS_API_KEY no configurada, saltando geocoding");
      return null;
    }

    const resultado = await geocodificarDireccion(venta.direccionEntrega, apiKey);

    if (!resultado) {
      await snap.ref.update({ geocodingStatus: "fallido" });
      return null;
    }

    const updateData: Record<string, any> = {
      coordenadas: { lat: resultado.lat, lng: resultado.lng },
      placeId: resultado.placeId,
      geohash: encodeGeohash(resultado.lat, resultado.lng),
      geocodingStatus: "ok",
    };

    // Solo actualizar distrito/provincia si no existen
    if (!venta.distrito && resultado.distrito) {
      updateData.distrito = resultado.distrito;
    }
    if (!venta.provincia && resultado.provincia) {
      updateData.provincia = resultado.provincia;
    }

    await snap.ref.update(updateData);
    functions.logger.info("Geocoding exitoso", {
      ventaId: snap.id,
      direccion: venta.direccionEntrega,
      coordenadas: updateData.coordenadas,
    });

    return null;
  });
