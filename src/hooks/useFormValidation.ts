import { useState, useCallback, useMemo } from 'react';
import { z, ZodError } from 'zod';
import type { ZodSchema } from 'zod';

export interface ValidationError {
  path: string;
  message: string;
}

export interface UseFormValidationOptions<T> {
  /** Schema de Zod para validación */
  schema: ZodSchema<T>;
  /** Modo de validación */
  mode?: 'onChange' | 'onBlur' | 'onSubmit';
  /** Callback cuando la validación es exitosa */
  onValid?: (data: T) => void;
  /** Callback cuando hay errores */
  onInvalid?: (errors: ValidationError[]) => void;
}

export interface UseFormValidationResult<T> {
  /** Errores actuales por campo */
  errors: Record<string, string>;
  /** Si el formulario tiene errores */
  hasErrors: boolean;
  /** Si el formulario es válido */
  isValid: boolean;
  /** Validar un campo específico */
  validateField: (field: keyof T, value: unknown) => boolean;
  /** Validar todo el formulario */
  validateForm: (data: Partial<T>) => boolean;
  /** Limpiar errores */
  clearErrors: () => void;
  /** Limpiar error de un campo específico */
  clearFieldError: (field: keyof T) => void;
  /** Obtener error de un campo */
  getFieldError: (field: keyof T) => string | undefined;
  /** Parsear y validar datos */
  parseAndValidate: (data: unknown) => { success: true; data: T } | { success: false; errors: ValidationError[] };
}

/**
 * Hook para validación de formularios con Zod
 *
 * @example
 * const productSchema = z.object({
 *   nombre: z.string().min(3, 'Mínimo 3 caracteres'),
 *   precio: z.number().positive('Debe ser mayor a 0'),
 *   stock: z.number().int().min(0, 'No puede ser negativo')
 * });
 *
 * const { errors, validateField, validateForm } = useFormValidation({
 *   schema: productSchema,
 *   mode: 'onChange'
 * });
 */
export function useFormValidation<T>({
  schema,
  mode: _mode = 'onBlur',
  onValid,
  onInvalid
}: UseFormValidationOptions<T>): UseFormValidationResult<T> {
  // Note: _mode is reserved for future implementation of different validation modes
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);
  const isValid = useMemo(() => !hasErrors, [hasErrors]);

  const parseZodErrors = useCallback((error: ZodError): ValidationError[] => {
    return error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
  }, []);

  const validateField = useCallback((field: keyof T, value: unknown): boolean => {
    try {
      // Crear un objeto parcial para validar solo el campo
      const partialSchema = (schema as any).pick?.({ [field]: true });
      if (partialSchema) {
        partialSchema.parse({ [field]: value });
      }

      // Limpiar error del campo si es válido
      setErrors(prev => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = parseZodErrors(error);
        const fieldError = fieldErrors.find(e => e.path === String(field));
        if (fieldError) {
          setErrors(prev => ({
            ...prev,
            [field as string]: fieldError.message
          }));
        }
      }
      return false;
    }
  }, [schema, parseZodErrors]);

  const validateForm = useCallback((data: Partial<T>): boolean => {
    try {
      schema.parse(data);
      setErrors({});
      onValid?.(data as T);
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = parseZodErrors(error);
        const errorMap: Record<string, string> = {};
        validationErrors.forEach(err => {
          errorMap[err.path] = err.message;
        });
        setErrors(errorMap);
        onInvalid?.(validationErrors);
      }
      return false;
    }
  }, [schema, parseZodErrors, onValid, onInvalid]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((field: keyof T) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  }, []);

  const getFieldError = useCallback((field: keyof T): string | undefined => {
    return errors[field as string];
  }, [errors]);

  const parseAndValidate = useCallback((data: unknown): { success: true; data: T } | { success: false; errors: ValidationError[] } => {
    try {
      const parsed = schema.parse(data);
      return { success: true, data: parsed };
    } catch (error) {
      if (error instanceof ZodError) {
        return { success: false, errors: parseZodErrors(error) };
      }
      return { success: false, errors: [{ path: '', message: 'Error de validación desconocido' }] };
    }
  }, [schema, parseZodErrors]);

  return {
    errors,
    hasErrors,
    isValid,
    validateField,
    validateForm,
    clearErrors,
    clearFieldError,
    getFieldError,
    parseAndValidate
  };
}

// Schemas comunes reutilizables
export const commonSchemas = {
  /** Email válido */
  email: z.string().email('Email inválido'),

  /** Teléfono peruano */
  telefonoPeru: z.string().regex(/^9\d{8}$/, 'Teléfono debe tener 9 dígitos y empezar con 9'),

  /** DNI peruano */
  dni: z.string().regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),

  /** RUC peruano */
  ruc: z.string().regex(/^(10|20)\d{9}$/, 'RUC inválido'),

  /** DNI o RUC */
  dniRuc: z.string().refine(
    val => /^\d{8}$/.test(val) || /^(10|20)\d{9}$/.test(val),
    'Debe ser DNI (8 dígitos) o RUC (11 dígitos)'
  ),

  /** Monto positivo */
  montoPositivo: z.number().positive('Debe ser mayor a 0'),

  /** Cantidad entera no negativa */
  cantidad: z.number().int('Debe ser entero').min(0, 'No puede ser negativo'),

  /** Porcentaje 0-100 */
  porcentaje: z.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%'),

  /** URL válida */
  url: z.string().url('URL inválida'),

  /** URL opcional */
  urlOptional: z.string().url('URL inválida').optional().or(z.literal('')),

  /** Fecha no pasada */
  fechaFutura: z.date().refine(
    date => date >= new Date(),
    'La fecha no puede ser pasada'
  ),

  /** Texto requerido con mínimo */
  textoRequerido: (min: number = 1) =>
    z.string().min(min, `Mínimo ${min} caractere${min > 1 ? 's' : ''}`),

  /** SKU válido */
  sku: z.string()
    .min(3, 'Mínimo 3 caracteres')
    .max(20, 'Máximo 20 caracteres')
    .regex(/^[A-Z0-9-]+$/, 'Solo mayúsculas, números y guiones')
};

export default useFormValidation;
