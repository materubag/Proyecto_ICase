/**
 * HTTP Client wrapper for consistent REST API communication
 */
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const isFormData = options.body instanceof FormData;
  const config = {
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    },
    ...options
  };

  if (config.body && typeof config.body === 'object' && !isFormData) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const raw = await response.text();
  let json;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(response.status === 413 ? 'El archivo supera el límite permitido de 100 MB.' : `El servidor respondió con HTML (HTTP ${response.status}).`);
  }

  if (!response.ok || json.success === false) {
    const message = json.error?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return json.data;
}
