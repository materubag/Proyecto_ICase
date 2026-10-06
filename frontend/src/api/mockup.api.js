import { request } from './client';

export const mockupApi = {
  list: projectId => request(`/projects/${projectId}/mockup`),
  generateMockup: (projectId, prompt = '', navigationNodeIds) =>
    request(`/projects/${projectId}/mockup`, {
      method: 'POST',
      body: { prompt, navigationNodeIds }
    })
};
