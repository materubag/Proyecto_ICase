import React, { useState } from 'react';

function roleBadge(role) {
  const value = String(role || '');
  if (/mecanic|t[eé]cnic/i.test(value)) return 'Taller Mecánico';
  if (/recep|operativ/i.test(value)) return 'Taller Operativo';
  if (/client/i.test(value)) return 'Portal Cliente';
  if (/admin/i.test(value)) return 'Administración';
  return value || 'Sesión';
}

export default function AppShell({ title, user, onLogout, children, navItems = [], activeTab, onSelectTab }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const userRole = (user && (user.role || user.rol)) || '';
  const choose = key => { onSelectTab(key); setMenuOpen(false); };
  const links = navItems.filter(item => !item.isEntity).map(item => (
    <button type="button" key={item.key} aria-current={item.key === activeTab ? 'page' : undefined} className={item.key === activeTab ? 'active' : ''} onClick={() => choose(item.key)}>{item.label}</button>
  ));
  return <div className="icase-shell">
    <header className="icase-topbar">
      <div className="icase-brand">
        <span aria-hidden="true">{(title || 'A').charAt(0)}</span>
        <div>
          <strong>{title}</strong>
          <small>{roleBadge(userRole)}</small>
        </div>
      </div>
      <button type="button" className="icase-menu-toggle" aria-label="Abrir navegación" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Menú</button>
      {menuOpen && <button type="button" aria-label="Cerrar navegación" className="icase-nav-overlay" onClick={() => setMenuOpen(false)} />}
      <nav className="icase-topnav" data-open={menuOpen} aria-label="Pantallas del rol">{links}</nav>
      <div className="icase-session">
        <strong>{user?.nombre || user?.username || user?.email || 'Sesión'}</strong>
        <span>{userRole}</span>
        {onLogout && <button type="button" onClick={onLogout}>Cerrar sesión</button>}
      </div>
    </header>
    <main className="icase-content">{children}</main>
  </div>;
}
