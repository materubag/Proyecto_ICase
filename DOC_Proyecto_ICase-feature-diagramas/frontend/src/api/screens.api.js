import { request } from './client';

export const screensApi = {
  getByProject: (projectId) => request(`/projects/${projectId}/screens`),
  toggleSelect: (id, selected) => request(`/screens/${id}/select`, { method: 'PATCH', body: { selected } }),
  selectMultiple: (projectId, screenIds, selected) => request(`/projects/${projectId}/screens/select-multiple`, {
    method: 'POST',
    body: { screenIds, selected }
  }),
  generateSelected: (projectId, screenIds = [], mode = 'stitch', prompt = '') =>
    request(`/projects/${projectId}/screens/generate-selected`, {
      method: 'POST',
      body: { screenIds, mode, prompt }
    }),
  updateStatus: (id, reviewStatus) => request(`/screens/${id}/status`, { method: 'PATCH', body: { reviewStatus } }),
  update: (id, data) => request(`/screens/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/screens/${id}`, { method: 'DELETE' })
};
