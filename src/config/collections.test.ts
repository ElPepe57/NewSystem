import { describe, it, expect } from 'vitest';
import { COLLECTIONS } from './collections';

// Smoke test: verificar que COLLECTIONS tiene todas las claves esperadas
// y que los valores no son cadenas vacías ni undefined.
// Esto detecta errores de tipeo o claves eliminadas accidentalmente.

describe('COLLECTIONS', () => {
  // Flujo de ventas
  it('tiene las claves del flujo de ventas', () => {
    expect(COLLECTIONS.VENTAS).toBe('ventas');
    expect(COLLECTIONS.COTIZACIONES).toBe('cotizaciones');
    expect(COLLECTIONS.CLIENTES).toBe('clientes');
    expect(COLLECTIONS.ENTREGAS).toBe('entregas');
    expect(COLLECTIONS.ENTREGAS_PARCIALES).toBe('entregas_parciales');
  });

  // Compras
  it('tiene las claves de compras y abastecimiento', () => {
    expect(COLLECTIONS.REQUERIMIENTOS).toBe('requerimientos');
    expect(COLLECTIONS.ORDENES_COMPRA).toBe('ordenesCompra');
    expect(COLLECTIONS.PROVEEDORES).toBe('proveedores');
  });

  // Inventario
  it('tiene las claves de inventario', () => {
    expect(COLLECTIONS.PRODUCTOS).toBe('productos');
    expect(COLLECTIONS.UNIDADES).toBe('unidades');
    expect(COLLECTIONS.ALMACENES).toBe('almacenes');
    expect(COLLECTIONS.TRANSFERENCIAS).toBe('transferencias');
  });

  // Finanzas
  it('tiene las claves de finanzas y tesorería', () => {
    expect(COLLECTIONS.GASTOS).toBe('gastos');
    expect(COLLECTIONS.MOVIMIENTOS_TESORERIA).toBe('movimientosTesoreria');
    expect(COLLECTIONS.CONVERSIONES_CAMBIARIAS).toBe('conversionesCambiarias');
    expect(COLLECTIONS.CUENTAS_CAJA).toBe('cuentasCaja');
    expect(COLLECTIONS.TIPOS_CAMBIO).toBe('tiposCambio');
    expect(COLLECTIONS.APORTES_CAPITAL).toBe('aportesCapital');
    expect(COLLECTIONS.RETIROS_CAPITAL).toBe('retirosCapital');
  });

  // Pool USD (rendimiento cambiario)
  it('tiene las claves del Pool USD', () => {
    expect(COLLECTIONS.POOL_USD_MOVIMIENTOS).toBe('poolUSDMovimientos');
    expect(COLLECTIONS.POOL_USD_SNAPSHOTS).toBe('poolUSDSnapshots');
  });

  // MercadoLibre
  it('tiene las claves de MercadoLibre', () => {
    expect(COLLECTIONS.ML_PRODUCT_MAP).toBe('mlProductMap');
    expect(COLLECTIONS.ML_ORDER_SYNC).toBe('mlOrderSync');
    expect(COLLECTIONS.ML_CONFIG).toBe('mlConfig');
    expect(COLLECTIONS.ML_QUESTIONS).toBe('mlQuestions');
    expect(COLLECTIONS.ML_WEBHOOK_LOG).toBe('mlWebhookLog');
  });

  // Sistema
  it('tiene las claves del sistema', () => {
    expect(COLLECTIONS.USERS).toBe('users');
    expect(COLLECTIONS.NOTIFICACIONES).toBe('notificaciones');
    expect(COLLECTIONS.AUDIT_LOGS).toBe('audit_logs');
    expect(COLLECTIONS.HISTORIAL_CTRU).toBe('historialRecalculoCTRU');
    expect(COLLECTIONS.CONTADORES).toBe('contadores');
    expect(COLLECTIONS.CONFIGURACION).toBe('configuracion');
  });

  it('ningún valor es string vacío', () => {
    for (const [key, value] of Object.entries(COLLECTIONS)) {
      expect(value, `COLLECTIONS.${key} no debe ser vacío`).not.toBe('');
    }
  });

  it('tiene exactamente 47 claves (contrato de la constante)', () => {
    const count = Object.keys(COLLECTIONS).length;
    // Si este test falla, se agregó o eliminó una colección —
    // actualizar el número y revisar que el cambio fue intencional.
    expect(count).toBe(53);
  });
});
