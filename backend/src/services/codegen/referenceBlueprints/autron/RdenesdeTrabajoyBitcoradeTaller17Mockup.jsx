import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function RdenesdeTrabajoyBitcoradeTaller17Mockup({ onNavigate }) {
  const PHASES = [
    { label: 'En bahía', value: 'EN_REPARACION' },
    { label: 'En pruebas', value: 'EN_PRUEBAS' },
    { label: 'Lavado final', value: 'LAVADO' },
    { label: 'Finalizada', value: 'FINALIZADA' }
  ];
  const phaseLabel = (estado) => PHASES.find((phase) => phase.value === estado)?.label || (estado === 'CREADA' ? 'Aprobada, lista para iniciar' : estado || 'Sin fase');

  const [selectedOrder, setSelectedOrder] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [activity, setActivity] = useState('');
  const [mechanics, setMechanics] = useState({});
  const [notes, setNotes] = useState('');

  const [ordersList, setOrdersList] = useState([]);
  const [mechanicOptions, setMechanicOptions] = useState([]);
  const [selectedMechanics, setSelectedMechanics] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiClient.get('/workshop-flow/ordenes').catch(() => []),
      apiClient.get('/vehiculos').catch(() => []),
      apiClient.get('/workshop-flow/mecanicos').catch(() => [])
    ]).then(([oRes, vRes, mRes]) => {
      if (!mounted) return;
      const oList = Array.isArray(oRes) ? oRes : (oRes?.data || []);
      const vList = Array.isArray(vRes) ? vRes : (vRes?.data || []);
      const mList = Array.isArray(mRes) ? mRes : (mRes?.data || []);
      setMechanicOptions(mList);

      const mappedOrders = oList.map(o => {
        const veh = vList.find(v => Number(v.id) === Number(o.vehiculoId || 0)) || {};
        return {
          id: o.id,
          orderKey: `ORD-${String(o.id).padStart(3, '0')}`,
          plate: o.placa || veh.placa || 'Sin placa',
          model: `${o.marca || veh.marca || ''} ${o.modelo || veh.modelo || ''}`.trim() || 'Vehículo',
          km: o.kilometraje ? `${Number(o.kilometraje).toLocaleString()} km` : 'Sin km',
          status: phaseLabel(o.estado),
          estado: o.estado,
          mechanic: o.mecanicoNombre || 'Mecánico asignado',
          bay: 'Bahía asignada en recepción',
          repuestos: Array.isArray(o.repuestos) ? o.repuestos : []
        };
      });

      setOrdersList(mappedOrders);
      if (mappedOrders[0]) {
        setSelectedOrder(mappedOrders[0].orderKey);
        setCurrentStatus(mappedOrders[0].status);
      }
    });

    return () => { mounted = false; };
  }, []);

  const [tests, setTests] = useState({
    frenadoDinamico: true,
    escaneoOBDFinal: true,
    inspeccionFugas: true
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const toggleMech = (key) => setMechanics(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleTest = (key) => setTests(prev => ({ ...prev, [key]: !prev[key] }));

  const activeOrderObj = ordersList.find(o => o.orderKey === selectedOrder) || ordersList[0] || null;

  const handleSaveActivity = async () => {
    setSaving(true);
    setSuccessMsg('');
    const targetOrder = ordersList.find(o => o.orderKey === selectedOrder) || ordersList[0];
    if (!targetOrder?.id) {
      setSuccessMsg('No hay una orden aprobada.');
      setSaving(false);
      return;
    }
    try {
      const role = JSON.parse(localStorage.getItem('user') || '{}').role;
      if (selectedMechanics.length && role !== 'Mecánico') {
        await apiClient.post('/workshop-flow/ordenes/mecanicos', {
          ordenTrabajoId: Number(targetOrder.id),
          mecanicoIds: selectedMechanics.map(Number)
        });
      }
      const pruebas = Object.entries(tests).filter(([, value]) => value).map(([key]) => key).join(', ');
      await apiClient.post('/workshop-flow/ordenes/consumo', {
        ordenTrabajoId: Number(targetOrder.id),
        descripcion: activity,
        observaciones: notes,
        pruebas
      });
      setSuccessMsg('Actividad registrada. El stock no cambia hasta finalizar la orden.');
    } catch (err) {
      setSuccessMsg(err.details?.message || err.message || 'No se pudo registrar la actividad.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (phase) => {
    const targetOrder = ordersList.find(o => o.orderKey === selectedOrder) || ordersList[0];
    if (!targetOrder?.id) {
      setSuccessMsg('No hay una orden aprobada. El cliente debe autorizar la cotización antes de cambiar la fase.');
      return;
    }
    setSaving(true);
    try {
      const result = await apiClient.post('/workshop-flow/fase', {
        ordenTrabajoId: Number(targetOrder.id),
        fase: phase.value
      });
      setCurrentStatus(phase.label);
      setOrdersList((current) => current.map((order) => order.id === targetOrder.id ? { ...order, status: phase.label, estado: result.estado } : order));
      setSuccessMsg(phase.value === 'FINALIZADA'
        ? 'Orden finalizada. El stock de los repuestos aprobados se descontó una sola vez y el cliente recibió el aviso.'
        : `Fase actualizada a ${phase.label}. El stock no cambió.`);
    } catch (err) {
      setSuccessMsg(err.details?.message || err.message || 'No se pudo cambiar la fase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12">
      {/* Context Bar */}
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-medium">
              <span>Taller Central</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Operaciones de Taller</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-indigo-600 font-semibold">Órdenes de Trabajo y Bitácora (RF-17 a RF-19)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Órdenes de Trabajo y Bitácora de Taller
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Registro en tiempo real de actividades técnicas, mecánicos asignados, consumo de inventario y control de pruebas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate?.('diagnosticos')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">biotech</span>
              Ver Diagnóstico Asociado
            </button>
            <button
              onClick={() => onNavigate?.('inventario')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-900 border border-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              Ver Stock Repuestos
            </button>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Active Order Hero Strip */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-l-indigo-600">
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-500">Orden</span>
              <span className="font-mono bg-slate-50 px-2 py-0.5 rounded font-bold text-slate-900 border border-slate-200">
                {activeOrderObj?.orderKey}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-base">directions_car</span>
              <span className="font-mono font-bold text-slate-900">{activeOrderObj?.plate}</span>
              <span className="text-slate-500">({activeOrderObj?.model})</span>
            </div>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <span className="material-symbols-outlined text-slate-500 text-base">engineering</span>
              <span className="text-slate-900">Mecánico: <strong>{activeOrderObj?.mechanic}</strong></span>
            </div>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4 text-slate-500">
              <span>{activeOrderObj?.km}</span>
              <span>·</span>
              <span className="font-semibold text-indigo-600">{activeOrderObj?.bay}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              {currentStatus}
            </span>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center gap-2 shadow-xs">
            <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: 7 cols */}
          <section className="lg:col-span-7 space-y-5">
            {/* 1. Selector de Orden */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <label htmlFor="orden-select" className="block text-xs font-bold text-slate-900 mb-1">
                Seleccionar Orden de Trabajo Activa
              </label>
              <select
                id="orden-select"
                value={selectedOrder}
                onChange={e => {
                  setSelectedOrder(e.target.value);
                  const matched = ordersList.find(o => o.orderKey === e.target.value);
                  if (matched) setCurrentStatus(matched.status);
                }}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                {ordersList.map(o => (
                  <option key={o.orderKey} value={o.orderKey}>
                    {o.orderKey} · {o.plate} ({o.model} · {o.mechanic})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Registro de Actividad Técnica */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">engineering</span>
                  Registro de Actividad Técnica
                </h2>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Paso 1: Bitácora
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Actividad Ejecutada</label>
                <select
                  value={activity}
                  onChange={e => setActivity(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option>Desmontaje y reemplazo de pastillas de freno delanteras</option>
                  <option>Purga de líquido de frenos y prueba de presión hidráulica</option>
                  <option>Inspección de discos y calibración de mordazas</option>
                  <option>Afinamiento y cambio de filtros / aceite sintético</option>
                  <option>Rotación y balanceo de neumáticos</option>
                </select>
              </div>

              {/* Mecánicos Asignados (RF-18) */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  Mecánicos Asignados a la Tarea (RF-18)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mechanics.luisMora}
                      onChange={() => toggleMech('luisMora')}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <strong className="block text-slate-900">Luis Mora</strong>
                      <span className="text-[10px] text-slate-500">Técnico Titular (Nivel 3)</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mechanics.carlosMendez}
                      onChange={() => toggleMech('carlosMendez')}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <strong className="block text-slate-900">Carlos Méndez</strong>
                      <span className="text-[10px] text-slate-500">Técnico de Apoyo (Frenos)</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="notas-mecanico" className="block text-xs font-bold text-slate-900 mb-1">
                  Notas de Ejecución y Par de Apriete
                </label>
                <textarea
                  id="notas-mecanico"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                />
              </div>
            </div>

            {/* 3. Repuestos Consumidos (RF-19 & RF-23: Descuento Automático) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-600">inventory_2</span>
                    Repuestos a utilizar
                  </h2>
                  <p className="text-[11px] text-slate-500">El stock se descuenta una sola vez, al marcar la orden como Finalizada.</p>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Paso 2: Inventario
                </span>
              </div>

              <div className="space-y-2">
                {(activeOrderObj?.repuestos || []).length === 0 ? (
                  <p className="text-xs text-slate-500">Esta orden no tiene repuestos aprobados en la cotización.</p>
                ) : activeOrderObj.repuestos.map((part) => (
                  <div key={part.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <strong className="block text-slate-900">{part.nombre}</strong>
                      <span className="text-[11px] text-slate-500 font-mono">{part.codigo || 'Sin código'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Cantidad aprobada</span>
                      <strong className="font-mono text-indigo-600">{part.cantidad} un.</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Pruebas de Calidad */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">verified</span>
                Pruebas de Funcionamiento y Control de Calidad
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {[
                  { key: 'frenadoDinamico', label: 'Prueba de frenado dinámico' },
                  { key: 'escaneoOBDFinal', label: 'Escaneo OBD final (0 DTCs)' },
                  { key: 'inspeccionFugas', label: 'Inspección de estanqueidad' }
                ].map(t => (
                  <label
                    key={t.key}
                    onClick={() => toggleTest(t.key)}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={tests[t.key]}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-900">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Right Summary: 5 cols */}
          <aside className="lg:col-span-5 flex flex-col gap-5 sticky top-20">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
                Control de Orden y Estado
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Estado actual:</span>
                  <span className="font-bold text-indigo-600">{currentStatus}</span>
                </div>
                <label className="block text-xs font-semibold">Mecánicos de la orden
                  <select multiple value={selectedMechanics} onChange={(e) => setSelectedMechanics(Array.from(e.target.selectedOptions).map((option) => option.value))} className="mt-1 w-full border border-slate-200 rounded-lg p-2">
                    {mechanicOptions.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                  </select>
                </label>
                <div className="py-1">
                  <span className="block text-xs font-semibold text-slate-900">Repuestos a utilizar</span>
                  {(activeOrderObj?.repuestos || []).length === 0 ? (
                    <p className="mt-1 text-[11px] text-slate-500">Esta orden no tiene repuestos aprobados en la cotización.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {activeOrderObj.repuestos.map((part) => (
                        <li key={part.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <span className="text-slate-900">{part.codigo ? `${part.codigo} · ` : ''}{part.nombre}</span>
                          <span className="font-mono text-indigo-600 whitespace-nowrap">{part.cantidad} un.</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">Guardar la actividad no descuenta stock. El descuento ocurre una sola vez al finalizar.</p>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Trazabilidad en historial:</span>
                  <span className="text-emerald-700 font-semibold">Sincronizada (RF-27)</span>
                </div>
              </div>

              {/* Status Update Buttons */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Cambiar Fase de Trabajo
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {PHASES.map(st => (
                    <button
                      key={st.value}
                      type="button"
                      disabled={saving}
                      onClick={() => handleUpdateStatus(st)}
                      className={`p-2 rounded-lg font-bold border transition-colors ${
                        currentStatus === st.label
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-100 text-slate-900 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveActivity}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-50 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>{saving ? 'Registrando...' : 'Guardar Actividad en Bitácora'}</span>
                </button>
                <p className="text-[10px] text-slate-500 text-center mt-2">
                  Al completar y finalizar la orden, se archivará automáticamente en el Expediente Digital del vehículo (RF-27).
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
