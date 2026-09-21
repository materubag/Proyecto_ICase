import { request } from './client';

export const aiApi = {
  analyzeProject: (projectId, description) =>
    request(`/projects/${projectId}/analyze`, {
      method: 'POST',
      body: { description }
    })
};
