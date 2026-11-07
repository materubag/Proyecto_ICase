import React, { useState, useEffect } from 'react';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import RolPage from './pages/RolPage';
import UsuarioPage from './pages/UsuarioPage';
import PacientePage from './pages/PacientePage';


export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [session, setSession] = useState(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      return token ? { token, user: userStr ? JSON.parse(userStr) : null } : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleExpired = () => {
      setSession(null);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSession(null);
  };

  if (!session || !session.token) {
    return <LoginPage onLoginSuccess={(token, user) => setSession({ token, user })} />;
  }

  const allNavItems = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },

    { type: 'section', label: 'Módulos de Datos' },
    { key: 'roles', label: 'Rol', icon: 'dataset' },
    { key: 'usuarios', label: 'Usuario', icon: 'dataset' },
    { key: 'pacientes', label: 'Paciente', icon: 'dataset' }
  ];

  const currentUserRole = (session?.user?.role || session?.user?.rol || null);
  const navItems = allNavItems.filter(item => {
    if (item.type === 'section') return true;
    if (currentUserRole && item.roles && item.roles.length > 0) {
      return item.roles.includes(currentUserRole);
    }
    return true;
  });

  return (
    <AppShell
      title="Hospital San Lucas"
      user={session?.user}
      onLogout={handleLogout}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}

      {activeTab === 'roles' && <RolPage />}
      {activeTab === 'usuarios' && <UsuarioPage />}
      {activeTab === 'pacientes' && <PacientePage />}
    </AppShell>
  );
}
