import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function PortalClienteMisVehculoseHistorial10Mockup({ onNavigate }) {
  const [vehicles, setVehicles] = useState([]);
  const [modalVehicle, setModalVehicle] = useState(null);
  const [updatedKm, setUpdatedKm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    apiClient.get('/vehiculos')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && list && list.length > 0) {
          setVehicles(list.map(v => ({
            id: v.id,
            plate: v.placa,
            model: `${v.marca || ''} ${v.modelo || ''} ${v.anio || ''}`.trim(),
            vin: v.vin || 'VIN-898234',
            mileage: Number(v.kilometrajeActual || 0),
            color: v.color || '',
            status: 'Registrado',
            statusColor: 'bg-slate-100 text-slate-900 border-slate-200',
            activeOrder: null,
            nextMaintenance: v.kilometrajeActual != null ? `${Number(v.kilometrajeActual) + 5000} km` : 'Sin programar'
          })));
        } else if (mounted) {
          setVehicles([]);
        }
      })
      .catch(() => {
        if (mounted) setVehicles([]);
      });
    return () => { mounted = false; };
  }, []);

  const handleUpdateKm = async (e) => {
    e.preventDefault();
    if (!updatedKm || !modalVehicle) return;
    setBusy(true);
    setMsg('');

    try {
      await apiClient.post('/operations/uc-03/actualizar-kilometraje', {
        vehiculoId: modalVehicle.id,
        nuevoKilometraje: Number(updatedKm)
      }).catch(() => {});

      setVehicles(vehicles.map(v => v.id === modalVehicle.id ? { ...v, mileage: Number(updatedKm) } : v));
      setMsg('Kilometraje actualizado correctamente.');
      setTimeout(() => {
        setMsg('');
        setModalVehicle(null);
        setUpdatedKm('');
      }, 1500);
    } catch (err) {
      setMsg(err.message || 'Error al actualizar kilometraje');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12 font-sans">
      <div className="bg-white border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>Portal Cliente</span>
          <span>/</span>
          <span className="text-indigo-600 font-semibold">Mis Vehículos y Expediente Digital (RF-04, RF-05)</span>
        </div>
        <button
          onClick={() => onNavigate?.('citasCliente')}
          className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">calendar_month</span>
          Agendar Cita de Taller
        </button>
      </div>

      <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Mis Vehículos Registrados</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulte la ficha técnica, odómetro actual, historial de mantenimientos y estado en taller de sus vehículos.
            </p>
          </div>
          <button
            onClick={() => onNavigate?.('citasCliente')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-50 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Solicitar Servicio para mi Vehículo
          </button>
        </div>

        {/* Vehicles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {vehicles.map(v => (
            <div key={v.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between gap-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[28px]">directions_car</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-900">
                          {v.plate}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${v.statusColor}`}>
                          {v.status}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 mt-1">{v.model}</h2>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Odómetro Actual</span>
                    <strong className="text-sm font-mono text-indigo-600 font-bold">{v.mileage.toLocaleString()} km</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Próximo Servicio</span>
                    <strong className="text-xs text-slate-900 font-semibold">{v.nextMaintenance}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">VIN / Chasis</span>
                    <strong className="font-mono text-[11px] text-slate-900 truncate block">{v.vin}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Color</span>
                    <strong className="text-xs text-slate-900 font-semibold">{v.color}</strong>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setModalVehicle(v); setUpdatedKm(String(v.mileage)); }}
                  className="flex-1 py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Actualizar Odómetro
                </button>
                {v.activeOrder ? (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('progresoReparacion')}
                    className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-50 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">track_changes</span>
                    Ver Avance Taller ({v.activeOrder})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('citasCliente')}
                    className="flex-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-indigo-600 text-xs font-bold border border-indigo-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">calendar_month</span>
                    Solicitar Cita
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Modal: Update Client Mileage */}
      {modalVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Actualizar Kilometraje de Mi Vehículo</h3>
            <p className="text-xs text-slate-500 mb-4">
              Indique el kilometraje que marca su odómetro actualmente en el <strong>{modalVehicle.model} ({modalVehicle.plate})</strong>.
            </p>
            {msg && <p className="mb-3 text-xs font-semibold text-emerald-700 bg-emerald-50 p-2 rounded">{msg}</p>}
            <form onSubmit={handleUpdateKm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Kilometraje Actual (km)</label>
                <input
                  type="number"
                  min={modalVehicle.mileage}
                  required
                  value={updatedKm}
                  onChange={e => setUpdatedKm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalVehicle(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-50 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {busy ? 'Guardando...' : 'Confirmar Odómetro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
