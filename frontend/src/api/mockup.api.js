import { request } from './client';

export const mockupApi = {
  generateMockup: (projectId, prompt = '', screenIds = [], mode = 'stitch') =>
    request(`/projects/${projectId}/mockup`, {
      method: 'POST',
      body: { prompt, screenIds, mode }
    }),
  generateLocal: (projectId, screenIds = []) =>
    request(`/projects/${projectId}/mockup`, {
      method: 'POST',
      body: { screenIds, mode: 'local' }
    })
};
