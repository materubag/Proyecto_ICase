import { request } from './client';

export const entitiesApi = {
  updateStatus: (projectId, entityId, reviewStatus) =>
    request(`/projects/${projectId}/entities/${entityId}/status`, {
      method: 'PATCH',
      body: { reviewStatus }
    }),

  approveAll: (projectId) =>
    request(`/projects/${projectId}/entities/approve-all`, {
      method: 'POST'
    })
};
