import { request } from './client';

export const projectsApi = {
  getAll: () => request('/projects'),
  getById: (id) => request(`/projects/${id}`),
  create: (data) => request('/projects', { method: 'POST', body: data }),
  update: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/projects/${id}`, { method: 'DELETE' })
};
