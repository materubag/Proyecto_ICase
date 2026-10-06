import { request } from './client';

export const aiApi = {
  analyzeProject: (projectId, description, providerOverride, modelOverride) =>
    request(`/projects/${projectId}/analyze`, {
      method: 'POST',
      body: { description, providerOverride, modelOverride }
    })
};
