import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

function QuotePhoto({ url }) {
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
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Foto no disponible'));
        reader.readAsDataURL(blob);
      }))
      .then((dataUrl) => { if (active) setSource(String(dataUrl || '')); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [url]);
  if (failed) return <span className="text-xs text-error">No se pudo abrir la foto.</span>;
  if (!source) return <span className="text-xs text-slate-500">Cargando foto...</span>;
  return (
    <a href={source} target="_blank" rel="noreferrer">
      <img src={source} alt="Evidencia de la cotización" className="h-40 w-56 object-cover rounded-lg border border-slate-200 bg-white" />
    </a>
  );
}

function mapQuote(quote) {
  const lines = quote?.items || [];
  return {
    services: lines.filter((item) => item.tipoItem === 'SERVICIO').map((item) => ({
      id: item.id,
      name: item.descripcion,
      desc: `Cantidad ${item.cantidad}`,
      price: Number(item.subtotal),
      tax: Number(item.impuesto || 0),
      hours: `${item.cantidad}`,
      selected: item.estadoAprobacion !== 'RECHAZADO'
    })),
    parts: lines.filter((item) => item.tipoItem !== 'SERVICIO').map((item) => ({
      id: item.id,
      name: item.descripcion,
      code: item.codigo || '—',
      tag: 'Repuesto',
      price: Number(item.subtotal),
      tax: Number(item.impuesto || 0),
      selected: item.estadoAprobacion !== 'RECHAZADO'
    }))
  };
}

