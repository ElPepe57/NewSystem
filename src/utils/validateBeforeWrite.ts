/**
 * SEC-011: Validation utility for Firestore writes
 *
 * Validates data against Zod schemas before writing to Firestore.
 * Uses .passthrough() to allow legacy fields not in the schema.
 */
import { z } from 'zod';
import { logger } from '../lib/logger';

/**
 * Validates data against a Zod schema before Firestore write.
 * Logs warnings for invalid data but does NOT throw by default
 * (to avoid breaking production flows during gradual adoption).
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param context - Description for logging (e.g., "venta.crear")
 * @param strict - If true, throws on validation failure. Default: false (log only)
 */
export function validateBeforeWrite<T extends z.ZodType>(
  schema: T,
  data: unknown,
  context: string,
  strict = false
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    ).join('; ');

    const msg = `[VALIDATE] ${context}: ${errors}`;

    if (strict) {
      logger.error(msg);
      throw new Error(`Datos inválidos en ${context}: ${errors}`);
    } else {
      logger.warn(msg);
    }
  }

  return data as z.infer<T>;
}

// ============================================================
// SCHEMAS FOR CRITICAL COLLECTIONS
// ============================================================

/** Schema for Venta creation — validates essential fields */
export const ventaCreateSchema = z.object({
  clienteId: z.string().optional(),
  clienteNombre: z.string().min(1, 'Nombre de cliente requerido'),
  productos: z.array(z.object({
    productoId: z.string().min(1),
    cantidad: z.number().positive(),
    precioUnitario: z.number().min(0),
  })).min(1, 'Al menos un producto requerido'),
  totalPEN: z.number().min(0),
  estado: z.string(),
}).passthrough();

/** Schema for OrdenCompra creation */
export const ordenCompraCreateSchema = z.object({
  proveedorId: z.string().min(1, 'Proveedor requerido'),
  proveedorNombre: z.string().min(1),
  productos: z.array(z.object({
    productoId: z.string().min(1),
    cantidad: z.number().positive(),
    precioUnitarioUSD: z.number().min(0),
  })).min(1, 'Al menos un producto requerido'),
  estado: z.string(),
}).passthrough();

/** Schema for Unidad creation */
export const unidadCreateSchema = z.object({
  productoId: z.string().min(1, 'Producto requerido'),
  estado: z.string().min(1, 'Estado requerido'),
  ordenCompraId: z.string().min(1, 'OC requerida'),
}).passthrough();
