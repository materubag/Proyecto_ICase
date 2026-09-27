import { request } from './client';

export const candidatesApi = {
  list: (projectId, filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request(`/projects/${projectId}/candidates${query ? `?${query}` : ''}`);
  },
  getStats: (projectId) => request(`/projects/${projectId}/candidates/stats`),
  get: (candidateId) => request(`/candidates/${candidateId}`),
  update: (candidateId, data) =>
    request(`/candidates/${candidateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
  approve: (candidateId) =>
    request(`/candidates/${candidateId}/approve`, {
      method: 'POST'
    }),
  reject: (candidateId, reason = '') =>
    request(`/candidates/${candidateId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    })
};
