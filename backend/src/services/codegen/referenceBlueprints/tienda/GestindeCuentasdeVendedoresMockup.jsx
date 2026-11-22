import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

const INITIAL_VENDORS = [
  { id: 1, nombre: 'Carlos Mendoza', username: 'cmendoza', rol: 'Vendedor', fechaAlta: '14 Oct 2024', activo: true },
  { id: 2, nombre: 'Mariana Soto', username: 'msoto', rol: 'Vendedor', fechaAlta: '28 Sep 2024', activo: true },
  { id: 3, nombre: 'Roberto Gómez', username: 'rgomez', rol: 'Vendedor', fechaAlta: '15 Ago 2024', activo: true },
  { id: 4, nombre: 'Elena Castillo', username: 'ecastillo', rol: 'Vendedor', fechaAlta: '02 Jul 2024', activo: true }
];

export default function GestindeCuentasdeVendedoresMockup() {
  const [vendors, setVendors] = useState(INITIAL_VENDORS);
  const [search, setSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    username: '',
    password: ''
  });
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiClient.get('/vendedores')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && Array.isArray(list) && list.length > 0) {
          const mapped = list.map(v => ({
            id: v.id,
            nombre: v.nombre || v.name || 'Vendedor',
            username: v.username || v.email?.split('@')[0] || `vendedor${v.id}`,
            rol: 'Vendedor',
            fechaAlta: v.fechaAlta || 'Reciente',
            activo: v.activo !== false
          }));
          setVendors(mapped);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim() || !formData.username.trim() || !formData.password.trim()) {
      showToast('Por favor completa todos los campos obligatorios');
      return;
    }

    setBusy(true);
    const newVendor = {
      id: vendors.length ? Math.max(...vendors.map(v => v.id)) + 1 : 1,
      nombre: formData.nombre.trim(),
      username: formData.username.trim().replace(/^@/, ''),
      rol: 'Vendedor',
      fechaAlta: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      activo: true
    };

    try {
      await apiClient.post('/vendedores', newVendor);
    } catch (err) {}

    setVendors(prev => [newVendor, ...prev]);
    setFormData({ nombre: '', username: '', password: '' });
    setBusy(false);
    showToast(`Cuenta de vendedor creada con éxito para @${newVendor.username}`);
  };

  const handleResetPassword = (v) => {
    showToast(`Enlace de restablecimiento generado para @${v.username}`);
  };

  const handleToggleActive = (id) => {
    setVendors(prev => prev.map(v => v.id === id ? { ...v, activo: !v.activo } : v));
    showToast('Estado del vendedor actualizado');
  };

  const filtered = vendors.filter(v => {
    const term = search.toLowerCase();
    return v.nombre.toLowerCase().includes(term) || v.username.toLowerCase().includes(term);
  });

  const activeCount = vendors.filter(v => v.activo).length;

  return (
    <div className="w-full max-w-[1200px] mx-auto pb-12">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
          <span>{toast}</span>
        </div>
      )}

      {/* 1. Ruta / Migas de pan (Exacto Stitch) */}
      <nav className="flex items-center gap-2 mb-4 text-xs text-slate-500 font-medium">
        <span>Inicio</span>
        <span className="text-slate-300">&gt;</span>
        <span>Administración de Usuarios</span>
        <span className="text-slate-300">&gt;</span>
        <span className="text-slate-900 font-semibold">Gestión de Cuentas de Vendedores</span>
      </nav>

      {/* 2. Encabezado principal */}
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Gestión de Cuentas de Vendedores</h1>
        <p className="text-sm text-slate-500 mt-1">Cree nuevas cuentas de acceso para el personal de mostrador y administre los vendedores habilitados con el rol Vendedor.</p>
      </header>

      {/* 3. Indicadores métricos (4 tarjetas Stitch) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="text-[36px] leading-[42px] font-bold text-slate-900">{activeCount}</div>
          <span className="text-xs font-medium text-slate-500 mt-1 block">Vendedores activos</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="text-[36px] leading-[42px] font-bold text-slate-900">2</div>
          <span className="text-xs font-medium text-slate-500 mt-1 block">Nuevas altas este mes</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="text-[36px] leading-[42px] font-bold text-indigo-600">100%</div>
          <span className="text-xs font-medium text-slate-500 mt-1 block">Rol asignado (Vendedor)</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="text-[36px] leading-[42px] font-bold text-slate-900">0</div>
          <span className="text-xs font-medium text-slate-500 mt-1 block">Cuentas bloqueadas</span>
        </div>
      </section>

      {/* 4. Contenido en dos columnas (Stitch) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Formulario de Alta (5 cols) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Nueva cuenta de vendedor</h2>
            <p className="text-xs text-slate-500 mt-1">Complete los datos obligatorios para habilitar el acceso al módulo de ventas.</p>
          </div>

          <form onSubmit={handleCreateVendor} className="space-y-4 text-xs">
            {/* Campo 1: Nombre completo */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nombre completo</label>
              <input
                type="text"
                required
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej. Juan Pérez Morales"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none text-slate-900"
              />
            </div>

            {/* Campo 2: Nombre de usuario único */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nombre de usuario único</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 font-bold select-none">@</span>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  placeholder="ej. jperez"
                  className="w-full h-11 pl-8 pr-3.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none text-slate-900 font-medium"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Se usará para iniciar sesión en caja y ventas</span>
            </div>

            {/* Campo 3: Contraseña inicial */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Contraseña inicial</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title="Mostrar u ocultar contraseña"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                </button>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">El vendedor podrá cambiarla en su primer ingreso</span>
            </div>

            {/* Campo 4: Rol asignado */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Rol asignado</label>
              <div className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold">Vendedor de Mostrador</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                  Asignación fija (RF-02)
                </span>
              </div>
            </div>

            {/* Botón Principal */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                <span>{busy ? 'Creando cuenta...' : 'Crear cuenta de vendedor'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Columna Derecha: Listado de Vendedores (7 cols) */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Vendedores registrados</h2>
            <p className="text-xs text-slate-500 mt-0.5">Cuentas habilitadas con permisos para emitir facturas y ventas de mostrador.</p>
          </div>

          {/* Buscador */}
          <div className="relative w-full mb-4">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o usuario..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-indigo-600 focus:outline-none text-slate-900 text-xs"
            />
          </div>

          {/* Tabla estructurada */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-3.5">Vendedor</th>
                  <th className="py-3 px-3.5">Rol</th>
                  <th className="py-3 px-3.5">Fecha de alta</th>
                  <th className="py-3 px-3.5">Estado</th>
                  <th className="py-3 px-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-3.5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{v.nombre}</span>
                        <span className="text-[11px] text-slate-500 font-mono">@{v.username}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px]">
                        {v.rol}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-600 font-medium">
                      {v.fechaAlta}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        v.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${v.activo ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {v.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleResetPassword(v)}
                          className="font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          Restablecer clave
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(v.id)}
                          className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          {v.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación descriptiva */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Mostrando {filtered.length} de {vendors.length} vendedores registrados</span>
            <div className="flex gap-2">
              <span className="px-2.5 py-1 bg-slate-100 rounded text-slate-600 font-medium">Página 1 de 1</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
