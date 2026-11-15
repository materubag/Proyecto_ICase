import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function Misnotificaciones20Mockup({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'taller' | 'inventario'

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiClient.get('/workshop-flow/notificaciones').catch(() => []),
      apiClient.get('/workshop-flow/alertas').catch(() => [])
    ]).then(([res, alerts]) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        const alertRows = (Array.isArray(alerts) ? alerts : []).map((alert) => ({
          id: `alerta-${alert.id}`,
          tipo: 'inventario',
          icono: 'warning',
          titulo: alert.tipoAlerta || 'Alerta',
          mensaje: alert.mensaje,
          fecha: alert.fechaGeneracion ? new Date(alert.fechaGeneracion).toLocaleString('es-EC') : 'Reciente',
          leida: alert.estado === 'LEIDA',
          color: 'text-error bg-error-container/30 border-error-container',
          destino: 'inventario'
        }));
        if (mounted) {
          setNotifications([...alertRows, ...list.map(n => ({
            id: n.id,
            tipo: n.tipo === 'cotizacion' ? 'cliente' : (n.tipo || 'taller'),
            icono: n.tipo === 'cotizacion' ? 'request_quote' : 'build_circle',
            titulo: n.titulo || 'Aviso del taller',
            mensaje: n.mensaje || 'Actualización del taller.',
            fecha: n.fechaCreacion ? new Date(n.fechaCreacion).toLocaleString('es-EC') : 'Reciente',
            leida: n.leida === true || n.estado === 'LEIDA',
            color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
            destino: n.tipo === 'cotizacion' ? 'cotizacionesCliente' : 'reparaciones'
          }))]);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleMarkAsRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, leida: true } : n));
    apiClient.post(`/workshop-flow/notificaciones/${id}/leida`).catch(() => {});
  };

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, leida: true })));
  };

  const filtered = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.leida;
    if (filter !== 'ALL') return n.tipo === filter;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.leida).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
              Módulo 10 · Notificaciones y Alertas
            </span>
            <span className="text-xs text-slate-500 font-medium">RF-28 · RF-29 Trazabilidad y Mantenimiento</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Centro de Notificaciones y Avisos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitoreo en tiempo real de eventos de taller, presupuestos, alertas de inventario y recordatorios automáticos.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-indigo-600 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">done_all</span>
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'ALL'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
          }`}
        >
          Todas ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('UNREAD')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
            filter === 'UNREAD'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <span>No leídas</span>
          {unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-error text-white text-[10px] inline-flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setFilter('taller')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'taller'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
          }`}
        >
          Taller y Reparaciones
        </button>
        <button
          type="button"
          onClick={() => setFilter('inventario')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'inventario'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
          }`}
        >
          Alertas de Stock
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
            <span className="material-symbols-outlined text-[48px] text-slate-500 mb-2">notifications_off</span>
            <p className="font-semibold text-sm">No tienes notificaciones en este filtro.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                item.leida
                  ? 'bg-white border-slate-200 opacity-90'
                  : 'bg-white border-indigo-400 shadow-xs ring-1 ring-indigo-500'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.color}`}>
                  <span className="material-symbols-outlined text-[22px]">{item.icono}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{item.titulo}</h3>
                    {!item.leida && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-3xl">
                    {item.mensaje}
                  </p>
                  <span className="text-[11px] font-mono text-slate-500 mt-1 block">
                    {item.fecha}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {!item.leida && (
                  <button
                    type="button"
                    onClick={() => handleMarkAsRead(item.id)}
                    title="Marcar como leída"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span className="hidden sm:inline">Leída</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate?.(item.destino)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center gap-1 transition-colors"
                >
                  <span>Ver detalle</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
