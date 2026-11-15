import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function PortalClienteSolicituddeCitas12Mockup({ onNavigate }) {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [espacioId, setEspacioId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [myAppointments, setMyAppointments] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiClient.get('/vehiculos').catch(() => []),
      apiClient.get('/citas').catch(() => [])
    ]).then(([vRes, cRes]) => {
      if (!mounted) return;
      const vList = Array.isArray(vRes) ? vRes : (vRes?.data || []);
      const cList = Array.isArray(cRes) ? cRes : (cRes?.data || []);

      if (vList && vList.length > 0) {
        setVehicles(vList);
        setSelectedVehicle(String(vList[0].id));
      }

      if (cList && cList.length > 0) {
        setMyAppointments(cList.map(c => {
          const matchedVeh = vList.find(v => Number(v.id) === Number(c.vehiculoId || c.vehiculo_id));
          return {
            id: c.id,
            vehicle: matchedVeh ? `${matchedVeh.marca || ''} ${matchedVeh.modelo || ''} (${matchedVeh.placa})`.trim() : `Vehículo #${c.vehiculoId}`,
            date: c.fechaHora ? c.fechaHora.split('T')[0] : '2026-11-07',
            time: c.fechaHora ? new Date(c.fechaHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' hrs' : '09:00 hrs',
            reason: c.motivo || 'Mantenimiento preventivo general',
            status: c.estado === 'INGRESADA' ? 'Ingresada' : (c.estado || 'Confirmada'),
            statusColor: c.estado === 'INGRESADA' || c.estado === 'CONFIRMADA'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
              : 'bg-amber-100 text-amber-800 border-amber-300'
          };
        }));
      } else {
        setMyAppointments([]);
      }
    });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    apiClient.get(`/workshop-flow/disponibilidad?fecha=${date}`)
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setSlots(list);
        setEspacioId(String(list.find((slot) => slot.disponible)?.id || ''));
      })
      .catch(() => setSlots([]));
  }, [date]);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const created = await apiClient.post('/workshop-flow/citas', {
        vehiculoId: Number(selectedVehicle),
        espacioId: Number(espacioId),
        motivo: reason
      });
      const matched = vehicles.find(v => Number(v.id) === Number(selectedVehicle));
      setMyAppointments([{
        id: created.id,
        vehicle: matched ? `${matched.marca || ''} ${matched.modelo || ''} (${matched.placa})`.trim() : 'Mi vehículo',
        date,
        time: new Date(created.fechaHora).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
        reason,
        status: created.estado,
        statusColor: 'bg-sky-100 text-sky-800 border-sky-300'
      }, ...myAppointments]);
      setMsg('Cita reservada en un horario con cupo.');
    } catch (err) {
      setMsg(err.details?.message || err.message || 'No se pudo reservar la cita.');
    } finally {
      setBusy(false);
    }
  };

  const handleReprogram = async (id, nextSlot) => {
    if (!nextSlot) return;
    try {
      await apiClient.post('/workshop-flow/citas/reprogramar', { citaId: id, espacioId: Number(nextSlot) });
      setMsg('Cita reprogramada.');
    } catch (err) {
      setMsg(err.details?.message || err.message || 'No se pudo reprogramar.');
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('¿Está seguro de cancelar esta cita?')) return;
    try {
      await apiClient.post('/workshop-flow/citas/cancelar', { citaId: id });
      setMyAppointments(myAppointments.map((item) => item.id === id ? { ...item, status: 'CANCELADA' } : item));
      setMsg('Cita cancelada.');
    } catch (err) {
      setMsg(err.details?.message || err.message || 'No se pudo cancelar la cita.');
    }
  };

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12 font-sans">
      <div className="bg-white border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>Portal Cliente</span>
          <span>/</span>
          <span className="text-indigo-600 font-semibold">Solicitud y Agenda de Citas (RF-06)</span>
        </div>
        <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Agenda disponible
        </span>
      </div>

      <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Agendar Cita en el Taller</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Seleccione su vehículo, fecha y motivo para reservar un turno con nuestros técnicos certificados.
          </p>
        </div>

        {msg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            <span>{msg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Booking Form: 7 cols */}
          <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">calendar_month</span>
              Nueva Reserva de Turno
            </h2>

            <form onSubmit={handleBookAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-900 mb-1">Vehículo a Ingresar</label>
                <select
                  value={selectedVehicle}
                  onChange={e => setSelectedVehicle(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500"
                >
                  {vehicles.length > 0 ? (
                    vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.placa} · {v.marca} {v.modelo} ({v.anio || 2020}) · {Number(v.kilometrajeActual || 80000).toLocaleString()} km
                      </option>
                    ))
                  ) : (
                    <option value="">Sin vehículos registrados</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Fecha de la Cita</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Franja Horaria Disponible</label>
                  <select
                    value={espacioId}
                    onChange={e => setEspacioId(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sin horarios con cupo</option>
                    {slots.filter((slot) => slot.disponible).map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {new Date(slot.inicio).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })} · {slot.capacidad - slot.ocupados} cupos
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-900 mb-1">Motivo o Síntomas Notados</label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Describa el servicio requerido o cualquier ruido, vibración o luz de testigo en tablero..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-50 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">send</span>
                <span>{busy ? 'Enviando Solicitud...' : 'Confirmar Solicitud de Cita'}</span>
              </button>
            </form>
          </section>

          {/* Current Appointments List: 5 cols */}
          <aside className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center justify-between">
                <span>Mis Citas Programadas</span>
                <span className="text-[11px] font-semibold text-indigo-600">{myAppointments.length} activas</span>
              </h2>

              <div className="space-y-3">
                {myAppointments.map(apt => (
                  <div key={apt.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 text-xs font-bold">{apt.vehicle}</strong>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${apt.statusColor}`}>
                        {apt.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-indigo-600">schedule</span>
                      <span>{apt.date} · {apt.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-200">
                      {apt.reason}
                    </p>
                    {apt.status !== 'Ingresada' && apt.status !== 'CANCELADA' ? (
                      <div className="flex justify-end gap-2 pt-1">
                        <select className="text-[10px] border border-slate-200 rounded px-1" defaultValue="" onChange={(e) => handleReprogram(apt.id, e.target.value)}>
                          <option value="">Reprogramar</option>
                          {slots.filter((slot) => slot.disponible).map((slot) => (
                            <option key={slot.id} value={slot.id}>{new Date(slot.inicio).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleCancel(apt.id)}
                          className="text-[10px] text-error hover:underline font-semibold"
                        >
                          Cancelar cita
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
