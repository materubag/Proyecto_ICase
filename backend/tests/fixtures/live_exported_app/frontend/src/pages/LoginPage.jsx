import React, { useState } from 'react';
import apiClient from '../api/client';

/**
 * Pantalla de Inicio de Sesión según DESIGN_SYSTEM.md (v3.0)
 * Valida credenciales contra el backend (/api/auth/login), guarda el JWT y session info,
 * y propaga errores reales sin admitir suplantación visual de roles.
 */
export default function LoginPage({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/auth/login', {
        identifier,
        password
      });

      const token = response.token || response.data?.token;
      const user = response.user || response.data?.user;

      if (!token) {
        throw new Error('Respuesta inválida del servidor: No se recibió token de sesión.');
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user || {}));

      if (onLoginSuccess) {
        onLoginSuccess(token, user);
      }
    } catch (err) {
      setError(err.details?.message || err.message || 'Error al autenticar credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg-app)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg, 16px)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        padding: '36px 32px'
      }}>
        {/* Cabecera */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-title)', marginBottom: '6px' }}>
            Hospital San Lucas
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Inicio de sesión seguro para usuarios autorizados
          </p>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 14px',
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-danger)',
            fontSize: '0.85rem'
          }}>
            ✗ {error}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-body)', marginBottom: '6px' }}>
              Usuario o Correo Electrónico
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="ej. usuario@ejemplo.com"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '0.875rem',
                color: 'var(--color-text-title)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-body)', marginBottom: '6px' }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '0.875rem',
                color: 'var(--color-text-title)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '44px',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background-color 0.15s ease'
            }}
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Autenticación JWT gestionada por backend Express + Sequelize
        </div>
      </div>
    </div>
  );
}
