import React from 'react';
import {
  Plus,
  Trash2,
  Plane,
  Store,
  Crown
} from 'lucide-react';
import { Button, Modal } from '../../components/common';
import { LineaNegocioCheckboxes } from '../../components/Maestros/LineaNegocioBadge';
import {
  ClienteDetalleModal,
  MarcaDetalleModal,
  ProveedorDetalleModal,
  AlmacenDetalleModal,
  CompetidorDetalleModal
} from '../../components/Maestros/DetalleModals';
import { ViajeroDetalle } from '../../components/modules/almacen/ViajeroDetalle';
import { ClienteDetalle } from '../../components/modules/cliente/ClienteDetalle';
import { CanalAutocomplete } from '../../components/modules/canalVenta/CanalAutocomplete';
import type {
  Cliente,
  ClienteFormData,
  Competidor,
  CompetidorFormData,
  PlataformaCompetidorData,
  ReputacionCompetidor
} from '../../types/entidadesMaestras.types';
import type { Marca, MarcaFormData } from '../../types/entidadesMaestras.types';
import type { Proveedor, ProveedorFormData, TipoProveedor } from '../../types/ordenCompra.types';
import type { Almacen, AlmacenFormData, TipoAlmacen, EstadoAlmacen, FrecuenciaViaje } from '../../types/almacen.types';

interface MaestrosModalsProps {
  // Cliente modal
  showClienteModal: boolean;
  editingCliente: Cliente | null;
  clienteForm: Partial<ClienteFormData>;
  isSubmitting: boolean;
  onCloseClienteModal: () => void;
  onClienteFormChange: (form: Partial<ClienteFormData>) => void;
  onSaveCliente: () => void;

  // Marca modal
  showMarcaModal: boolean;
  editingMarca: Marca | null;
  marcaForm: Partial<MarcaFormData>;
  onCloseMarcaModal: () => void;
  onMarcaFormChange: (form: Partial<MarcaFormData>) => void;
  onSaveMarca: () => void;

  // Proveedor modal
  showProveedorModal: boolean;
  editingProveedor: Proveedor | null;
  proveedorForm: Partial<ProveedorFormData>;
  onCloseProveedorModal: () => void;
  onProveedorFormChange: (form: Partial<ProveedorFormData>) => void;
  onSaveProveedor: () => void;

  // Almacen modal
  showAlmacenModal: boolean;
  editingAlmacen: Almacen | null;
  almacenForm: Partial<AlmacenFormData>;
  onCloseAlmacenModal: () => void;
  onAlmacenFormChange: (form: Partial<AlmacenFormData>) => void;
  onSaveAlmacen: () => void;

  // Competidor modal
  showCompetidorModal: boolean;
  editingCompetidor: Competidor | null;
  competidorForm: Partial<CompetidorFormData>;
  onCloseCompetidorModal: () => void;
  onCompetidorFormChange: (form: Partial<CompetidorFormData>) => void;
  onSaveCompetidor: () => void;
  onAddPlataforma: () => void;
  onUpdatePlataforma: (index: number, field: keyof PlataformaCompetidorData, value: string | boolean) => void;
  onRemovePlataforma: (index: number) => void;

  // Detalle modals
  detalleCliente: Cliente | null;
  detalleMarca: Marca | null;
  detalleProveedor: Proveedor | null;
  detalleAlmacen: Almacen | null;
  detalleCompetidor: Competidor | null;
  historialViajero: Almacen | null;
  historialCliente: Cliente | null;
  onCloseDetalleCliente: () => void;
  onCloseDetalleMarca: () => void;
  onCloseDetalleProveedor: () => void;
  onCloseDetalleAlmacen: () => void;
  onCloseDetalleCompetidor: () => void;
  onCloseHistorialViajero: () => void;
  onCloseHistorialCliente: () => void;
  onEditFromDetalleCliente: () => void;
  onEditFromDetalleMarca: () => void;
  onEditFromDetalleProveedor: () => void;
  onEditFromDetalleAlmacen: () => void;
  onEditFromDetalleCompetidor: () => void;
  onEditFromHistorialViajero: () => void;
  onEditFromHistorialCliente: () => void;
  onViewHistoryFromDetalleCliente: () => void;
  onViewHistoryFromDetalleAlmacen: (() => void) | undefined;

