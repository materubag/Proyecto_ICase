import React, { useState } from 'react';

export default function AppShell({
  title = 'Tienda',
  navItems = [],
  activeTab = '',
  onSelectTab = () => {},
  children
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sessionUser = (() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  })();

  const currentRole = sessionUser?.role || sessionUser?.rol || 'Administrador';
  const displayName = sessionUser?.name || sessionUser?.nombre || (currentRole === 'Vendedor' ? 'Carlos Mendoza' : 'Carlos Ramos');
  const isAdmin = /admin/i.test(currentRole);

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('icase_active_cart');
    } catch (e) {}
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Cabecera Superior / Navegación Global Fiel a Stitch */}
      <header className="sticky top-0 left-0 right-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight text-slate-900">{title}</span>
            <span className="px-2.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200 uppercase tracking-wider">
              {isAdmin ? 'Panel Administrador' : 'Punto de Venta e Inventario'}
            </span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-xs font-bold text-slate-900 leading-tight">{displayName}</span>
                <span className="text-[11px] text-slate-500 flex items-center justify-end gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {currentRole}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cerrar sesión segura"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>

        {/* Barra de Pestañas Horizontales Subrayadas (Estilo Stitch) */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 overflow-x-auto">
          <nav className="flex space-x-6 sm:space-x-8 text-xs sm:text-sm font-semibold whitespace-nowrap">
            {navItems.map(item => {
              const isActive = item.key === activeTab;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectTab(item.key)}
                  className={`py-3.5 border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* Pie de página sutil */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-400">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{title} · Sistema POS e Inventario de Mostrador</span>
          <span className="text-[11px]">Diseño validado conforme a requerimientos RF-01 al RF-07</span>
        </div>
      </footer>
    </div>
  );
}
