import { request } from './client';

export const historyApi = {
  getByProject: (projectId) => request(`/projects/${projectId}/history`),
  restore: (historyId) => request(`/history/${historyId}/restore`, { method: 'POST' })
};
