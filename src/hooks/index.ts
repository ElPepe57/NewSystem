// Form Validation
export { useFormValidation, commonSchemas } from './useFormValidation';
export type { ValidationError, UseFormValidationOptions, UseFormValidationResult } from './useFormValidation';

// Auto Save
export { useAutoSave, useUnsavedChanges } from './useAutoSave';
export type { UseAutoSaveOptions, UseAutoSaveResult } from './useAutoSave';

// Debounce
export { useDebounce, useDebouncedCallback, useSearch, useFilteredList } from './useDebounce';

// Permissions
export { usePermissions, useHasPermiso, useIsRole } from './usePermissions';

// Notificaciones Auto
export { useNotificacionesAuto, useNotificacionesAutoInit } from './useNotificacionesAuto';

// Rentabilidad Ventas
export { useRentabilidadVentas } from './useRentabilidadVentas';
export type { DesgloseProducto, GAGOProducto, RentabilidadVenta, DatosRentabilidadGlobal } from './useRentabilidadVentas';

// User Names
export { useUserName, useUserNames, getUserNameSync, preloadUserNames, clearUserNameCache } from './useUserNames';
