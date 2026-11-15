import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function BasedeConocimientoTcnicoOBD2Mockup({ onNavigate }) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newProposal, setNewProposal] = useState({ codigo: '', sintomas: '', causas: '', solucion: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [articles, setArticles] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [official, setOfficial] = useState({ codigo: '', sintoma: '', causa: '', solucion: '', componente: '' });
  const isAdmin = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').role === 'Administrador'; } catch { return false; } })();

  useEffect(() => {
    let mounted = true;
    apiClient.get('/workshop-flow/conocimiento')
      .then(res => {
        const list = Array.isArray(res) ? res : [...(res?.catalogo || []), ...(res?.casos || [])];
        if (mounted && list && list.length > 0) {
          setArticles(list.map(o => ({
            id: o.id,
            code: o.codigo,
            title: `Código OBD-II ${o.codigo}: ${o.sintoma || 'Falla Electrónica'}`,
            system: o.componente || 'Sistema Motor',
            component: o.componente || 'Sensores y Actuadores',
            severity: 'Alta',
            severityColor: 'bg-red-100 text-red-800 border-red-300',
            symptoms: [o.sintoma || 'Luz Check Engine encendida'],
            causes: [o.causa || 'Componente con desgaste'],
            solutions: [o.solucion || 'Reemplazo o calibración'],
            casesResolved: o.casoResuelto ? 1 : 0,
            casoResuelto: o.casoResuelto === true
          })));
        } else if (mounted) {
          setArticles([]);
        }
      })
      .catch(() => {
        if (mounted) setArticles([]);
      });
    if (isAdmin) {
      apiClient.get('/workshop-flow/obd/propuestas').then((res) => { if (mounted) setProposals(Array.isArray(res) ? res : []); }).catch(() => {});
    }
    return () => { mounted = false; };
  }, []);

  const handleProposeCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiClient.post('/workshop-flow/obd/proponer', {
        codigo: newProposal.codigo,
        sintomas: newProposal.sintomas,
        causas: newProposal.causas,
        solucion: newProposal.solucion
      });
      setMsg('Propuesta enviada. El administrador debe aprobarla para publicarla.');
      setModalOpen(false);
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setMsg(err.details?.message || err.message || 'No se pudo enviar la propuesta.');
    } finally {
      setBusy(false);
    }
  };

  const filteredArticles = articles.filter(a =>
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.system.toLowerCase().includes(search.toLowerCase()) ||
    a.component.toLowerCase().includes(search.toLowerCase()) ||
    a.symptoms.some(s => s.toLowerCase().includes(search.toLowerCase())) ||
    a.causes.some(c => c.toLowerCase().includes(search.toLowerCase()))
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
              <span>Inteligencia Técnica</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-indigo-600 font-semibold">Base de Conocimiento OBD-II (RF-30, RF-31)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Base de Conocimiento Técnico OBD-II
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Catálogo de averías, síntomas probables, causas raíz verificadas, soluciones y casos históricos resueltos en taller.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-semibold text-white shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">post_add</span>
              Proponer Nuevo Código / Caso
            </button>
            <button
              onClick={() => onNavigate?.('diagnosticos')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">biotech</span>
              Diagnóstico en Vivo
            </button>
          </div>
        </div>
      </section>
      {isAdmin && (
        <section className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-3">
          <form className="grid sm:grid-cols-5 gap-2 bg-white border border-slate-200 rounded-xl p-3" onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiClient.post('/workshop-flow/obd', official);
              setOfficial({ codigo: '', sintoma: '', causa: '', solucion: '', componente: '' });
              setMsg('Código oficial publicado.');
            } catch (err) { setMsg(err.details?.message || err.message || 'No se pudo publicar.'); }
          }}>
            {['codigo', 'sintoma', 'causa', 'solucion', 'componente'].map((field) => (
              <input key={field} required={field === 'codigo'} placeholder={field} value={official[field]} onChange={(e) => setOfficial({ ...official, [field]: e.target.value })} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
            ))}
            <button className="sm:col-span-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold" type="submit">Publicar código oficial</button>
          </form>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-2">
            <strong>Propuestas pendientes</strong>
            {proposals.filter((item) => item.estado === 'PENDIENTE').length === 0 && <p>No hay propuestas.</p>}
            {proposals.filter((item) => item.estado === 'PENDIENTE').map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <span>{item.datos?.codigo} · {item.datos?.sintoma}</span>
                <span className="flex gap-2">
                  <button type="button" className="text-emerald-700 font-bold" onClick={() => apiClient.post(`/workshop-flow/obd/propuestas/${item.id}/resolver`, { decision: 'APROBAR' }).then(() => setProposals(proposals.map((row) => row.id === item.id ? { ...row, estado: 'APROBADA' } : row)))}>Aprobar</button>
                  <button type="button" className="text-error font-bold" onClick={() => apiClient.post(`/workshop-flow/obd/propuestas/${item.id}/resolver`, { decision: 'RECHAZAR' }).then(() => setProposals(proposals.map((row) => row.id === item.id ? { ...row, estado: 'RECHAZADA' } : row)))}>Rechazar</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Container */}
      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {msg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            <span>{msg}</span>
          </div>
        )}

        {/* Search Bar (RF-31) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <label className="block text-xs font-bold text-slate-900">
            Buscador Inteligente de Averías OBD (por Código, Síntoma, Sistema o Componente)
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-500 text-xl">search</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Escriba código (ej. P0301, P0420) o síntoma (ej. tironeo, catalizador, ralentí inestable)..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-500 text-[11px] font-semibold">Búsquedas rápidas frecuentes:</span>
            {['P0301', 'P0420', 'P0171', 'P0300', 'Frenos', 'Inyección'].map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setSearch(tag)}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-indigo-600 font-semibold text-[11px] border border-slate-200 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Articles List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
            <span>Se encontraron <strong>{filteredArticles.length}</strong> códigos OBD y casos técnicos</span>
            <span>Base de conocimiento sincronizada</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredArticles.map(art => (
              <div key={art.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-indigo-500 transition-colors space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-lg font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200 shrink-0">
                      {art.code}
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{art.title}</h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                        <span>Sistema: <strong>{art.system}</strong></span>
                        <span>·</span>
                        <span>Componente: <strong>{art.component}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${art.severityColor}`}>
                      Severidad {art.severity}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold">
                      <span className="material-symbols-outlined text-sm">verified</span>
                      {art.casoResuelto ? 'Caso resuelto' : 'Caso abierto'}
                      {!art.casoResuelto && <button type="button" className="ml-2 underline" onClick={() => apiClient.post(`/workshop-flow/obd/${art.id}/caso`, { solucion: art.solutions?.[0] || 'Resuelto en taller' }).then(() => setArticles(articles.map((row) => row.id === art.id ? { ...row, casoResuelto: true, casesResolved: 1 } : row)))}>Marcar resuelto</button>}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Síntomas */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <strong className="block text-slate-900 flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-amber-700 text-base">warning</span>
                      Síntomas Comunes
                    </strong>
                    <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px] leading-relaxed">
                      {art.symptoms.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Causas Raíz */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <strong className="block text-slate-900 flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-indigo-600 text-base">psychology</span>
                      Causas Probables
                    </strong>
                    <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px] leading-relaxed">
                      {art.causes.map((c, idx) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Soluciones Técnicas */}
                  <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-200 space-y-1.5">
                    <strong className="block text-emerald-900 flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-emerald-700 text-base">check_circle</span>
                      Soluciones Verificadas
                    </strong>
                    <ul className="list-disc list-inside space-y-1 text-emerald-800 text-[11px] leading-relaxed">
                      {art.solutions.map((sol, idx) => (
                        <li key={idx}>{sol}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Modal: Propose OBD Code (RF-30) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 font-sans">
            <h3 className="text-base font-bold text-slate-900 mb-1">Proponer Nuevo Código / Caso Resuelto (RF-30)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Comparta la experiencia técnica de diagnóstico del taller para nutrir la base de conocimiento común.
            </p>
            <form onSubmit={handleProposeCode} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-900 mb-1">Código OBD-II</label>
                <input
                  type="text"
                  required
                  value={newProposal.codigo}
                  onChange={e => setNewProposal({ ...newProposal, codigo: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-900 mb-1">Síntomas Detectados</label>
                <input
                  type="text"
                  required
                  value={newProposal.sintomas}
                  onChange={e => setNewProposal({ ...newProposal, sintomas: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-900 mb-1">Causas Identificadas</label>
                <input
                  type="text"
                  required
                  value={newProposal.causas}
                  onChange={e => setNewProposal({ ...newProposal, causas: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-900 mb-1">Solución Técnica Aplicada</label>
                <textarea
                  rows={3}
                  required
                  value={newProposal.solucion}
                  onChange={e => setNewProposal({ ...newProposal, solucion: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-lg"
                />
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
                  {busy ? 'Enviando...' : 'Guardar en Base OBD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
