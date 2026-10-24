import { request } from './client';

export const filesApi = {
  getByProject: (projectId) => request(`/projects/${projectId}/files`),
  uploadFiles: (projectId, formData) => request(`/projects/${projectId}/files`, {
    method: 'POST',
    body: formData
  }),
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),
  analyzeConsolidated: (projectId) => request(`/projects/${projectId}/analyze-consolidated`, { method: 'POST' })
};
