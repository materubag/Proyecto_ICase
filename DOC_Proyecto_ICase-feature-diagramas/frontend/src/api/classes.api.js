import { request } from './client';

export const classesApi = {
  getByProject: (projectId) => request(`/projects/${projectId}/classes`),
  create: (projectId, data) => request(`/projects/${projectId}/classes`, { method: 'POST', body: data }),
  generate: (projectId) => request(`/projects/${projectId}/classes/generate`, { method: 'POST' }),
  getDiagram: (projectId) => request(`/projects/${projectId}/classes/diagram`),
  update: (id, data) => request(`/classes/${id}`, { method: 'PUT', body: data }),
  updateStatus: (id, reviewStatus) => request(`/classes/${id}/status`, { method: 'PATCH', body: { reviewStatus } }),
  delete: (id) => request(`/classes/${id}`, { method: 'DELETE' })
};
