/**
 * productoFinanciero.service.ts — ADR-PF-001 · F2
 *
 * CRUD de ProductoFinanciero (entidad madre que reemplaza CuentaCaja +
 * TarjetaCredito).
 *
 * Decisiones aplicadas:
 *   - D-PF-1: una sola colección, discriminator tipoProducto
 *   - D-PF-2: relacionBancariaId obligatorio para tipos con banco
 *   - D-PF-3: saldo cacheado, recálculo desde libro mayor
 *   - P-1: validación de canalesDigitales contra CANAL_BANCO_MAP
 *
 * Orden de invocación típico desde el wizard:
 *   1. findOrCreateRelacionBancaria(banco, titular)  ← relacionBancaria.service
 *   2. crearProductoFinanciero({ relacionBancariaId, tipoProducto, ... })
 *   3. (opcional) registrarMovimientoFinanciero saldo inicial
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  ProductoFinanciero,
  ProductoFinancieroFormData,
  TipoProductoFinanciero,
  CanalDigital,
  MonedaPF,
} from '../types/productoFinanciero.types';
import {
  requiereRelacionBancaria,
  admiteCanalesDigitales,
  validarCanalDigital,
} from '../types/productoFinanciero.types';
import { getRelacionBancaria } from './relacionBancaria.service';

const COL = COLLECTIONS.PRODUCTOS_FINANCIEROS;

// ═════════════════════════════════════════════════════════════════════════
// VALIDACIONES INTERNAS
// ═════════════════════════════════════════════════════════════════════════

async function validarFormData(
  data: ProductoFinancieroFormData,
): Promise<void> {
  if (!data.nombre?.trim()) {
    throw new Error('El nombre del producto es obligatorio');
  }
  if (!data.tipoProducto) {
    throw new Error('El tipo de producto es obligatorio');
  }
  if (!data.moneda) {
    throw new Error('La moneda es obligatoria');
  }

  // Bi-moneda solo para cuentas (no tarjetas, no cajas, no wallets)
  const soportaBiMoneda =
    data.tipoProducto === 'cuenta_corriente' ||
    data.tipoProducto === 'cuenta_ahorros';
  if (data.esBiMoneda && !soportaBiMoneda) {
    throw new Error(
      `El tipo "${data.tipoProducto}" no soporta bi-moneda. Usa cuenta_corriente o cuenta_ahorros.`,
    );
  }

  // Tipos con banco requieren RelacionBancaria
  if (requiereRelacionBancaria(data.tipoProducto)) {
    if (!data.relacionBancariaId) {
      throw new Error(
        `El tipo "${data.tipoProducto}" requiere vinculación a una RelacionBancaria.`,
      );
    }
    const rb = await getRelacionBancaria(data.relacionBancariaId);
    if (!rb) {
      throw new Error(
        `RelacionBancaria con id=${data.relacionBancariaId} no existe.`,
      );
    }
    if (!rb.activa) {
      throw new Error(
        `RelacionBancaria con id=${data.relacionBancariaId} está inactiva.`,
      );
    }
  }

  // Tarjeta débito requiere cuentaVinculadaId
  if (data.tipoProducto === 'tarjeta_debito' && !data.cuentaVinculadaId) {
    throw new Error(
      'La tarjeta débito requiere cuentaVinculadaId (producto de ahorros vinculado).',
    );
  }

  // Tarjeta crédito requiere ultimosDigitos, diaCorte, diaPago
  if (data.tipoProducto === 'tarjeta_credito') {
    if (!data.ultimosDigitos?.trim()) {
      throw new Error('Tarjeta de crédito: ultimosDigitos es obligatorio');
    }
    if (!data.diaCorte || data.diaCorte < 1 || data.diaCorte > 31) {
      throw new Error('Tarjeta de crédito: diaCorte debe estar entre 1 y 31');
    }
    if (!data.diaPago || data.diaPago < 1 || data.diaPago > 31) {
      throw new Error('Tarjeta de crédito: diaPago debe estar entre 1 y 31');
    }
  }

  // Wallet digital requiere proveedorWallet
  if (data.tipoProducto === 'wallet_digital' && !data.proveedorWallet) {
    throw new Error('Wallet digital: proveedorWallet es obligatorio');
  }

  // Validar canales digitales (P-1)
  if (data.canalesDigitales?.length) {
    if (!admiteCanalesDigitales(data.tipoProducto)) {
      throw new Error(
        `El tipo "${data.tipoProducto}" no admite canales digitales adosados (Yape/Plin/SIP/Ágora/BIM). Solo cuenta_corriente y cuenta_ahorros.`,
      );
    }
    if (!data.banco && data.relacionBancariaId) {
      // Resolver banco desde la relacion
      const rb = await getRelacionBancaria(data.relacionBancariaId);
      data.banco = rb?.banco;
    }
    if (!data.banco) {
      throw new Error(
        'Para validar canales digitales se requiere `banco` o `relacionBancariaId`.',
      );
    }
    for (const canal of data.canalesDigitales) {
      const err = validarCanalDigital(canal, data.banco);
      if (err) throw new Error(err);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// CREAR
// ═════════════════════════════════════════════════════════════════════════

export async function crearProductoFinanciero(
  data: ProductoFinancieroFormData,
  userId: string,
): Promise<string> {
  await validarFormData(data);

  // Generar codigo (PF-001, PF-002, ...)
  const codigo = await generarCodigoProductoFinanciero();

  // Hidratar banco/bancoNombreCompleto desde RelacionBancaria si no vienen
  let banco = data.banco;
  let bancoNombreCompleto = data.bancoNombreCompleto;
  if (!banco && data.relacionBancariaId) {
    const rb = await getRelacionBancaria(data.relacionBancariaId);
    if (rb) {
      banco = rb.banco;
      bancoNombreCompleto = rb.bancoNombreCompleto;
    }
  }

  const docData: Record<string, unknown> = {
    codigo,
    nombre: data.nombre.trim(),
    tipoProducto: data.tipoProducto,

    moneda: data.moneda,
    esBiMoneda: data.esBiMoneda ?? false,

    // Saldos iniciales (se setean al crear; D-PF-3)
    saldoActual: data.saldoInicial ?? 0,
    saldoActualizadoEn: Timestamp.now(),

    titularidad: data.titularidad,

    activa: true,
    creadoPor: userId,
    fechaCreacion: Timestamp.now(),
  };

  // Bi-moneda
  if (data.esBiMoneda) {
    docData.saldoUSD = data.saldoInicialUSD ?? 0;
    docData.saldoPEN = data.saldoInicialPEN ?? 0;
    docData.saldoActual = 0;
  }

  // Vinculacion bancaria
  if (data.relacionBancariaId) docData.relacionBancariaId = data.relacionBancariaId;
  if (banco) docData.banco = banco;
  if (bancoNombreCompleto) docData.bancoNombreCompleto = bancoNombreCompleto;

  // Titularidad personal
  if (data.titularidad === 'personal') {
    if (data.titularEntidadId) docData.titularEntidadId = data.titularEntidadId;
    if (data.titularEntidadTipo) docData.titularEntidadTipo = data.titularEntidadTipo;
    if (data.titularNombre) docData.titularNombre = data.titularNombre.trim();
  }

  // Datos de cuenta bancaria
  if (data.numeroCuenta?.trim()) docData.numeroCuenta = data.numeroCuenta.trim();
  if (data.cci?.trim()) docData.cci = data.cci.trim();
  if (data.numerosAdicionales?.length)
    docData.numerosAdicionales = data.numerosAdicionales;

  // Tarjeta débito
  if (data.cuentaVinculadaId) docData.cuentaVinculadaId = data.cuentaVinculadaId;

  // Tarjeta crédito
  if (data.ultimosDigitos) docData.ultimosDigitos = data.ultimosDigitos;
  if (data.marca) docData.marca = data.marca;
  if (data.diaCorte) docData.diaCorte = data.diaCorte;
  if (data.diaPago) docData.diaPago = data.diaPago;
  if (data.topeControlUSD !== undefined) docData.topeControlUSD = data.topeControlUSD;
  if (data.topeControlPEN !== undefined) docData.topeControlPEN = data.topeControlPEN;
  if (data.cuentaPagoDefaultId) docData.cuentaPagoDefaultId = data.cuentaPagoDefaultId;

  // Wallet
  if (data.proveedorWallet) docData.proveedorWallet = data.proveedorWallet;
  if (data.identificadorWallet?.trim())
    docData.identificadorWallet = data.identificadorWallet.trim();

  // Métodos y canales
  if (data.metodosDisponibles?.length)
    docData.metodosDisponibles = data.metodosDisponibles;
  if (data.canalesDigitales?.length)
    docData.canalesDigitales = data.canalesDigitales;

  // Configuración
  if (data.esCuentaPorDefecto !== undefined)
    docData.esCuentaPorDefecto = data.esCuentaPorDefecto;

  const ref = await addDoc(collection(db, COL), docData);
  return ref.id;
}

// ═════════════════════════════════════════════════════════════════════════
// LEER
// ═════════════════════════════════════════════════════════════════════════

export async function getProductoFinanciero(
  id: string,
): Promise<ProductoFinanciero | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ProductoFinanciero;
}

export async function getProductosFinancieros(): Promise<ProductoFinanciero[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProductoFinanciero);
}

export async function getProductosFinancierosActivos(): Promise<
  ProductoFinanciero[]
> {
  const q = query(collection(db, COL), where('activa', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProductoFinanciero);
}

export async function getProductosFinancierosPorTipo(
  tipo: TipoProductoFinanciero,
): Promise<ProductoFinanciero[]> {
  const q = query(
    collection(db, COL),
    where('tipoProducto', '==', tipo),
    where('activa', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProductoFinanciero);
}

export async function getProductosFinancierosPorRelacion(
  relacionBancariaId: string,
): Promise<ProductoFinanciero[]> {
  const q = query(
    collection(db, COL),
    where('relacionBancariaId', '==', relacionBancariaId),
    where('activa', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProductoFinanciero);
}

// ═════════════════════════════════════════════════════════════════════════
// ACTUALIZAR
// ═════════════════════════════════════════════════════════════════════════

export async function actualizarProductoFinanciero(
  id: string,
  data: Partial<
    Omit<
      ProductoFinancieroFormData,
      'saldoInicial' | 'saldoInicialUSD' | 'saldoInicialPEN'
    >
  >,
  userId: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    actualizadoPor: userId,
    fechaActualizacion: Timestamp.now(),
  };

  // Solo iterar campos definidos para no sobrescribir con undefined
  const fields: (keyof typeof data)[] = [
    'nombre',
    'tipoProducto',
    'relacionBancariaId',
    'banco',
    'bancoNombreCompleto',
    'moneda',
    'esBiMoneda',
    'titularidad',
    'titularEntidadId',
    'titularEntidadTipo',
    'titularNombre',
    'numeroCuenta',
    'cci',
    'numerosAdicionales',
    'cuentaVinculadaId',
    'ultimosDigitos',
    'marca',
    'diaCorte',
    'diaPago',
    'topeControlUSD',
    'topeControlPEN',
    'cuentaPagoDefaultId',
    'proveedorWallet',
    'identificadorWallet',
    'metodosDisponibles',
    'canalesDigitales',
    'esCuentaPorDefecto',
  ];
  for (const f of fields) {
    if (data[f] !== undefined) updates[f] = data[f];
  }

  await updateDoc(doc(db, COL, id), updates);
}

export async function toggleActivaProductoFinanciero(
  id: string,
  activa: boolean,
  userId: string,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    activa,
    actualizadoPor: userId,
    fechaActualizacion: Timestamp.now(),
  });
}

/**
 * Actualiza el saldo cacheado de un producto. Llamado por
 * movimientoFinanciero.service al insertar un movimiento.
 *
 * D-PF-3: el libro mayor es la fuente de verdad. Esta función NO valida
 * contra el libro — solo aplica un delta. Para reconcilar, usar
 * recalcularSaldoDesdeLibroMayor().
 */
