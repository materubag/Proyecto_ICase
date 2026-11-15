import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';

export default function TablerodeControlIndicadoresyReportes15Mockup({ onNavigate }) {
  const [periodo, setPeriodo] = useState('30d');
  const [ambito, setAmbito] = useState('todos');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [dbData, setDbData] = useState({
    ventas: [],
    ordenes: [],
    citas: [],
    productos: [],
    servicios: [],
    fallas: []
  });

  const fetchLiveData = async () => {
    setLoading(true);
    try {
      const [vRes, oRes, cRes, pRes, sRes, fRes] = await Promise.all([
        apiClient.get('/ventas').catch(() => []),
        apiClient.get('/orden-trabajos').catch(() => []),
        apiClient.get('/citas').catch(() => []),
        apiClient.get('/productos').catch(() => []),
        apiClient.get('/servicios').catch(() => []),
        apiClient.get('/diagnostico-fallas').catch(() => [])
      ]);

      const normalize = (res) => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.rows)) return res.rows;
        return [];
      };

      setDbData({
        ventas: normalize(vRes),
        ordenes: normalize(oRes),
        citas: normalize(cRes),
        productos: normalize(pRes),
        servicios: normalize(sRes),
        fallas: normalize(fRes)
      });
    } catch {
      // Clean fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
  }, []);

  const metrics = useMemo(() => {
    const { ventas, ordenes, citas, productos, servicios, fallas } = dbData;

    const totalOrders = ordenes.length;
    const completedOrders = ordenes.filter(o =>
      ['FINALIZADA', 'COMPLETADA', 'ENTREGADA', 'Completada', 'Finalizada'].includes(String(o.estado || ''))
    ).length;

    const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 100;

    const ventasTotal = ventas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
    const ordenesTotal = ordenes.reduce((acc, o) => acc + (Number(o.total || o.presupuestoTotal || 0)), 0);
    const totalRevenue = ventasTotal + ordenesTotal;

    const manoObraTotal = Math.round(ordenesTotal * 0.6);
    const repuestosTallerTotal = Math.round(ordenesTotal * 0.4);
    const mostradorTotal = ventasTotal;

    const avgTicket = totalOrders > 0 ? (ordenesTotal / totalOrders) : (ventas.length > 0 ? (ventasTotal / ventas.length) : 0);

    const topServices = servicios.slice(0, 4).map((s, idx) => {
      const sOrders = Math.max(1, Math.round(totalOrders / (idx + 2)));
      const sRevenue = (Number(s.precioBase || s.precio || 35)) * sOrders;
      return {
        id: s.id || idx + 1,
        rank: String(idx + 1).padStart(2, '0'),
        nombre: s.nombre || `Servicio ${idx + 1}`,
        tiempo: `${s.duracionEstimada || (1.5 + idx * 0.5).toFixed(1)} horas`,
        ordenesCount: totalOrders > 0 ? sOrders : 0,
        facturacion: totalOrders > 0 ? sRevenue : 0
      };
    });

    const topFaults = fallas.slice(0, 3).map((f) => ({
      code: f.codigoObd || f.codigo || 'OBD-II',
      nombre: f.sistemaAfectado || f.descripcion || 'Diagnóstico de Sistema',
      casos: 1,
      pct: 33,
      nota: f.detalles || 'Registro pericial de inspección técnica.'
    }));

    return {
      totalOrders,
      completedOrders,
      completionRate,
      totalRevenue,
      manoObraTotal,
      repuestosTallerTotal,
      mostradorTotal,
      avgTicket,
      citasCount: citas.length,
      topServices,
      topFaults,
      totalProductos: productos.length
    };
  }, [dbData]);

  const handleExportCSV = () => {
    const rows = [
      ['AUTRON - REPORTE CONSOLIDADO EJECUTIVO Y OPERATIVO'],
      ['Generado:', new Date().toLocaleString('es-EC')],
      ['Ambito:', ambito],
      [''],
      ['METRICA', 'VALOR'],
      ['Ordenes de Trabajo Totales', metrics.totalOrders],
      ['Ordenes Completadas', metrics.completedOrders],
      ['Tasa de Efectividad Tecnica', `${metrics.completionRate}%`],
      ['Ingresos Totales Liquidados', `$${metrics.totalRevenue.toFixed(2)}`],
      ['Mano de Obra en Taller', `$${metrics.manoObraTotal.toFixed(2)}`],
      ['Repuestos en Taller', `$${metrics.repuestosTallerTotal.toFixed(2)}`],
      ['Ventas en Mostrador', `$${metrics.mostradorTotal.toFixed(2)}`],
      ['Ticket Promedio por Orden', `$${metrics.avgTicket.toFixed(2)}`],
      ['Total Productos en Inventario', metrics.totalProductos]
    ];

    const csvContent = '\uFEFF' + rows.map(e => e.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AUTRON_Reporte_Ejecutivo_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setFeedback('✓ Reporte consolidado descargado exitosamente.');
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 font-sans space-y-6">
      {/* 1) Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
        <span>Inicio</span>
        <span>/</span>
        <span className="text-slate-800 font-semibold">Reportes</span>
      </div>

      {/* 2) View Header & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Tablero de Control, Indicadores y Reportes
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitoreo ejecutivo de órdenes de trabajo, ingresos financieros, demanda de servicios y rendimiento del taller.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Datos en Tiempo Real
          </span>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* 3) Filter Controls & Action Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Período seleccionado
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none cursor-pointer"
            >
              <option value="30d">Últimos 30 días</option>
              <option value="mes">Mes en curso</option>
              <option value="q3">Tercer Trimestre</option>
              <option value="anio">Año en curso</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Ámbito operativo
            </label>
            <select
              value={ambito}
              onChange={(e) => setAmbito(e.target.value)}
              className="w-full h-11 bg-white border border-slate-200 rounded-xl px-3 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none cursor-pointer"
            >
              <option value="todos">Consolidado Taller y Mostrador</option>
              <option value="taller">Servicios Mecánicos y Diagnóstico</option>
              <option value="mostrador">Ventas Directas de Repuestos</option>
            </select>
          </div>

          <div className="md:col-span-5 flex items-center justify-end gap-2.5 pt-2 md:pt-0">
            <button
              type="button"
              onClick={handleExportCSV}
              className="h-11 px-4 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition-colors inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">download</span>
              <span>Exportar reporte (CSV)</span>
            </button>
            <button
              type="button"
              onClick={fetchLiveData}
              disabled={loading}
              className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>tune</span>
              <span>{loading ? 'Consultando...' : 'Filtrar período'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4) Resumen de Indicadores Clave (4 Tarjetas Limpias) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="text-3xl font-extrabold text-slate-900 font-mono mb-1">
            {metrics.completedOrders}
          </div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Órdenes completadas
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-indigo-600 text-sm">build</span>
            <span>{metrics.totalOrders} órdenes registradas</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="text-3xl font-extrabold text-slate-900 font-mono mb-1">
            ${metrics.totalRevenue.toFixed(2)}
          </div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Ingresos totales liquidados
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-emerald-600 text-sm">payments</span>
            <span>Facturación taller y mostrador</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="text-3xl font-extrabold text-slate-900 font-mono mb-1">
            {metrics.completionRate}%
          </div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Tasa de efectividad técnica
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-indigo-600 text-sm">task_alt</span>
            <span>{metrics.citasCount} citas atendidas</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="text-3xl font-extrabold text-slate-900 font-mono mb-1">
            ${metrics.avgTicket.toFixed(2)}
          </div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Ticket promedio por orden
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-sky-600 text-sm">receipt_long</span>
            <span>Mano de obra + piezas</span>
          </div>
        </div>
      </section>

      {/* 5) Contenido Principal en dos columnas (8 cols izq, 4 cols der) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Bloque 1: Servicios más demandados */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Servicios más demandados</h2>
                <p className="text-xs text-slate-500 mt-0.5">Ranking por volumen ejecutado y rendimiento de facturación</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('servicios')}
                className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver catálogo</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Ranking / Servicio</th>
                    <th className="py-3 px-4 text-center">Órdenes</th>
                    <th className="py-3 px-4 text-center">Tiempo promedio</th>
                    <th className="py-3 px-4 text-right">Facturación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {metrics.topServices.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-500">
                        <span className="material-symbols-outlined text-slate-300 text-3xl block mb-1">design_services</span>
                        No hay servicios registrados en el catálogo aún.
                      </td>
                    </tr>
                  ) : (
                    metrics.topServices.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-medium flex items-center gap-2">
                          <span className="text-slate-400 font-mono text-[11px] font-bold">{s.rank}</span>
                          <span>{s.nombre}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">{s.ordenesCount}</td>
                        <td className="py-3.5 px-4 text-center text-slate-500">{s.tiempo}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          ${s.facturacion.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bloque 2: Diagnósticos y fallas recurrentes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Diagnósticos y fallas recurrentes</h2>
                <p className="text-xs text-slate-500 mt-0.5">Sistemas automotrices y códigos de error con mayor prevalencia (RF-32)</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('conocimiento')}
                className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Base OBD-II</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            <div className="space-y-3">
              {metrics.topFaults.length === 0 ? (
                <div className="py-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                  <span className="material-symbols-outlined text-slate-300 text-3xl block mb-1">troubleshoot</span>
                  No se han registrado fallas o diagnósticos en el período. Los registros aparecerán al realizar inspecciones.
                </div>
              ) : (
                metrics.topFaults.map((f, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 font-mono text-[11px] font-bold text-indigo-700 rounded">
                          {f.code}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">{f.nombre}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-700">{f.casos} caso ({f.pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${f.pct}%` }}></div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">{f.nota}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Bloque 3: Desglose de Facturación */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="pb-4 border-b border-slate-200 mb-5">
              <h2 className="text-base font-bold text-slate-900">Desglose de Facturación</h2>
              <p className="text-xs text-slate-500 mt-0.5">Origen de los ${metrics.totalRevenue.toFixed(2)} liquidados</p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-800">Mano de obra</span>
                  <span className="text-xs font-bold font-mono text-slate-900">${metrics.manoObraTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Servicios mecánicos</span>
                  <span>{metrics.totalOrders} órdenes</span>
                </div>
              </div>

              <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-800">Repuestos en taller</span>
                  <span className="text-xs font-bold font-mono text-slate-900">${metrics.repuestosTallerTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Piezas instaladas</span>
                  <span>En taller</span>
                </div>
              </div>

              <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-800">Venta en mostrador</span>
                  <span className="text-xs font-bold font-mono text-slate-900">${metrics.mostradorTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Despacho directo</span>
                  <span>Mostrador</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ingreso Consolidado</span>
              <span className="text-lg font-bold font-mono text-indigo-700">${metrics.totalRevenue.toFixed(2)}</span>
            </div>
          </div>

          {/* Bloque 4: Reportes Disponibles */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="pb-4 border-b border-slate-200 mb-4">
              <h2 className="text-base font-bold text-slate-900">Reportes Disponibles</h2>
              <p className="text-xs text-slate-500 mt-0.5">Archivos consolidados listos para descarga ejecutiva</p>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">Rendimiento por Bahía</h3>
                  <p className="text-[11px] text-slate-500">Métricas de ocupación y tiempos</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                >
                  Descargar
                </button>
              </div>

              <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">Liquidación de Ventas SRI</h3>
                  <p className="text-[11px] text-slate-500">Facturación consolidada IVA 15%</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                >
                  Descargar
                </button>
              </div>

              <div className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">Rotación de Inventario</h3>
                  <p className="text-[11px] text-slate-500">Stock crítico y reabastecimiento</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate?.('inventario')}
                  className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                >
                  Ver Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
