import { request } from './client';

export const actorsApi = {
  getByProject: (projectId) => request(`/projects/${projectId}/actors`),
  create: (projectId, data) => request(`/projects/${projectId}/actors`, { method: 'POST', body: data }),
  update: (id, data) => request(`/actors/${id}`, { method: 'PUT', body: data }),
  updateStatus: (id, reviewStatus) => request(`/actors/${id}/status`, { method: 'PATCH', body: { reviewStatus } }),
  delete: (id) => request(`/actors/${id}`, { method: 'DELETE' })
};
