import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function CatlogoMaestrodeServiciosyTarifas3Mockup({ onNavigate }) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState({ codigo: '', nombre: '', categoria: 'Mecánica Rápida', duracionEstimada: 1.5, precioManoObra: 45.0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [services, setServices] = useState([]);

  useEffect(() => {
    let mounted = true;
    apiClient.get('/servicios')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && list && list.length > 0) {
          setServices(list.map(s => ({
            id: s.id,
            codigo: 'SRV-0' + s.id,
            nombre: s.nombre,
            categoria: s.categoria || 'Taller General',
            duracionEstimada: (s.duracionEstimadaMinutos || 60) / 60,
            precioManoObra: Number(s.precioManoObra || 35.0),
            activo: s.activo !== false
          })));
        } else if (mounted) {
          setServices([]);
        }
      })
      .catch(() => {
        if (mounted) setServices([]);
      });
    return () => { mounted = false; };
  }, []);

  const handleOpenModal = (srv = null) => {
    if (srv) {
      setEditingService(srv);
      setForm({ codigo: srv.codigo, nombre: srv.nombre, categoria: srv.categoria, duracionEstimada: srv.duracionEstimada, precioManoObra: srv.precioManoObra });
    } else {
      setEditingService(null);
      setForm({ codigo: 'SRV-' + Math.floor(100 + Math.random() * 900), nombre: '', categoria: 'Mecánica Rápida', duracionEstimada: 1.5, precioManoObra: 50.0 });
    }
    setModalOpen(true);
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    setBusy(true);

    try {
      const payload = {
        nombre: form.nombre,
        descripcion: form.categoria || '',
        precioManoObra: Number(form.precioManoObra),
        duracionEstimadaMinutos: Math.max(1, Math.round(Number(form.duracionEstimada) * 60))
      };
      if (editingService) {
        await apiClient.post('/operations/uc-25/actualizar', { servicioId: editingService.id, ...payload });
        setMsg(`Servicio ${form.nombre} actualizado.`);
      } else {
        await apiClient.post('/operations/uc-25/crear', payload);
        setMsg(`Servicio ${form.nombre} creado.`);
      }
      const res = await apiClient.get('/servicios');
      const list = Array.isArray(res) ? res : (res?.data || []);
      setServices(list.map(s => ({
        id: s.id,
        codigo: 'SRV-0' + s.id,
        nombre: s.nombre,
        categoria: s.descripcion || s.categoria || 'Taller General',
        duracionEstimada: (s.duracionEstimadaMinutos || 60) / 60,
        precioManoObra: Number(s.precioManoObra || 0),
        activo: s.activo !== false
      })));
      setModalOpen(false);
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setMsg(err.details?.message || err.message || 'No se pudo guardar el servicio.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = services.filter(s =>
    s.nombre.toLowerCase().includes(search.toLowerCase()) ||
    s.codigo.toLowerCase().includes(search.toLowerCase()) ||
    s.categoria.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12 font-sans">
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-medium">
              <span>Administración</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Catálogos Maestros</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-indigo-600 font-semibold">Tarifario de Servicios (RF-13)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Catálogo Maestro de Servicios y Tarifas
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Definición de mano de obra por hora, duración estimada de intervención y categorías de taller.
            </p>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-semibold text-white shadow-xs flex items-center gap-1.5 transition-colors self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Añadir Servicio al Catálogo
          </button>
        </div>
      </section>

      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {msg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            <span>{msg}</span>
          </div>
        )}

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-[18px]">search</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, nombre o categoría..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total servicios activos: <strong>{services.length}</strong>
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Servicio / Descripción</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-center">Duración Estimada</th>
                  <th className="py-3 px-4 text-right">Tarifa Mano de Obra</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{s.codigo}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{s.nombre}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{s.categoria}</td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-slate-900">{s.duracionEstimada} hrs</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600">${s.precioManoObra.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Activo
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenModal(s)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold text-indigo-600 border border-indigo-200"
                      >
                        Editar Tarifa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal: Service Form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 font-sans">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingService ? 'Modificar Servicio (RF-13)' : 'Nuevo Servicio (RF-13)'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure la tarifa de mano de obra y la duración estimada para la presupuestación automática.
            </p>
            <form onSubmit={handleSaveService} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-900 mb-1">Código del Servicio</label>
                <input
                  type="text"
                  required
                  value={form.codigo}
                  onChange={e => setForm({ ...form, codigo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-900 mb-1">Nombre del Servicio</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Duración Estimada (hrs)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={form.duracionEstimada}
                    onChange={e => setForm({ ...form, duracionEstimada: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Precio Mano de Obra ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={form.precioManoObra}
                    onChange={e => setForm({ ...form, precioManoObra: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-900 mb-1">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option>Mecánica Rápida</option>
                  <option>Diagnóstico</option>
                  <option>Frenos</option>
                  <option>Mantenimiento Periódico</option>
                  <option>Transmisión</option>
                  <option>Suspensión</option>
                  <option>Geometría</option>
                </select>
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-50 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {busy ? 'Guardando...' : 'Guardar Servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
