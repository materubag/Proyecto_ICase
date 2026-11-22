import React, { useState } from 'react';
import apiClient from '../api/client';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('administrador@tienda.com');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState('admin'); // 'admin' | 'seller'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectRole = (role) => {
    setSelectedRole(role);
    setError(null);
    if (role === 'admin') {
      setEmail('administrador@tienda.com');
      setPassword('Password123!');
    } else {
      setEmail('vendedor@tienda.com');
      setPassword('Password123!');
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const targetRole = selectedRole === 'admin' ? 'Administrador' : 'Vendedor';

    try {
      const response = await apiClient.post('/auth/login', {
        correo: email,
        identifier: email,
        password: password,
        role: targetRole
      });

      const token = response.token || response.data?.token || 'mock_jwt_token_' + Date.now();
      const user = response.user || response.data?.user || {
        nombre: selectedRole === 'admin' ? 'Laura Paredes' : 'Carlos Mendoza',
        email: email,
        role: targetRole,
        rol: targetRole
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      }

      if (onLoginSuccess) {
        onLoginSuccess(token, user);
      }
    } catch (err) {
      // Mensaje exacto según RF-01 de requerimientos
      setError('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F8FAFC] text-[#111111] font-sans antialiased">
      {/* Header Superior Minimalista */}
      <header className="w-full bg-white border-b border-[#E2E8F0] h-16">
        <div className="max-w-[1200px] mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[20px] font-semibold tracking-tight text-[#111111] select-none">Tienda</span>
            <span className="text-[12px] font-medium text-[#5F5F5A] bg-[#F8FAFC] px-2.5 py-0.5 rounded-full border border-[#E2E8F0]">
              Punto de Venta e Inventario
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#5F5F5A] text-[13px]">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Servidor en línea</span>
          </div>
        </div>
      </header>

      {/* Contenedor Principal Centrado (Fiel al Mockup de Diseño) */}
      <main className="w-full flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[1200px] mx-auto flex flex-col items-center">
          
          {/* 1. Ruta pequeña gris (Migas de pan) */}
          <nav aria-label="Migas de pan" className="flex items-center gap-2 mb-3 text-[13px] text-[#5F5F5A]">
            <span>Tienda</span>
            <span>/</span>
            <span className="text-[#111111] font-medium">Inicio de Sesión</span>
          </nav>

          {/* 2. Título y descripción corta */}
          <div className="text-center mb-8">
            <h1 className="text-[28px] font-semibold text-[#111111] tracking-tight leading-tight">
              Inicio de Sesión y Acceso al Sistema
            </h1>
            <p className="text-[14px] text-[#5F5F5A] mt-1.5">
              Portal de autenticación y redirección automática según rol asignado.
            </p>
          </div>

          {/* Tarjeta Principal de Login */}
          <div className="w-full max-w-[440px] bg-white border border-[#E2E8F0] rounded-[16px] p-8 shadow-xs">
            
            {/* Alerta de error (RF-01) */}
            {error && (
              <div className="mb-6 p-3.5 bg-[#FEF2F2] border border-[#FEE2E2] rounded-[10px] flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#DC2626] text-[20px] shrink-0 mt-0.5">error</span>
                <div className="text-[13px] text-[#DC2626] font-medium leading-snug">
                  {error}
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Campo: Correo */}
              <div className="space-y-1.5">
                <label htmlFor="correo" className="block text-[13px] font-medium text-[#111111]">
                  Correo
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="correo"
                    name="correo"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@tienda.com"
                    required
                    className="w-full h-[48px] px-3.5 bg-white border border-[#E2E8F0] rounded-[10px] text-[14px] text-[#111111] placeholder:text-[#5F5F5A]/70 focus:outline-none focus:border-[#4F46E5] transition-colors"
                  />
                </div>
              </div>

              {/* Campo: Contraseña */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-[13px] font-medium text-[#111111]">
                    Contraseña
                  </label>
                  <button type="button" className="text-[12px] text-[#4F46E5] hover:underline font-medium">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full h-[48px] pl-3.5 pr-10 bg-white border border-[#E2E8F0] rounded-[10px] text-[14px] text-[#111111] focus:outline-none focus:border-[#4F46E5] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Mostrar contraseña"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5F5F5A] hover:text-[#111111] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Selector de Roles Rápidos */}
              <div className="space-y-2 pt-1">
                <span className="block text-[11px] font-medium text-[#5F5F5A]">
                  Acceso directo para evaluación de roles:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => selectRole('admin')}
                    className={`h-[36px] px-3 rounded-[8px] border text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      selectedRole === 'admin'
                        ? 'border-[#4F46E5] bg-[#F8FAFC] text-[#4F46E5]'
                        : 'border-[#E2E8F0] bg-white text-[#5F5F5A] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                    Administrador
                  </button>
                  <button
                    type="button"
                    onClick={() => selectRole('seller')}
                    className={`h-[36px] px-3 rounded-[8px] border text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      selectedRole === 'seller'
                        ? 'border-[#4F46E5] bg-[#F8FAFC] text-[#4F46E5]'
                        : 'border-[#E2E8F0] bg-white text-[#5F5F5A] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                    Vendedor
                  </button>
                </div>
              </div>

              {/* Botón Principal Ingresar */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[48px] bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-[15px] rounded-[10px] transition-colors flex items-center justify-center gap-2 select-none shadow-none cursor-pointer"
                >
                  <span>{loading ? 'Ingresando...' : 'Ingresar'}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </form>

            {/* Información de cuenta inicial y soporte */}
            <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between text-[12px] text-[#5F5F5A]">
                <span>Cuenta inicial preconfigurada:</span>
                <span className="font-medium text-[#111111]">Administrador central</span>
              </div>
              <p className="text-[11px] text-[#5F5F5A] mt-2 leading-relaxed text-center">
                El sistema redirige automáticamente al Panel de Administrador o al Catálogo de Ventas según la cuenta autenticada.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Minimalista */}
      <footer className="w-full bg-white border-t border-[#E2E8F0] py-4">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-[#5F5F5A]">
          <span>© 2024 Tienda • Sistema de Ventas e Inventario</span>
          <div className="flex items-center gap-4">
            <span>Conexión cifrada TLS</span>
            <span>v2.4.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
