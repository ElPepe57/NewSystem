import React, { useEffect, useState } from "react";
import { Plus, TrendingUp, Calendar } from "lucide-react";
import { Button, Card, Modal } from "../../components/common";
import { TipoCambioForm } from "../../components/modules/tipoCambio/TipoCambioForm";
import { TipoCambioTable } from "../../components/modules/tipoCambio/TipoCambioTable";
import { TipoCambioChart } from "../../components/modules/tipoCambio/TipoCambioChart";
import { useTipoCambioStore } from "../../store/tipoCambioStore";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { tipoCambioService } from "../../services/tipoCambio.service";
import type { TipoCambioFormData } from "../../types/tipoCambio.types";

export const TipoCambio: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { tiposCambio, loading, fetchTiposCambio, createTipoCambio, registrarDesdeSunat, getUltimosDias } = useTipoCambioStore();
  const toast = useToastStore();
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [tcDelDia, setTcDelDia] = useState<any>(null);

  useEffect(() => {
    fetchTiposCambio();
    loadChartData();
    loadTCDelDia();
  }, []);

  const loadChartData = async () => {
    try {
      const data = await getUltimosDias(30);
      setChartData(data);
    } catch (error) {
      console.error("Error al cargar datos del gráfico:", error);
    }
  };

  const loadTCDelDia = async () => {
    try {
      const tc = await tipoCambioService.getTCDelDia();
      setTcDelDia(tc);
    } catch (error) {
      console.error("Error al cargar TC del día:", error);
    }
  };

  const handleCreate = () => {
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (data: TipoCambioFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await createTipoCambio(data, user.uid);
      toast.success("Tipo de cambio registrado correctamente");
      setIsFormModalOpen(false);
      loadChartData();
      loadTCDelDia();
    } catch (error: any) {
      toast.error(error.message, "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleObtenerSunat = async (fecha: Date) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await registrarDesdeSunat(fecha, user.uid);
      toast.success("Tipo de cambio obtenido de SUNAT y registrado correctamente");
      setIsFormModalOpen(false);
      loadChartData();
      loadTCDelDia();
    } catch (error: any) {
      toast.error(error.message, "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setIsFormModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tipo de Cambio</h1>
          <p className="text-gray-600 mt-1">Gestiona los tipos de cambio USD/PEN</p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <Plus className="h-5 w-5 mr-2" />
          Registrar Tipo de Cambio
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">TC Compra Hoy</div>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {tcDelDia ? `S/ ${tcDelDia.compra.toFixed(3)}` : "-"}
              </div>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">TC Venta Hoy</div>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {tcDelDia ? `S/ ${tcDelDia.venta.toFixed(3)}` : "-"}
              </div>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Total Registros</div>
              <div className="text-2xl font-bold text-primary-600 mt-1">
                {tiposCambio.length}
              </div>
            </div>
            <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </Card>
      </div>

      <TipoCambioChart tiposCambio={chartData} />

      <Card padding="md">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Historial de Tipos de Cambio</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <TipoCambioTable tiposCambio={tiposCambio} />
        )}
      </Card>

      <Modal
        isOpen={isFormModalOpen}
        onClose={handleCloseModal}
        title="Registrar Tipo de Cambio"
        size="md"
      >
        <TipoCambioForm
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          onObtenerSunat={handleObtenerSunat}
          loading={isSubmitting}
        />
      </Modal>
    </div>
  );
};
