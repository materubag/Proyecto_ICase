import React, { useState } from 'react';

export default function Indicadoresoperativos18Mockup({ onNavigate }) {
  const [fechaDesde, setFechaDesde] = useState('2024-10-01');
  const [fechaHasta, setFechaHasta] = useState('2024-11-05');
  const [filtroTipo, setFiltroTipo] = useState('mensual');
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleConsultar = (e) => {
    e.preventDefault();
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setFeedback(`✓ Indicadores recalculados para el periodo [ ${fechaDesde} al ${fechaHasta} ] (RF-33).`);
      setTimeout(() => setFeedback(null), 4000);
    }, 600);
  };

  const handleExport = (tipo) => {
    setFeedback(`✓ Exportando reporte consolidado en formato ${tipo.toUpperCase()}...`);
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
              Módulo 11 · Analítica y Reportes
            </span>
            <span className="text-xs text-slate-500 font-medium">RF-32 · RF-33 Indicadores de Operación</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Indicadores Operativos del Taller</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Filtros cronológicos, productividad por bahía técnica, volumen de ventas y diagnóstico de fallas recurrentes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('excel')}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold text-xs text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-emerald-600">table_chart</span>
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Descargar Informe PDF
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600">verified</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* Date Range Query Filter Bar (RF-33) */}
      <form onSubmit={handleConsultar} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 text-xs">
            <div>
              <label className="block font-semibold text-slate-900 mb-1">Fecha Desde (incluida) *</label>
              <input
                type="date"
                required
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-900 mb-1">Fecha Hasta (excluida) *</label>
              <input
                type="date"
                required
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-900 mb-1">Agrupación Temporal</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
              >
                <option value="diario">Por Día</option>
                <option value="semanal">Por Semana</option>
                <option value="mensual">Por Mes (Recomendado)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={generating}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">
              {generating ? 'sync' : 'search'}
            </span>
            {generating ? 'Calculando...' : 'Consultar Indicadores'}
          </button>
        </div>
      </form>

      {/* Operational KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Citas Agendadas vs Ejecutadas</span>
            <span className="material-symbols-outlined text-indigo-600 text-[18px]">event_available</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">128 citas</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <span>92.2% tasa de cumplimiento</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">10 canceladas / 118 atendidas</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Órdenes de Trabajo (OT)</span>
            <span className="material-symbols-outlined text-amber-600 text-[18px]">build</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">94 órdenes</div>
          <div className="text-xs text-amber-700 font-semibold mt-1">
            87 finalizadas · 7 en proceso
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Tiempo medio: 4.2h por vehículo</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Facturación Consolidada</span>
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">attach_money</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">$18,450.00</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">
            +14.3% vs periodo anterior
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Taller: 72% · Mostrador: 28%</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Ticket Promedio por Auto</span>
            <span className="material-symbols-outlined text-indigo-600 text-[18px]">receipt</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">$196.28</div>
          <div className="text-xs text-indigo-600 font-semibold mt-1">
            Repuestos + Mano de obra
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Margen promedio: 38.5%</div>
        </div>
      </div>

      {/* Two Columns: Frequent Vehicle Faults (RF-32) + Mechanic Productivity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RF-32: Frequent Faults & OBD Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-[20px]">troubleshoot</span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Averías y Fallas Más Frecuentes (RF-32)</h3>
                <p className="text-xs text-slate-500">Desglose porcentual y correlación con base OBD-II</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate?.('conocimiento')}
              className="text-xs text-indigo-600 font-bold hover:underline"
            >
              Base OBD-II &rarr;
            </button>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-900">Sistema de Frenado (Desgaste pastillas & discos)</span>
                <span className="font-mono text-indigo-600 font-bold">34% (48 casos)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: '34%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-900">Fallas de Ignición / Bujías (OBD: P0301, P0300)</span>
                <span className="font-mono text-amber-600 font-bold">26% (37 casos)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: '26%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-900">Sistema de Suspensión y Amortiguadores</span>
                <span className="font-mono text-indigo-600 font-bold">18% (25 casos)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: '18%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-900">Catalizador y Mezcla Pobre (OBD: P0420, P0171)</span>
                <span className="font-mono text-sky-600 font-bold">14% (20 casos)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-sky-500 h-2.5 rounded-full" style={{ width: '14%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-900">Refrigeración / Bomba de agua y fugas</span>
                <span className="font-mono text-rose-600 font-bold">8% (11 casos)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-rose-500 h-2.5 rounded-full" style={{ width: '8%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Productivity Ranking by Technician */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-[20px]">engineering</span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Productividad de Mecánicos de Taller</h3>
                <p className="text-xs text-slate-500">Eficiencia en bahías y horas estándar completadas</p>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-600 font-bold">96% Eficacia Global</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
                  CM
                </div>
                <div>
                  <div className="font-bold text-slate-900">Carlos Mecánico (Bahía 1)</div>
                  <div className="text-[11px] text-slate-500">Especialista Motor & Diagnóstico</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold font-mono text-slate-900">36 órdenes (148h)</div>
                <div className="text-[11px] text-emerald-600 font-semibold">98.5% puntualidad</div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs">
                  FO
                </div>
                <div>
                  <div className="font-bold text-slate-900">Fernando Ortiz (Bahía 2)</div>
                  <div className="text-[11px] text-slate-500">Especialista Frenos & Suspensión</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold font-mono text-slate-900">31 órdenes (124h)</div>
                <div className="text-[11px] text-emerald-600 font-semibold">96.0% puntualidad</div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-xs">
                  MT
                </div>
                <div>
                  <div className="font-bold text-slate-900">Mario Tapia (Bahía 3)</div>
                  <div className="text-[11px] text-slate-500">Mantenimiento Rápido y Fluidos</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold font-mono text-slate-900">27 órdenes (96h)</div>
                <div className="text-[11px] text-emerald-600 font-semibold">94.8% puntualidad</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
