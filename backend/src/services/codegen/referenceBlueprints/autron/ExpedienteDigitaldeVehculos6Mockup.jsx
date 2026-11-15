import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

function ReceptionPhoto({ url }) {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setSource('');
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then((response) => {
        if (!response.ok) throw new Error('Foto no disponible');
        return response.blob();
      })
      .then((blob) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => { throw new Error('Foto no disponible'); };
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
  if (failed) return <span className="text-xs text-error">No se pudo abrir la foto.</span>;
  if (!source) return <span className="text-xs text-slate-500">Cargando foto...</span>;
  return (
    <a href={source} target="_blank" rel="noreferrer">
      <img src={source} alt="Foto del ingreso" className="h-40 w-56 object-cover rounded-lg border border-slate-200 bg-white" />
    </a>
  );
}

export default function ExpedienteDigitaldeVehculos6Mockup({ onNavigate }) {
  const [search, setSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [newMileage, setNewMileage] = useState('');
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [clientsList, setClientsList] = useState([]);

  const [newVehicleForm, setNewVehicleForm] = useState({
    clienteId: 1,
    placa: '',
    marca: '',
    modelo: '',
    anio: new Date().getFullYear(),
    color: 'Plata',
    vin: '',
    kilometrajeActual: 45000
  });

  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiClient.get('/vehiculos').catch(() => []),
      apiClient.get('/clientes').catch(() => [])
    ]).then(([vRes, cRes]) => {
      if (!mounted) return;
      const list = Array.isArray(vRes) ? vRes : (vRes?.data || []);
      const cList = Array.isArray(cRes) ? cRes : (cRes?.data || []);
      setClientsList(cList);
      if (cList.length > 0) {
        setNewVehicleForm(prev => ({ ...prev, clienteId: cList[0].id }));
      }
      if (list && list.length > 0) {
        const mapped = list.map(v => {
          const owner = cList.find(c => Number(c.id) === Number(v.clienteId || v.cliente_id));
          return {
            id: v.id,
            plate: v.placa || 'ABC-1234',
            model: `${v.marca || ''} ${v.modelo || ''} ${v.anio || ''}`.trim() || 'Vehículo Taller',
            client: owner ? `${owner.nombre} (C.I. ${owner.documento || 'S/D'})` : (v.Cliente?.nombre || 'Cliente Registrado'),
            vin: v.vin || 'VIN-' + v.id,
            motor: 'Motor Gasolina / Diésel',
            mileage: Number(v.kilometrajeActual || 84200),
            status: 'Activo',
            nextMaintenance: `${Number(v.kilometrajeActual || 84200) + 5000} km (en 5,000 km)`,
            history: []
          };
        });
        setVehicles(mapped);
        if (mapped[0]?.plate) {
          setSelectedVehicle(mapped[0].plate);
        }
      }
    });

    return () => { mounted = false; };
  }, []);

  const selectedVehicleId = vehicles.find((item) => item.plate === selectedVehicle)?.id;
  useEffect(() => {
    if (!selectedVehicleId) return undefined;
    let mounted = true;
    apiClient.get(`/workshop-flow/expediente?vehiculoId=${selectedVehicleId}`)
      .then((res) => {
        const historial = (res?.historial || []).map((item) => ({
          date: item.fecha ? String(item.fecha).slice(0, 10) : '',
          km: item.kilometraje || '',
          order: item.estado || item.tipo,
          type: item.tipo,
          desc: item.detalle || '',
          tech: '',
          parts: '',
          cost: ''
        }));
        if (mounted) {
          setVehicles((prev) => prev.map((item) => item.id === selectedVehicleId ? { ...item, history: historial, photos: res?.evidencias || [] } : item));
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [selectedVehicleId]);

  const activeVehicleData = vehicles.find(v => v.plate === selectedVehicle) || vehicles[0] || null;

  const handleUpdateMileage = async (e) => {
    e.preventDefault();
    if (!newMileage) return;
    setBusy(true);

    try {
      await apiClient.post('/operations/uc-03/actualizar-kilometraje', {
        vehiculoId: activeVehicleData.id || 1,
        nuevoKilometraje: Number(newMileage)
      }).catch(() => {});

      setVehicles(vehicles.map(v => v.plate === selectedVehicle ? { ...v, mileage: Number(newMileage) } : v));
      setModalOpen(false);
      setNewMileage('');
    } catch {
      setVehicles(vehicles.map(v => v.plate === selectedVehicle ? { ...v, mileage: Number(newMileage) } : v));
      setModalOpen(false);
      setNewMileage('');
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterVehicle = async (e) => {
    e.preventDefault();
    if (!newVehicleForm.placa || !newVehicleForm.marca || !newVehicleForm.modelo) return;
    setBusy(true);

    try {
      const payload = {
        clienteId: Number(newVehicleForm.clienteId),
        placa: newVehicleForm.placa.trim().toUpperCase(),
        marca: newVehicleForm.marca.trim(),
        modelo: newVehicleForm.modelo.trim(),
        anio: Number(newVehicleForm.anio),
        vin: newVehicleForm.vin ? newVehicleForm.vin.trim().toUpperCase() : undefined,
        color: newVehicleForm.color || 'Plata',
        kilometrajeActual: Number(newVehicleForm.kilometrajeActual || 0)
      };

      const res = await apiClient.post('/operations/uc-24/registrar', payload).catch(() => null);

      const clientObj = clientsList.find(c => c.id === Number(newVehicleForm.clienteId));
      const clientName = clientObj?.nombre || 'Cliente Nexora';

      const newVeh = {
        id: res?.data?.id || Date.now(),
        plate: payload.placa,
        model: `${payload.marca} ${payload.modelo} ${payload.anio}`,
        client: clientName,
        vin: payload.vin || ('VIN-' + payload.placa),
        motor: 'Motor Inyección Gasolina/Diésel',
        mileage: payload.kilometrajeActual,
        status: 'Activo',
        nextMaintenance: `${payload.kilometrajeActual + 5000} km (en 5,000 km)`,
        history: []
      };

      setVehicles([newVeh, ...vehicles]);
      setSelectedVehicle(newVeh.plate);
      setRegisterModalOpen(false);
      setNewVehicleForm({
        clienteId: clientsList[0]?.id || 1,
        placa: '',
        marca: '',
        modelo: '',
        anio: new Date().getFullYear(),
        color: 'Plata',
        vin: '',
        kilometrajeActual: 45000
      });
      setToastMsg(`Vehículo ${newVeh.plate} registrado exitosamente en el expediente.`);
      setTimeout(() => setToastMsg(''), 5000);
    } catch (err) {
      setToastMsg('Error al registrar vehículo: ' + (err.message || 'Error'));
    } finally {
      setBusy(false);
    }
  };

  const filteredVehicles = vehicles.filter(v =>
    (v.plate || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.model || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.client || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12 font-sans">
      {/* Sub-header */}
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-medium">
              <span>Taller</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Expedientes</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-indigo-600 font-semibold">Trazabilidad y Hoja de Vida (RF-05, RF-27)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Expediente Digital de Vehículos
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Registro histórico integral: intervenciones, kilometrajes certificados, diagnósticos OBD, repuestos y alertas preventivas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                alert(`Exportando Ficha Técnica PDF para el vehículo ${activeVehicleData?.plate || 'S/P'}...`);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-900 border border-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              Ficha Técnica (PDF)
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-900 border border-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">edit_note</span>
              Actualizar Kilometraje
            </button>
            <button
              onClick={() => setRegisterModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Registrar Nuevo Vehículo
            </button>
          </div>
        </div>
      </section>

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-semibold shadow-xs">
            <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Metrics Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Vehículos Registrados</span>
              <span className="material-symbols-outlined text-indigo-600 text-lg">directions_car</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{vehicles.length}</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                100% con expediente
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">Trazabilidad garantizada</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[10px]">En Servicio Activo</span>
              <span className="material-symbols-outlined text-amber-700 text-lg">build</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-indigo-600">1</span>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ORD-001 en bahía
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">Toyota Corolla ABC-123</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Preventivo al Día</span>
              <span className="material-symbols-outlined text-emerald-700 text-lg">verified</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">92%</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Pautas cumplidas
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">Alertas automáticas activas</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Próximo Servicio</span>
              <span className="material-symbols-outlined text-indigo-600 text-lg">calendar_month</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-900">50,000 km</span>
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                En 1,750 km
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">Aviso por odómetro (RF-29)</span>
          </div>
        </section>

        {/* Search & Selector Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-[18px]">search</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por placa, cliente o modelo..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
            {filteredVehicles.map(veh => (
              <button
                key={veh.plate}
                type="button"
                onClick={() => setSelectedVehicle(veh.plate)}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedVehicle === veh.plate
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-mono">{veh.plate || 'S/P'}</span>
                <span className="text-[10px] opacity-80">({((veh.model || '').split(' ')[0]) || 'Vehículo'})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Vehicle Dossier */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Technical Specs & History (8 cols) */}
          <section className="lg:col-span-8 space-y-6">
            {/* Specs Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[28px]">directions_car</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-slate-900 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200">
                        {activeVehicleData?.plate || 'S/P'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {activeVehicleData?.status || 'Activo'}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-1">{activeVehicleData?.model || 'Vehículo'}</h2>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Propietario</span>
                  <strong className="text-xs text-slate-900">{activeVehicleData?.client || 'Cliente Nexora'}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">VIN / Chasis</span>
                  <strong className="font-mono text-slate-900 text-[11px]">{activeVehicleData?.vin || 'N/D'}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Motorización</span>
                  <strong className="text-slate-900 text-[11px]">{activeVehicleData?.motor || 'N/D'}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Kilometraje Actual</span>
                  <strong className="text-indigo-600 font-mono text-xs">{Number(activeVehicleData?.mileage || 0).toLocaleString()} km</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Próximo Service</span>
                  <strong className="text-amber-800 text-[11px]">{activeVehicleData?.nextMaintenance || 'N/D'}</strong>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <strong className="text-sm">Fotos del ingreso ({(activeVehicleData?.photos || []).length})</strong>
                {(activeVehicleData?.photos || []).length === 0 ? (
                  <p className="text-xs text-slate-500">Este vehículo todavía no tiene fotos.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {activeVehicleData.photos.map((photo) => <ReceptionPhoto key={photo.id} url={photo.url} />)}
                  </div>
                )}
              </div>
            </div>

            <form className="bg-white border border-slate-200 rounded-xl p-4 grid sm:grid-cols-2 gap-2 text-xs" onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              try {
                await apiClient.post('/workshop-flow/mantenimiento', {
                  vehiculoId: activeVehicleData.id,
                  descripcion: data.get('descripcion'),
                  fechaBase: data.get('fechaBase') || undefined,
                  intervaloDias: data.get('intervaloDias') || undefined,
                  kilometrajeBase: data.get('kilometrajeBase') || undefined,
                  intervaloKilometros: data.get('intervaloKilometros') || undefined
                });
                setToastMsg('Mantenimiento preventivo configurado.');
              } catch (err) {
                setToastMsg(err.details?.message || err.message || 'No se pudo configurar el mantenimiento.');
              }
            }}>
              <strong className="sm:col-span-2">Mantenimiento preventivo</strong>
              <input name="descripcion" required placeholder="Descripción" className="sm:col-span-2 px-2 py-1.5 border border-slate-200 rounded-lg" />
              <input name="fechaBase" type="date" className="px-2 py-1.5 border border-slate-200 rounded-lg" />
              <input name="intervaloDias" type="number" min="1" placeholder="Intervalo en días" className="px-2 py-1.5 border border-slate-200 rounded-lg" />
              <input name="kilometrajeBase" type="number" min="0" placeholder="Kilometraje base" className="px-2 py-1.5 border border-slate-200 rounded-lg" />
              <input name="intervaloKilometros" type="number" min="1" placeholder="Intervalo en km" className="px-2 py-1.5 border border-slate-200 rounded-lg" />
              <button className="sm:col-span-2 py-2 bg-indigo-600 text-white rounded-lg font-bold" type="submit" disabled={!activeVehicleData?.id}>Guardar programación</button>
            </form>
            {/* Interventions History (RF-27) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">history_edu</span>
                  Historial de Reparaciones y Mantenimientos Certificados
                </h3>
                <span className="text-[11px] text-slate-500">{(activeVehicleData?.history || []).length} intervenciones registradas</span>
              </div>

              <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {(activeVehicleData?.history || []).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3.5 relative">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-300 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 z-10 bg-white">
                      <span className="material-symbols-outlined text-sm">build</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex-1 text-xs space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-slate-900">{item.type}</strong>
                          <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold">
                            {item.order}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                          <span>{item.date}</span>
                          <span>·</span>
                          <strong className="font-mono text-slate-900">{item.km.toLocaleString()} km</strong>
                        </div>
                      </div>
                      <p className="text-slate-500 leading-relaxed">{item.desc}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[11px]">
                        <div>
                          <span className="text-slate-500">Repuestos: </span>
                          <strong className="text-slate-900">{item.parts}</strong>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">Técnico: <strong>{item.tech}</strong></span>
                          <span className="font-mono font-bold text-indigo-600">{item.cost}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right Column: Maintenance Rules & Actions (4 cols) */}
          <aside className="lg:col-span-4 flex flex-col gap-5 sticky top-20">
            {/* Preventive Maintenance Alert (RF-28 & RF-29) */}
            <div className="bg-amber-50/50 border border-amber-300 rounded-xl p-5 shadow-xs flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-900">
                <span className="material-symbols-outlined text-amber-700">alarm_on</span>
                <h3 className="text-sm font-bold">Mantenimiento Programado (RF-28)</h3>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Este modelo requiere calibración de inyección y revisión profunda a los <strong>50,000 km</strong>.
                Faltan <strong>1,750 km</strong> estimados para la alerta de turno.
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.('citas')}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                Agendar Cita Preventiva
              </button>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Acciones del Expediente</h4>
              <button
                type="button"
                onClick={() => setRegisterModalOpen(true)}
                className="w-full py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-lg text-xs flex items-center gap-2 transition-colors text-left border border-indigo-200"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>Registrar Nuevo Vehículo (UC-24)</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('diagnosticos')}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 flex items-center gap-2 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-base">biotech</span>
                <span>Crear Nuevo Diagnóstico OBD</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('recepcion')}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-900 border border-slate-200 flex items-center gap-2 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-base">input</span>
                <span>Registrar Nuevo Ingreso de Taller</span>
              </button>
            </div>
          </aside>
        </div>
      </main>

      {/* Modal: Update Mileage */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Actualizar Kilometraje</h3>
            <p className="text-xs text-slate-500 mb-4">
              Ingrese el nuevo kilometraje verificado en el odómetro del vehículo <strong>{activeVehicleData?.plate || 'S/P'}</strong>.
            </p>
            <form onSubmit={handleUpdateMileage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Nuevo Kilometraje (km)</label>
                <input
                  type="number"
                  min={activeVehicleData?.mileage || 0}
                  required
                  value={newMileage}
                  onChange={e => setNewMileage(e.target.value)}
                  placeholder={`Mayor a ${activeVehicleData?.mileage || 0}`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-50 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {busy ? 'Guardando...' : 'Guardar Kilometraje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register New Vehicle (UC-24) */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Registrar Nuevo Vehículo</h3>
                <p className="text-xs text-slate-500">Alta en el expediente digital y asignación al cliente propietario (UC-24).</p>
              </div>
              <button
                type="button"
                onClick={() => setRegisterModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleRegisterVehicle} className="space-y-4 text-xs">
              {/* Cliente Propietario */}
              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  Cliente Propietario <span className="text-indigo-600">*</span>
                </label>
                <select
                  required
                  value={newVehicleForm.clienteId}
                  onChange={e => setNewVehicleForm({ ...newVehicleForm, clienteId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900"
                >
                  {clientsList.length > 0 ? (
                    clientsList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.documento ? `(CI/RUC: ${c.documento})` : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="1">Juan Pérez (CI: 1803948571)</option>
                      <option value="2">Dra. María Rodríguez (CI: 1802345678)</option>
                      <option value="3">Ing. Carlos Morales (RUC: 1809876543001)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Placa y Año */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-900 mb-1">
                    Placa Vehicular <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: TBA-4521"
                    value={newVehicleForm.placa}
                    onChange={e => setNewVehicleForm({ ...newVehicleForm, placa: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold tracking-wider"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Formato ecuatoriano normalizado</span>
                </div>
                <div>
                  <label className="block font-bold text-slate-900 mb-1">
                    Año de Fabricación <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1980"
                    max={new Date().getFullYear() + 1}
                    required
                    value={newVehicleForm.anio}
                    onFocus={e => { if (e.target.value === '0' || e.target.value === String(new Date().getFullYear())) e.target.select(); }}
                    onChange={e => setNewVehicleForm({ ...newVehicleForm, anio: e.target.value.replace(/^0+(?=\d)/, '') })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Marca y Modelo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-900 mb-1">
                    Marca <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Chevrolet, Toyota, Hyundai"
                    value={newVehicleForm.marca}
                    onChange={e => setNewVehicleForm({ ...newVehicleForm, marca: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-900 mb-1">
                    Modelo <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Sail 1.4 Sedán, Hilux 2.8 D/C"
                    value={newVehicleForm.modelo}
                    onChange={e => setNewVehicleForm({ ...newVehicleForm, modelo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Kilometraje y Color */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-900 mb-1">
                    Kilometraje Inicial (km) <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newVehicleForm.kilometrajeActual}
                    onChange={e => setNewVehicleForm({ ...newVehicleForm, kilometrajeActual: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-900 mb-1">Color</label>
                  <input
                    type="text"
                    placeholder="Ej: Blanco, Plata, Negro, Azul"
                    value={newVehicleForm.color}
                    onChange={e => setNewVehicleForm({ ...newVehicleForm, color: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* VIN / Chasis */}
              <div>
                <label className="block font-bold text-slate-900 mb-1">Número de Chasis (VIN) - Opcional</label>
                <input
                  type="text"
                  placeholder="Ej: 8AG11234XLM09871"
                  value={newVehicleForm.vin}
                  onChange={e => setNewVehicleForm({ ...newVehicleForm, vin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-50 text-white rounded-lg font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>{busy ? 'Registrando...' : 'Registrar Vehículo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
