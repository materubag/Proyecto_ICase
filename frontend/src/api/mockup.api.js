import { request } from './client';

export const mockupApi = {
  list: projectId => request(`/projects/${projectId}/mockup`),
  generateMockup: (projectId, prompt = '', navigationNodeIds, mode = 'stitch') =>
    request(`/projects/${projectId}/mockup`, {
      method: 'POST',
      body: { prompt, navigationNodeIds, mode }
    }),
  generateLocal: (projectId, navigationNodeIds) =>
    request(`/projects/${projectId}/mockup`, {
      method: 'POST', body: { navigationNodeIds, mode: 'local' }
    })
};
