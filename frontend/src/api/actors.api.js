import { request } from './client';

export const actorsApi = {
  getByProject: (projectId) => request(`/projects/${projectId}/actors`),
  create: (projectId, data) => request(`/projects/${projectId}/actors`, { method: 'POST', body: data }),
  update: (id, data) => request(`/actors/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/actors/${id}`, { method: 'DELETE' })
};
