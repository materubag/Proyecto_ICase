import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function RecepcineInspeccindeVehculos14Mockup({ onNavigate }) {
  const [clients, setClients] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(1);
  const [selectedVehicleId, setSelectedVehicleId] = useState(1);
  const [selectorModalOpen, setSelectorModalOpen] = useState(false);
  const [searchPicker, setSearchPicker] = useState('');
  const [mechanics, setMechanics] = useState([]);
  const [mecanicoId, setMecanicoId] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState(null);
  const [formError, setFormError] = useState('');

  const handlePhotosChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPhotos(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreviews(prev => [...prev, {
          name: file.name,
          size: (file.size / 1024).toFixed(0) + ' KB',
          url: event.target.result
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (idxToRemove) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== idxToRemove));
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const [mileage, setMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState('1/2');
  const [reason, setReason] = useState('');
  const [observations, setObservations] = useState('');

  useEffect(() => {
    let mounted = true;
    apiClient.get('/clientes')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && list && list.length > 0) {
          setClients(list);
        }
      })
      .catch(() => {});

    apiClient.get('/vehiculos')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && list && list.length > 0) {
          setVehicles(list);
          const first = list[0];
          if (first) {
            setSelectedVehicleId(first.id);
            if (first.clienteId) setSelectedClientId(first.clienteId);
            if (first.kilometrajeActual != null) setMileage(Number(first.kilometrajeActual));
          }
        }
      })
      .catch(() => {});

    return () => { mounted = false; };
  }, []);

  const activeClient = clients.find(c => c.id === Number(selectedClientId)) || clients[0] || { id: '', nombre: '', documento: '', telefono: '', correo: '' };
  const clientVehicles = vehicles.filter(v => v.clienteId === Number(selectedClientId));
  const availableOptions = clientVehicles.length > 0 ? clientVehicles : vehicles;
  const activeVehicle = vehicles.find(v => v.id === Number(selectedVehicleId)) || availableOptions[0] || { id: '', placa: '', marca: '', modelo: '', anio: '', color: '' };

  const handleSelectClient = (clientId) => {
    const cId = Number(clientId);
    setSelectedClientId(cId);
    const hisVehicles = vehicles.filter(v => v.clienteId === cId);
    const targetVeh = hisVehicles[0] || vehicles[0];
    if (targetVeh) {
      setSelectedVehicleId(targetVeh.id);
      setMileage(Number(targetVeh.kilometrajeActual || 80000));
    }
  };

  const handleSelectVehicle = (vehicleId) => {
    const vId = Number(vehicleId);
    setSelectedVehicleId(vId);
    const veh = vehicles.find(v => v.id === vId);
    if (veh) {
      if (veh.clienteId) setSelectedClientId(veh.clienteId);
      setMileage(Number(veh.kilometrajeActual || 80000));
    }
  };

  const [checklist, setChecklist] = useState({
    ruedaRepuesto: true,
    gatoHerramientas: true,
    documentos: true,
    rayonesPrevios: true,
    radioAntena: true
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiClient.get('/workshop-flow/mecanicos')
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (!mounted) return;
        setMechanics(list);
        if (list[0]) setMecanicoId(String(list[0].id));
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const toggleCheck = (key) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedMechanic = mechanics.find((item) => String(item.id) === String(mecanicoId));

  const handleSaveReception = async () => {
    setFormError('');
    if (!mecanicoId) {
      setFormError('Selecciona el mecánico que realizará la inspección y el diagnóstico.');
      return;
    }
    if (!activeClient.id || !activeVehicle.id) {
      setFormError('Registra primero el cliente y su vehículo en el directorio.');
      return;
    }
    if (!reason.trim()) {
      setFormError('Indica el motivo de ingreso.');
      return;
    }
    setSaving(true);
    const fuelMap = { '1/4': 0.25, '1/2': 0.50, '3/4': 0.75, 'Lleno': 1.00 };
    const numericFuel = fuelMap[fuelLevel] || 0.5;

    try {
      const archivoIds = [];
      for (const file of photos) {
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await apiClient.post('/upload', formData);
        if (uploaded?.archivoId) archivoIds.push(uploaded.archivoId);
      }
      const recRes = await apiClient.post('/workshop-flow/recepcion', {
        vehiculoId: Number(activeVehicle.id),
        clienteId: Number(activeClient.id),
        kilometraje: Number(mileage),
        nivelCombustible: numericFuel,
        motivoIngreso: reason,
        observaciones: observations,
        mecanicoId: Number(mecanicoId),
        archivoIds
      });
      const receptionRecord = {
        orderId: `REC-${String(recRes.recepcionId).padStart(3, '0')}`,
        receptionId: recRes.recepcionId,
        vehicleId: Number(activeVehicle.id),
        clientId: Number(activeClient.id),
        clientName: activeClient.nombre,
        vehiclePlate: activeVehicle.placa,
        vehicleModel: `${activeVehicle.marca || ''} ${activeVehicle.modelo || ''}`.trim(),
        vehicleYear: activeVehicle.anio,
        vehicleColor: activeVehicle.color,
        vehicleMileage: Number(mileage),
        reason,
        observations,
        mecanicoId: recRes.mecanicoId,
        mecanicoNombre: recRes.mecanicoNombre
      };
      localStorage.setItem('autron_active_reception', JSON.stringify(receptionRecord));
      localStorage.setItem('autron_selected_diagnosis_plate', activeVehicle.placa || '');
      if (photoPreviews.length > 0) {
        localStorage.setItem('autron_reception_photos', JSON.stringify(photoPreviews.map(p => ({ url: p.url, name: p.name }))));
      }
      window.dispatchEvent(new CustomEvent('autron:new_reception', { detail: receptionRecord }));
      setSavedSuccess(true);
    } catch (err) {
      setFormError(err.details?.message || err.message || 'No se pudo registrar el ingreso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12">
      {/* Context Sub-header */}
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-medium">
              <span>Taller Central</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Recepción y Admisión</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-indigo-600 font-semibold">Inspección Inicial (RF-07)</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Recepción e Inspección de Vehículos
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-300 text-indigo-600 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                ORD-001 · En Recepción
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Registro pericial de ingreso, kilometraje verificado, nivel de combustible y estado físico del vehículo.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Fecha y hora de registro:</span>
            <span className="font-mono font-bold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-900">
              Hoy · {new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </section>

      {/* Main Grid: Form (8 cols) + Summary Rail (4 cols) */}
      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {savedSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center gap-3 shadow-xs">
            <span className="material-symbols-outlined text-emerald-600 text-2xl">check_circle</span>
            <div>
              <strong className="block text-sm font-bold">Ingreso registrado y mecánico asignado</strong>
              <span className="text-xs text-emerald-800">El mecánico recibió el aviso para continuar con el vehículo.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: 8 cols */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* 1. Datos del Cliente y Vehículo */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">car_repair</span>
                  1. Datos de Ingreso y Vehículo
                </h2>
                <span className="text-xs text-slate-500 font-medium">Paso obligatorio</span>
              </div>

              {/* Selector de Cliente */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-600 text-base">person</span>
                    Cliente Propietario <span className="text-error">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectorModalOpen(true)}
                      className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">search</span>
                      Buscar en Directorio
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('clientes')}
                      className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">person_add</span>
                      Nuevo Cliente
                    </button>
                  </div>
                </div>

                {/* Dropdown de Clientes */}
                <select
                  value={selectedClientId}
                  onChange={(e) => handleSelectClient(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.documento ? `· CI/RUC: ${c.documento}` : ''} {c.telefono ? `(${c.telefono})` : ''}
                    </option>
                  ))}
                </select>

                {/* Ficha Dinámica del Cliente Seleccionado */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {activeClient.nombre ? activeClient.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'CL'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{activeClient.nombre}</h3>
                        {activeClient.documento && (
                          <span className="font-mono text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded font-semibold">
                            CI: {activeClient.documento}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {activeClient.telefono || '+593 99 123 4567'} · {activeClient.correo || 'correo@ejemplo.ec'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectorModalOpen(true)}
                    className="self-end sm:self-center text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">swap_horiz</span>
                    Cambiar Cliente
                  </button>
                </div>
              </div>

              {/* Selector de Vehículo */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-600 text-base">directions_car</span>
                    Vehículo que Ingresa al Taller <span className="text-error">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('vehiculos')}
                    className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 self-start sm:self-auto transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    + Registrar Otro Vehículo
                  </button>
                </div>

                {/* Dropdown de Vehículos */}
                <select
                  value={selectedVehicleId}
                  onChange={(e) => handleSelectVehicle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  {clientVehicles.length > 0 ? (
                    <optgroup label={`Vehículos registrados de ${activeClient.nombre}`}>
                      {clientVehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.placa} - {v.marca} {v.modelo} ({v.anio || 2020}) · {v.color || 'Color estándar'}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  <optgroup label="Todos los Vehículos del Taller">
                    {vehicles.filter(v => !clientVehicles.some(cv => cv.id === v.id)).map(v => (
                      <option key={v.id} value={v.id}>
                        {v.placa} - {v.marca} {v.modelo} ({v.anio || 2020}) {v.color ? `· ${v.color}` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-600 text-base">engineering</span>
                    Mecánico asignado al diagnóstico <span className="text-error">*</span>
                  </label>
                  <select
                    value={mecanicoId}
                    onChange={(e) => setMecanicoId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="">Selecciona un mecánico</option>
                    {mechanics.map((item) => (
                      <option key={item.id} value={item.id}>{item.nombre} · {item.correo}</option>
                    ))}
                  </select>
                  {mechanics.length === 0 && (
                    <p className="text-[11px] text-error">No hay mecánicos activos. Revisa el usuario de taller antes de recibir el vehículo.</p>
                  )}
                </div>

                {/* Ficha Visual de la Placa y Odómetro */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Placa Estilizada */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Matrícula / Placa Oficial</label>
                    <div className="flex items-center">
                      <div className="inline-flex items-center bg-white border-2 border-slate-200 rounded-lg overflow-hidden shadow-xs">
                        <div className="bg-indigo-600 text-white px-2 py-2 flex flex-col items-center justify-center text-[10px] font-bold">
                          <span>EC</span>
                        </div>
                        <div className="px-4 py-1.5 font-mono text-base font-bold tracking-widest text-slate-900 bg-white">
                          {activeVehicle.placa || 'Sin placa'}
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-xs font-bold text-slate-900">{activeVehicle.marca} {activeVehicle.modelo}</p>
                        <span className="text-[11px] text-slate-500">
                          {activeVehicle.anio ? `Año ${activeVehicle.anio} · ` : ''}{activeVehicle.color || 'Plata'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Kilometraje Actual (Odómetro) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Kilometraje de Entrada (Odómetro) <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-[18px]">speed</span>
                      <input
                        type="number"
                        value={mileage}
                        onChange={e => setMileage(e.target.value)}
                        className="w-full pl-9 pr-12 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-medium">km</span>
                    </div>
                  </div>
                </div>

                {/* Nivel de Combustible */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                    Nivel de Combustible Registrado <span className="text-error">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['1/4', '1/2', '3/4', 'Lleno'].map(lvl => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setFuelLevel(lvl)}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          fuelLevel === lvl
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Motivo de Ingreso y Observaciones */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">description</span>
                  2. Motivo de Ingreso y Diagnóstico Inicial Solicitado
                </h2>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Motivo Principal de Ingreso <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Observaciones de Recepción / Daños Notificados
                </label>
                <textarea
                  rows={3}
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none resize-y leading-relaxed"
                />
              </div>
            </div>

            {/* 3. Inspección Pericial y Checklist */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">fact_check</span>
                  3. Checklist de Inventario Inicial del Vehículo
                </h2>
                <span className="text-xs text-slate-500">Inspección de custodia</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { key: 'ruedaRepuesto', label: 'Rueda de repuesto presente y calibrada' },
                  { key: 'gatoHerramientas', label: 'Kit de herramientas y gato hidráulico' },
                  { key: 'documentos', label: 'Matrícula y documentación en guantera' },
                  { key: 'rayonesPrevios', label: 'Verificación pericial de rayones/abolladuras' },
                  { key: 'radioAntena', label: 'Antena y accesorios externos intactos' }
                ].map(item => (
                  <label
                    key={item.key}
                    onClick={() => toggleCheck(item.key)}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checklist[item.key]}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-900">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Summary Rail: 4 cols */}
          <aside className="lg:col-span-4 flex flex-col gap-5 sticky top-20">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Resumen de Recepción</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600">
                  ORD-001
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Cliente:</span>
                  <strong className="text-slate-900 truncate max-w-[170px] text-right" title={activeClient.nombre}>
                    {activeClient.nombre}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Vehículo:</span>
                  <strong className="text-slate-900">{activeVehicle.marca} {activeVehicle.modelo}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Placa:</span>
                  <strong className="font-mono text-indigo-600 font-bold">{activeVehicle.placa}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Kilometraje:</span>
                  <strong className="font-mono">{Number(mileage).toLocaleString()} km</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Combustible:</span>
                  <strong>{fuelLevel} tanque</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Mecánico asignado:</span>
                  <strong className="text-slate-900">{selectedMechanic?.nombre || 'Sin asignar'}</strong>
                </div>
              </div>
              {/* Fotos del ingreso con galería de miniaturas interactiva */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-600 text-base">photo_camera</span>
                    <span>Fotos del Ingreso</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">
                    {photoPreviews.length} {photoPreviews.length === 1 ? 'archivo' : 'archivos'}
                  </span>
                </div>

                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-3 text-center transition-colors bg-slate-50/50">
                  <input
                    type="file"
                    id="receptionPhotosInput"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={handlePhotosChange}
                  />
                  <label
                    htmlFor="receptionPhotosInput"
                    className="flex flex-col items-center justify-center gap-1 cursor-pointer py-1"
                  >
                    <span className="material-symbols-outlined text-indigo-600 text-2xl">add_photo_alternate</span>
                    <span className="text-xs font-semibold text-indigo-600 hover:underline">
                      Seleccionar o subir fotos
                    </span>
                    <span className="text-[10px] text-slate-400">
                      PNG, JPG, WEBP (Odómetro, daños, inspección 360°)
                    </span>
                  </label>
                </div>

                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {photoPreviews.map((p, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-4/3 shadow-2xs"
                      >
                        <img
                          src={p.url}
                          alt={p.name}
                          onClick={() => setSelectedPhotoPreview(p.url)}
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                          title="Eliminar foto"
                        >
                          <span className="material-symbols-outlined text-[13px]">close</span>
                        </button>
                        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-900/80 via-slate-900/40 to-transparent p-1.5 flex items-center justify-between text-white pointer-events-none">
                          <span className="text-[9.5px] truncate max-w-[70%] font-mono">{p.name}</span>
                          <span className="text-[8.5px] text-slate-300 font-mono">{p.size}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-2">
                {formError && (
                  <p className="mb-2 text-xs text-error bg-error-container/30 border border-error/30 rounded-lg px-3 py-2">{formError}</p>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveReception}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-50 text-white font-bold rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">save</span>
                  <span>{saving ? 'Registrando ingreso...' : 'Registrar ingreso y asignar mecánico'}</span>
                </button>
                <p className="text-[11px] text-slate-500 text-center mt-2">
                  El mecánico asignado hace la inspección, el diagnóstico y envía la cotización. El código OBD es opcional.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Modal de Búsqueda Rápida de Cliente y Vehículo */}
      {selectorModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">manage_search</span>
                  Seleccionar Cliente y Vehículo
                </h3>
                <p className="text-xs text-slate-500">
                  Busque por nombre de cliente, número de cédula/RUC o placa del vehículo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectorModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Input de Búsqueda */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-3 text-slate-500 text-lg">search</span>
              <input
                type="text"
                autoFocus
                value={searchPicker}
                onChange={e => setSearchPicker(e.target.value)}
                placeholder="Escriba apellido, nombre, cédula (ej: 180...) o placa (ej: ABC-1234)..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Lista Filtrada */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-200 pr-1 space-y-2">
              {clients
                .filter(c => {
                  const q = searchPicker.toLowerCase().trim();
                  if (!q) return true;
                  const nameMatch = (c.nombre || '').toLowerCase().includes(q);
                  const docMatch = (c.documento || '').toLowerCase().includes(q);
                  const phoneMatch = (c.telefono || '').toLowerCase().includes(q);
                  const clientVehs = vehicles.filter(v => v.clienteId === c.id);
                  const plateMatch = clientVehs.some(v => (v.placa || '').toLowerCase().includes(q) || (v.modelo || '').toLowerCase().includes(q));
                  return nameMatch || docMatch || phoneMatch || plateMatch;
                })
                .map(client => {
                  const hisVehs = vehicles.filter(v => v.clienteId === client.id);
                  const isCurrent = client.id === Number(selectedClientId);
                  return (
                    <div
                      key={client.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isCurrent
                          ? 'border-indigo-600 bg-indigo-50/60'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                            {client.nombre ? client.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'CL'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{client.nombre}</span>
                              {client.documento && (
                                <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-medium">
                                  CI: {client.documento}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {client.telefono} · {client.correo}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            handleSelectClient(client.id);
                            setSelectorModalOpen(false);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-600 text-white'
                              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                          }`}
                        >
                          {isCurrent ? 'Seleccionado' : 'Elegir Cliente'}
                        </button>
                      </div>

                      {/* Lista de vehículos del cliente */}
                      {hisVehs.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap gap-2 items-center">
                          <span className="text-[10px] text-slate-500 font-medium">Vehículos:</span>
                          {hisVehs.map(v => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                handleSelectClient(client.id);
                                handleSelectVehicle(v.id);
                                setSelectorModalOpen(false);
                              }}
                              className={`px-2 py-1 rounded text-[11px] font-mono font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                                v.id === Number(selectedVehicleId)
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-900 border-slate-200 hover:border-indigo-600'
                              }`}
                            >
                              <span className="text-[9px] font-sans font-bold bg-black/10 px-1 rounded">EC</span>
                              <span>{v.placa}</span>
                              <span className="text-[10px] font-sans font-normal opacity-80">({v.marca} {v.modelo})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSelectorModalOpen(false);
                  onNavigate?.('clientes');
                }}
                className="text-xs text-indigo-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Registrar nuevo cliente en el sistema
              </button>
              <button
                type="button"
                onClick={() => setSelectorModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox para previsualizar foto en tamaño completo */}
      {selectedPhotoPreview && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedPhotoPreview(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-3" onClick={e => e.stopPropagation()}>
            <img src={selectedPhotoPreview} alt="Foto ampliada" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <div className="flex items-center justify-between pt-3 px-2 text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-indigo-600 text-base">photo_camera</span>
                Evidencia Fotográfica de Ingreso
              </span>
              <button
                type="button"
                onClick={() => setSelectedPhotoPreview(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