export default function PortalClienteAprobacindePresupuestos9Mockup({ onNavigate }) {
  const [quotes, setQuotes] = useState([]);
  const [activeQuote, setActiveQuote] = useState(null);
  const [services, setServices] = useState([]);
  const [parts, setParts] = useState([]);
  const [decisionMade, setDecisionMade] = useState(null);
  const [decisionDate, setDecisionDate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const applyQuote = (quote) => {
    const mapped = mapQuote(quote);
    setActiveQuote(quote);
    setServices(mapped.services);
    setParts(mapped.parts);
    const closed = quote && ['APROBADA', 'APROBADA_PARCIALMENTE', 'RECHAZADA'].includes(quote.estado);
    setDecisionMade(closed ? quote.estado : null);
    setDecisionDate(quote?.fechaDecision ? new Date(quote.fechaDecision).toLocaleString('es-EC') : null);
  };

  useEffect(() => {
    let mounted = true;
    apiClient.get('/workshop-flow/cotizaciones')
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (!mounted) return;
        setQuotes(list);
        const pending = list.find((quote) => quote.estado === 'ENVIADA') || list[0];
        if (pending) applyQuote(pending);
      })
      .catch((err) => { if (mounted) setError(err.message || 'No se pudieron cargar las cotizaciones.'); });
    return () => { mounted = false; };
  }, []);

  const togglePart = (id) => {
    if (decisionMade) return;
    setParts(parts.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  };
  const toggleService = (id) => {
    if (decisionMade) return;
    setServices(services.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const selectedServices = services.filter((item) => item.selected);
  const selectedParts = parts.filter((item) => item.selected);
  const servicesTotal = selectedServices.reduce((acc, item) => acc + item.price, 0);
  const partsSelectedTotal = selectedParts.reduce((acc, item) => acc + item.price, 0);
  const subtotal = servicesTotal + partsSelectedTotal;
  const tax = [...selectedServices, ...selectedParts].reduce((acc, item) => acc + (item.tax || 0), 0);
  const total = subtotal + tax;
  const allSelected = services.every((item) => item.selected) && parts.every((item) => item.selected);

  const handleDecision = async (type) => {
    if (!activeQuote) return;
    setBusy(true);
    setError('');
    const selectedIds = [...selectedServices, ...selectedParts].map((item) => item.id);
    try {
      const result = await apiClient.post('/workshop-flow/decision', {
        cotizacionId: activeQuote.id,
        decision: type === 'RECHAZADA' ? 'RECHAZAR' : type === 'PARCIAL' ? 'APROBAR_PARCIALMENTE' : 'APROBAR',
        itemsAprobadosIds: selectedIds
      });
      setDecisionMade(result.estado || type);
      setDecisionDate(new Date().toLocaleString('es-EC'));
    } catch (err) {
      setError(err.details?.message || err.message || 'No se pudo registrar la decisión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12">
      {/* Context Bar */}
      <div className="bg-white border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>Portal Cliente</span>
          <span>/</span>
          <span className="text-indigo-600 font-semibold">Presupuestos y Cotizaciones</span>
          <span>/</span>
          <strong className="text-slate-900 font-mono">{activeQuote ? `#COT-${activeQuote.id}` : 'Sin cotización'}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mr-1.5"></span>
            {decisionMade ? (decisionMade === 'RECHAZADA' ? 'Rechazado' : 'Aprobado') : 'Revisión Pendiente (Cliente)'}
          </span>
          <span className="text-slate-500 text-[11px]">Vigencia: 7 días hábiles</span>
        </div>
      </div>

      <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Decision Banner if already approved / rejected */}
        {decisionMade && (
          <div className={`p-4 rounded-xl border flex items-center justify-between shadow-xs ${
            decisionMade === 'RECHAZADA' || decisionMade === 'RECHAZAR'
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">
                {decisionMade === 'RECHAZADA' || decisionMade === 'RECHAZAR' ? 'cancel' : 'verified'}
              </span>
              <div>
                <strong className="block text-sm font-bold">
                  {(decisionMade === 'TOTAL' || decisionMade === 'APROBADA') && 'Presupuesto aprobado en su totalidad'}
                  {(decisionMade === 'PARCIAL' || decisionMade === 'APROBADA_PARCIALMENTE') && 'Presupuesto aprobado parcialmente'}
                  {(decisionMade === 'RECHAZADA' || decisionMade === 'RECHAZAR') && 'Presupuesto rechazado'}
                </strong>
                <span className="text-xs">
                  Decisión registrada el {decisionDate} por el cliente titular. Solo los ítems autorizados pasan a la Orden de Trabajo.
                </span>
              </div>
            </div>
            <button
              onClick={() => onNavigate?.('progresoReparacion')}
              className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-50 transition-colors"
            >
              Ver Seguimiento
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Quote Details (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* 1. Header Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    Cotización {activeQuote ? `#COT-${activeQuote.id}` : ''} {activeQuote?.placa ? `· ${activeQuote.placa}` : ''}
                  </h1>
                  <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap gap-4">
                    <span>{activeQuote?.vehiculo || 'Vehículo del taller'}</span>
                    {quotes.length > 1 && (
                      <select
                        value={activeQuote?.id || ''}
                        onChange={(event) => applyQuote(quotes.find((quote) => String(quote.id) === event.target.value))}
                        className="border border-slate-200 rounded px-2 py-1"
                      >
                        {quotes.map((quote) => (
                          <option key={quote.id} value={quote.id}>COT-{quote.id} · {quote.estado} · {quote.placa}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Asesor Asignado</span>
                  <span className="text-xs font-bold text-slate-900">Ing. Roberto Salcedo</span>
                </div>
              </div>

              {/* Associated Diagnostic Hint */}
              <div className="mt-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex items-start gap-2.5 text-xs">
                <span className="material-symbols-outlined text-indigo-600 text-lg mt-0.5">assignment</span>
                <div>
                  <strong className="block font-bold text-slate-900">Diagnóstico Técnico Asociado</strong>
                  <p className="text-slate-500 mt-0.5">
                    {activeQuote?.observaciones || 'El mecánico todavía no envía una cotización para tus vehículos.'}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <strong className="text-sm text-slate-900">Evidencia del vehículo ({(activeQuote?.evidencias || []).length})</strong>
                {(activeQuote?.evidencias || []).length === 0 ? (
                  <p className="text-xs text-slate-500">Esta cotización no tiene fotos.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {activeQuote.evidencias.map((photo) => <QuotePhoto key={photo.id} url={photo.url} />)}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Labor & Services */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-lg">handyman</span>
                  <h2 className="text-sm font-bold text-slate-900">Mano de Obra y Servicios Especializados</h2>
                </div>
                <span className="font-mono font-bold text-xs text-indigo-600">${servicesTotal.toFixed(2)}</span>
              </div>
              <div className="divide-y divide-slate-200">
                {services.length === 0 && <p className="p-4 text-xs text-slate-500">Esta cotización no incluye servicios.</p>}
                {services.map(svc => (
                  <label key={svc.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={svc.selected} disabled={!!decisionMade} onChange={() => toggleService(svc.id)} className="mt-0.5" />
                      <div>
                        <strong className="block font-semibold text-slate-900">{svc.name}</strong>
                        <span className="text-slate-500 text-[11px]">{svc.desc}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">${svc.price.toFixed(2)}</span>
                      <span className="block text-[10px] text-slate-500">{svc.hours}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 3. Parts & Materials with Partial Selection (RF-15) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-lg">inventory_2</span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Repuestos Originales y Materiales</h2>
                    <span className="text-[10px] text-slate-500">Marque o desmarque ítems para autorización parcial</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs text-indigo-600">${partsSelectedTotal.toFixed(2)}</span>
              </div>
              <div className="divide-y divide-slate-200">
                {parts.map(part => (
                  <label
                    key={part.id}
                    className={`p-4 flex items-center justify-between text-xs cursor-pointer select-none transition-colors ${
                      part.selected ? 'bg-indigo-50/60 hover:bg-indigo-50' : 'bg-white opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={part.selected}
                        disabled={!!decisionMade}
                        onChange={() => togglePart(part.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="font-semibold text-slate-900">{part.name}</strong>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-500">
                            {part.tag}
                          </span>
                        </div>
                        <span className="text-slate-500 text-[11px]">Código OEM: {part.code}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">${part.price.toFixed(2)}</span>
                      <span className="block text-[10px] text-emerald-700 font-medium">En stock</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Financial Summary & Actions (4 cols) */}
          <aside className="lg:col-span-4 flex flex-col gap-5 sticky top-20">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
                Desglose Económico
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Mano de obra ({selectedServices.length} servicios):</span>
                  <span className="font-mono text-slate-900">${servicesTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Repuestos ({selectedParts.length} autorizados):</span>
                  <span className="font-mono text-slate-900">${partsSelectedTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-slate-900 font-semibold">
                  <span>Subtotal Neto:</span>
                  <span className="font-mono">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>IVA Ecuador (15%):</span>
                  <span className="font-mono text-slate-900">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t-2 border-slate-200 text-base font-bold text-indigo-600">
                  <span>Total a Pagar:</span>
                  <span className="font-mono">${total.toFixed(2)}</span>
                </div>
              </div>

              {error && <p className="text-xs text-error">{error}</p>}
              {!activeQuote ? (
                <p className="text-xs text-slate-500">Cuando el mecánico envíe el diagnóstico, la cotización aparecerá aquí.</p>
              ) : !decisionMade ? (
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDecision('TOTAL')}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-50 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span>Aprobar Presupuesto Completo</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy || allSelected || selectedServices.length + selectedParts.length === 0}
                    onClick={() => handleDecision('PARCIAL')}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-indigo-600 font-bold rounded-lg text-xs border border-indigo-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-base">checklist_rtl</span>
                    <span>Aprobar Selección Parcial (RF-15)</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDecision('RECHAZADA')}
                    className="w-full py-2 bg-transparent hover:bg-error-container/30 text-error font-semibold rounded-lg text-xs border border-error/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                    <span>Rechazar Presupuesto</span>
                  </button>

                  <p className="text-[10px] text-slate-500 text-center mt-1">
                    Solo los ítems autorizados pasarán automáticamente a la orden de trabajo según la regla de negocio 5.3.
                  </p>
                </div>
              ) : (
                <div className="pt-2">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs">
                    <span className="material-symbols-outlined text-emerald-600 text-lg mb-1">lock</span>
                    <strong className="block text-slate-900">Cotización Cerrada</strong>
                    <span className="text-[10px] text-slate-500">Decisión guardada con registro de auditoría RF-16.</span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
