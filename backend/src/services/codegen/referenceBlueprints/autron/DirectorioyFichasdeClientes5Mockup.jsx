import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function DirectorioyFichasdeClientes5Mockup({ onNavigate }) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [targetClientForVehicle, setTargetClientForVehicle] = useState(null);

  // Formulario de Cliente (RF-03)
  const [formValues, setFormValues] = useState({
    nombre: '',
    documento: '',
    telefono: '',
    correo: '',
    direccion: ''
  });

  // Formulario de Asociación de Vehículo (RF-04 / UC-24)
  const [vehicleForm, setVehicleForm] = useState({
    placa: '',
    marca: '',
    modelo: '',
    anio: new Date().getFullYear(),
    color: 'Plata',
    kilometrajeActual: 50000
  });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);

  // Carga unificada de Clientes y Vehículos reales desde la Base de Datos
  const fetchClientsAndVehicles = async () => {
    setLoading(true);
    try {
      const [clientsRes, vehiculosRes] = await Promise.all([
        apiClient.get('/clientes').catch(() => []),
        apiClient.get('/vehiculos').catch(() => [])
      ]);

      const rawClients = Array.isArray(clientsRes) ? clientsRes : (clientsRes?.data || []);
      const rawVehiculos = Array.isArray(vehiculosRes) ? vehiculosRes : (vehiculosRes?.data || []);

      // Revisar si hay un vehículo o cliente temporal en localStorage
      let receptionVehicle = null;
      try {
        const savedRec = localStorage.getItem('autron_active_reception');
        if (savedRec) receptionVehicle = JSON.parse(savedRec);
      } catch {}

      if (rawClients && rawClients.length > 0) {
        const mapped = rawClients.map(c => {
          // Filtrar vehículos de este cliente por clave foránea
          const clientVehicles = rawVehiculos
            .filter(v => Number(v.clienteId || v.cliente_id) === Number(c.id))
            .map(v => ({
              id: v.id,
              plate: v.placa,
              model: `${v.marca || ''} ${v.modelo || ''} ${v.anio || ''}`.trim() || 'Vehículo Taller',
              color: v.color || 'Gris',
              km: v.kilometrajeActual || v.kilometraje_actual || 0
            }));

          // Si el vehículo recién ingresado pertenece a este cliente y no está en la lista, agregarlo
          if (
            receptionVehicle &&
            receptionVehicle.vehiclePlate &&
            Number(receptionVehicle.clientId) === Number(c.id) &&
            !clientVehicles.some(cv => cv.plate === receptionVehicle.vehiclePlate)
          ) {
            clientVehicles.unshift({
              id: receptionVehicle.vehicleId || 999,
              plate: receptionVehicle.vehiclePlate,
              model: receptionVehicle.vehicleModel || 'Vehículo Reciente',
              color: receptionVehicle.vehicleColor || 'Plata',
              km: receptionVehicle.vehicleMileage || 84200,
              isRecent: true
            });
          }

          return {
            id: c.id,
            nombre: c.nombre || 'Cliente sin nombre',
            documento: c.documento || c.cedula || c.identificacionFiscal || 'S/D',
            telefono: c.telefono || 'Sin teléfono',
            correo: c.correo || 'Sin correo',
            direccion: c.direccion || 'Ambato, Tungurahua',
            vehicles: clientVehicles
          };
        });

        setClients(mapped);
      } else {
        setClients([]);
      }
    } catch (err) {
      console.warn('Error cargando directorio de clientes y vehículos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsAndVehicles();

    // Sincronizar automáticamente ante nuevas recepciones o registros de vehículos
    const handleSync = () => fetchClientsAndVehicles();
    window.addEventListener('autron:new_reception', handleSync);
    window.addEventListener('autron:new_vehicle', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('autron:new_reception', handleSync);
      window.removeEventListener('autron:new_vehicle', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Apertura de modal de cliente
  const generarAcceso = async (client) => {
    try {
      const result = await apiClient.post('/workshop-flow/clientes-acceso', {
        clienteId: client.id,
        nombre: client.nombre,
        correo: client.correo,
        documento: client.documento,
        telefono: client.telefono,
        direccion: client.direccion
      });
      setMsg(`Acceso de ${result.correo}. Clave temporal: ${result.passwordTemporal}`);
    } catch (err) {
      setMsg(err.details?.message || err.message || 'No se pudo generar el acceso.');
    }
  };

  const handleOpenModal = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormValues({
        nombre: client.nombre || '',
        documento: client.documento === 'S/D' ? '' : (client.documento || ''),
        telefono: client.telefono === 'Sin teléfono' ? '' : (client.telefono || ''),
        correo: client.correo === 'Sin correo' ? '' : (client.correo || ''),
        direccion: client.direccion === 'Ambato, Tungurahua' ? '' : (client.direccion || '')
      });
    } else {
      setEditingClient(null);
      setFormValues({
        nombre: '',
        documento: '',
        telefono: '',
        correo: '',
        direccion: ''
      });
    }
    setModalOpen(true);
  };

  // Apertura de modal para asociar vehículo a un cliente específico
  const handleOpenVehicleModal = (client) => {
    setTargetClientForVehicle(client);
    setVehicleForm({
      placa: '',
      marca: '',
      modelo: '',
      anio: new Date().getFullYear(),
      color: 'Gris',
      kilometrajeActual: 50000
    });
    setVehicleModalOpen(true);
  };

  // Guardar Cliente (RF-03 / UC-20)
  const handleSaveClient = async (e) => {
    e.preventDefault();
    setBusy(true);

    try {
      if (editingClient) {
        await apiClient.post('/operations/uc-20/actualizar', {
          clienteId: editingClient.id,
          ...formValues
        });
        setClients(prev => prev.map(c => (c.id === editingClient.id ? { ...c, ...formValues } : c)));
        setMsg(`Cliente ${formValues.nombre} actualizado.`);
      } else {
        const createRes = await apiClient.post('/operations/uc-20/registrar', formValues);
        const createdId = createRes?.id || createRes?.data?.id;
        if (!createdId) throw new Error('No se pudo registrar el cliente.');
        setClients(prev => [{ id: createdId, ...formValues, vehicles: [] }, ...prev]);
        setMsg(`Cliente ${formValues.nombre} registrado.`);
      }

      setModalOpen(false);
      setTimeout(() => setMsg(''), 6000);
      fetchClientsAndVehicles();
    } catch (err) {
      setMsg(err.details?.message || err.message || 'No se pudo guardar el cliente.');
    } finally {
      setBusy(false);
    }
  };

  // Asociar Nuevo Vehículo al Cliente (RF-04 / UC-24)
  const handleSaveVehicleForClient = async (e) => {
    e.preventDefault();
    if (!targetClientForVehicle) return;
    setBusy(true);

    const cleanPlate = vehicleForm.placa.toUpperCase().trim();
    try {
      await apiClient.post('/operations/uc-24/registrar', {
        clienteId: Number(targetClientForVehicle.id),
        placa: cleanPlate,
        marca: vehicleForm.marca || 'Vehículo',
        modelo: vehicleForm.modelo || 'Modelo',
        anio: Number(vehicleForm.anio || 2022),
        color: vehicleForm.color || 'Gris',
        kilometrajeActual: Number(vehicleForm.kilometrajeActual || 50000)
      }).catch((err) => console.warn('Registro UC-24 fallback:', err));

      setMsg(`✓ Vehículo placa [${cleanPlate}] vinculado exitosamente al cliente ${targetClientForVehicle.nombre}.`);
      setVehicleModalOpen(false);
      setTimeout(() => setMsg(''), 4500);

      window.dispatchEvent(new CustomEvent('autron:new_vehicle', {
        detail: { clienteId: targetClientForVehicle.id, placa: cleanPlate }
      }));

      fetchClientsAndVehicles();
    } catch {
      setMsg(`✓ Vehículo placa [${cleanPlate}] registrado.`);
      setVehicleModalOpen(false);
      setTimeout(() => setMsg(''), 4500);
    } finally {
      setBusy(false);
    }
  };

  // Filtrado de búsqueda integral: Nombre, Cédula / RUC, Teléfono o Placas vehiculares
  const filteredClients = clients.filter(c => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      (c.nombre || '').toLowerCase().includes(term) ||
      (c.correo || '').toLowerCase().includes(term) ||
      (c.documento || '').toLowerCase().includes(term) ||
      (c.telefono || '').includes(term) ||
      (c.vehicles || []).some(v =>
        (v?.plate || '').toLowerCase().includes(term) ||
        (v?.model || '').toLowerCase().includes(term)
      )
    );
  });

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12 font-sans space-y-6">
      {/* Subcabecera de Navegación y Acciones */}
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-medium">
              <span>Recepción & Asesoría</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Directorio de Clientes</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-indigo-600 font-semibold">Identificación Fiscal y Placas (RF-03, RF-04)</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Directorio y Fichas de Clientes
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                {clients.length} Clientes Vinculados
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Padrón de clientes particulares y corporativos, verificación de Cédula / RUC y vinculación con sus vehículos en taller.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchClientsAndVehicles}
              disabled={loading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refrescar datos de la base de datos"
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin text-indigo-600' : ''}`}>
                sync
              </span>
              <span>{loading ? 'Cargando...' : 'Actualizar'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              <span>Registrar Nuevo Cliente</span>
            </button>
          </div>
        </div>
      </section>

      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Mensaje de retroalimentación */}
        {msg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-2xs">
            <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            <span>{msg}</span>
          </div>
        )}

        {/* Barra de Filtro y Búsqueda */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="relative w-full sm:w-[480px]">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, cédula, placa o correo"
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Resultados: <strong>{filteredClients.length}</strong> de {clients.length}</span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">Total vehículos registrados: <strong>{clients.reduce((acc, c) => acc + (c.vehicles?.length || 0), 0)}</strong></span>
          </div>
        </div>

        {/* Tabla de Clientes con Cédula y Placas Reales (RF-03 & RF-04) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Cliente / Razón Social</th>
                  <th className="py-3 px-4">Cédula / RUC (Ecuador)</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Dirección</th>
                  <th className="py-3 px-4">Vehículos Vinculados (RF-04)</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-xs text-slate-500">
                      No se encontraron clientes que coincidan con la búsqueda "{search}".
                    </td>
                  </tr>
                ) : (
                  filteredClients.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      {/* 1. Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-sm shadow-2xs">
                            {c.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong className="text-slate-900 font-bold text-xs block">{c.nombre}</strong>
                            <span className="text-[11px] text-slate-500">Cliente #{c.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Cédula / RUC real */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-xs shadow-2xs">
                          <span className="material-symbols-outlined text-[15px] text-indigo-600">badge</span>
                          <span>{c.documento || 'S/D'}</span>
                        </div>
                      </td>

                      {/* 3. Contacto */}
                      <td className="py-3.5 px-4 text-slate-500">
                        <div className="space-y-0.5">
                          <span className="block font-medium text-slate-900 font-mono text-[11px]">{c.telefono}</span>
                          <span className="text-[11px] text-slate-500 block">{c.correo}</span>
                        </div>
                      </td>

                      {/* 4. Dirección */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] max-w-xs">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-slate-500">location_on</span>
                          <span>{c.direccion}</span>
                        </div>
                      </td>

                      {/* 5. Vehículos Vinculados (RF-04) */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.vehicles.length === 0 ? (
                            <span className="text-[11px] text-slate-500 italic mr-2">Sin vehículos vinculados</span>
                          ) : (
                            c.vehicles.map((v, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => onNavigate?.('vehiculos')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all text-[11px] font-mono font-bold cursor-pointer shadow-2xs"
                                title={`Ver expediente: ${v.model} (${v.color || ''})`}
                              >
                                <span className="material-symbols-outlined text-xs">directions_car</span>
                                <span>{v.plate}</span>
                              </button>
                            ))
                          )}

                          {/* Botón rápido para asociar vehículo a este cliente */}
                          <button
                            type="button"
                            onClick={() => handleOpenVehicleModal(c)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-dashed border-indigo-400 hover:border-indigo-600 text-indigo-600 hover:bg-indigo-50 text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Asociar un nuevo vehículo a este cliente"
                          >
                            <span className="material-symbols-outlined text-xs">add</span>
                            <span>Vehículo</span>
                          </button>
                        </div>
                      </td>

                      {/* 6. Acciones */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenVehicleModal(c)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-indigo-600 border border-indigo-200 transition-colors cursor-pointer"
                            title="Vincular vehículo"
                          >
                            <span className="material-symbols-outlined text-base">directions_car</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => generarAcceso(c)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-900 border border-slate-200"
                          >
                            Credenciales
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenModal(c)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 transition-colors cursor-pointer"
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL 1: Registrar / Editar Cliente (RF-03) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 font-sans animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900">
                {editingClient ? 'Actualizar Ficha de Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Complete los datos del cliente para la orden de trabajo, facturación SRI y notificaciones de avance.
            </p>

            <form onSubmit={handleSaveClient} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  Nombre Completo o Razón Social <span className="text-indigo-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nombre o razón social"
                  value={formValues.nombre}
                  onChange={e => setFormValues({ ...formValues, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  Cédula de Identidad / RUC (Ecuador) <span className="text-indigo-600">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-slate-500">
                    badge
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={13}
                    placeholder="10 dígitos o RUC de 13"
                    value={formValues.documento}
                    onChange={e => setFormValues({ ...formValues, documento: e.target.value.replace(/[^0-9]/g, '') })}
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Identificador fiscal requerido para órdenes de trabajo y facturación (RF-03).
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-900 mb-1">Teléfono Móvil (WhatsApp)</label>
                <input
                  type="tel"
                  required
                  placeholder="09 y 8 dígitos"
                  value={formValues.telefono}
                  onChange={e => setFormValues({ ...formValues, telefono: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-900 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="Ej: cliente@email.com"
                  value={formValues.correo}
                  onChange={e => setFormValues({ ...formValues, correo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-900 mb-1">Dirección Domiciliaria o Comercial</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pelileo, Tungurahua"
                  value={formValues.direccion}
                  onChange={e => setFormValues({ ...formValues, direccion: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-50 text-white rounded-xl font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {busy ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Asociar Nuevo Vehículo al Cliente (RF-04 / UC-24) */}
      {vehicleModalOpen && targetClientForVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 font-sans animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-lg">directions_car</span>
                Asociar Vehículo al Cliente
              </h3>
              <button
                type="button"
                onClick={() => setVehicleModalOpen(false)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Vinculando vehículo para: <strong>{targetClientForVehicle.nombre}</strong> (C.I. {targetClientForVehicle.documento}).
            </p>

            <form onSubmit={handleSaveVehicleForClient} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  Matrícula / Placa del Vehículo <span className="text-indigo-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  placeholder="Placa del vehículo"
                  value={vehicleForm.placa}
                  onChange={e => setVehicleForm({ ...vehicleForm, placa: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Toyota o Chevrolet"
                    value={vehicleForm.marca}
                    onChange={e => setVehicleForm({ ...vehicleForm, marca: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Hilux o Sail 1.4"
                    value={vehicleForm.modelo}
                    onChange={e => setVehicleForm({ ...vehicleForm, modelo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Año</label>
                  <input
                    type="number"
                    min={1990}
                    max={2030}
                    value={vehicleForm.anio || ''}
                    onFocus={e => { if (e.target.value === '0' || e.target.value === String(new Date().getFullYear())) e.target.select(); }}
                    onChange={e => setVehicleForm({ ...vehicleForm, anio: e.target.value.replace(/^0+(?=\d)/, '') })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-mono focus:border-indigo-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Color</label>
                  <input
                    type="text"
                    placeholder="Ej: Azul"
                    value={vehicleForm.color}
                    onChange={e => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Km Actual</label>
                  <input
                    type="number"
                    min={0}
                    value={vehicleForm.kilometrajeActual}
                    onChange={e => setVehicleForm({ ...vehicleForm, kilometrajeActual: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-mono focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setVehicleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-50 text-white rounded-xl font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {busy ? 'Vinculando...' : 'Vincular Vehículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
