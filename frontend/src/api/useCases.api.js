import { request } from './client';

export const useCasesApi = {
  getByProject: (projectId) => request(`/projects/${projectId}/use-cases`),
  create: (projectId, data) => request(`/projects/${projectId}/use-cases`, { method: 'POST', body: data }),
  generate: (projectId) => request(`/projects/${projectId}/use-cases/generate`, { method: 'POST' }),
  getDiagram: (projectId) => request(`/projects/${projectId}/use-cases/diagram`),
  update: (id, data) => request(`/use-cases/${id}`, { method: 'PUT', body: data }),
  updateStatus: (id, reviewStatus) => request(`/use-cases/${id}/status`, { method: 'PATCH', body: { reviewStatus } }),
  delete: (id) => request(`/use-cases/${id}`, { method: 'DELETE' })
};
