import React, { useEffect, useState } from 'react';
import apiClient from '../../api/client';

const STAGES = [
  {
    step: 1,
    key: 'RECEPCION',
    title: 'Recepción',
    label: 'Recepción',
    sublabel: 'Ingreso e inspección',
    icon: 'fact_check',
    description: 'Vehículo recibido en taller. Se realizó el checklist de ingreso, kilometraje verificado y registro de inventario.',
    dept: 'Área de Admisión y Asesoría'
  },
  {
    step: 2,
    key: 'DIAGNOSTICO',
    title: 'Diagnóstico',
    label: 'Diagnóstico',
    sublabel: 'Escaneo y fallas',
    icon: 'troubleshoot',
    description: 'El técnico especialista realiza el escaneo computarizado OBD-II y la revisión física de averías en bahía.',
    dept: 'Bahía de Diagnóstico Electrónico'
  },
  {
    step: 3,
    key: 'PRESUPUESTO',
    title: 'Presupuesto',
    label: 'Presupuesto',
    sublabel: 'Aprobación de cliente',
    icon: 'request_quote',
    description: 'Cotización emitida con desglose de repuestos y mano de obra. Requiere tu aprobación para iniciar la reparación.',
    dept: 'Departamento de Presupuestos'
  },
  {
    step: 4,
    key: 'TALLER',
    title: 'Taller',
    label: 'Taller',
    sublabel: 'Reparación en curso',
    icon: 'handyman',
    description: 'Mecánicos autorizados trabajando activamente en el reemplazo de componentes y mantenimiento correctivo.',
    dept: 'Bahía Operativa de Reparación'
  },
  {
    step: 5,
    key: 'PRUEBAS',
    title: 'Pruebas / Lavado',
    label: 'Pruebas / Lavado',
    sublabel: 'Control de calidad',
    icon: 'local_car_wash',
    description: 'Inspección final de control de calidad, borrado de códigos DTC, prueba de ruta y lavado integral de cortesía.',
    dept: 'Control de Calidad y Detailing'
  },
  {
    step: 6,
    key: 'ENTREGA',
    title: 'Entrega',
    label: 'Entrega',
    sublabel: 'Listo para retiro',
    icon: 'key',
    description: '¡Tu vehículo está 100% reparado, probado y listo para entrega! Puedes acercarte a la recepción del taller.',
    dept: 'Recepción y Entrega Vehicular'
  }
];

function getStageIndex(estado = '') {
  const e = String(estado || '').toUpperCase();
  if (['FINALIZADA', 'ENTREGADO', 'LISTO_ENTREGA', 'COMPLETADO', 'ENTREGA'].includes(e)) return 6;
  if (['EN_PRUEBAS', 'CONTROL_CALIDAD', 'LAVADO', 'PRUEBAS'].includes(e)) return 5;
  if (['EN_REPARACION', 'EN_TALLER_TRABAJANDO', 'REPARANDO', 'EN_BAHIA', 'TALLER'].includes(e)) return 4;
  if (['COTIZACION_ENVIADA', 'COTIZACION_PENDIENTE', 'PENDIENTE_APROBACION', 'CREADA', 'PRESUPUESTO'].includes(e)) return 3;
  if (['DIAGNOSTICO', 'EN_DIAGNOSTICO', 'DIAGNOSTICO_COMPLETADO'].includes(e)) return 2;
  if (['EN_TALLER', 'RECEPCIONADO', 'INGRESADO', 'RECEPCION'].includes(e)) return 1;
  return 1;
}

function EvidencePhoto({ url }) {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSource('');
    if (!url) return;

    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      setSource(url);
      return;
    }

    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then((response) => {
        if (!response.ok) throw new Error('Foto no disponible');
        return response.blob();
      })
      .then((blob) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => { throw new Error('Error al leer foto'); };
        reader.readAsDataURL(blob);
      }))
      .then((dataUrl) => {
        if (active) setSource(String(dataUrl || ''));
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => { active = false; };
  }, [url]);

  if (failed) return <span className="text-xs text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">Foto no disponible</span>;
  if (!source) return <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 animate-pulse">Cargando foto...</span>;

  return (
    <a href={source} target="_blank" rel="noreferrer" className="block group relative overflow-hidden rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all">
      <img src={source} alt="Evidencia pericial" className="h-36 w-52 object-cover group-hover:scale-105 transition-transform duration-200" />
      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
        <span className="material-symbols-outlined text-[12px]">zoom_in</span> Ver
      </span>
    </a>
  );
}

