const { convertHtmlToJsx } = require('./mockupConverter');
function generateLoginMockup(screen) {
  const inputs = [...screen.html.matchAll(/<input\b[^>]*>/gi)].map(m => m[0]);
  const buttons = [...screen.html.matchAll(/<button\b[^>]*>/gi)].map(m => m[0]);
  const identifier = inputs.findIndex(attrs => /(?:name|id)=["'](?:correo|email|username|identifier|usuario)["']/i.test(attrs));
  const password = inputs.findIndex(attrs => /type=["']password["']/i.test(attrs));
  const submit = buttons.findIndex(attrs => /type=["']submit["']/i.test(attrs));
  if ([identifier, password, submit].some(i => i < 0)) throw new Error('UNRESOLVED_LOGIN_CONTROLS');
  const contract = { renderer: 'task', fields: [{ fieldName: 'identifier', mode: 'editable' }, { fieldName: 'password', mode: 'editable' }],
    actions: [{ actionId: 'login', name: 'Iniciar sesión' }], controlBindings: { input: [{ index: identifier, field: 'identifier' }, { index: password, field: 'password' }], button: [{ index: submit, actionId: 'login' }] } };
  const jsx = convertHtmlToJsx(screen.html, 'LoginPage', screen.route, '', { screenContract: contract });
  return `import React, { useState } from 'react';
import apiClient from '../api/client';
export default function LoginPage({ onLoginSuccess }) {
  const [values, setValues] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [temporarySession, setTemporarySession] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const submit = async event => {
    event?.preventDefault?.();
    if (loading) return;
    setLoading(true); setError('');
    try {
      if (!values.identifier || !values.password) throw new Error('Complete sus credenciales');
      const response = await apiClient.post('/auth/login', values);
      const token = response.token || response.data?.token;
      const user = response.user || response.data?.user;
      if (!token) throw new Error('Respuesta de autenticación inválida');
      localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user || {}));
      if (user?.cambioObligatorio) { setTemporarySession(true); return; }
      onLoginSuccess?.(token, user);
    } catch (error) { setError(error.details?.message || error.message); }
    finally { setLoading(false); }
  };
  const changePassword = async event => {
    event.preventDefault(); if (loading) return;
    setLoading(true); setError('');
    try {
      await apiClient.post('/auth/change-password', { passwordActual: values.password, passwordNueva: newPassword });
      localStorage.removeItem('token'); localStorage.removeItem('user');
      setTemporarySession(false); setValues(old => ({ ...old, password: '' })); setNewPassword('');
      setError('Contraseña actualizada. Inicie sesión con la nueva contraseña.');
    } catch (error) { setError(error.details?.message || error.message); }
    finally { setLoading(false); }
  };
  const slots = { values, setField: (field, value) => setValues(old => ({ ...old, [field]: value })), submit, execute: submit,
    busy: loading, loading: false, rows: [], filter: '', setFilter: () => {}, optionsFor: () => [], labelFor: () => '' };
  if (temporarySession) return <main style={{ maxWidth: 480, margin: '40px auto', padding: 24 }}><h1>Cambiar contraseña temporal</h1><form onSubmit={changePassword}><label>Nueva contraseña<input name="passwordNueva" type="password" autoComplete="new-password" required minLength={12} value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label><button disabled={loading}>Guardar contraseña</button></form>{error && <p role="alert">{error}</p>}</main>;
  return <div className="mockup-screen">{error && <p role="alert">{error}</p>}${jsx}</div>;
}
`;
}
module.exports = { generateLoginMockup };
