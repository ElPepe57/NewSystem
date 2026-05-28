/**
 * EditarAvatarModal · F10.F.1.N · 2026-05-27
 *
 * Modal canon FormModalV2 para subir/cambiar foto de perfil.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 12 (líneas 1263-1310).
 *
 * Estructura:
 *   - Header: iconTone="purple" + Camera icon + "Editar foto"
 *   - Body:
 *     · Preview circular grande (96px) · current photo o iniciales
 *     · Drop zone para seleccionar nueva foto
 *     · Validación: solo imágenes · max 2MB
 *     · Botón "Quitar foto actual" (si tiene)
 *   - Footer: Cancelar + Subir foto (variant primary-soft purple)
 *
 * Connector: userService.uploadProfilePhoto
 */
import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2, AlertTriangle, ImageIcon } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import { userService } from '../../../services/user.service';
import { useAuthStore } from '../../../store/authStore';
import { usePermissions } from '../../../hooks/usePermissions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const MAX_SIZE_MB = 2;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const getIniciales = (nombre?: string): string => {
  if (!nombre) return 'U';
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'U';
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

export const EditarAvatarModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { profile, displayName } = usePermissions();
  const fetchUserProfile = useAuthStore((state) => state.fetchUserProfile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const iniciales = getIniciales(displayName);

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
    onClose();
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen (JPG · PNG · WEBP)');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`La imagen no puede superar ${MAX_SIZE_MB}MB · actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }
    setError(null);
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!profile?.uid || !selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      await userService.uploadProfilePhoto(profile.uid, selectedFile);
      await fetchUserProfile(profile.uid);
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Error al subir la foto');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!profile?.uid || !profile.photoURL) return;
    setUploading(true);
    setError(null);
    try {
      await userService.updateProfile(profile.uid, { photoURL: '' });
      await fetchUserProfile(profile.uid);
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Error al quitar la foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title="Editar foto de perfil"
      subtitle="Sube una imagen cuadrada · máximo 2MB · JPG/PNG/WEBP"
      icon={Camera}
      iconTone="purple"
      submitLabel={uploading ? 'Subiendo...' : 'Subir foto'}
      submitVariant="primary-soft"
      submitIcon={Upload}
      loading={uploading}
      disabled={!selectedFile || uploading}
      size="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-[12px] text-rose-800 inline-flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Preview grande · canon mockup línea 1275 */}
        <div className="flex flex-col items-center py-2">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 p-0.5 shadow-lg mb-3 overflow-hidden">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
            ) : profile?.photoURL ? (
              <img src={profile.photoURL} alt={displayName} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <div className="w-full h-full rounded-2xl bg-white flex items-center justify-center">
                <span className="text-3xl font-bold text-purple-700">{iniciales}</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {selectedFile
              ? `${selectedFile.name} · ${(selectedFile.size / 1024).toFixed(0)} KB`
              : profile?.photoURL
              ? 'Foto actual · subí una nueva para reemplazar'
              : 'Sin foto · subí una imagen'}
          </p>
        </div>

        {/* Botón seleccionar archivo */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full bg-purple-50 hover:bg-purple-100 border-2 border-dashed border-purple-300 hover:border-purple-400 rounded-lg p-4 transition-colors flex flex-col items-center gap-2 disabled:opacity-50"
        >
          <ImageIcon className="w-6 h-6 text-purple-600" />
          <span className="text-[13px] font-semibold text-purple-700">
            {selectedFile ? 'Elegir otra imagen' : 'Seleccionar imagen'}
          </span>
          <span className="text-[10px] text-purple-600">JPG · PNG · WEBP · máximo 2MB</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
          }}
          className="hidden"
        />

        {/* Quitar foto actual */}
        {profile?.photoURL && !selectedFile && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="w-full text-[12px] font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Quitar foto actual
          </button>
        )}
      </div>
    </FormModalV2>
  );
};

export default EditarAvatarModal;