export async function aplicarDeltaSaldo(
  productoId: string,
  delta: number,
  moneda: MonedaPF,
  userId: string,
): Promise<void> {
  const prod = await getProductoFinanciero(productoId);
  if (!prod) throw new Error(`ProductoFinanciero ${productoId} no existe`);

  const updates: Record<string, unknown> = {
    saldoActualizadoEn: Timestamp.now(),
    actualizadoPor: userId,
  };

  if (prod.esBiMoneda) {
    if (moneda === 'USD') {
      updates.saldoUSD = (prod.saldoUSD ?? 0) + delta;
    } else {
      updates.saldoPEN = (prod.saldoPEN ?? 0) + delta;
    }
  } else {
    if (moneda !== prod.moneda) {
      throw new Error(
        `Moneda del movimiento (${moneda}) no coincide con la del producto (${prod.moneda}). ` +
        `Usar conversión o producto bi-moneda.`,
      );
    }
    updates.saldoActual = prod.saldoActual + delta;
  }

  await updateDoc(doc(db, COL, productoId), updates);
}

// ═════════════════════════════════════════════════════════════════════════
// ELIMINAR
// ═════════════════════════════════════════════════════════════════════════

/**
 * Borra un producto financiero. Solo permitido si NO tiene movimientos
 * registrados. Esa validación se hace en movimientoFinanciero.service.
 */
export async function eliminarProductoFinanciero(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Genera el siguiente código PF-NNN. Lee el máximo actual y suma 1.
 * Para volúmenes pequeños (< 1000 productos) este patrón es OK; para más
 * conviene usar un contador atómico en `contadores/PF`.
 */
async function generarCodigoProductoFinanciero(): Promise<string> {
  const productos = await getProductosFinancieros();
  let maxN = 0;
  for (const p of productos) {
    const m = p.codigo?.match(/^PF-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
  }
  const next = (maxN + 1).toString().padStart(3, '0');
  return `PF-${next}`;
}

// ═════════════════════════════════════════════════════════════════════════
// RE-EXPORT
// ═════════════════════════════════════════════════════════════════════════

export type {
  ProductoFinanciero,
  ProductoFinancieroFormData,
  TipoProductoFinanciero,
  CanalDigital,
  MonedaPF,
};
