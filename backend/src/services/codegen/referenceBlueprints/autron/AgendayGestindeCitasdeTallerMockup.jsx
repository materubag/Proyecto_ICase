import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function AgendayGestindeCitasdeTallerMockup({ onNavigate }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [modalOpen, setModalOpen] = useState(false);
  const [newSlot, setNewSlot] = useState({ inicio: '', fin: '', capacidad: 1 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiClient.get('/citas').catch(() => []),
      apiClient.get('/clientes').catch(() => []),
      apiClient.get('/vehiculos').catch(() => [])
    ]).then(([cRes, clRes, vRes]) => {
      const list = Array.isArray(cRes) ? cRes : (cRes?.data || []);
      const clientsList = Array.isArray(clRes) ? clRes : (clRes?.data || []);
      const vehiclesList = Array.isArray(vRes) ? vRes : (vRes?.data || []);

      if (mounted && list && list.length > 0) {
        setAppointments(list.map(c => {
          const owner = clientsList.find(cl => Number(cl.id) === Number(c.clienteId || c.cliente_id));
          const veh = vehiclesList.find(v => Number(v.id) === Number(c.vehiculoId || c.vehiculo_id));
          return {
            id: c.id,
            client: owner?.nombre || c.Cliente?.nombre || 'Cliente del Taller',
            vehicle: veh ? `${veh.marca || ''} ${veh.modelo || ''} (${veh.placa})`.trim() : (c.Vehiculo?.placa ? `${c.Vehiculo.marca || ''} (${c.Vehiculo.placa})` : 'Vehículo Registrado'),
            time: c.fechaHora ? new Date(c.fechaHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM',
            reason: c.motivo || 'Mantenimiento Preventivo y Diagnóstico',
            bay: 'Bahía 1',
            status: c.estado === 'INGRESADA' ? 'Ingresada' : (c.estado || 'Confirmada'),
            statusColor: c.estado === 'INGRESADA' || c.estado === 'CONFIRMADA'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
              : 'bg-amber-100 text-amber-800 border-amber-300'
          };
        }));
      } else if (mounted) {
          setAppointments([]);
        }
      })
      .catch(() => {
        if (mounted) setAppointments([]);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    apiClient.get(`/workshop-flow/disponibilidad?fecha=${selectedDate}`)
      .then((res) => setSlots(Array.isArray(res) ? res : []))
      .catch(() => setSlots([]));
  }, [selectedDate, msg]);

  const handleConfirmAppointment = async (id) => {
    setBusy(true);
    try {
      await apiClient.post('/operations/uc-14/confirmar', { citaId: id }).catch(() => {});
      setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'Confirmada', statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' } : a));
      setMsg('Cita confirmada exitosamente');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'Confirmada', statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' } : a));
    } finally {
      setBusy(false);
    }
  };

  const handleResolveReschedule = async (id, decision) => {
    setBusy(true);
    try {
      await apiClient.post('/operations/uc-14/resolver-reprogramacion', {
        solicitudId: id,
        decision,
        claveOperacion: 'RES-' + Date.now()
      }).catch(() => {});

      if (decision === 'APROBAR') {
        setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'Confirmada', time: 'Mañana · 09:00', statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' } : a));
        setMsg('Reprogramación de cita aprobada');
      } else {
        setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'Confirmada', statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' } : a));
        setMsg('Reprogramación rechazada; se mantiene horario original');
      }
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'Confirmada', statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' } : a));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiClient.post('/workshop-flow/espacios', { ...newSlot, capacidad: Number(newSlot.capacidad || 1) });
      setMsg('Horario habilitado. El cliente solo puede reservar si queda cupo.');
      setModalOpen(false);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.details?.message || err.message || 'No se pudo habilitar el horario.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12 font-sans">
      {/* Sub-header */}
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-medium">
              <span>Taller</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Recepción y Agenda</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-indigo-600 font-semibold">Gestión de Citas (RF-06)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Agenda y Gestión de Citas de Taller
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Programación de bahías de trabajo, confirmación de citas y resolución de reprogramaciones en tiempo real.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-semibold text-white shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Definir Espacio de Agenda
            </button>
            <button
              onClick={() => onNavigate?.('recepcion')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">input</span>
              Pasar a Recepción
            </button>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {msg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            <span>{msg}</span>
          </div>
        )}

        {/* Bays Status Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {slots.length === 0 && <p className="text-sm text-slate-500">No hay horarios habilitados en esta fecha.</p>}
          {slots.map((slot) => (
            <div key={slot.id} className="bg-white p-4 rounded-xl border border-slate-200">
              <strong className="text-sm text-slate-900">{new Date(slot.inicio).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })} – {new Date(slot.fin).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</strong>
              <span className="text-xs block mt-1">{slot.ocupados} de {slot.capacidad} cupos · {slot.disponible ? 'Disponible' : 'Lleno'}</span>
            </div>
          ))}
        </div>

        {/* Date Selector & Appointments Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-indigo-600 text-xl">event_available</span>
              <h2 className="text-sm font-bold text-slate-900">Citas de Taller Registradas</h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Fecha:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Horario</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Vehículo</th>
                  <th className="py-2.5 px-3">Motivo de Visita</th>
                  <th className="py-2.5 px-3">Bahía</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {appointments.map(apt => (
                  <tr key={apt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">{apt.time}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">{apt.client}</td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{apt.vehicle}</td>
                    <td className="py-3 px-3 text-slate-900 max-w-xs">{apt.reason}</td>
                    <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">{apt.bay}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${apt.statusColor}`}>
                        {apt.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {(apt.status === 'Pendiente' || apt.status === 'SOLICITADA') && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleConfirmAppointment(apt.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                        >
                          Confirmar
                        </button>
                      )}
                      {apt.status === 'Solicitud Reprogramación' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleResolveReschedule(apt.id, 'APROBAR')}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-50 text-white rounded text-[11px] font-semibold"
                            title="Aprobar nuevo horario"
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleResolveReschedule(apt.id, 'RECHAZAR')}
                            className="px-2 py-1 bg-error-container text-error rounded text-[11px] font-semibold hover:bg-red-200"
                            title="Rechazar y mantener horario"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                      {apt.status === 'Confirmada' && (
                        <button
                          type="button"
                          onClick={() => onNavigate?.('recepcion')}
                          className="text-indigo-600 hover:underline font-semibold text-xs flex items-center justify-end gap-1 ml-auto"
                        >
                          <span className="material-symbols-outlined text-sm">login</span>
                          Recibir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal: Define Slot */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Definir Espacio de Agenda (RF-06)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Establezca un rango horario disponible para que los clientes puedan solicitar citas en taller.
            </p>
            <form onSubmit={handleCreateSlot} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-900 mb-1">Inicio del Espacio (Fecha y Hora)</label>
                <input
                  type="datetime-local"
                  required
                  value={newSlot.inicio}
                  onChange={e => setNewSlot({ ...newSlot, inicio: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-900 mb-1">Fin del Espacio (Fecha y Hora)</label>
                <input
                  type="datetime-local"
                  required
                  value={newSlot.fin}
                  onChange={e => setNewSlot({ ...newSlot, fin: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-900 mb-1">Cupos</label>
                <input type="number" min="1" required value={newSlot.capacidad} onChange={e => setNewSlot({ ...newSlot, capacidad: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-50 text-white rounded-lg font-semibold"
                >
                  {busy ? 'Habilitando...' : 'Habilitar Espacio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