  // Confirm dialog
  confirmDialog: React.ReactNode;
}

export const MaestrosModals: React.FC<MaestrosModalsProps> = ({
  // Cliente
  showClienteModal,
  editingCliente,
  clienteForm,
  isSubmitting,
  onCloseClienteModal,
  onClienteFormChange,
  onSaveCliente,
  // Marca
  showMarcaModal,
  editingMarca,
  marcaForm,
  onCloseMarcaModal,
  onMarcaFormChange,
  onSaveMarca,
  // Proveedor
  showProveedorModal,
  editingProveedor,
  proveedorForm,
  onCloseProveedorModal,
  onProveedorFormChange,
  onSaveProveedor,
  // Almacen
  showAlmacenModal,
  editingAlmacen,
  almacenForm,
  onCloseAlmacenModal,
  onAlmacenFormChange,
  onSaveAlmacen,
  // Competidor
  showCompetidorModal,
  editingCompetidor,
  competidorForm,
  onCloseCompetidorModal,
  onCompetidorFormChange,
  onSaveCompetidor,
  onAddPlataforma,
  onUpdatePlataforma,
  onRemovePlataforma,
  // Detalle
  detalleCliente,
  detalleMarca,
  detalleProveedor,
  detalleAlmacen,
  detalleCompetidor,
  historialViajero,
  historialCliente,
  onCloseDetalleCliente,
  onCloseDetalleMarca,
  onCloseDetalleProveedor,
  onCloseDetalleAlmacen,
  onCloseDetalleCompetidor,
  onCloseHistorialViajero,
  onCloseHistorialCliente,
  onEditFromDetalleCliente,
  onEditFromDetalleMarca,
  onEditFromDetalleProveedor,
  onEditFromDetalleAlmacen,
  onEditFromDetalleCompetidor,
  onEditFromHistorialViajero,
  onEditFromHistorialCliente,
  onViewHistoryFromDetalleCliente,
  onViewHistoryFromDetalleAlmacen,
  confirmDialog
}) => {
  return (
    <>
      {/* ============ MODAL CLIENTE ============ */}
      <Modal
        isOpen={showClienteModal}
        onClose={onCloseClienteModal}
        title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={clienteForm.nombre || ''}
                onChange={(e) => onClienteFormChange({ ...clienteForm, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Juan Perez Garcia"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Cliente
              </label>
              <select
                value={clienteForm.tipoCliente}
                onChange={(e) => onClienteFormChange({ ...clienteForm, tipoCliente: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="persona">Persona Natural</option>
                <option value="empresa">Empresa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DNI / RUC
              </label>
              <input
                type="text"
                value={clienteForm.dniRuc || ''}
                onChange={(e) => onClienteFormChange({ ...clienteForm, dniRuc: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="12345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefono (WhatsApp)
              </label>
              <input
                type="tel"
                value={clienteForm.telefono || ''}
                onChange={(e) => onClienteFormChange({ ...clienteForm, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="999 123 456"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={clienteForm.email || ''}
                onChange={(e) => onClienteFormChange({ ...clienteForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="cliente@email.com"
              />
            </div>

            <div>
              <CanalAutocomplete
                value={clienteForm.canalOrigen || ''}
                onChange={(canalId) => onClienteFormChange({ ...clienteForm, canalOrigen: canalId })}
                label="Canal de Origen"
                placeholder="Buscar o crear canal..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referido por
              </label>
              <input
                type="text"
                value={clienteForm.referidoPor || ''}
                onChange={(e) => onClienteFormChange({ ...clienteForm, referidoPor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nombre de quien refirio"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={clienteForm.notas || ''}
                onChange={(e) => onClienteFormChange({ ...clienteForm, notas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Notas internas sobre el cliente..."
              />
            </div>
          </div>

          <LineaNegocioCheckboxes
            value={clienteForm.lineaNegocioIds || []}
            onChange={(ids) => onClienteFormChange({ ...clienteForm, lineaNegocioIds: ids })}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="ghost" onClick={onCloseClienteModal}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={onSaveCliente}
              disabled={isSubmitting || !clienteForm.nombre}
            >
              {isSubmitting ? 'Guardando...' : editingCliente ? 'Actualizar' : 'Crear Cliente'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============ MODAL MARCA ============ */}
      <Modal
        isOpen={showMarcaModal}
        onClose={onCloseMarcaModal}
        title={editingMarca ? 'Editar Marca' : 'Nueva Marca'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la Marca *
            </label>
            <input
              type="text"
              value={marcaForm.nombre || ''}
              onChange={(e) => onMarcaFormChange({ ...marcaForm, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Pfizer, NOW Foods, etc."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Marca
              </label>
              <select
                value={marcaForm.tipoMarca}
                onChange={(e) => onMarcaFormChange({ ...marcaForm, tipoMarca: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="farmaceutica">Farmaceutica</option>
                <option value="suplementos">Suplementos</option>
                <option value="cosmetica">Cosmetica</option>
                <option value="tecnologia">Tecnologia</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pais de Origen
              </label>
              <input
                type="text"
                value={marcaForm.paisOrigen || ''}
                onChange={(e) => onMarcaFormChange({ ...marcaForm, paisOrigen: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="USA, Alemania, etc."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alias (separados por coma)
            </label>
            <input
              type="text"
              value={(marcaForm.alias || []).join(', ')}
              onChange={(e) => onMarcaFormChange({
                ...marcaForm,
                alias: e.target.value.split(',').map(a => a.trim()).filter(Boolean)
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Phizer, PFIZER, etc."
            />
            <p className="text-xs text-gray-500 mt-1">
              Nombres alternativos que puedan escribir los usuarios
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sitio Web
            </label>
            <input
              type="url"
              value={marcaForm.sitioWeb || ''}
              onChange={(e) => onMarcaFormChange({ ...marcaForm, sitioWeb: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="https://www.marca.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion
            </label>
            <textarea
              value={marcaForm.descripcion || ''}
              onChange={(e) => onMarcaFormChange({ ...marcaForm, descripcion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
              placeholder="Breve descripcion de la marca..."
            />
          </div>

          <LineaNegocioCheckboxes
            value={marcaForm.lineaNegocioIds || []}
            onChange={(ids) => onMarcaFormChange({ ...marcaForm, lineaNegocioIds: ids })}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="ghost" onClick={onCloseMarcaModal}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={onSaveMarca}
              disabled={isSubmitting || !marcaForm.nombre}
            >
              {isSubmitting ? 'Guardando...' : editingMarca ? 'Actualizar' : 'Crear Marca'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============ MODAL PROVEEDOR ============ */}
      <Modal
        isOpen={showProveedorModal}
        onClose={onCloseProveedorModal}
        title={editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Proveedor *
              </label>
              <input
                type="text"
                value={proveedorForm.nombre || ''}
                onChange={(e) => onProveedorFormChange({ ...proveedorForm, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Amazon, iHerb, Carlyle, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Proveedor
              </label>
              <select
                value={proveedorForm.tipo}
                onChange={(e) => onProveedorFormChange({ ...proveedorForm, tipo: e.target.value as TipoProveedor })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="distribuidor">Distribuidor</option>
                <option value="fabricante">Fabricante</option>
                <option value="mayorista">Mayorista</option>
                <option value="minorista">Minorista</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pais *
              </label>
              <select
                value={proveedorForm.pais}
                onChange={(e) => onProveedorFormChange({ ...proveedorForm, pais: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="USA">USA</option>
                <option value="China">China</option>
                <option value="Alemania">Alemania</option>
                <option value="India">India</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL del Sitio Web *
              </label>
              <input
                type="url"
                value={proveedorForm.url || ''}
                onChange={(e) => onProveedorFormChange({ ...proveedorForm, url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://www.amazon.com, https://www.iherb.com, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefono
              </label>
              <input
                type="tel"
                value={proveedorForm.telefono || ''}
                onChange={(e) => onProveedorFormChange({ ...proveedorForm, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="+1 555 123 4567"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Direccion
              </label>
              <input
                type="text"
                value={proveedorForm.direccion || ''}
                onChange={(e) => onProveedorFormChange({ ...proveedorForm, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Direccion del proveedor"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas Internas
              </label>
              <textarea
                value={proveedorForm.notasInternas || ''}
                onChange={(e) => onProveedorFormChange({ ...proveedorForm, notasInternas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Notas internas sobre el proveedor..."
              />
            </div>
          </div>

          <LineaNegocioCheckboxes
            value={proveedorForm.lineaNegocioIds || []}
            onChange={(ids) => onProveedorFormChange({ ...proveedorForm, lineaNegocioIds: ids })}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="ghost" onClick={onCloseProveedorModal}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={onSaveProveedor}
              disabled={isSubmitting || !proveedorForm.nombre || !proveedorForm.url}
            >
              {isSubmitting ? 'Guardando...' : editingProveedor ? 'Actualizar' : 'Crear Proveedor'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============ MODAL ALMACEN ============ */}
      <Modal
        isOpen={showAlmacenModal}
        onClose={onCloseAlmacenModal}
        title={editingAlmacen ? 'Editar Almacen' : 'Nuevo Almacen / Viajero'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {editingAlmacen && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Codigo
                </label>
                <input
                  type="text"
                  value={editingAlmacen.codigo}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-md font-mono bg-gray-100 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  El codigo no se puede modificar
                </p>
              </div>
            )}

            <div className={editingAlmacen ? '' : 'col-span-2'}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={almacenForm.nombre || ''}
                onChange={(e) => onAlmacenFormChange({ ...almacenForm, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Carlos Rodriguez, Almacen Miami..."
              />
              {!editingAlmacen && (
                <p className="text-xs text-gray-500 mt-1">
                  El codigo se generara automaticamente segun el tipo
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
              <select
                value={almacenForm.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoAlmacen;
                  onAlmacenFormChange({
                    ...almacenForm,
                    tipo,
                    esViajero: tipo === 'viajero',
                    pais: tipo === 'almacen_peru' ? 'Peru' : 'USA'
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="viajero">Viajero (USA - Almacena y transporta)</option>
                <option value="almacen_peru">Almacen Peru</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={almacenForm.estadoAlmacen}
                onChange={(e) => onAlmacenFormChange({ ...almacenForm, estadoAlmacen: e.target.value as EstadoAlmacen })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="suspendido">Suspendido</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Direccion
              </label>
              <input
                type="text"
                value={almacenForm.direccion || ''}
                onChange={(e) => onAlmacenFormChange({ ...almacenForm, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="123 Main Street, Apt 4B"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                value={almacenForm.ciudad || ''}
                onChange={(e) => onAlmacenFormChange({ ...almacenForm, ciudad: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Miami, Lima, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado/Region
              </label>
              <input
                type="text"
                value={almacenForm.estado || ''}
                onChange={(e) => onAlmacenFormChange({ ...almacenForm, estado: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Florida, California, Lima..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contacto
              </label>
              <input
                type="text"
                value={almacenForm.contacto || ''}
                onChange={(e) => onAlmacenFormChange({ ...almacenForm, contacto: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nombre del contacto"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefono / WhatsApp
              </label>
              <input
                type="tel"
                value={almacenForm.telefono || ''}
                onChange={(e) => onAlmacenFormChange({ ...almacenForm, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="+1 (305) 555-0101"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={almacenForm.email || ''}
                onChange={(e) => onAlmacenFormChange({ ...almacenForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="contacto@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacidad (unidades)
              </label>
              <input
                type="number"
                value={almacenForm.capacidadUnidades || ''}
                onChange={(e) => onAlmacenFormChange({ ...almacenForm, capacidadUnidades: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="200"
              />
            </div>

            {almacenForm.esViajero && (
              <>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h4 className="text-sm font-semibold text-purple-700 flex items-center">
                    <Plane className="h-4 w-4 mr-2" />
                    Configuracion de Viajero
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frecuencia de Viaje
                  </label>
                  <select
                    value={almacenForm.frecuenciaViaje || ''}
                    onChange={(e) => onAlmacenFormChange({ ...almacenForm, frecuenciaViaje: e.target.value as FrecuenciaViaje })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                    <option value="bimestral">Bimestral</option>
                    <option value="variable">Variable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proximo Viaje
                  </label>
                  <input
                    type="date"
                    value={almacenForm.proximoViaje ? new Date(almacenForm.proximoViaje).toISOString().split('T')[0] : ''}
                    onChange={(e) => onAlmacenFormChange({ ...almacenForm, proximoViaje: e.target.value ? new Date(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Costo Promedio Flete (USD/unidad)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={almacenForm.costoPromedioFlete || ''}
                    onChange={(e) => onAlmacenFormChange({ ...almacenForm, costoPromedioFlete: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="5.00"
                  />
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={almacenForm.notas || ''}
                onChange={(e) => onAlmacenFormChange({ ...almacenForm, notas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Notas adicionales sobre el almacen o viajero..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="ghost" onClick={onCloseAlmacenModal}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={onSaveAlmacen}
              disabled={isSubmitting || !almacenForm.nombre}
            >
              {isSubmitting ? 'Guardando...' : editingAlmacen ? 'Actualizar' : 'Crear Almacen'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============ MODAL COMPETIDOR ============ */}
      <Modal
        isOpen={showCompetidorModal}
        onClose={onCloseCompetidorModal}
        title={editingCompetidor ? 'Editar Competidor' : 'Nuevo Competidor'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Competidor *
              </label>
              <input
                type="text"
                value={competidorForm.nombre || ''}
                onChange={(e) => onCompetidorFormChange({ ...competidorForm, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nombre o usuario del competidor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nivel de Amenaza
              </label>
              <select
                value={competidorForm.nivelAmenaza}
                onChange={(e) => onCompetidorFormChange({ ...competidorForm, nivelAmenaza: e.target.value as 'bajo' | 'medio' | 'alto' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                value={competidorForm.ciudad || ''}
                onChange={(e) => onCompetidorFormChange({ ...competidorForm, ciudad: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Lima, Arequipa, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departamento
              </label>
              <input
                type="text"
                value={competidorForm.departamento || ''}
                onChange={(e) => onCompetidorFormChange({ ...competidorForm, departamento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Lima, Cusco, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reputacion
              </label>
              <select
                value={competidorForm.reputacion}
                onChange={(e) => onCompetidorFormChange({ ...competidorForm, reputacion: e.target.value as ReputacionCompetidor })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="desconocida">Desconocida</option>
                <option value="excelente">Excelente</option>
                <option value="buena">Buena</option>
                <option value="regular">Regular</option>
                <option value="mala">Mala</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estrategia de Precio
              </label>
              <select
                value={competidorForm.estrategiaPrecio || ''}
                onChange={(e) => onCompetidorFormChange({ ...competidorForm, estrategiaPrecio: e.target.value as any || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Sin definir</option>
                <option value="premium">Premium (precios altos)</option>
                <option value="competitivo">Competitivo (precios mercado)</option>
                <option value="bajo">Bajo costo</option>
                <option value="variable">Variable</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ventas Estimadas (mensuales)
              </label>
              <input
                type="number"
                value={competidorForm.ventasEstimadas || ''}
                onChange={(e) => onCompetidorFormChange({ ...competidorForm, ventasEstimadas: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Cantidad estimada de ventas"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={competidorForm.esLiderCategoria || false}
                  onChange={(e) => onCompetidorFormChange({ ...competidorForm, esLiderCategoria: e.target.checked })}
                  className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <Crown className="h-4 w-4 mr-1 text-amber-500" />
                  Es lider en alguna categoria
                </span>
              </label>
            </div>

            {/* Plataformas dinamicas */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Plataformas donde opera
                </label>
                <button
                  type="button"
                  onClick={onAddPlataforma}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Plataforma
                </button>
              </div>

              {(!competidorForm.plataformasData || competidorForm.plataformasData.length === 0) ? (
                <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <Store className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No hay plataformas registradas</p>
                  <button
                    type="button"
                    onClick={onAddPlataforma}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                  >
                    Agregar primera plataforma
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {competidorForm.plataformasData.map((plataforma, index) => (
                    <div
                      key={plataforma.id}
                      className={`p-3 rounded-lg border ${plataforma.esPrincipal ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div>
                            <input
                              type="text"
                              value={plataforma.nombre}
                              onChange={(e) => onUpdatePlataforma(index, 'nombre', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                              placeholder="Nombre (ej: MercadoLibre, Web Propia)"
                            />
                          </div>
                          <div>
                            <input
                              type="url"
                              value={plataforma.url || ''}
                              onChange={(e) => onUpdatePlataforma(index, 'url', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                              placeholder="URL (ej: https://...)"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={plataforma.notas || ''}
                              onChange={(e) => onUpdatePlataforma(index, 'notas', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                              placeholder="Notas (opcional)"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <label className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              checked={plataforma.esPrincipal || false}
                              onChange={(e) => onUpdatePlataforma(index, 'esPrincipal', e.target.checked)}
                              className="mr-1 h-3 w-3"
                            />
                            Principal
                          </label>
                          <button
                            type="button"
                            onClick={() => onRemovePlataforma(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Eliminar plataforma"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fortalezas
              </label>
              <textarea
                value={competidorForm.fortalezas || ''}
                onChange={(e) => onCompetidorFormChange({ ...competidorForm, fortalezas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Precios bajos, envio rapido..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Debilidades
              </label>
              <textarea
                value={competidorForm.debilidades || ''}
                onChange={(e) => onCompetidorFormChange({ ...competidorForm, debilidades: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Poca variedad, mala atencion..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={competidorForm.notas || ''}
                onChange={(e) => onCompetidorFormChange({ ...competidorForm, notas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Notas adicionales sobre este competidor..."
              />
            </div>
          </div>

          <LineaNegocioCheckboxes
            value={competidorForm.lineaNegocioIds || []}
            onChange={(ids) => onCompetidorFormChange({ ...competidorForm, lineaNegocioIds: ids })}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="ghost" onClick={onCloseCompetidorModal}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={onSaveCompetidor}
              disabled={isSubmitting || !competidorForm.nombre}
            >
              {isSubmitting ? 'Guardando...' : editingCompetidor ? 'Actualizar' : 'Crear Competidor'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============ MODALES DE DETALLE ============ */}
      <ClienteDetalleModal
        isOpen={!!detalleCliente}
        onClose={onCloseDetalleCliente}
        cliente={detalleCliente}
        onEdit={onEditFromDetalleCliente}
        onViewHistory={onViewHistoryFromDetalleCliente}
      />

      <MarcaDetalleModal
        isOpen={!!detalleMarca}
        onClose={onCloseDetalleMarca}
        marca={detalleMarca}
        onEdit={onEditFromDetalleMarca}
      />

      <ProveedorDetalleModal
        isOpen={!!detalleProveedor}
        onClose={onCloseDetalleProveedor}
        proveedor={detalleProveedor}
        onEdit={onEditFromDetalleProveedor}
      />

      <AlmacenDetalleModal
        isOpen={!!detalleAlmacen}
        onClose={onCloseDetalleAlmacen}
        almacen={detalleAlmacen}
        onEdit={onEditFromDetalleAlmacen}
        onViewHistory={onViewHistoryFromDetalleAlmacen}
      />

      <CompetidorDetalleModal
        isOpen={!!detalleCompetidor}
        onClose={onCloseDetalleCompetidor}
        competidor={detalleCompetidor}
        onEdit={onEditFromDetalleCompetidor}
      />

      {historialViajero && (
        <ViajeroDetalle
          viajero={historialViajero}
          onClose={onCloseHistorialViajero}
          onEdit={onEditFromHistorialViajero}
        />
      )}

      {historialCliente && (
        <ClienteDetalle
          cliente={historialCliente}
          onClose={onCloseHistorialCliente}
          onEdit={onEditFromHistorialCliente}
        />
      )}

      {confirmDialog}
    </>
  );
};