export default function PortalClienteSeguimientodeAvance11Mockup({ onNavigate }) {
  const [vehicles, setVehicles] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [manualStageMap, setManualStageMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      let data = await apiClient.get('/workshop-flow/progreso').catch(() => []);
      let list = Array.isArray(data) ? data : (data?.data || []);

      // Revisar si hay un vehículo recién ingresado en localStorage desde Recepción
      let activeReception = null;
      try {
        const raw = localStorage.getItem('autron_active_reception');
        if (raw) activeReception = JSON.parse(raw);
      } catch {}

      if (activeReception && activeReception.vehiclePlate) {
        const existingIdx = list.findIndex(r => r.placa === activeReception.vehiclePlate);
        const receptionEntry = {
          vehiculoId: activeReception.vehicleId || 901,
          placa: activeReception.vehiclePlate,
          modelo: activeReception.vehicleModel || 'Vehículo en Taller',
          kilometraje: activeReception.vehicleMileage || 84200,
          ordenId: activeReception.orderId || 'ORD-2024-001',
          estado: 'EN_TALLER',
          ingreso: {
            fecha: new Date().toISOString(),
            motivo: activeReception.reason || 'Mantenimiento Preventivo / Revisión de Frenos'
          },
          evidencias: []
        };
        if (existingIdx !== -1) {
          list[existingIdx] = { ...list[existingIdx], ...receptionEntry };
        } else {
          list.unshift(receptionEntry);
        }
      }

      setVehicles(list);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el avance de la reparación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleSync = () => loadData();
    window.addEventListener('autron:new_reception', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('autron:new_reception', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const activeVehicle = vehicles[selectedIndex] || vehicles[0];
  const autoStage = activeVehicle ? getStageIndex(activeVehicle.estado) : 1;
  const currentStep = activeVehicle && manualStageMap[activeVehicle.placa] !== undefined
    ? manualStageMap[activeVehicle.placa]
    : autoStage;

  const currentStageConfig = STAGES.find(s => s.step === currentStep) || STAGES[0];

  const handleSimulateStage = (stepNum) => {
    if (!activeVehicle) return;
    setManualStageMap(prev => ({
      ...prev,
      [activeVehicle.placa]: stepNum
    }));
  };

  return (
    <div className="w-full bg-slate-50 min-h-full pb-16 font-sans space-y-6">
      {/* Subcabecera de Navegación del Portal */}
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-medium">
              <span>Portal de Clientes</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Servicio en Taller</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-indigo-600 font-semibold">Seguimiento en Vivo (RF-11)</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <span className="material-symbols-outlined text-indigo-600 text-3xl">timelapse</span>
                Seguimiento de Avance en Vivo
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Transmisión en Tiempo Real
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Consulta en tiempo real la fase exacta de tu reparación vehicular, evidencias periciales y tiempos estimados de entrega.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin text-indigo-600' : ''}`}>
                sync
              </span>
              <span>{loading ? 'Sincronizando...' : 'Actualizar'}</span>
            </button>
          </div>
        </div>
      </section>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Selector de Vehículo si hay más de 1 */}
        {vehicles.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Tus Vehículos:</span>
            {vehicles.map((v, idx) => (
              <button
                key={v.vehiculoId || idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                  selectedIndex === idx
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">directions_car</span>
                <span>{v.placa}</span>
                <span className="opacity-80 text-[11px] font-normal">({v.modelo})</span>
              </button>
            ))}
          </div>
        )}

        {activeVehicle && (
          <div className="space-y-6">
            {/* Tarjeta Principal de la Orden y Línea de Tiempo de 6 Pasos Funcional */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              {/* Encabezado del Vehículo */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold text-xl shadow-2xs">
                    <span className="material-symbols-outlined text-2xl">directions_car</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">{activeVehicle.placa}</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                        {activeVehicle.modelo || 'Vehículo Particular'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeVehicle.ordenId ? `Orden de Taller: ${activeVehicle.ordenId}` : 'En proceso de recepción inicial'} · {Number(activeVehicle.kilometraje || 0).toLocaleString()} km registrados
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <span className="text-[11px] text-slate-400 font-medium block">Estado Actual</span>
                    <strong className="text-sm font-bold text-indigo-600 block">
                      Fase {currentStageConfig.step}: {currentStageConfig.title}
                    </strong>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                    <span>{currentStageConfig.sublabel}</span>
                  </span>
                </div>
              </div>

              {/* STEPPER FUNCIONAL DE 6 FASES */}
              <div className="py-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-2 relative">
                  {STAGES.map((s, idx) => {
                    const isCompleted = s.step < currentStep;
                    const isCurrent = s.step === currentStep;
                    const isPending = s.step > currentStep;

                    return (
                      <div
                        key={s.step}
                        onClick={() => handleSimulateStage(s.step)}
                        title={`Haga clic para simular la fase ${s.step}: ${s.title}`}
                        className="flex flex-col items-center text-center group cursor-pointer transition-transform hover:scale-102"
                      >
                        {/* Círculo de la Fase */}
                        <div className="relative mb-2 flex items-center justify-center">
                          {isCompleted && (
                            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                              <span className="material-symbols-outlined text-[20px]">check</span>
                            </div>
                          )}
                          {isCurrent && (
                            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold ring-4 ring-indigo-100 shadow-md animate-pulse">
                              <span className="text-sm font-bold">{s.step}</span>
                            </div>
                          )}
                          {isPending && (
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold border border-slate-200">
                              <span className="text-sm font-medium">{s.step}</span>
                            </div>
                          )}
                        </div>

                        {/* Etiqueta y Subtítulo */}
                        <span className={`text-xs tracking-tight ${
                          isCompleted ? 'font-bold text-emerald-700' : (isCurrent ? 'font-bold text-indigo-600' : 'font-medium text-slate-500')
                        }`}>
                          {s.title}
                        </span>
                        <span className={`text-[10px] mt-0.5 ${
                          isCompleted ? 'text-emerald-600 font-semibold' : (isCurrent ? 'text-indigo-600 font-bold' : 'text-slate-400')
                        }`}>
                          {isCompleted ? 'Completado ✓' : (isCurrent ? 'En curso' : (s.step === 6 ? 'Final' : 'Pendiente'))}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Barra de Simulación Interactiva para pruebas en vivo */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="material-symbols-outlined text-indigo-600 text-[18px]">tune</span>
                    <span className="font-semibold text-slate-800">Simulador interactivo de avance:</span>
                    <span className="hidden sm:inline text-slate-500">(Haz clic en cualquier fase para probar el flujo)</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {STAGES.map((s) => (
                      <button
                        key={s.step}
                        type="button"
                        onClick={() => handleSimulateStage(s.step)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          currentStep === s.step
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {s.step}. {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Panel de Detalle Informativo de la Fase Activa */}
              <div className="bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white rounded-xl border border-indigo-100 p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-indigo-600 text-2xl">{currentStageConfig.icon}</span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Fase {currentStageConfig.step}: {currentStageConfig.title}
                      </h3>
                      <span className="text-[11px] text-indigo-700 font-semibold">{currentStageConfig.dept}</span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-xs text-indigo-800 font-medium shadow-2xs">
                    <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
                    Actualizado hoy · {new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  {currentStageConfig.description}
                </p>

                {/* Acciones contextuales por fase */}
                {currentStep === 3 && onNavigate && (
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onNavigate('cotizacionesCliente')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">request_quote</span>
                      <span>Ver y Aprobar Presupuesto Ahora</span>
                    </button>
                    <span className="text-xs text-slate-500">Revisa repuestos, mano de obra y costos antes de autorizar.</span>
                  </div>
                )}

                {currentStep === 6 && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 font-medium">
                    <span className="material-symbols-outlined text-emerald-600 text-xl">celebration</span>
                    <span>Tu vehículo ha completado el control de calidad. Puedes retirarlo en Recepción presentando tu Cédula o RUC.</span>
                  </div>
                )}
              </div>

              {/* Bitácora de Registro e Ingreso */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-600 text-[18px]">receipt_long</span>
                    Ficha Técnica de Admisión
                  </h4>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {activeVehicle.ingreso?.fecha ? new Date(activeVehicle.ingreso.fecha).toLocaleDateString('es-EC') : 'Hoy'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Motivo de Ingreso</span>
                    <span className="font-medium">{activeVehicle.ingreso?.motivo || 'Revisión y mantenimiento general'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Kilometraje Verificado</span>
                    <span className="font-mono font-bold text-slate-900">{Number(activeVehicle.kilometraje || 0).toLocaleString()} KM</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Garantía Aplicable</span>
                    <span className="font-medium text-emerald-700">6 Meses o 10,000 KM en mano de obra</span>
                  </div>
                </div>

                {/* Evidencia Fotográfica */}
                <div className="pt-3 border-t border-slate-200/80 space-y-2">
                  <span className="font-bold text-slate-700 block">Fotografías Periciales de Ingreso</span>
                  {(activeVehicle.evidencias || []).length === 0 ? (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400 text-base">photo_camera</span>
                      <span>Sin fotografías adjuntas para este ingreso (inspección ocular directa).</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {activeVehicle.evidencias.map((photo) => (
                        <EvidencePhoto key={photo.id} url={photo.url} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!activeVehicle && !loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto space-y-3.5 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-2xs">
              <span className="material-symbols-outlined text-3xl">directions_car</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">No hay vehículos en taller actualmente</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              La base de datos se encuentra limpia. Cuando se registre el ingreso de un vehículo en la pantalla de <strong>Recepción</strong>, podrás seguir en vivo su avance a través de las 6 fases de reparación.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
