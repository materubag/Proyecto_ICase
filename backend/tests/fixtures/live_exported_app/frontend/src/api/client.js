/**
 * Cliente HTTP unificado para la API REST de Express + Sequelize
 * Soporta métodos REST estándar (GET, POST, PUT, PATCH, DELETE),
 * inyecta automáticamente el token de autenticación desde localStorage,
 * retorna directamente el payload data y propaga errores estructurados del servidor.
 */

const API_BASE = '/api';

export async function apiRequest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = cleanEndpoint.startsWith('/api') ? cleanEndpoint : `${API_BASE}${cleanEndpoint}`;

  // Obtener token de autenticación de la sesión si existe
  const token = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('token') : null;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    },
    ...options
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.success === false) {
    if (response.status === 401 && (json.code === 'TOKEN_EXPIRED' || json.code === 'UNAUTHENTICATED')) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('token');
        window.localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:expired'));
      }
    }
    const error = new Error(json.message || json.error || `Error HTTP ${response.status}`);
    error.status = response.status;
    error.details = json;
    throw error;
  }

  // Contrato unificado: Retorna directamente json.data
  return json.data !== undefined ? json.data : json;
}

const apiClient = {
  request: apiRequest,
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'DELETE' })
};

export default apiClient;
