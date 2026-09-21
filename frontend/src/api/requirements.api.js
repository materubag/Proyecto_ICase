import { request } from './client';

export const requirementsApi = {
  getByProject: (projectId) => request(`/projects/${projectId}/requirements`),
  create: (projectId, data) => request(`/projects/${projectId}/requirements`, { method: 'POST', body: data }),
  update: (id, data) => request(`/requirements/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/requirements/${id}`, { method: 'DELETE' })
};
